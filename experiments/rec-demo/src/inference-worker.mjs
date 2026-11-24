import * as tf from '@tensorflow/tfjs';
import { BasicPitch } from '@spotify/basic-pitch/esm/inference.js';
import { outputToNotesPoly, noteFramesToTime } from '@spotify/basic-pitch/esm/toMidi.js';
import { noteEvents } from './events.mjs';
import { MODEL_SAMPLE_RATE } from './transcription.mjs';

let model;
const thresholds = { onset: 0.25, frame: 0.25, minNoteLengthFrames: 5 };
const resources = () => performance.getEntriesByType('resource').map(entry => ({
  name: entry.name, durationMs: entry.duration, transferBytes: entry.transferSize,
  decodedBytes: entry.decodedBodySize,
}));

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'initialize') {
      const started = performance.now();
      // Explicit local CPU backend: no OffscreenCanvas/WebGL dependency on iOS.
      await tf.setBackend('cpu');
      await tf.ready();
      model = await tf.loadGraphModel(data.modelURL);
      self.postMessage({ type: 'ready', initializationMs: performance.now() - started,
        backend: tf.getBackend(), tensorflowVersion: tf.version.tfjs, modelMemory: tf.memory(), resources: resources() });
    } else if (data.type === 'infer') {
      if (!model) throw new Error('Prepare the local model before inference.');
      const started = performance.now();
      const pcm = new Float32Array(data.pcm);
      const frames = [], onsets = [];
      // Basic Pitch 1.0.1 retains temporary tensors internally. Scope the full
      // evaluation and terminate this worker after every take, including errors.
      tf.engine().startScope();
      let notes, beforeCleanup;
      try {
        const engine = new BasicPitch(Promise.resolve(model));
        await engine.evaluateModel(pcm, (f, o) => {
          for (const row of f) frames.push(row);
          for (const row of o) onsets.push(row);
          // Contours are intentionally not retained: no piano pitch-bend output.
        }, progress => self.postMessage({ type: 'progress', progress }));
        notes = noteEvents(noteFramesToTime(outputToNotesPoly(frames, onsets,
          thresholds.onset, thresholds.frame, thresholds.minNoteLengthFrames)), pcm.length / MODEL_SAMPLE_RATE);
        beforeCleanup = tf.memory();
      } finally {
        tf.engine().endScope();
      }
      model.dispose();
      model = null;
      self.postMessage({ type: 'result', notes, thresholds, inferenceMs: performance.now() - started,
        tensorMemoryBeforeCleanup: beforeCleanup, tensorMemoryAfterCleanup: tf.memory(),
        resources: resources(),
        memoryCaveat: 'Tensor accounting is not resident or peak device memory; worker terminates after this result.' });
    }
  } catch (error) {
    self.postMessage({ type: 'error', name: error.name, message: error.message });
  }
};
