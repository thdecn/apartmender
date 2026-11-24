import test from 'node:test';
import assert from 'node:assert/strict';
import { noteEvents } from '../src/events.mjs';

test('raw events preserve simultaneous tones, unequal lengths and repeated attacks', () => {
  const notes = [
    { pitchMidi: 60, startTimeSeconds: 0.2, durationSeconds: 0.7, amplitude: 0.8 },
    { pitchMidi: 64, startTimeSeconds: 0.2, durationSeconds: 0.3, amplitude: 0.5 },
    { pitchMidi: 60, startTimeSeconds: 1.1, durationSeconds: 0.2, amplitude: 0.7 },
  ];
  const events = noteEvents(notes, 2);
  assert.deepEqual(events.map(event => [event.pitchMidi, event.onsetSeconds]), [[60, 0.2], [64, 0.2], [60, 1.1]]);
  assert.notEqual(events[0].offsetSeconds, events[1].offsetSeconds);
  assert.equal(events[0].estimatedStrength, 0.8);
  assert.equal(notes[0].startTimeSeconds, 0.2);
});

test('invalid events are excluded and padded model tails do not exceed the actual take', () => {
  const events = noteEvents([
    { pitchMidi: 60, startTimeSeconds: -0.01, durationSeconds: 0.5, amplitude: 0.5 },
    { pitchMidi: 64, startTimeSeconds: 0.8, durationSeconds: 2, amplitude: 0.6 },
    { pitchMidi: 67, startTimeSeconds: 1.2, durationSeconds: 1, amplitude: 0.7 },
    { pitchMidi: 72, startTimeSeconds: NaN, durationSeconds: 1, amplitude: 0.5 },
    { pitchMidi: 20, startTimeSeconds: 0, durationSeconds: 1, amplitude: 0.5 },
    { pitchMidi: 60, startTimeSeconds: 0, durationSeconds: 0, amplitude: 0.5 },
  ], 1);
  assert.deepEqual(events.map(event => [event.onsetSeconds, event.offsetSeconds]), [[0, 0.49], [0.8, 1]]);
});
