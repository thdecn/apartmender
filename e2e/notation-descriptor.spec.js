import { test, expect } from '@playwright/test';
import { serveSite } from './site.js';

let site;
test.beforeEach(async({page})=>{
  site=await serveSite();await page.route(site.origin+'/descriptor-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Descriptor test</title>'}));
  await page.goto(site.origin+'/descriptor-test');
});
test.afterEach(async({page})=>{await page.close();await site.close();});

test('served public descriptor binds independently parsed immutable score, reverse cards and exact runtime/glue bytes',async({page})=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));
  const result=await page.evaluate(async()=>{
    const catalog=await(await fetch('/pieces.json')).json(),piece=catalog.find(p=>p.notation);
    const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const verified=async(url,expected)=>{
      const r=await fetch('/'+url);if(!r.ok)throw Error('Missing asset');const bytes=await r.arrayBuffer();
      if(await sha(bytes)!==expected)throw Error('Mixed version '+url);return bytes;
    };
    const json=bytes=>JSON.parse(new TextDecoder().decode(bytes));
    const d=json(await verified(piece.notation.descriptor.url,piece.notation.descriptor.sha256));
    const source=await verified(d.score.url,d.score.sha256),index=json(await verified(d.manifest.url,d.manifest.sha256));
    const runtime=json(await verified(d.renderer.assetsManifestUrl,d.renderer.assetsManifestSha256));
    for(const asset of d.assets)await verified(asset.url,asset.sha256);
    for(const asset of runtime.files.filter(f=>f.runtime))await verified('vendor/verovio/'+asset.path,asset.sha256);
    const {indexScore,assertScoreInventory}=await import('/notation/score-index.js');
    const {verifyNotationDescriptor}=await import('/notation/edition-descriptor.js');
    verifyNotationDescriptor(piece,d,index,runtime);
    const loaded=await indexScore(new Uint8Array(source),{slug:piece.id,editionId:d.editionId});assertScoreInventory(loaded.index,index);
    return {slug:piece.id,edition:d.editionId,cards:d.cards.length,first:d.cards[0],last:d.cards.at(-1),
      pitched:loaded.index.measures.reduce((n,m)=>n+m.notes.length,0),legacy:piece.cards.length,version:piece.notation.version};
  });
  expect(result.cards).toBe(34);expect(result.legacy).toBe(34);expect(result.pitched).toBe(598);
  expect(result.first).toEqual({cardId:'m000034',measureId:'m000034',previewMeasureId:null});
  expect(result.last.measureId).toBe('m000001');
  expect(requests.some(url=>/supabase|\/login\/|\/auth\/|\/rpc\//.test(url))).toBe(false);
});

test('root remains on the compatible PNG route after additive descriptor publication',async({page})=>{
  await page.route(/https:\/\/fonts\./,r=>r.abort());await page.setViewportSize({width:844,height:390});
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto(site.origin+'/');await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect(page.locator('#card-image')).toHaveAttribute('src',/cards\/bach-bwv-779-invention-no-8\/01-m34.png$/);
  expect(requests.some(url=>/verovio-module|\.musicxml|\/login\//.test(url))).toBe(false);
});
