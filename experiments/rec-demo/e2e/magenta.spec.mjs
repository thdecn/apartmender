import { test, expect } from '@playwright/test';
import { moduleURL } from './release.mjs';

test('Magenta checkpoint runs locally in a disposable CPU worker under the page CSP', async ({ page }, testInfo) => {
  const writes = [], errors = [];
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/apartmender/rec-demo/');
  const result = await page.evaluate(async runtimeURL => {
    const { InferenceWorker } = await import(runtimeURL);
    const worker = new InferenceWorker('magenta');
    try {
      const model = await worker.initialize();
      const pcm = Float32Array.from({ length: 16000 }, (_, i) => i < 3200 ? 0 :
        Math.exp(-(i - 3200) / 4000) * [261.6256, 329.6276, 391.9954].reduce((sum, f) =>
          sum + Math.sin(2 * Math.PI * f * i / 16000) * 0.15, 0));
      const result = await worker.infer(pcm);
      worker.destroy();
      const tinyWorker = new InferenceWorker('magenta');
      try {
        await tinyWorker.initialize();
        return { model, result, tiny: await tinyWorker.infer(new Float32Array(1)) };
      } finally { tinyWorker.destroy(); }
    } finally { worker.destroy(); }
  }, moduleURL('runtime.mjs'));
  expect(result.model.backend).toBe('cpu');
  expect(result.model.tensorflowVersion).toBe('2.8.6');
  expect(result.result.notes.length).toBeGreaterThan(0);
  expect(result.result.notes.every(note => note.onsetSeconds >= 0 && note.offsetSeconds <= 1)).toBe(true);
  expect(result.result.tensorMemoryAfterCleanup.numTensors).toBe(0);
  expect(result.tiny.notes).toEqual([]);
  expect(result.tiny.tensorMemoryAfterCleanup.numTensors).toBe(0);
  expect(errors).toEqual([]); expect(writes).toEqual([]);
  await testInfo.attach('magenta-worker-result', { body: JSON.stringify(result), contentType: 'application/json' });
});

import { readFile } from 'node:fs/promises';
import { syntheticMicrophone } from './synthetic-microphone.mjs';

