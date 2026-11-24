export class TapTempo {
  constructor() { this.taps = []; }
  tap(nowMs) {
    if (!Number.isFinite(nowMs)) throw new Error('Tap time must be finite.');
    const last = this.taps.at(-1);
    if (last !== undefined && nowMs <= last) return null;
    if (last !== undefined && nowMs - last > 4000) this.taps = [];
    this.taps.push(nowMs);
    this.taps = this.taps.slice(-7);
    if (this.taps.length < 2) return null;
    const intervals = this.taps.slice(1).map((time, i) => time - this.taps[i]).sort((a, b) => a - b);
    const mid = Math.floor(intervals.length / 2);
    const period = intervals.length % 2 ? intervals[mid] : (intervals[mid - 1] + intervals[mid]) / 2;
    return Math.round(600000 / period) / 10;
  }
}

export function countInTiming(nowSeconds, sampleRate, beats, bpm) {
  if (![2, 3, 4].includes(beats) || !Number.isFinite(bpm) || bpm <= 0) throw new Error('Choose a supported meter and positive tempo.');
  if (!Number.isFinite(nowSeconds) || nowSeconds < 0 || !Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error('Invalid audio clock.');
  const startFrame = Math.ceil((nowSeconds + 0.15) * sampleRate);
  const beatFrames = 60 * sampleRate / bpm;
  const originFrame = startFrame + Math.round(beats * beatFrames);
  return { meter: { beats, beatType: 4 }, tempoBPM: bpm, sampleRate,
    countInStartFrame: startFrame, scoreOriginFrame: originFrame,
    scoreOriginSeconds: originFrame / sampleRate,
    clickFrames: Array.from({ length: beats }, (_, i) => startFrame + Math.round(i * beatFrames)) };
}

export function performancePCM(packets, originFrame, stopFrame) {
  if (!Number.isInteger(originFrame) || !Number.isInteger(stopFrame) || stopFrame <= originFrame) throw new Error('No performance audio after the count-in.');
  const samples = new Float32Array(stopFrame - originFrame);
  let nextFrame = originFrame;
  for (const packet of packets) {
    const start = Math.max(originFrame, packet.frame);
    const end = Math.min(stopFrame, packet.frame + packet.samples.length);
    if (end <= start) continue;
    if (start !== nextFrame) throw new Error('Audio capture has missing or overlapping samples. Please try another take.');
    samples.set(packet.samples.subarray(start - packet.frame, end - packet.frame), start - originFrame);
    nextFrame = end;
  }
  if (nextFrame !== stopFrame) throw new Error('Audio capture ended before the requested Stop time.');
  return samples;
}
