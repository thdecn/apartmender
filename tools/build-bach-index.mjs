// Developer-only generation/check using the repository's browser test runtime.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { serveSite } from '../e2e/site.js';

const root = 'docs/scores/bach-bwv-779-invention-no-8';
const provenance = JSON.parse(await readFile(`${root}/provenance.json`, 'utf8'));
const site = await serveSite();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(`${site.origin}/index-tool`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local index check</title>' }));
  await page.goto(`${site.origin}/index-tool`);
  const index = await page.evaluate(async descriptor => {
    const { indexScore } = await import('/notation/score-index.js');
    const base = `/scores/${descriptor.slug}`;
    const response = await fetch(`${base}/score.musicxml`);
    if (!response.ok) throw Error('Missing source');
    const inventory = await (await fetch(`${base}/review-inventory.json`)).json();
    return (await indexScore(new Uint8Array(await response.arrayBuffer()), { slug: descriptor.slug, editionId: descriptor.editionId, inventory })).index;
  }, provenance);
  const encoded = `${JSON.stringify(index, null, 2)}\n`, target = `${root}/score-index.json`;
  if (process.argv.includes('--write')) await writeFile(target, encoded);
  else if (await readFile(target, 'utf8') !== encoded) throw Error('Published index differs from exact source');
  console.log(JSON.stringify({ editionId: index.editionId, measures: index.measures.length,
    pitchedNotes: index.measures.reduce((total, measure) => total + measure.notes.length, 0), mode: process.argv.includes('--write') ? 'generated' : 'verified' }));
} finally {
  await browser?.close();
  await site.close();
}
