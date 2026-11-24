import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { straightExamples } from '../fixtures/straight-scores.mjs';

test('generated straight piano scores retain every attack and engrave with pinned Verovio', async ({ page }, testInfo) => {
  await page.goto('/apartmender/rec-demo/');
  const results = await page.evaluate(async examples => {
    const { buildStraightScore } = await import('./score.mjs');
    const { indexScore, scoreEditionId } = await import('../notation/score-index.js');
    const [{ default: createModule }, { VerovioToolkit }] = await Promise.all([
      import('../vendor/verovio/verovio-module.mjs'), import('../vendor/verovio/verovio.mjs'),
    ]);
    const module = await createModule(), results = [];
    for (const example of examples) {
      const score = buildStraightScore(example.take);
      const document = new DOMParser().parseFromString(score.musicXML, 'application/xml');
      if (document.querySelector('parsererror')) throw new Error('Generated malformed XML.');
      const pitched = [...document.querySelectorAll('note[id]')];
      const attacks = pitched.filter(note => !note.querySelector('tie[type="stop"]'));
      // The existing bounded index excludes tempo directions. Validate musical
      // invariants on a notation-only clone; engrave the FULL original below.
      document.querySelectorAll('direction').forEach(direction => direction.remove());
      const bytes = new TextEncoder().encode(new XMLSerializer().serializeToString(document));
      const { index } = await indexScore(bytes, { slug: 'recording-demo', editionId: await scoreEditionId(bytes) });
      const toolkit = new VerovioToolkit(module);
      try {
        toolkit.setOptions({ pageWidth: 2100, pageHeight: 2970, scale: 40 });
        if (!toolkit.loadData(score.musicXML)) throw new Error('Verovio rejected generated MusicXML.');
        const svg = toolkit.renderToSVG(1);
        const durationBySource = {};
        for (const note of pitched) {
          const id = Number(note.id.match(/^n(\d+)t/)[1]);
          durationBySource[id] = (durationBySource[id] ?? 0) + Number(note.querySelector('duration').textContent);
        }
        results.push({ name: example.name, version: toolkit.getVersion(), notes: score.notes,
          durationBySource, attacks: attacks.length, measures: index.measures.map(measure => ({
            duration: measure.duration, voices: [...new Set([...measure.notes, ...measure.rests].map(note => note.voice))],
            voiceDurations: [...new Set([...measure.notes, ...measure.rests].map(note => note.voice))].map(voice =>
              [...measure.notes, ...measure.rests].filter(note => note.voice === voice && !note.chord)
                .reduce((sum, note) => sum + note.duration.numerator / note.duration.denominator, 0)),
          })), pages: toolkit.getPageCount(), xml: score.musicXML, svg });
      } finally { toolkit.destroy(); }
    }
    return results;
  }, straightExamples);
  for (const [i, result] of results.entries()) {
    expect(result.version).toMatch(/^6\.3\.0/);
    expect(result.attacks).toBe(straightExamples[i].take.notes.length);
    expect(result.svg).toContain('<svg');
    expect(result.pages).toBeGreaterThan(0);
    for (const note of result.notes) expect(result.durationBySource[note.id]).toBe(note.end - note.start);
    for (const measure of result.measures) {
      expect(measure.duration.numerator / measure.duration.denominator).toBe(straightExamples[i].take.meter.beats);
      expect(measure.voiceDurations.every(duration => duration === straightExamples[i].take.meter.beats)).toBe(true);
    }
    await testInfo.attach(`${i + 1}-score.musicxml`, { body: result.xml, contentType: 'application/xml' });
    await testInfo.attach(`${i + 1}-score.svg`, { body: result.svg, contentType: 'image/svg+xml' });
  }
  // Inspection-only fixture, not an implementation of the later page host.
  // Leave the capture page's strict CSP before inspecting standalone SVG CSS.
  await page.goto('about:blank');
  await page.setContent(results[0].svg);
  await page.screenshot({ path: testInfo.outputPath('straight-score.png'), fullPage: true });
  await writeFile(testInfo.outputPath('fixture.musicxml'), results[0].xml);
  await writeFile(testInfo.outputPath('fixture.svg'), results[0].svg);
  await writeFile(testInfo.outputPath('notation-summary.json'), JSON.stringify(results.map(({ xml, svg, ...result }) => result), null, 2));
  await testInfo.attach('notation-summary', { body: JSON.stringify(results.map(({ xml, svg, ...result }) => result), null, 2), contentType: 'application/json' });
});
