import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCatalog, generalPracticePieces, cardAssetPath } from '../docs/piece-catalog.js';
import { validateCatalogFiles, pieceVersion, sha256 } from '../tools/validate-catalog.mjs';
import { buildAssignmentHome, buildStudentHome } from '../docs/login/practice/student-home.js';

const makePiece = (id='test-piece') => ({ id, label:'Test Piece', catalogVersion:1, status:'supported', assetsAvailable:true,
  cards:['01-m2.png','02-m1.png'], cardAssets:[{path:`cards/${id}/01-m2.png`,sha256:sha256('first')},{path:`cards/${id}/02-m1.png`,sha256:sha256('second')}] });
const collection = (...slugs) => ({collectionVersion:1,slugs});
const fixture = () => { const piece=makePiece();piece.version=pieceVersion(piece);return piece; };

test('the actual deployed public catalogue, collection, ledger and every card validate',async()=>{
  assert.deepEqual(await validateCatalogFiles(),{pieces:6,general:6,assets:157,metadataOnly:0});
});

test('public selection/order and Assignment eligibility are independent, with no copied definitions',()=>{
  const a=fixture(),b={...fixture(),id:'another-piece',cardAssets:makePiece('another-piece').cardAssets};
  b.version=pieceVersion(b);
  const catalog=[a,b],before=JSON.stringify(catalog);
  assert.deepEqual(generalPracticePieces(catalog,collection(b.id)),[b]);
  assert.equal(generalPracticePieces(catalog,collection(b.id))[0],b);
  assert.deepEqual(buildAssignmentHome([{assignmentId:'durable-id',slug:a.id}],catalog).pieces.map(p=>p.id),[a.id]);
  assert.equal(JSON.stringify(catalog),before);
});

test('retirement retains Active Assignment access and General membership while assets remain',()=>{
  const piece={...fixture(),status:'retired'};
  assert.equal(generalPracticePieces([piece],collection(piece.id))[0],piece);
  assert.equal(buildAssignmentHome([{assignmentId:'same-id',slug:piece.id}],[piece]).pieces[0].assignmentId,'same-id');
  assert.equal(piece.version,pieceVersion(piece));
  piece.assetsAvailable=false;
  assert.equal(validateCatalog([piece])[0].label,'Test Piece');
  assert.throws(()=>generalPracticePieces([piece],collection(piece.id)),/retained assets/);
  assert.deepEqual(buildAssignmentHome([{assignmentId:'same-id',slug:piece.id}],[piece]),{pieces:[],hasAssignedPiece:true,unavailable:1});
  assert.equal(buildStudentHome({piece_1:piece.id},[piece]).unavailable,1);
});

for (const [name,change] of [
  ['duplicate permanent slug',catalog=>catalog.push({...catalog[0]})],
  ['missing retirement state',catalog=>delete catalog[0].status],
  ['supported assets removed',catalog=>catalog[0].assetsAvailable=false],
  ['duplicate ordered card',catalog=>catalog[0].cards[1]=catalog[0].cards[0]],
  ['missing asset declaration',catalog=>catalog[0].cardAssets.pop()],
  ['foreign card address',catalog=>catalog[0].cardAssets[0].path='cards/other/01-m2.png'],
  ['escaping card filename',catalog=>catalog[0].cards[0]='../../.env.png'],
  ['invalid digest',catalog=>catalog[0].cardAssets[0].sha256='anything'],
]) test(`reject ${name}`,()=>{const catalog=[fixture()];change(catalog);assert.throws(()=>validateCatalog(catalog));});

test('unknown/duplicate General slugs and removed/unregistered ledger identities are rejected',()=>{
  const piece=fixture();
  assert.throws(()=>generalPracticePieces([piece],collection('unknown-piece')),/retained assets/);
  assert.throws(()=>generalPracticePieces([piece],collection(piece.id,piece.id)),/duplicate/);
  assert.throws(()=>validateCatalog([piece],{knownSlugs:['gone-piece']}),/permanent slug/);
  assert.throws(()=>validateCatalog([piece],{knownSlugs:[]}),/permanent slug/);
  assert.throws(()=>cardAssetPath('../private','../../.env'),/address/);
});

test('static validation detects missing/changed bytes, stale versions, historical deletion and metadata-only retirement',async()=>{
  const root=await mkdtemp(join(tmpdir(),'apartmender-catalog-'));
  try {
    const piece=fixture(),folder=join(root,'cards',piece.id);await mkdir(folder,{recursive:true});
    const save=async()=>{
      await writeFile(join(root,'pieces.json'),JSON.stringify([piece]));
      await writeFile(join(root,'general-practice-collection.json'),JSON.stringify(collection()));
      await writeFile(join(root,'piece-slugs.json'),JSON.stringify({ledgerVersion:1,slugs:[piece.id]}));
    };
    await save(); await writeFile(join(folder,piece.cards[0]),'first');await writeFile(join(folder,piece.cards[1]),'second');
    assert.equal((await validateCatalogFiles(root)).assets,2);
    await writeFile(join(folder,piece.cards[0]),'changed');await assert.rejects(validateCatalogFiles(root),/Changed declared card/);
    await rm(join(folder,piece.cards[0]));await assert.rejects(validateCatalogFiles(root),/Missing declared card/);
    piece.status='retired';piece.assetsAvailable=false;await save();
    assert.deepEqual(await validateCatalogFiles(root),{pieces:1,general:0,assets:0,metadataOnly:1});
    await assert.rejects(validateCatalogFiles(root,{previousCatalog:[{id:'historical-piece'}]}),/permanent Piece slug/);
    piece.cardAssets.reverse();await save();await assert.rejects(validateCatalogFiles(root),/invalid card asset/);
    piece.cardAssets.reverse();piece.version='sha256:'+'0'.repeat(64);await save();await assert.rejects(validateCatalogFiles(root),/complete version/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
