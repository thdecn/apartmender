import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// These checks use a generated Web Audio stream, not a real microphone or piano.
// The browser still performs actual timestamped AudioWorklet capture/resampling,
// real Basic Pitch inference and real Verovio WASM initialization.
async function syntheticMicrophone(page) {
  await page.addInitScript(() => {
    window.testAudioContexts = [];
    const getUserMedia = async () => {
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

test('two takes use real browser audio, local inference and Verovio; no outbound writes', async ({ page, context }, testInfo) => {
  const requests = [], errors = [];
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
  page.on('pageerror', error => errors.push(error.message));
  await syntheticMicrophone(page);
  await page.goto('/apartmender/rec-demo/');
  for (let run = 0; run < 2; run++) {
    await page.getByRole('button', { name: 'Prepare local engines' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.locator('body')).toHaveAttribute('data-state', 'countin');
    await expect(page.locator('#meter')).toBeDisabled();
    await expect(page.locator('#tap')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Stop and transcribe' })).toBeDisabled();
    await expect(page.locator('body')).toHaveAttribute('data-state', 'recording');
    await page.waitForTimeout(2250); // Actual recorded sound must elapse.
    await page.getByRole('button', { name: 'Stop and transcribe' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-state', 'complete');
    await expect(page.locator('#notes tr').first()).toBeVisible();
    expect(await page.evaluate(() => window.testAudioContexts.every(context => context.state === 'closed'))).toBe(true);
  }
  const scoreDownloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download straight-rhythm MusicXML' }).click();
  const scoreDownload = await scoreDownloadEvent;
  const scorePath = testInfo.outputPath('captured-straight.musicxml');
  await scoreDownload.saveAs(scorePath);
  await page.getByText('Save device observations', { exact: true }).click();
  await page.getByLabel('Device model').fill('AUTOMATED DESKTOP — synthetic Web Audio stream');
  await page.getByLabel('iOS and Safari version').fill(`Playwright ${testInfo.project.name}; not physical iPhone evidence`);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download diagnostic report' }).click();
  const download = await downloadEvent;
  const reportPath = testInfo.outputPath('desktop-synthetic-report.json');
  await download.saveAs(reportPath);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  expect(report.takes).toHaveLength(2);
  for (const take of report.takes) {
    expect(take.status).toBe('complete');
    expect(take.verovio.version).toMatch(/^6\.3\.0/);
    expect(take.verovio.reused).toBe(take.number === 2);
    expect(take.model.backend).toBe('cpu');
    expect(take.audio.performanceDurationSeconds).toBeGreaterThan(1.5);
    expect(take.audio.modelSampleRate).toBe(22050);
    expect(take.audio.timing.meter).toEqual({ beats: 4, beatType: 4 });
    expect(take.audio.timing.tempoBPM).toBe(120);
    expect(take.audio.timing.clickFrames).toHaveLength(4);
    expect(take.audio.timing.scoreOriginFrame).toBe(take.audio.timing.countInStartFrame + 2 * take.audio.captureSampleRate);
    expect(take.result.notes.length).toBeGreaterThan(1);
    expect(take.result.notes.some((note, i, all) => all.slice(i + 1).some(other =>
      other.pitchMidi !== note.pitchMidi && other.onsetSeconds < note.offsetSeconds && other.offsetSeconds > note.onsetSeconds))).toBe(true);
    expect(take.result.tensorMemoryAfterCleanup.numTensors).toBe(0);
    expect(take.transcription.timeOrigin).toBe('count-in-end');
    expect(take.transcription.capture.scoreOriginFrame).toBe(take.audio.timing.scoreOriginFrame);
    expect(take.transcription.meter).toEqual(take.audio.timing.meter);
    expect(take.transcription.tempoBPM).toBe(take.audio.timing.tempoBPM);
    expect(take.transcription.durationSeconds).toBe(take.audio.performanceDurationSeconds);
    expect(take.transcription.notes.length).toBeGreaterThan(1);
    expect(take.score.rhythm).toBe('straight');
    expect(take.score.noteCount).toBe(take.transcription.notes.length);
    expect(take.score.musicXML).toContain('<score-partwise');
    expect(take.transcription.notes.every(note => Number.isFinite(note.onsetSeconds)
      && note.onsetSeconds >= 0 && note.offsetSeconds > note.onsetSeconds
      && note.offsetSeconds <= take.transcription.durationSeconds)).toBe(true);
  }
  expect(await readFile(scorePath, 'utf8')).toBe(report.takes.at(-1).score.musicXML);
  expect(requests.every(request => new URL(request.url).origin === 'http://127.0.0.1:4178'
    && request.method === 'GET' && request.body === null)).toBe(true);
  expect(requests.some(request => request.url.endsWith('/model/model.json'))).toBe(true);
  expect(requests.some(request => request.url.endsWith('/model/group1-shard1of1.bin'))).toBe(true);
  expect(requests.some(request => request.url.endsWith('/vendor/verovio/verovio-module.mjs'))).toBe(true);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('result-390px.png'), fullPage: true });
  await testInfo.attach('request-audit', { body: JSON.stringify(requests, null, 2), contentType: 'application/json' });
});

test('44.1 and 48 kHz conversion preserve performance silence and onset time', async ({ page }) => {
  await page.goto('/apartmender/rec-demo/');
  const results = await page.evaluate(async () => {
    const { resamplePerformance, MODEL_SAMPLE_RATE } = await import('./transcription.mjs');
    const output = [];
    for (const rate of [44100, 48000]) {
      const samples = new Float32Array(rate);
      for (let i = Math.round(rate * 0.25); i < rate * 0.5; i++) samples[i] = 0.2 * Math.sin(2 * Math.PI * 440 * i / rate);
      const converted = await resamplePerformance(samples, rate);
      output.push({ rate, length: converted.length, outputRate: MODEL_SAMPLE_RATE,
        firstSignalSeconds: converted.findIndex(sample => Math.abs(sample) > 0.01) / MODEL_SAMPLE_RATE,
        initialSilence: converted.slice(0, Math.round(MODEL_SAMPLE_RATE * 0.2)).every(sample => Math.abs(sample) < 0.0001) });
    }
    return output;
  });
  for (const result of results) {
    expect(result.length).toBe(result.outputRate);
    expect(result.initialSilence).toBe(true);
    expect(result.firstSignalSeconds).toBeGreaterThan(0.245);
    expect(result.firstSignalSeconds).toBeLessThan(0.255);
  }
});

test('cancelled inference cannot display its queued result or progress over a new take', async ({ page }) => {
  await syntheticMicrophone(page);
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      set onmessage(handler) {
        super.onmessage = event => {
          if (event.data.type !== 'result') { handler(event); return; }
          window.queuedInferenceResult = true;
          // Deliberately deliver callbacks even after terminate to exercise
          // the app's generation guard rather than relying on Worker cleanup.
          window.deliverStaleInference = () => {
            handler({ data: { type: 'progress', progress: 0.99 } });
            handler(event);
          };
        };
      }
    };
  });
  await page.goto('/apartmender/rec-demo/');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'recording');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Stop and transcribe' }).click();
  await page.waitForFunction(() => window.queuedInferenceResult);
  await page.getByRole('button', { name: 'Cancel check' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.evaluate(() => window.deliverStaleInference());
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#status')).toContainText('Local engines ready');
  await expect(page.locator('#results')).toBeHidden();
});

test('model download failure is visible and never falls back to a service', async ({ page, context }) => {
  const writes = [];
  context.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await context.route('**/model/model.json', route => route.abort());
  await page.goto('/apartmender/rec-demo/');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
});

test('Prepare retries a failed manifest request and reuses a successful result', async ({ page }) => {
  let requests = 0;
  await page.route('**/asset-manifest.json', route => {
    requests++;
    return requests === 1 ? route.abort('failed') : route.continue();
  });
  await page.goto('/apartmender/rec-demo/');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(requests).toBe(1);

  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
  await expect(page.getByRole('alert')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
  expect(requests).toBe(2);

  await page.getByRole('button', { name: 'Cancel check' }).click();
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
  expect(requests).toBe(2);
});

test('permission denial and cancellation release state without displaying a stale result', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => { throw new DOMException('Test permission denied', 'NotAllowedError'); },
    } });
  });
  await page.goto('/apartmender/rec-demo/');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Test permission denied');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Cancel check' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Prepare local engines' })).toBeEnabled();
});
