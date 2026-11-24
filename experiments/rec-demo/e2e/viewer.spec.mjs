import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { viewerScore } from '../fixtures/viewer-score.mjs';
import { moduleURL } from './release.mjs';

async function probe(page) {
  await page.addInitScript(() => {
    window.scoreURLs = new Set(); window.scoreBlobs = new Map(); window.cspFailures = [];
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      const url = create(blob); window.scoreURLs.add(url); window.scoreBlobs.set(url, blob.text()); return url;
    };
    URL.revokeObjectURL = url => { window.scoreURLs.delete(url); revoke(url); };
    document.addEventListener('securitypolicyviolation', event => window.cspFailures.push({ directive: event.violatedDirective,
      source: event.sourceFile, blocked: event.blockedURI, line: event.lineNumber, sample: event.sample }));
  });
  await page.goto('/apartmender/rec-demo/');
  await page.evaluate(async viewerURL => {
    const { createScoreViewer } = await import(viewerURL);
    const { VerovioToolkit } = await import('../vendor/verovio/verovio.mjs');
    window.destroyedToolkits = 0;
    const destroy = VerovioToolkit.prototype.destroy;
    VerovioToolkit.prototype.destroy = function () { window.destroyedToolkits++; return destroy.call(this); };
    const host = document.createElement('section'); host.id = 'viewer-probe'; document.querySelector('main').append(host);
    window.viewer = createScoreViewer(host);
  }, moduleURL('score-viewer.mjs'));
  return page.locator('#viewer-probe');
}

test('complete multipage piano score navigates and zooms under the real CSP, including tuplets', async ({ page }, testInfo) => {
  const host = await probe(page);
  const result = await page.evaluate(xml => window.viewer.render({ musicXML: xml, noteCount: 512 }), viewerScore());
  expect(result.outcome).toBe('rendered'); expect(result.pageCount).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.cspFailures)).toEqual([]);
  await expect(host.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  const pages = [];
  for (let pageNumber = 1; pageNumber <= result.pageCount; pageNumber++) {
    await expect(host.getByText(`Page ${pageNumber} of ${result.pageCount}`, { exact: true })).toBeVisible();
    pages.push(await page.evaluate(async () => {
      const image = document.querySelector('#viewer-probe img');
      const svg = await window.scoreBlobs.get(image.src);
      // Inspect a style-free detached clone, leaving the actual image intact.
      // Chromium evaluates style elements even in DOMParser inspection docs.
      const styles = svg.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) ?? [];
      const documentXML = new DOMParser().parseFromString(svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ''), 'image/svg+xml');
      return { headIds: [...documentXML.querySelectorAll('g.note[id]')].map(note => note.id).filter(id => /^vp-m\d+-head$/.test(id)),
        staves: documentXML.querySelectorAll('g.staff').length, tuplets: documentXML.querySelectorAll('g.tuplet').length,
        svgStyles: styles.length, width: image.naturalWidth, height: image.naturalHeight };
    }));
    if (pageNumber < result.pageCount) await host.getByRole('button', { name: 'Next page' }).click();
  }
  expect(new Set(pages.flatMap(page => page.headIds)).size).toBe(64);
  expect(pages.every(page => page.staves >= 2 && page.tuplets > 0 && page.svgStyles > 0 && page.width > 0 && page.height > 0)).toBe(true);
  await expect(host.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await host.getByRole('button', { name: 'Previous page' }).click();
  await expect(host.getByText(`Page ${result.pageCount - 1} of ${result.pageCount}`, { exact: true })).toBeVisible();
  await host.getByLabel('Score zoom').selectOption('200');
  const geometry = await host.locator('.score-page-viewport').evaluate(viewport => ({
    width: viewport.clientWidth, imageWidth: viewport.querySelector('img').getBoundingClientRect().width,
    scrollWidth: viewport.scrollWidth, scrollHeight: viewport.scrollHeight, height: viewport.clientHeight,
    documentFits: document.documentElement.scrollWidth <= innerWidth,
  }));
  expect(geometry.imageWidth).toBeGreaterThan(geometry.width * 1.9);
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.width);
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.height);
  expect(geometry.documentFits).toBe(true);
  const panned = await host.locator('.score-page-viewport').evaluate(viewport => {
    viewport.scrollLeft = viewport.scrollWidth; viewport.scrollTop = viewport.scrollHeight;
    return { left: viewport.scrollLeft, top: viewport.scrollTop };
  });
  expect(panned.left).toBeGreaterThan(0); expect(panned.top).toBeGreaterThan(0);
  await host.locator('.score-page-viewport').evaluate(viewport => { viewport.scrollLeft = viewport.scrollTop = 0; });
  await host.getByLabel('Score zoom').selectOption('100');
  expect(await page.evaluate(() => window.scoreURLs.size)).toBe(1);
  expect(await page.evaluate(() => window.cspFailures)).toEqual([]);
  await host.screenshot({ path: testInfo.outputPath('viewer-fit-390px.png') });
  await host.getByLabel('Score zoom').selectOption('200');
  await host.screenshot({ path: testInfo.outputPath('viewer-zoom-390px.png') });
  const summary = { ...result, sourceMeasures: 64, pages, geometry, cspFailures: [], livePageURLs: 1 };
  await writeFile(testInfo.outputPath('viewer-summary.json'), JSON.stringify(summary, null, 2));
  await page.evaluate(() => window.viewer.destroy());
  expect(await page.evaluate(() => window.scoreURLs.size)).toBe(0);
});

