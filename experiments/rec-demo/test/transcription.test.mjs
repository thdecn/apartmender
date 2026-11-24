import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranscription, MODEL_SAMPLE_RATE } from '../src/transcription.mjs';

function audio(rate = 48000) {
  const captureFirstFrame = rate, scoreOriginFrame = rate * 3, stopFrame = rate * 5;
  return { captureSampleRate: rate, captureChannels: 1, performanceDurationSeconds: 2,
    modelSampleRate: MODEL_SAMPLE_RATE, modelSamples: MODEL_SAMPLE_RATE * 2,
    timing: { sampleRate: rate, captureFirstFrame, scoreOriginFrame, stopFrame,
      captureToOriginSeconds: 2, meter: { beats: 4, beatType: 4 }, tempoBPM: 120 } };
}

test('the score handoff preserves chords, independent overlaps, repeated attacks and initial silence', () => {
  const notes = [
    { pitchMidi: 64, onsetSeconds: 0.2, offsetSeconds: 0.5, estimatedStrength: 0.6 },
    { pitchMidi: 60, onsetSeconds: 0.2, offsetSeconds: 1.2, estimatedStrength: 0.8 },
    { pitchMidi: 60, onsetSeconds: 0.9, offsetSeconds: 1.5, estimatedStrength: 0.7 },
  ];
  const original = structuredClone(notes);
  const input = audio();
  const result = createTranscription(notes, input);
  assert.equal(result.timeOrigin, 'count-in-end');
  assert.equal(result.timeUnit, 'seconds');
  assert.equal(result.durationSeconds, 2);
  assert.deepEqual(result.notes.map(note => [note.pitchMidi, note.onsetSeconds, note.offsetSeconds]),
    [[60, 0.2, 1.2], [64, 0.2, 0.5], [60, 0.9, 1.5]]);
  assert.equal(result.notes[0].estimatedStrength, 0.8);
  assert.deepEqual(notes, original);
  result.meter.beats = 3;
  result.notes[0].onsetSeconds = 0;
  assert.equal(input.timing.meter.beats, 4);
  assert.deepEqual(notes, original);
});

test('sample rates and different capture origins retain the same performance-relative event times', () => {
  for (const rate of [44100, 48000]) {
    const input = audio(rate);
    input.timing.captureFirstFrame = 0;
    input.timing.captureToOriginSeconds = 3;
    const result = createTranscription([{ pitchMidi: 60, onsetSeconds: 0.5, offsetSeconds: 1 }], input);
    assert.equal(result.capture.scoreOriginFrame, rate * 3);
    assert.equal(result.capture.captureToOriginSeconds, 3);
    assert.equal(result.notes[0].onsetSeconds, 0.5);
    assert.equal(result.notes[0].offsetSeconds, 1);
    assert.equal('estimatedStrength' in result.notes[0], false);
  }
});

test('invalid events, count-in-only events and resampling tail are excluded without moving later attacks', () => {
  const input = audio();
  input.timing.stopFrame += 1;
  input.performanceDurationSeconds += 1 / 48000;
  input.modelSamples += 1;
  const result = createTranscription([
    null,
    { pitchMidi: 60, onsetSeconds: -1, offsetSeconds: -0.1 },
    { pitchMidi: 60, onsetSeconds: -0.1, offsetSeconds: 0.1 },
    { pitchMidi: 64, onsetSeconds: 0.3, offsetSeconds: 3 },
    { pitchMidi: 65, onsetSeconds: 0.8, offsetSeconds: 0.8 },
    { pitchMidi: 66, onsetSeconds: NaN, offsetSeconds: 1 },
    { pitchMidi: 67, onsetSeconds: 0.8, offsetSeconds: Infinity },
    { pitchMidi: 68, onsetSeconds: 0.8, offsetSeconds: 1, estimatedStrength: NaN },
    { pitchMidi: 109, onsetSeconds: 0.8, offsetSeconds: 1 },
    { pitchMidi: 69, onsetSeconds: input.performanceDurationSeconds + 0.000001, offsetSeconds: 3 },
  ], input);
  assert.equal(result.notes.length, 2);
  assert.deepEqual(result.notes[0], { pitchMidi: 60, onsetSeconds: 0, offsetSeconds: 0.1 });
  assert.equal(result.notes[1].onsetSeconds, 0.3);
  assert.equal(result.notes[1].offsetSeconds, input.performanceDurationSeconds);
});

test('inconsistent origin, sample conversion and tempo metadata fail visibly instead of guessing', () => {
  const changes = [
    input => { input.timing.sampleRate = 44100; },
    input => { input.timing.scoreOriginFrame = -1; },
    input => { input.timing.captureFirstFrame = input.timing.scoreOriginFrame + 1; },
    input => { input.timing.stopFrame = input.timing.scoreOriginFrame; },
    input => { input.timing.captureToOriginSeconds = 0; },
    input => { input.timing.tempoBPM = NaN; },
    input => { input.timing.meter.beatType = 8; },
    input => { input.modelSamples += 1; },
    input => { input.modelSampleRate = 48000; },
    input => { input.performanceDurationSeconds = NaN; },
  ];
  for (const change of changes) {
    const input = audio(); change(input);
    assert.throws(() => createTranscription([], input), /Stopped-take/);
  }
  assert.deepEqual(createTranscription([], audio()).notes, []);
});
