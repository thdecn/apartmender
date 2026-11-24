import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateNotationFiles, digest } from '../tools/notation-edition.mjs';
import { validateCatalogFiles } from '../tools/validate-catalog.mjs';
import { verifyNotationDescriptor, PILOT_SLUG, PILOT_EDITION } from '../docs/notation/edition-descriptor.js';
import { generalPracticePieces } from '../docs/piece-catalog.js';
import { buildAssignmentHome } from '../docs/login/practice/student-home.js';

const root=fileURLToPath(new URL('../docs/',import.meta.url));
const readBytes=path=>readFile(resolve(root,path));
const catalog=JSON.parse(await readBytes('pieces.json')),piece=catalog.find(p=>p.id===PILOT_SLUG);
const descriptor=JSON.parse(await readBytes(piece.notation.descriptor.url));
const index=JSON.parse(await readBytes(descriptor.manifest.url));
const runtime=JSON.parse(await readBytes(descriptor.renderer.assetsManifestUrl));

test('one complete notation representation binds all exact public dependencies and preserves six PNG declarations',async()=>{
  const result=await validateNotationFiles(piece,{root});
  assert.equal(result.version,piece.notation.version);assert.equal(descriptor.editionId,PILOT_EDITION);
  assert.equal(catalog.filter(p=>p.notation).length,1);assert.equal(index.measures.length,34);
  assert.deepEqual(descriptor.cards[0],{cardId:'m000034',measureId:'m000034',previewMeasureId:null});
  assert.deepEqual(descriptor.cards.at(-1),{cardId:'m000001',measureId:'m000001',previewMeasureId:'m000002'});
  assert.deepEqual(index.measures.at(-1).notes.map(n=>n.sourceNoteOrdinal),[1,2,3,6]);
  assert.equal(piece.version,'sha256:2edfa7cadb60c76444f26fe7907c907cf57740463482b619cfe164cdd86634ad');
  assert.equal((await validateCatalogFiles()).assets,157);
  const collection=JSON.parse(await readBytes('general-practice-collection.json'));
  assert.equal(generalPracticePieces(catalog,collection).find(p=>p.id===piece.id).notation,piece.notation);
  const assigned=buildAssignmentHome([{slug:piece.id,assignmentId:'durable-assignment'}],catalog).pieces[0];
  assert.equal(assigned.assignmentId,'durable-assignment');assert.equal(assigned.notation,piece.notation);
});

for(const path of [descriptor.score.url,descriptor.manifest.url,descriptor.provenance.url,descriptor.renderer.assetsManifestUrl,
  'vendor/verovio/verovio-module.mjs','vendor/verovio/verovio.mjs','vendor/verovio/LiberationSerif-1.04.ttf',
  'notation/measure-card.js','notation/score-index.js','notation/score-renderer.js','notation/score-renderer.css']){
  test(`reject changed/mixed complete-version dependency ${path}`,async()=>{
    await assert.rejects(validateNotationFiles(piece,{root,readBytes:async url=>{
      const bytes=await readBytes(url);return url===path?Buffer.concat([bytes,Buffer.from(' ')]):bytes;
    }}),/Changed notation asset/);
  });
}

test('missing required assets fail validation',async()=>{
  await assert.rejects(validateNotationFiles(piece,{root,readBytes:async path=>{
    if(path==='vendor/verovio/verovio-module.mjs')throw Error('Missing runtime');return readBytes(path);
  }}),/Missing runtime/);
});

test('rehashed descriptor cannot invent extraction options, card identities or a replacement edition',()=>{
  for(const mutate of [
    d=>d.engraving.scale=100,d=>d.preview='first-sounding-note',d=>d.projectionVersion=2,
    d=>d.cards[0].previewMeasureId='m000001',d=>d.cards[1].cardId=d.cards[0].cardId,
    d=>d.cards.reverse(),d=>d.assets.pop(),d=>d.assets[0].url=d.assets[1].url,
    d=>d.editionId='sha256:'+'f'.repeat(64),d=>d.renderer.version='7.0.0',
  ]){const changed=structuredClone(descriptor);mutate(changed);assert.throws(()=>verifyNotationDescriptor(piece,changed,index,runtime));}
  const wrongIndex=structuredClone(index);wrongIndex.measures[0].notes.push(wrongIndex.measures[0].notes[0]);
  assert.throws(()=>verifyNotationDescriptor(piece,descriptor,wrongIndex,runtime),/pitched-note identity/);
  const wrongRuntime=structuredClone(runtime);wrongRuntime.embeddedWasm.version='other';
  assert.throws(()=>verifyNotationDescriptor(piece,descriptor,index,wrongRuntime),/WASM manifest/);
});

test('descriptor bytes define the notation version independently of unchanged PNG versions',async()=>{
  const bytes=await readBytes(piece.notation.descriptor.url);
  assert.equal(piece.notation.version,`sha256:${digest(bytes)}`);
  const wrong=structuredClone(piece);wrong.notation.version=piece.version;
  await assert.rejects(validateNotationFiles(wrong,{root}),/complete-version pointer/);
  const previous=structuredClone(catalog);previous.find(p=>p.id===piece.id).notation.editionId='sha256:'+'f'.repeat(64);
  await assert.rejects(validateCatalogFiles(root,{previousCatalog:previous}),/new permanent Piece identity/);
});
