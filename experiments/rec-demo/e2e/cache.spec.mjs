import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';

test('published legacy HTML and its cached graph still work before visiting the current release', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/apartmender/rec-demo/legacy-index.html');
  expect(response.headers()['cache-control']).toContain('max-age=600');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready', { timeout: 5000 });
  const legacyExports = await page.evaluate(async () => Object.keys(await import('./runtime.mjs')));
  expect(legacyExports).not.toContain('createScoreToolkit');
  await page.getByRole('button', { name: 'Cancel check' }).click();
  await page.goto('/apartmender/rec-demo/');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready', { timeout: 5000 });
  await expect(page.locator('#score-viewer')).toHaveCount(1);
  const entry = await page.locator('script[type="module"]').getAttribute('src');
  expect(entry).toMatch(/^\.\/releases\/[a-f0-9]{16}\/app\.mjs$/);
  expect(errors).toEqual([]);
});

test('current HTML ignores an older runtime response at the unversioned URL', async ({ page }) => {
  const runtime = await readFile(new URL('../../../docs/rec-demo/runtime.mjs', import.meta.url), 'utf8');
  let legacyRequests = 0;
  await page.route('**/rec-demo/runtime.mjs', route => {
    legacyRequests++; return route.fulfill({ contentType: 'text/javascript', body: runtime });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/apartmender/rec-demo/');
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready', { timeout: 5000 });
  expect(legacyRequests).toBe(0);
  expect(errors).toEqual([]);
});

// A retained release must resolve its own module graph and diagnostic build,
// even after the public root starts linking a different release.
test('retained cohort entry still prepares with its own manifest', async ({ page }) => {
  const root = new URL('../../../docs/rec-demo/', import.meta.url);
  const current = JSON.parse(await readFile(new URL('release.json', root), 'utf8'));
  const previous = (await readdir(new URL('releases/', root))).filter(id => id !== current.buildId).sort()[0];
  expect(previous).toBeTruthy();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/apartmender/rec-demo/releases/${previous}/`);
  await page.getByRole('button', { name: 'Prepare local engines' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'ready', { timeout: 5000 });
  const manifestRequests = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => entry.name.endsWith('/asset-manifest.json')).map(entry => entry.name));
  expect(manifestRequests).toHaveLength(1);
  expect(manifestRequests[0]).toContain(`/releases/${previous}/asset-manifest.json`);
  expect(errors).toEqual([]);
});
