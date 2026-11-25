import * as tf from '@magenta/music/node_modules/@tensorflow/tfjs';
import { OnsetsAndFrames } from '@magenta/music/esm/transcription/model.js';
import { melSpectrogram, powerToDb } from '@magenta/music/esm/core/audio_utils.js';
import { normalizeNoteEvents } from './events.mjs';
import { MAGENTA_AUDIO, padMagentaInput } from './magenta-input.mjs';

let model;
const resources = () => performance.getEntriesByType('resource').map(entry => ({
  name: entry.name, durationMs: entry.duration, transferBytes: entry.transferSize, decodedBytes: entry.decodedBodySize,
}));
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'initialize') {
      const started = performance.now();
      await tf.setBackend('cpu'); await tf.ready();
      model = new OnsetsAndFrames(data.modelURL, MAGENTA_AUDIO.chunkLength);
      await model.initialize();
      self.postMessage({ type: 'ready', initializationMs: performance.now() - started,
        backend: tf.getBackend(), tensorflowVersion: tf.version.tfjs, modelMemory: tf.memory(), resources: resources() });
    } else if (data.type === 'infer') {
      if (!model?.isInitialized()) throw new Error('Prepare Magenta before inference.');
      const started = performance.now(), pcm = new Float32Array(data.pcm);
      tf.engine().startScope();
      let notes, beforeCleanup;
      try {
        self.postMessage({ type: 'progress', progress: 0.05 });
        const input = padMagentaInput(pcm);
        const { sampleRate, hopLength, nFft } = MAGENTA_AUDIO;
        const spec = powerToDb(melSpectrogram(input, { sampleRate, hopLength, nFft, nMels: 229, fMin: 30 }));
        self.postMessage({ type: 'progress', progress: 0.15 });
        const sequence = await model.transcribeFromMelSpec(spec.map(row => Array.from(row)), 1);
        notes = normalizeNoteEvents(sequence.notes.map(note => ({ pitchMidi: note.pitch,
          onsetSeconds: note.startTime, offsetSeconds: note.endTime })), pcm.length / MAGENTA_AUDIO.sampleRate);
        beforeCleanup = tf.memory();
      } finally { tf.engine().endScope(); model.dispose(); model = null; }
      self.postMessage({ type: 'result', notes, inferenceMs: performance.now() - started,
        thresholds: { onset: 0.5, frame: 0.5, chunkLength: MAGENTA_AUDIO.chunkLength, parallelBatches: 1 },
        tensorMemoryBeforeCleanup: beforeCleanup, tensorMemoryAfterCleanup: tf.memory(), resources: resources(),
        memoryCaveat: 'Tensor accounting is not peak device memory; worker terminates after this result.' });
    }
  } catch (error) { self.postMessage({ type: 'error', name: error.name, message: error.message }); }
};
