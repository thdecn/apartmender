import { countInTiming, performancePCM } from './timing.mjs';
export const MODEL_SAMPLE_RATE = 22050;

async function toModelAudio(samples, sampleRate) {
  const offline = new OfflineAudioContext(1, Math.ceil(samples.length * MODEL_SAMPLE_RATE / sampleRate), MODEL_SAMPLE_RATE);
  const buffer = offline.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0).slice();
}

export class AudioCapture {
  constructor(onInterrupted) {
    this.onInterrupted = onInterrupted;
    this.cancelled = false;
    this.finishing = false;
    this.packets = [];
    this.clicks = [];
  }

  async start({ beats, bpm }) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture needs HTTPS (or localhost).');
    try {
      this.context = new AudioContext();
      // Activate on the Start gesture before microphone permission is awaited.
      await this.context.resume();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: { ideal: 1 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      } });
      if (this.cancelled) throw new Error('Recording cancelled during microphone permission.');
      if (!this.context.audioWorklet) throw new Error('This browser needs AudioWorklet support for timed piano capture.');
      await this.context.audioWorklet.addModule(new URL('./capture-worklet.js', import.meta.url));
      if (this.cancelled) throw new Error('Recording cancelled during audio setup.');
      const settings = this.stream.getAudioTracks().map(track => {
        const { sampleRate, channelCount, echoCancellation, noiseSuppression, autoGainControl } = track.getSettings();
        track.addEventListener('ended', () => {
          if (!this.finishing && !this.cancelled) this.onInterrupted('Microphone capture was interrupted. Please try a new take.');
        });
        return { sampleRate, channelCount, echoCancellation, noiseSuppression, autoGainControl };
      });
      this.node = new AudioWorkletNode(this.context, 'piano-capture');
      this.node.onprocessorerror = () => {
        const error = new Error('The timed audio capture processor failed. Please try a new take.');
        this.rejectReady?.(error);
        this.rejectStop?.(error);
        if (!this.finishing && !this.cancelled) this.onInterrupted(error.message);
      };
      const ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
      this.node.port.onmessage = ({ data }) => {
        if (this.cancelled) return;
        if (data.type === 'ready') this.resolveReady(data);
        else if (data.type === 'samples') this.packets.push(data);
        else if (data.type === 'stopped') this.resolveStop?.();
      };
      this.source = this.context.createMediaStreamSource(this.stream);
      this.mute = this.context.createGain();
      this.mute.gain.value = 0;
      this.source.connect(this.node).connect(this.mute).connect(this.context.destination);
      this.startupTimeout = setTimeout(() => this.rejectReady(new Error('Microphone audio did not start. Please try again.')), 10000);
      const first = await ready;
      clearTimeout(this.startupTimeout);
      if (this.cancelled) throw new Error('Recording cancelled during audio setup.');
      this.timing = { ...countInTiming(this.context.currentTime, this.context.sampleRate, beats, bpm),
        captureFirstFrame: first.frame, captureStartSeconds: first.frame / this.context.sampleRate,
        inputChannels: first.channels, clock: 'AudioContext sample frames',
        baseLatencySeconds: this.context.baseLatency ?? null, outputLatencySeconds: this.context.outputLatency ?? null,
        latencyCaveat: 'Hardware/acoustic input-output latency is not calibrated.' };
      this.timing.captureToOriginSeconds = (this.timing.scoreOriginFrame - first.frame) / this.context.sampleRate;
      for (const [index, frame] of this.timing.clickFrames.entries()) {
        const at = frame / this.context.sampleRate;
        const duration = Math.min(0.04, 30 / bpm);
        const oscillator = this.context.createOscillator(), gain = this.context.createGain();
        oscillator.frequency.value = index === 0 ? 1200 : 900;
        gain.gain.setValueAtTime(0.18, at);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration * 0.875);
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start(at);
        oscillator.stop(at + duration);
        this.clicks.push(oscillator);
      }
      this.context.onstatechange = () => {
        if (!this.finishing && !this.cancelled && this.context.state !== 'running') this.onInterrupted('Audio was interrupted. Keep this page open and try a new take.');
      };
      return { format: 'timestamped mono float32 PCM', trackSettings: settings,
        audioContextSampleRate: this.context.sampleRate, timing: this.timing };
    } catch (error) { await this.cancel(); throw error; }
  }

  watchClock(onChange) {
    let last;
    const update = () => {
      const now = this.context.currentTime;
      const phase = now >= this.timing.scoreOriginSeconds ? 'recording' : 'countin';
      const beat = Math.max(0, Math.min(this.timing.meter.beats, Math.floor((now - this.timing.countInStartFrame / this.context.sampleRate) * this.timing.tempoBPM / 60) + 1));
      const key = `${phase}:${beat}`;
      if (key !== last) { last = key; onChange({ phase, beat }); }
      if (phase === 'recording') clearInterval(this.clockTimer);
    };
    this.clockTimer = setInterval(update, 25);
    update();
  }

  async stop() {
    if (this.cancelled || !this.timing || this.context.currentTime <= this.timing.scoreOriginSeconds) throw new Error('Wait for the count-in to finish.');
    this.finishing = true;
    clearInterval(this.clockTimer);
    const stopFrame = Math.floor(this.context.currentTime * this.context.sampleRate);
    try {
      const stopped = new Promise((resolve, reject) => { this.resolveStop = resolve; this.rejectStop = reject; });
      this.stopTimeout = setTimeout(() => this.rejectStop(new Error('Audio capture did not finish. Please try again.')), 10000);
      this.node.port.postMessage({ type: 'stop', frame: stopFrame });
      await stopped;
      clearTimeout(this.stopTimeout);
      this.releaseAudio();
      const samples = performancePCM(this.packets, this.timing.scoreOriginFrame, stopFrame);
      this.packets = [];
      const started = performance.now();
      const pcm = await toModelAudio(samples, this.context.sampleRate);
      if (this.cancelled) throw new Error('Recording conversion was cancelled.');
      return { pcm, metadata: { captureSampleRate: this.context.sampleRate, captureChannels: 1,
        performanceDurationSeconds: samples.length / this.context.sampleRate, capturedPCMBytes: samples.byteLength,
        timing: { ...this.timing, stopFrame, discardedCountInFrames: this.timing.scoreOriginFrame - this.timing.captureFirstFrame },
        modelSampleRate: MODEL_SAMPLE_RATE, modelSamples: pcm.length, resampleMs: performance.now() - started } };
    } finally { await this.cancel(); }
  }

  releaseAudio() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.source?.disconnect();
    this.node?.disconnect();
    this.mute?.disconnect();
    this.node?.port.close();
    for (const click of this.clicks) { try { click.stop(); } catch {} click.disconnect(); }
    this.clicks = [];
  }

  async cancel() {
    this.cancelled = true;
    clearTimeout(this.startupTimeout);
    clearTimeout(this.stopTimeout);
    clearInterval(this.clockTimer);
    this.rejectReady?.(new Error('Recording cancelled.'));
    this.rejectStop?.(new Error('Recording cancelled.'));
    this.releaseAudio();
    this.packets = [];
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }
}