async function recordTake(page, mode = 'both') {
  await page.goto('/apartmender/rec-demo/');
  await page.getByLabel('Transcription engine').selectOption(mode);
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByLabel('Transcription engine')).toBeDisabled();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'recording');
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop and transcribe' }).click();
}
async function reportDownload(page, testInfo, filename) {
  await page.getByText('Save device observations', { exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download diagnostic report' }).click();
  const file = await event; const output = testInfo.outputPath(filename); await file.saveAs(output);
  return JSON.parse(await readFile(output, 'utf8'));
}

test('one captured take compares both real engines with independently selectable scores and no uploads', async ({ page, context }, testInfo) => {
  const requests = [], errors = [];
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.inferenceInputs = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) { super(url, options); this.engineURL = String(url); }
      postMessage(message, ...rest) {
        if (message.type === 'infer') window.inferenceInputs.push({ engineURL: this.engineURL, pcm: new Float32Array(message.pcm.slice(0)) });
        return super.postMessage(message, ...rest);
      }
    };
  });
  await syntheticMicrophone(page); await recordTake(page);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'complete');
  await expect(page.locator('#engine-outcomes')).toContainText('Spotify Basic Pitch:');
  await expect(page.locator('#engine-outcomes')).toContainText('Magenta Onsets and Frames:');
  await expect(page.getByLabel('View result')).toBeEnabled();
  await page.getByLabel('View result').selectOption('magenta');
  await expect(page.locator('#note-summary')).toContainText('Magenta Onsets and Frames:');
  await expect(page.locator('#score-viewer img')).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download straight-rhythm MusicXML' }).click();
  const scoreDownload = await downloadEvent;
  expect(scoreDownload.suggestedFilename()).toBe('piano-magenta-straight.musicxml');
  const magentaXML = testInfo.outputPath('magenta.musicxml'); await scoreDownload.saveAs(magentaXML);
  const report = await reportDownload(page, testInfo, 'comparison-report.json'), take = report.takes[0];
  expect(report.schemaVersion).toBe(3);
  expect(await page.evaluate(() => window.captureRequests)).toBe(1);
  expect(take.engineMode).toBe('both');
  expect(take.selectedEngine).toBe('magenta');
  const basic = take.engineResults['basic-pitch'], magenta = take.engineResults.magenta;
  expect(basic.status).toBe('complete'); expect(magenta.status).toBe('complete');
  expect(await readFile(magentaXML, 'utf8')).toBe(magenta.score.musicXML);
  expect(take.transcription).toEqual(basic.transcription);
  expect(take.stopToScoreMs).toBeGreaterThanOrEqual(take.stopToEventsMs);
  expect(basic.input).toEqual(magenta.input); expect(basic.input.sha256).toMatch(/^[a-f0-9]{64}$/);
  const sameInput = await page.evaluate(async transcriptionURL => {
    const { resamplePerformance } = await import(transcriptionURL);
    const [basic, magenta] = window.inferenceInputs;
    const expected = await resamplePerformance(basic.pcm, 22050, 16000);
    const digest = await crypto.subtle.digest('SHA-256', basic.pcm);
    return { count: window.inferenceInputs.length, basicURL: basic.engineURL, magentaURL: magenta.engineURL,
      equal: expected.length === magenta.pcm.length && expected.every((sample, i) => Math.abs(sample - magenta.pcm[i]) < 1e-6),
      hash: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
  }, moduleURL('transcription.mjs'));
  expect(sameInput.count).toBe(2); expect(sameInput.basicURL).toMatch(/inference-worker.js$/);
  expect(sameInput.magentaURL).toMatch(/magenta-worker.js$/); expect(sameInput.equal).toBe(true);
  expect(sameInput.hash).toBe(take.input.sha256);

  expect(magenta.modelInput.sampleRate).toBe(16000); expect(basic.modelInput.sampleRate).toBe(22050);
  for (const result of [basic, magenta]) {
    expect(result.transcription.capture).toEqual(basic.transcription.capture);
    expect(result.transcription.durationSeconds).toBe(take.audio.performanceDurationSeconds);
    expect(result.transcription.timeOrigin).toBe('count-in-end');
    expect(result.transcription.notes.length).toBeGreaterThan(0);
    expect(result.score.noteCount).toBe(result.transcription.notes.length);
    expect(result.result.tensorMemoryAfterCleanup.numTensors).toBe(0);
  }
  expect(requests.every(r => new URL(r.url).origin === 'http://127.0.0.1:4178' && r.method === 'GET' && r.body === null)).toBe(true);
  expect(requests.some(r => r.url.includes('/magenta-onsets-frames-uni-q2/group1-shard8of8'))).toBe(true);
  expect(errors).toEqual([]);
  await page.getByLabel('View result').selectOption('basic-pitch');
  await expect(page.locator('#note-summary')).toContainText('Spotify Basic Pitch:');
  await expect(page.locator('#score-viewer img')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('comparison-390px.png'), fullPage: true });
});

test('a Magenta download failure preserves the Basic Pitch result and a repeat take can retry', async ({ page }, testInfo) => {
  await syntheticMicrophone(page);
  await page.route('**/magenta-onsets-frames-uni-q2/weights_manifest.json', route => route.abort());
  await recordTake(page);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'complete');
  await expect(page.locator('#status')).toContainText('One engine failed');
  await expect(page.locator('#engine-outcomes')).toContainText('Magenta Onsets and Frames: failed');
  await expect(page.locator('#score-viewer img')).toBeVisible();
  const report = await reportDownload(page, testInfo, 'partial-report.json');
  expect(report.takes[0].engineResults['basic-pitch'].status).toBe('complete');
  expect(report.takes[0].engineResults.magenta.status).toBe('error');
  await page.unroute('**/magenta-onsets-frames-uni-q2/weights_manifest.json');
  await page.getByLabel('Transcription engine').selectOption('magenta');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('#score-output')).toBeHidden();
  await expect(page.locator('#engine-comparison')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Cancel check' }).click();
});

