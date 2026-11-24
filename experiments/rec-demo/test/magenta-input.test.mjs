import test from 'node:test';
import assert from 'node:assert/strict';
import { padMagentaInput } from '../src/magenta-input.mjs';

test('batching gap endpoints append silence without changing captured PCM', () => {
  for (const length of [34304, 35327]) {
    const original = Float32Array.from({ length }, (_, i) => Math.sin(i / 13));
    const padded = padMagentaInput(original);
    assert.equal(padded.length, 35328);
    assert.deepEqual(padded.subarray(0, length), original);
    assert.ok(padded.subarray(length).every(sample => sample === 0));
    assert.equal(original.length, length);
  }
});

test('tiny takes get FFT padding; ordinary and adjacent lengths avoid a copy', () => {
  const tiny = Float32Array.of(0.25);
  const padded = padMagentaInput(tiny);
  assert.equal(padded.length, 1024); assert.equal(padded[0], 0.25);
  assert.ok(padded.subarray(1).every(sample => sample === 0));
  for (const length of [1024, 16000, 34303, 35328, 65536]) {
    const pcm = new Float32Array(length);
    assert.equal(padMagentaInput(pcm), pcm);
  }
});
