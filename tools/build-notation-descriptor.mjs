import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, validateNotationFiles } from './notation-edition.mjs';
import { PILOT_SLUG, PILOT_EDITION, PILOT_INDEX_SHA, NOTATION_ASSETS } from '../docs/notation/edition-descriptor.js';
import { CARD_ENGRAVING_OPTIONS } from '../docs/notation/score-renderer.js';

if (process.argv.length !== 3 || process.argv[2] !== '--write') throw Error('Usage: build-notation-descriptor.mjs --write');
const root = resolve(dirname(fileURLToPath(import.meta.url)),'../docs');
const catalogPath = resolve(root,'pieces.json'), catalog = JSON.parse(await readFile(catalogPath,'utf8'));
const piece = catalog.find(p => p.id === PILOT_SLUG), base = `scores/${PILOT_SLUG}`;
if (!piece) throw Error('Pilot Piece missing');
const asset = async url => ({url,sha256:digest(await readFile(resolve(root,url)))});
const score = await asset(`${base}/score.musicxml`), manifest = await asset(`${base}/score-index.json`);
if (`sha256:${score.sha256}` !== PILOT_EDITION || manifest.sha256 !== PILOT_INDEX_SHA) throw Error('Accepted score/index changed; never repin this edition');
const index = JSON.parse(await readFile(resolve(root,manifest.url),'utf8'));
const runtime = await asset('vendor/verovio/manifest.json');
const descriptor = {descriptorVersion:1,slug:piece.id,title:piece.label,editionId:PILOT_EDITION,score,manifest,
  renderer:{name:'verovio',version:'6.3.0',assetsManifestUrl:runtime.url,assetsManifestSha256:runtime.sha256},
  indexVersion:1,projectionVersion:1,preview:'downbeat-attacks',engraving:CARD_ENGRAVING_OPTIONS,
  cards:[...index.measures].reverse().map(m=>({cardId:m.measureId,measureId:m.measureId,previewMeasureId:m.nextMeasureId})),
  assets:await Promise.all(NOTATION_ASSETS.map(asset)),provenance:await asset(`${base}/provenance.json`)};
const bytes=Buffer.from(JSON.stringify(descriptor,null,2)+'\n'), url=`notation/editions/${PILOT_SLUG}.v1.json`;
piece.notation={editionId:PILOT_EDITION,manifestSha256:PILOT_INDEX_SHA,version:`sha256:${digest(bytes)}`,descriptor:{url,sha256:digest(bytes)}};
// Validate the prospective files before writing either catalogue or descriptor.
await validateNotationFiles(piece,{root,readBytes:path=>path===url?bytes:readFile(resolve(root,path))});
await mkdir(resolve(root,'notation/editions'),{recursive:true});
await writeFile(resolve(root,url),bytes);await writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({slug:piece.id,editionId:PILOT_EDITION,notationVersion:piece.notation.version,cards:descriptor.cards.length}));
