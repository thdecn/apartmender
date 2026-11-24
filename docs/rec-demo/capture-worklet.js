// PCM frame numbers use the same AudioContext clock as the scheduled count-in.
class PianoCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(4096);
    this.used = 0;
    this.nextFrame = null;
    this.stopFrame = Infinity;
    this.done = false;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'stop') {
        this.stopFrame = data.frame;
        if (this.nextFrame !== null && this.nextFrame >= this.stopFrame) this.finish();
      }
    };
  }
  flush() {
    if (!this.used) return;
    const samples = this.samples.slice(0, this.used);
    this.port.postMessage({ type: 'samples', frame: this.packetFrame, samples }, [samples.buffer]);
    this.used = 0;
  }
  finish() {
    if (this.done) return;
    this.flush();
    this.done = true;
    this.port.postMessage({ type: 'stopped' });
  }
  process(inputs) {
    if (this.done) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    if (this.nextFrame === null) this.port.postMessage({ type: 'ready', frame: currentFrame, channels: channels.length });
    const length = channels[0].length;
    for (let i = 0; i < length && currentFrame + i < this.stopFrame; i++) {
      if (!this.used) this.packetFrame = currentFrame + i;
      let sum = 0;
      for (const channel of channels) sum += channel[i];
      this.samples[this.used++] = sum / channels.length;
      if (this.used === this.samples.length) this.flush();
    }
    this.nextFrame = currentFrame + length;
    if (this.nextFrame >= this.stopFrame) this.finish();
    return !this.done;
  }
}
registerProcessor('piano-capture', PianoCaptureProcessor);