test('cancelling while Magenta loads releases its worker and cannot overwrite a new take', async ({ page }, testInfo) => {
  await syntheticMicrophone(page);
  let requested, release;
  const loading = new Promise(resolve => { requested = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/magenta-onsets-frames-uni-q2/weights_manifest.json', async route => {
    requested(); await held; await route.continue().catch(() => {});
  });
  await recordTake(page); await loading;
  await page.getByRole('button', { name: 'Cancel check' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#score-viewer img')).toHaveCount(0);
  const report = await reportDownload(page, testInfo, 'cancelled-comparison-report.json');
  const engines = report.takes[0].engineResults;
  expect(engines['basic-pitch'].status).toBe('complete');
  expect(engines['basic-pitch'].transcription.notes.length).toBeGreaterThan(0);
  expect(engines.magenta.status).toBe('cancelled');
  expect(engines.magenta.error).toContain('cancelled');
  expect(Date.parse(engines.magenta.endedAt)).toBeGreaterThan(0);
  await page.getByLabel('Transcription engine').selectOption('basic-pitch');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  release(); await page.waitForTimeout(200);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#engine-comparison')).toBeHidden();
  await expect(page.locator('#score-output')).toBeHidden();
});

test('Magenta transcribes both batching-gap endpoints and their adjacent lengths', async ({ page }, testInfo) => {
  await page.goto('/apartmender/rec-demo/');
  const results = await page.evaluate(async runtimeURL => {
    const { InferenceWorker } = await import(runtimeURL);
    const output = [];
    for (const samples of [34303, 34304, 35327, 35328]) {
      const worker = new InferenceWorker('magenta');
      try {
        await worker.initialize();
        const pcm = Float32Array.from({ length: samples }, (_, i) => i < 3200 ? 0 :
          [261.6256, 329.6276, 391.9954].reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * i / 16000) * 0.08, 0));
        output.push({ samples, result: await worker.infer(pcm) });
      } finally { worker.destroy(); }
    }
    return output;
  }, moduleURL('runtime.mjs'));
  for (const { samples, result } of results) {
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes.every(note => note.onsetSeconds >= 0 && note.offsetSeconds <= samples / 16000)).toBe(true);
    expect(result.tensorMemoryAfterCleanup.numTensors).toBe(0);
  }
  await testInfo.attach('magenta-batching-boundaries', { body: JSON.stringify(results), contentType: 'application/json' });
});

test('a preparation failure is attributed to the engine and a fresh Prepare retries', async ({ page }, testInfo) => {
  await page.route('**/model/model.json', route => route.abort());
  await page.goto('/apartmender/rec-demo/');
  await page.getByLabel('Transcription engine').selectOption('both');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'error');
  const report = await reportDownload(page, testInfo, 'prepare-failure-report.json');
  const basic = report.takes[0].engineResults['basic-pitch'];
  expect(basic.status).toBe('error'); expect(basic.error).toBeTruthy();
  expect(basic.modelSetupPhase).toBe('prepare'); expect(Date.parse(basic.endedAt)).toBeGreaterThan(0);
  await page.unroute('**/model/model.json');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Cancel check' }).click();
});


test('completion guidance follows the selected display after another engine renders successfully', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode; let failNext = true;
    HTMLImageElement.prototype.decode = function () {
      if (failNext) { failNext = false; return Promise.reject(new Error('Synthetic first-score decode failure')); }
      return decode.call(this);
    };
  });
  await syntheticMicrophone(page); await recordTake(page);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'complete');
  await expect(page.locator('#status')).toContainText('selected score could not be displayed');
  await page.getByLabel('View result').selectOption('magenta');
  await expect(page.locator('#score-viewer img')).toBeVisible();
  await expect(page.locator('#status')).toContainText('Both engines finished');
  await expect(page.locator('#status')).not.toContainText('could not be displayed');
});

test('single-engine empty and failed displays give actionable completion guidance', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.emptyInference = true;
    window.Worker = class extends NativeWorker {
      set onmessage(handler) {
        super.onmessage = event => {
          if (event.data.type === 'result' && window.emptyInference) event = { data: { ...event.data, notes: [] } };
          handler(event);
        };
      }
    };
    HTMLImageElement.prototype.decode = () => Promise.reject(new Error('Synthetic score decode failure'));
  });
  await syntheticMicrophone(page); await recordTake(page, 'basic-pitch');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'complete');
  await expect(page.locator('#status')).toContainText('No notes detected');
  await expect(page.locator('#status')).not.toContainText('View the score');
  await page.evaluate(() => { window.emptyInference = false; });
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'recording');
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop and transcribe' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'complete');
  await expect(page.locator('#status')).toContainText('selected score could not be displayed');
  await expect(page.locator('#status')).toContainText('Download its MusicXML or prepare');
  await expect(page.locator('#status')).not.toContainText('another engine');
});
