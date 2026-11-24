import * as tf from '@magenta/music/node_modules/@tensorflow/tfjs';
import { OnsetsAndFrames } from '@magenta/music/esm/transcription/model.js';
import { melSpectrogram, powerToDb } from '@magenta/music/esm/core/audio_utils.js';
import { normalizeNoteEvents } from './events.mjs';

let model;
const resources = () => performance.getEntriesByType('resource').map(entry => ({
  name: entry.name, durationMs: entry.duration, transferBytes: entry.transferSize, decodedBytes: entry.decodedBodySize,
}));
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'initialize') {
      const started = performance.now();
      await tf.setBackend('cpu'); await tf.ready();
      model = new OnsetsAndFrames(data.modelURL, 64);
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
        // Reflect padding in upstream FFT needs at least half a window. Append
        // silence for tiny takes without moving zero; clip output to real PCM.
        const input = pcm.length < 1024 ? new Float32Array(1024) : pcm;
        if (input !== pcm) input.set(pcm);
        const spec = powerToDb(melSpectrogram(input, { sampleRate: 16000, hopLength: 512, nMels: 229, nFft: 2048, fMin: 30 }));
        self.postMessage({ type: 'progress', progress: 0.15 });
        const sequence = await model.transcribeFromMelSpec(spec.map(row => Array.from(row)), 1);
        notes = normalizeNoteEvents(sequence.notes.map(note => ({ pitchMidi: note.pitch,
          onsetSeconds: note.startTime, offsetSeconds: note.endTime })), pcm.length / 16000);
        beforeCleanup = tf.memory();
      } finally { tf.engine().endScope(); model.dispose(); model = null; }
      self.postMessage({ type: 'result', notes, inferenceMs: performance.now() - started,
        thresholds: { onset: 0.5, frame: 0.5, chunkLength: 64, parallelBatches: 1 },
        tensorMemoryBeforeCleanup: beforeCleanup, tensorMemoryAfterCleanup: tf.memory(), resources: resources(),
        memoryCaveat: 'Tensor accounting is not peak device memory; worker terminates after this result.' });
    }
  } catch (error) { self.postMessage({ type: 'error', name: error.name, message: error.message }); }
};
