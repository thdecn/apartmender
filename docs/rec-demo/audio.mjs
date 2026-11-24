export const MODEL_SAMPLE_RATE = 22050;

export async function toModelAudio(buffer) {
  if (!buffer.length) throw new Error('The recording contains no decoded audio.');
  const outputLength = Math.ceil(buffer.duration * MODEL_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, outputLength, MODEL_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const mono = await offline.startRendering();
  return mono.getChannelData(0).slice();
}

// A fresh capture owns its recorder, tracks and decoding context. Permission
// requests cannot be cancelled, so late streams are stopped before use.
export class AudioCapture {
  constructor(onInterrupted) {
    this.onInterrupted = onInterrupted;
    this.cancelled = false;
    this.finishing = false;
    this.chunks = [];
  }

  async start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone capture needs HTTPS (or localhost on this computer).');
    }
    if (!window.MediaRecorder) throw new Error('This browser has no MediaRecorder audio capture.');
    try {
      this.context = new AudioContext();
      // Called immediately from the Start gesture, before the permission await.
      await this.context.resume();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 }, echoCancellation: false,
          noiseSuppression: false, autoGainControl: false },
      });
      if (this.cancelled) throw new Error('Recording was cancelled during microphone permission.');
      this.settings = this.stream.getAudioTracks().map(track => {
        const { sampleRate, channelCount, echoCancellation, noiseSuppression, autoGainControl } = track.getSettings();
        track.addEventListener('ended', () => {
          if (!this.finishing && !this.cancelled) this.onInterrupted('Microphone capture was interrupted. Please try a new take.');
        });
        return { sampleRate, channelCount, echoCancellation, noiseSuppression, autoGainControl };
      });
      const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find(type => MediaRecorder.isTypeSupported(type));
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.stopped = new Promise((resolve, reject) => {
        this.recorder.addEventListener('dataavailable', event => {
          if (event.data.size) this.chunks.push(event.data);
        });
        this.recorder.addEventListener('stop', resolve, { once: true });
        this.recorder.addEventListener('error', event => {
          const error = event.error || new Error('The audio recorder failed.');
          reject(error);
          if (!this.finishing && !this.cancelled) this.onInterrupted(error.message);
        }, { once: true });
      });
      // Keep an unsolicited recorder error from becoming an unhandled rejection.
      this.stopped.catch(() => {});
      this.recorder.start();
      this.startedAt = performance.now();
      return { mimeType: this.recorder.mimeType, trackSettings: this.settings,
        audioContextSampleRate: this.context.sampleRate };
    } catch (error) {
      await this.cancel();
      throw error;
    }
  }

  async stop() {
    if (this.cancelled || this.recorder?.state !== 'recording') throw new Error('No active recording to stop.');
    this.finishing = true;
    const stoppedAt = performance.now();
    this.recorder.stop();
    try {
      await this.stopped;
      this.releaseTracks();
      const blob = new Blob(this.chunks, { type: this.recorder.mimeType });
      this.chunks = [];
      if (!blob.size) throw new Error('The microphone produced an empty recording.');
      const decodingStarted = performance.now();
      const decoded = await this.context.decodeAudioData(await blob.arrayBuffer());
      const metadata = { recordedBytes: blob.size, captureWallMs: stoppedAt - this.startedAt,
        decodedSampleRate: decoded.sampleRate, decodedChannels: decoded.numberOfChannels,
        decodedDurationSeconds: decoded.duration };
      const pcm = await toModelAudio(decoded);
      if (this.cancelled) throw new Error('Recording conversion was cancelled.');
      return { pcm, metadata: { ...metadata, modelSampleRate: MODEL_SAMPLE_RATE,
        modelSamples: pcm.length, decodeAndResampleMs: performance.now() - decodingStarted } };
    } finally {
      this.chunks = [];
      this.releaseTracks();
      await this.closeContext();
    }
  }

  releaseTracks() { this.stream?.getTracks().forEach(track => track.stop()); }

  async closeContext() {
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }

  async cancel() {
    this.cancelled = true;
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.releaseTracks();
    await this.closeContext();
    this.chunks = [];
  }
}
