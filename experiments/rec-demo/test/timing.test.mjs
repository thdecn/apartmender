import test from 'node:test';
import assert from 'node:assert/strict';
import { TapTempo, countInTiming, performancePCM } from '../src/timing.mjs';

test('tap tempo uses recent intervals, tolerates an outlier and resets after a pause', () => {
  const tempo = new TapTempo();
  assert.equal(tempo.tap(1000), null);
  assert.equal(tempo.tap(1500), 120);
  assert.equal(tempo.tap(2000), 120);
  tempo.tap(2700);
  assert.equal(tempo.tap(3200), 120);
  assert.equal(tempo.tap(3200), null);
  assert.equal(tempo.tap(8000), null);
  assert.equal(tempo.tap(9000), 60);
});

test('all meter options schedule one bar on sample boundaries with no click at score zero', () => {
  for (const beats of [2, 3, 4]) {
    for (const rate of [44100, 48000]) {
      const plan = countInTiming(0.73, rate, beats, 137);
      assert.equal(plan.clickFrames.length, beats);
      assert.equal(plan.scoreOriginFrame - plan.countInStartFrame, Math.round(beats * 60 * rate / 137));
      assert.ok(plan.clickFrames.every(frame => Number.isInteger(frame) && frame < plan.scoreOriginFrame));
      assert.equal(plan.scoreOriginSeconds, plan.scoreOriginFrame / rate);
    }
  }
});

test('PCM trimming removes count-in, preserves initial silence and ignores packet delivery boundaries', () => {
  const data = new Float32Array([1, 1, 1, 0, 0, 0.5, 0.5, 0, 0]);
  const single = performancePCM([{ frame: 100, samples: data }], 103, 108);
  const split = performancePCM([{ frame: 100, samples: data.slice(0, 4) }, { frame: 104, samples: data.slice(4) }], 103, 108);
  assert.deepEqual([...single], [0, 0, 0.5, 0.5, 0]);
  assert.deepEqual(split, single);
  assert.throws(() => performancePCM([{ frame: 104, samples: data }], 103, 108), /missing/);
  assert.throws(() => performancePCM([{ frame: 103, samples: data.slice(0, 2) }], 103, 108), /ended/);
});
