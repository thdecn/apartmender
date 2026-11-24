import { normalizeNoteEvents } from './events.mjs';

export const MODEL_SAMPLE_RATE = 22050;

// PCM has already been trimmed on the capture clock. Resampling must not
// normalize its first attack to zero or remove initial performance silence.
export async function resamplePerformance(samples, sampleRate) {
  if (!(samples instanceof Float32Array) || !samples.length || !Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new Error('Invalid captured PCM.');
  }
  const offline = new OfflineAudioContext(1, Math.ceil(samples.length * MODEL_SAMPLE_RATE / sampleRate), MODEL_SAMPLE_RATE);
  const buffer = offline.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0).slice();
}

// Engine-neutral handoff for the subsequent score builder. Engine diagnostics
// remain in take.result; this contract contains musical input and its origin.
export function createTranscription(notes, audio) {
  const timing = audio?.timing;
  const rate = audio?.captureSampleRate;
  const frame = value => Number.isInteger(value) && value >= 0;
  if (!timing || !Number.isInteger(rate) || rate <= 0 || timing.sampleRate !== rate
    || !frame(timing.captureFirstFrame) || !frame(timing.scoreOriginFrame) || !frame(timing.stopFrame)
    || timing.captureFirstFrame > timing.scoreOriginFrame || timing.stopFrame <= timing.scoreOriginFrame
    || ![2, 3, 4].includes(timing.meter?.beats) || timing.meter.beatType !== 4
    || !Number.isFinite(timing.tempoBPM) || timing.tempoBPM <= 0) {
    throw new Error('Stopped-take timing metadata is invalid.');
  }
  const durationSeconds = (timing.stopFrame - timing.scoreOriginFrame) / rate;
  const captureToOriginSeconds = (timing.scoreOriginFrame - timing.captureFirstFrame) / rate;
  if (Math.abs(audio.performanceDurationSeconds - durationSeconds) > 1e-9
    || !Number.isFinite(audio.performanceDurationSeconds)
    || !Number.isFinite(timing.captureToOriginSeconds)
    || Math.abs(timing.captureToOriginSeconds - captureToOriginSeconds) > 1e-9
    || audio.captureChannels !== 1 || audio.modelSampleRate !== MODEL_SAMPLE_RATE
    || audio.modelSamples !== Math.ceil((timing.stopFrame - timing.scoreOriginFrame) * MODEL_SAMPLE_RATE / rate)) {
    throw new Error('Stopped-take sample conversion does not match the saved origin.');
  }
  return { schemaVersion: 1, timeUnit: 'seconds', timeOrigin: 'count-in-end', durationSeconds,
    meter: { beats: timing.meter.beats, beatType: timing.meter.beatType }, tempoBPM: timing.tempoBPM,
    capture: { sampleRate: rate, firstFrame: timing.captureFirstFrame,
      scoreOriginFrame: timing.scoreOriginFrame, stopFrame: timing.stopFrame, captureToOriginSeconds },
    notes: normalizeNoteEvents(notes, durationSeconds) };
}
