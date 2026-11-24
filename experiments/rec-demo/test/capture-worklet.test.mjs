import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { performancePCM } from '../src/timing.mjs';

const source = readFileSync(new URL('../src/capture-worklet.js', import.meta.url), 'utf8');
function processor() {
  const messages = [];
  let Processor;
  const clock = { currentFrame: 0, Float32Array,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: message => messages.push(message) }; } },
    registerProcessor: (_name, implementation) => { Processor = implementation; } };
  runInNewContext(source, clock);
  const instance = new Processor();
  return { messages, stop: frame => instance.port.onmessage({ data: { type: 'stop', frame } }),
    block(frame, available = true) {
      clock.currentFrame = frame;
      return instance.process(available ? [[new Float32Array(128).fill(frame)]] : [[]]);
    } };
}

test('an input gap inside the final packet fails before delayed Stop can conceal it', () => {
  const capture = processor();
  capture.block(0);
  capture.block(128, false);
  for (let frame = 256; frame <= 4096; frame += 128) capture.block(frame);
  capture.stop(4096);
  assert.equal(capture.messages.at(-1).type, 'stopped');
  assert.throws(() => performancePCM(capture.messages.filter(message => message.type === 'samples'), 0, 4096), /missing or overlapping/);
});

test('skipped or overlapping render frames preserve packet timestamps for rejection', () => {
  for (const next of [0, 256]) {
    const capture = processor();
    capture.block(0);
    capture.block(next);
    capture.stop(128);
    assert.throws(() => performancePCM(capture.messages.filter(message => message.type === 'samples'), 0, next + 128), /missing or overlapping/);
  }
});

test('startup gaps before the origin do not invalidate continuous performance audio', () => {
  const capture = processor();
  capture.block(0);
  capture.block(128, false);
  capture.block(256);
  capture.block(384);
  capture.stop(512);
  const pcm = performancePCM(capture.messages.filter(message => message.type === 'samples'), 256, 512);
  assert.equal(pcm.length, 256);
  assert.equal(pcm[0], 256);
  assert.equal(pcm[128], 384);
});

test('initial absent input is allowed and continuous packets retain exact sample frames', () => {
  const capture = processor();
  assert.equal(capture.block(0, false), true);
  for (let frame = 128; frame <= 4352; frame += 128) capture.block(frame);
  capture.stop(4200);
  const pcm = performancePCM(capture.messages.filter(message => message.type === 'samples'), 128, 4200);
  assert.equal(capture.messages.find(message => message.type === 'ready').frame, 128);
  assert.equal(capture.messages.at(-1).type, 'stopped');
  assert.equal(pcm.length, 4072);
  assert.equal(pcm[0], 128);
  assert.equal(pcm[128], 256);
  assert.equal(pcm.at(-1), 4096);
});