test('empty/import/decode errors and superseded renders clear scores and release resources', async ({ page }) => {
  const host = await probe(page), xml = viewerScore(2);
  const render = () => page.evaluate(xml => window.viewer.render({ musicXML: xml, noteCount: 16 }), xml);
  expect((await render()).outcome).toBe('rendered');
  const baseline = await page.evaluate(() => window.destroyedToolkits);
  expect((await page.evaluate(() => window.viewer.render({ musicXML: '', noteCount: 0 }))).outcome).toBe('empty');
  await expect(host).toContainText('No notes detected'); await expect(host.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.destroyedToolkits)).toBe(baseline + 1);
  expect(await page.evaluate(() => window.scoreURLs.size)).toBe(0);
  expect((await render()).outcome).toBe('rendered');
  const failed = await page.evaluate(() => window.viewer.render({ musicXML: '<score-partwise><part-list/></score-partwise>', noteCount: 1 }));
  expect(failed.outcome).toBe('error'); await expect(host.getByRole('alert')).toContainText('Unable to display');
  await expect(host.locator('img')).toHaveCount(0); expect(await page.evaluate(() => window.scoreURLs.size)).toBe(0);
  expect((await render()).outcome).toBe('rendered');
  await page.evaluate(() => {
    window.originalDecode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async () => { throw Error('Synthetic decode failure'); };
  });
  expect((await render()).outcome).toBe('error');
  await expect(host.getByRole('alert')).toContainText('Synthetic decode failure');
  expect(await page.evaluate(() => window.scoreURLs.size)).toBe(0);
  await page.evaluate(() => {
    HTMLImageElement.prototype.decode = async function () {
      if (window.delayDecode) { window.delayDecode = false; await new Promise(resolve => { window.releaseDecode = resolve; }); }
      return window.originalDecode.call(this);
    };
    window.delayDecode = true;
  });
  await page.evaluate(xml => { window.oldRender = window.viewer.render({ musicXML: xml, noteCount: 16 }); }, xml);
  await page.waitForFunction(() => typeof window.releaseDecode === 'function');
  const beforeClear = await page.evaluate(() => window.destroyedToolkits);
  await page.evaluate(() => window.viewer.clear());
  expect(await page.evaluate(() => window.destroyedToolkits)).toBe(beforeClear + 1);
  expect(await page.evaluate(() => window.scoreURLs.size)).toBe(0);
  expect((await render()).outcome).toBe('rendered');
  await page.evaluate(() => window.releaseDecode());
  expect((await page.evaluate(() => window.oldRender)).outcome).toBe('superseded');
  await expect(host.locator('img')).toHaveCount(1); await expect(host.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => window.scoreURLs.size)).toBe(1);
  await page.evaluate(() => window.viewer.destroy());
  expect(await page.evaluate(() => window.scoreURLs.size)).toBe(0);
});

test('a failed renderer download is visible with no stale page or server fallback', async ({ page, context }) => {
  const writes = [];
  context.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await page.route('**/vendor/verovio/verovio-module.mjs', route => route.abort());
  const host = await probe(page);
  const result = await page.evaluate(xml => window.viewer.render({ musicXML: xml, noteCount: 8 }), viewerScore(1));
  expect(result.outcome).toBe('error'); await expect(host.getByRole('alert')).toBeVisible();
  await expect(host.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.scoreURLs.size)).toBe(0);
  expect(writes).toEqual([]);
});
