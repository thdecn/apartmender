import { test, expect } from '@playwright/test';
import { moduleURL } from './release.mjs';

test('audio-frame origin survives delayed UI work and excludes pre-origin signal', async ({ page }, testInfo) => {
  await page.goto('/apartmender/rec-demo/');
  await page.evaluate(audioURL => {
    const button = document.createElement('button');
    button.textContent = 'Run clock probe';
    button.onclick = () => {
      window.clockProbe = (async () => {
        const { AudioCapture } = await import(audioURL);
        const capture = new AudioCapture(error => { throw new Error(error); });
        let input;
        const scheduled = [];
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
          getUserMedia: async () => {
            input = capture.context.createMediaStreamDestination();
            const silence = capture.context.createOscillator(), gain = capture.context.createGain();
            gain.gain.value = 0;
            silence.connect(gain).connect(input);
            silence.start();
            const create = capture.context.createOscillator.bind(capture.context);
            capture.context.createOscillator = () => {
              const node = create(), start = node.start.bind(node), stop = node.stop.bind(node);
              const observation = { stops: [] };
              node.start = at => { observation.start = at; observation.frequency = node.frequency.value; start(at); };
              node.stop = at => { observation.stops.push(at ?? capture.context.currentTime); stop(at); };
              scheduled.push(observation);
              return node;
            };
            return input.stream;
          },
        } });
        const meta = await capture.start({ beats: 3, bpm: 120 });
        const context = capture.context;
        const origin = meta.timing.scoreOriginSeconds;
        const sound = (start, end, frequency) => {
          const oscillator = context.createOscillator(), gain = context.createGain();
          oscillator.frequency.value = frequency;
          gain.gain.value = 0.2;
          oscillator.connect(gain).connect(input);
          oscillator.start(start);
          oscillator.stop(end);
        };
        sound(meta.timing.countInStartFrame / context.sampleRate + 0.05, origin - 0.1, 220);
        sound(origin + 0.25, origin + 0.35, 660);
        // Block the UI across the scheduled origin. Audio-thread scheduling and
        // timestamps must continue; no timer callback is allowed to set zero.
        await new Promise(resolve => setTimeout(resolve, 1100));
        const until = performance.now() + 750;
        while (performance.now() < until) {}
        while (context.currentTime < origin + 0.65) await new Promise(resolve => setTimeout(resolve, 20));
        const result = await capture.stop();
        const rms = (start, end) => {
          const samples = result.pcm.slice(Math.round(start * 22050), Math.round(end * 22050));
          return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        };
        const firstSignal = result.pcm.findIndex(value => Math.abs(value) > 0.01) / 22050;
        return { initialSilenceRMS: rms(0, 0.12), toneRMS: rms(0.27, 0.33), firstSignal,
          timing: result.metadata.timing, samples: result.pcm.length,
          clicks: scheduled.filter(node => [900, 1200].includes(node.frequency)), stateAfterStop: context.state };
      })();
    };
    document.body.append(button);
  }, moduleURL('audio.mjs'));
  await page.getByRole('button', { name: 'Run clock probe' }).click();
  const result = await page.evaluate(() => window.clockProbe);
  expect(result.clicks).toHaveLength(3);
  for (const [i, click] of result.clicks.entries()) {
    expect(click.start).toBe(result.timing.clickFrames[i] / result.timing.sampleRate);
    expect(click.stops[0]).toBeLessThan(result.timing.scoreOriginSeconds);
  }
  expect(result.timing.meter).toEqual({ beats: 3, beatType: 4 });
  expect(result.timing.clickFrames.every(frame => frame < result.timing.scoreOriginFrame)).toBe(true);
  expect(result.initialSilenceRMS).toBeLessThan(0.0001);
  expect(result.toneRMS).toBeGreaterThan(0.05);
  expect(result.firstSignal).toBeGreaterThan(0.2);
  expect(result.firstSignal).toBeLessThan(0.35);
  expect(result.samples).toBe(Math.ceil((result.timing.stopFrame - result.timing.scoreOriginFrame) * 22050 / result.timing.sampleRate));
  expect(result.stateAfterStop).toBe('closed');
  await testInfo.attach('audio-clock-probe', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
});

test('a failed capture worklet load is visible and releases the microphone', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    let context;
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        context = this;
        const load = this.audioWorklet.addModule.bind(this.audioWorklet);
        // Worklet fetches are not intercepted by page.route in every engine.
        // Use the real loader with a missing static module to cause a real 404.
        Object.defineProperty(this, 'audioWorklet', { value: {
          addModule: url => load(new URL('./missing-capture-worklet.js', url)),
        } });
      }
    };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => {
        const stream = context.createMediaStreamDestination().stream;
        window.capturedTracks = stream.getTracks();
        return stream;
      },
    } });
  });
  await page.goto('/apartmender/rec-demo/');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => window.capturedTracks.every(track => track.readyState === 'ended'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Prepare local engines' })).toBeEnabled();
});

test('meter and tempo freeze; cancellation and missing input stop the take', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    let context;
    window.AudioContext = class extends NativeContext {
      constructor(...args) { super(...args); context = this; }
      createMediaStreamSource(stream) {
        window.captureSource = super.createMediaStreamSource(stream);
        const connect = window.captureSource.connect.bind(window.captureSource);
        window.captureSource.connect = destination => { window.captureSink = destination; return connect(destination); };
        return window.captureSource;
      }
    };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => {
        const destination = context.createMediaStreamDestination();
        const source = context.createOscillator(), gain = context.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(destination);
        source.start();
        window.capturedTracks = destination.stream.getTracks();
        return destination.stream;
      },
    } });
  });
  await page.goto('/apartmender/rec-demo/');
  await expect(page.getByLabel('Time signature')).toHaveValue('4');
  await page.getByLabel('Time signature').selectOption('2');
  await page.getByRole('button', { name: 'Tap tempo' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Tap tempo' }).click();
  const tempo = Number((await page.locator('#tempo').textContent()).match(/[\d.]+/)[0]);
  expect(tempo).toBeGreaterThan(90);
  expect(tempo).toBeLessThan(150);
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'countin');
  await expect(page.getByLabel('Time signature')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tap tempo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Stop and transcribe' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel check' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.getByLabel('Time signature')).toBeEnabled();
  await page.waitForTimeout(1200);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#results')).toBeHidden();
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'recording');
  // Real worklet receives an empty input after its source is disconnected.
  await page.evaluate(() => window.captureSource.disconnect());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.captureSource.connect(window.captureSink));
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Stop and transcribe' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('alert')).toContainText('missing or overlapping samples');
  expect(await page.evaluate(() => window.capturedTracks.every(track => track.readyState === 'ended'))).toBe(true);
  await expect(page.locator('#results')).toBeHidden();
});
