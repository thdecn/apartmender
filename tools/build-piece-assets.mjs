// Explicit maintainer operation, separate from validation; never runs during a browser visit.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, pieceVersion } from './validate-catalog.mjs';
import { cardAssetPath } from '../docs/piece-catalog.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../docs');
if (process.argv.length !== 3 || process.argv[2] !== '--write') throw Error('Usage: build-piece-assets.mjs --write');
const path = resolve(root, 'pieces.json'), catalog = JSON.parse(await readFile(path, 'utf8'));
for (const piece of catalog) {
  if (piece.renderer) throw Error('Renderer editions require their own complete-version builder');
  if (piece.assetsAvailable === false) continue; // Preserve last complete manifest after governed removal.
  piece.cardAssets = await Promise.all(piece.cards.map(async card => {
    const path = cardAssetPath(piece.id, card);
    return { path, sha256: sha256(await readFile(resolve(root, path))) };
  }));
  piece.version = pieceVersion(piece);
}
await writeFile(path, `${JSON.stringify(catalog, null, 2)}\n`);
