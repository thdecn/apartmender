export async function syntheticMicrophone(page) {
  await page.addInitScript(() => {
    window.testAudioContexts = []; window.captureRequests = 0;
    const getUserMedia = async () => {
      window.captureRequests++;
      const context = new AudioContext();
      await context.resume();
      window.testAudioContexts.push(context);
      const destination = context.createMediaStreamDestination();
      for (const start of [0.08, 1.1, 2.2, 3.3, 4.4, 5.5, 6.6]) {
        for (const frequency of [261.6256, 329.6276, 391.9954]) {
          for (let partial = 1; partial <= 4; partial++) {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = frequency * partial;
            gain.gain.setValueAtTime(0, context.currentTime + start);
            gain.gain.linearRampToValueAtTime(0.09 / partial, context.currentTime + start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + 0.75);
            oscillator.connect(gain).connect(destination);
            oscillator.start(context.currentTime + start);
            oscillator.stop(context.currentTime + start + 0.8);
          }
        }
      }
      const track = destination.stream.getAudioTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => { stop(); if (context.state !== 'closed') void context.close(); };
      return destination.stream;
    };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  });
}
