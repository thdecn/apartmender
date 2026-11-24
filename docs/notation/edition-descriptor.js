import { CARD_ENGRAVING_OPTIONS } from './score-renderer.js';

export const PILOT_SLUG = 'bach-bwv-779-invention-no-8';
export const PILOT_EDITION = 'sha256:2d9973db07428c5390ea4f8c2c1518f29834022db5d788682f37d8fcf3765b49';
export const PILOT_INDEX_SHA = '85f4e0bbdc778d67d316949b695dc0a3717d7d4d54c17a6ca9d09ce54ff6a057';
export const NOTATION_ASSETS = Object.freeze(['notation/score-index.js','notation/measure-card.js','notation/score-renderer.js',
  'notation/score-preview.js','notation/score-renderer.css','notation/edition-descriptor.js']);
const check = (value, message) => { if (!value) throw Error(`Notation edition: ${message}`); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const publicAssetPath = value => typeof value === 'string' && /^[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$/.test(value)
  && value.split('/').every(part => part && part !== '.' && part !== '..');

export function verifyNotationDescriptor(piece, descriptor, index, rendererManifest) {
  const d = descriptor;
  check(piece.id === PILOT_SLUG && piece.notation?.editionId === PILOT_EDITION
    && piece.notation.manifestSha256 === PILOT_INDEX_SHA, 'fixed edition changed; use a new permanent Piece identity');
  check(d?.descriptorVersion === 1 && d.slug === piece.id && d.title === piece.label && d.editionId === PILOT_EDITION, 'descriptor identity mismatch');
  check(d.score?.sha256 === PILOT_EDITION.slice(7) && publicAssetPath(d.score.url)
    && d.manifest?.sha256 === PILOT_INDEX_SHA && publicAssetPath(d.manifest.url), 'score/index binding mismatch');
  check(publicAssetPath(d.provenance?.url) && hash(d.provenance?.sha256), 'missing source provenance binding');
  check(d.indexVersion === 1 && d.projectionVersion === 1 && d.preview === 'downbeat-attacks', 'unsupported extraction policy');
  check(Object.keys(d.engraving ?? {}).length === Object.keys(CARD_ENGRAVING_OPTIONS).length
    && Object.entries(CARD_ENGRAVING_OPTIONS).every(([key,value]) => d.engraving[key] === value), 'engraving settings mismatch');
  check(d.renderer?.name === 'verovio' && d.renderer.version === '6.3.0'
    && publicAssetPath(d.renderer.assetsManifestUrl) && hash(d.renderer.assetsManifestSha256), 'renderer binding mismatch');
  check(rendererManifest?.npmVersion === '6.3.0' && rendererManifest.toolkitVersion === '6.3.0-425dd7b'
    && rendererManifest.selectedFont === 'Leipzig' && rendererManifest.embeddedWasm?.container === 'verovio-module.mjs'
    && rendererManifest.embeddedWasm.version === rendererManifest.toolkitVersion && rendererManifest.embeddedWasm.separateRequest === false,
  'renderer/WASM manifest mismatch');
  check(Array.isArray(rendererManifest.files) && new Set(rendererManifest.files.map(f => f.path)).size === rendererManifest.files.length
    && rendererManifest.files.every(f => publicAssetPath(f.path) && hash(f.sha256) && Number.isSafeInteger(f.bytes) && f.bytes > 0), 'invalid renderer files');
  check(rendererManifest.files.filter(f => f.runtime).map(f => f.path).sort().join('|') === 'verovio-module.mjs|verovio.mjs', 'incomplete runtime');
  check(Array.isArray(d.assets) && d.assets.length === NOTATION_ASSETS.length && new Set(d.assets.map(a => a.url)).size === d.assets.length
    && NOTATION_ASSETS.every(url => d.assets.some(a => a.url === url && hash(a.sha256))), 'incomplete or duplicate notation assets');
  check(index?.manifestVersion === 1 && index.indexVersion === 1 && index.slug === piece.id && index.editionId === d.editionId
    && Array.isArray(index.measures) && index.measures.length === 34, 'index identity mismatch');
  const notes = new Set();
  for (const [i,measure] of index.measures.entries()) {
    const id = `m${String(i+1).padStart(6,'0')}`;
    check(measure.measureId === id && measure.sourceOrdinal === i+1 && measure.nextMeasureId === (index.measures[i+1]?.measureId ?? null), 'invalid measure order');
    check(Array.isArray(measure.notes), 'missing pitched-note inventory');
    for (const note of measure.notes) {
      check(Number.isSafeInteger(note.sourceNoteOrdinal) && note.sourceNoteOrdinal > 0 && note.sourceNoteOrdinal <= measure.sourceNoteCount
        && note.noteId === `${id}-n${String(note.sourceNoteOrdinal).padStart(6,'0')}` && !notes.has(note.noteId), 'duplicate or invalid pitched-note identity');
      notes.add(note.noteId);
    }
  }
  check(notes.size === 598, 'incomplete pitched-note inventory');
  check(Array.isArray(d.cards) && d.cards.length === index.measures.length, 'incomplete practice cards');
  for (const [i,card] of d.cards.entries()) {
    const measure = index.measures[index.measures.length-1-i];
    check(card.cardId === measure.measureId && card.measureId === measure.measureId && card.previewMeasureId === measure.nextMeasureId, 'invalid practice card identity/order');
  }
  return descriptor;
}
