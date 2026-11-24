import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateCatalog, generalPracticePieces } from '../docs/piece-catalog.js';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const pieceVersion = piece => `sha256:${sha256(JSON.stringify({ id: piece.id, label: piece.label,
  cards: piece.cards.map((name, index) => [name, piece.cardAssets[index].sha256]) }))}`;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function validateCatalogFiles(root = resolve(projectRoot, 'docs'), { previousCatalog = [] } = {}) {
  const json = async name => JSON.parse(await readFile(resolve(root, name), 'utf8'));
  const [catalog, collection, ledger] = await Promise.all([
    json('pieces.json'), json('general-practice-collection.json'), json('piece-slugs.json'),
  ]);
  if (ledger.ledgerVersion !== 1) throw Error('Unsupported permanent-slug ledger');
  validateCatalog(catalog, { knownSlugs: ledger.slugs });
  const general = generalPracticePieces(catalog, collection);
  const ids = new Set(catalog.map(piece => piece.id));
  if (!Array.isArray(previousCatalog) || previousCatalog.some(piece => !ids.has(piece.id)))
    throw Error('Do not delete a permanent Piece slug; retain retired metadata');
  let assets = 0, metadataOnly = 0;
  for (const piece of catalog) {
    if (piece.version !== pieceVersion(piece)) throw Error(`Inconsistent complete version: ${piece.id}`);
    if (!piece.assetsAvailable) { metadataOnly++; continue; }
    for (const asset of piece.cardAssets) {
      let bytes;
      try { bytes = await readFile(resolve(root, asset.path)); }
      catch (cause) { throw Error(`Missing declared card: ${asset.path}`, { cause }); }
      if (sha256(bytes) !== asset.sha256) throw Error(`Changed declared card: ${asset.path}`);
      assets++;
    }
  }
  return { pieces: catalog.length, general: general.length, assets, metadataOnly };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 0 && (args.length !== 2 || args[0] !== '--baseline')) throw Error('Usage: validate-catalog.mjs [--baseline <git-ref>]');
    const previousCatalog = args.length ? JSON.parse(execFileSync('git', ['show', `${args[1]}:docs/pieces.json`],
      { cwd: projectRoot, encoding: 'utf8' })) : [];
    console.log(JSON.stringify(await validateCatalogFiles(undefined, { previousCatalog })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
