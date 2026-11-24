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
  }
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
