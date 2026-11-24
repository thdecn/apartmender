import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStraightScore } from '../src/score.mjs';
import { takeFromTicks, straightExamples } from '../fixtures/straight-scores.mjs';

test('sixteenth quantization retains score-zero silence, exact rational beats and every attack', () => {
  const take = takeFromTicks([[60, 2.1, 2.2], [60, 2.3, 2.4], [64, 7.9, 12.1]]);
  const original = structuredClone(take);
  const score = buildStraightScore(take);
  assert.deepEqual(score.notes.map(note => [note.start, note.end]), [[2, 3], [2, 3], [8, 12]]);
  assert.deepEqual(score.notes[0].onsetQuarters, { numerator: 1, denominator: 2 });
  assert.deepEqual(score.notes[0].durationQuarters, { numerator: 1, denominator: 4 });
  assert.notEqual(score.notes[0].voice, score.notes[1].voice);
  assert.equal(score.noteCount, take.notes.length);
  assert.deepEqual(take, original);
});

test('equal spans form chords while unequal simultaneous lengths use independent voices', () => {
  const score = buildStraightScore(straightExamples[0].take);
  const byPitch = pitch => score.notes.filter(note => note.pitchMidi === pitch);
  assert.equal(byPitch(60)[0].voice, byPitch(64)[0].voice);
  assert.notEqual(byPitch(60)[0].voice, byPitch(67)[0].voice);
  assert.equal(byPitch(48)[0].staff, 2);
  assert.equal(byPitch(60)[0].staff, 1);
  assert.equal(byPitch(72).length, 2);
  assert.match(score.musicXML, /<chord\/>/);
  assert.match(score.musicXML, /<beam number="2">/);
  assert.match(score.musicXML, /<tie type="start"\/>/);
  assert.match(score.musicXML, /<tie type="stop"\/>/);
  assert.match(score.musicXML, /<accidental>natural<\/accidental>/);
});

test('all meters produce whole filled bars including trailing silence and an empty staff', () => {
  for (const example of straightExamples) {
    const score = buildStraightScore(example.take);
    assert.equal(score.measureCount, Math.ceil(example.take.durationSeconds * example.take.tempoBPM / 60 / example.take.meter.beats));
    assert.equal(score.noteCount, example.take.notes.length);
    assert.match(score.musicXML, /<staves>2<\/staves>/);
    assert.match(score.musicXML, new RegExp(`<per-minute>${example.take.tempoBPM}</per-minute>`));
    assert.equal((score.musicXML.match(/<measure number=/g) ?? []).length, score.measureCount);
  }
  assert.match(buildStraightScore(straightExamples[3].take).musicXML, /<rest measure="yes"\/>/);
});

test('invalid events and missing origin metadata fail instead of silently dropping notes', () => {
  const take = takeFromTicks([[60, 0, 4]]);
  assert.throws(() => buildStraightScore({ ...take, timeOrigin: 'first-note' }), /Invalid transcription/);
  assert.throws(() => buildStraightScore({ ...take, notes: [{ ...take.notes[0], pitchMidi: 999 }] }), /Invalid note/);
  assert.throws(() => buildStraightScore({ ...take, notes: [{ ...take.notes[0], offsetSeconds: Infinity }] }), /Invalid note/);
});
