import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { serveSite } from './site.js';

const slug = 'bach-bwv-779-invention-no-8';
const inventory = JSON.parse(await readFile('docs/scores/'+slug+'/score-index.json', 'utf8'));
const student = '11111111-1111-4111-8111-111111111111';
const privatePartition = {open:{sentinel:{assignmentId:'private-assignment'}},queue:{sentinel:{durationSeconds:321}}};
const authKey = 'sb-jxhxerchsxonsgmqsatd-auth-token';
let site, root, requests, errors, privateAccess;
test.use({viewport:{width:844,height:390},hasTouch:true});

test.beforeEach(async ({page}) => {
  site = await serveSite({basePath:'/apartmender'}); root = site.origin+'/apartmender/';
  requests=[]; errors=[]; privateAccess=[];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/https:\/\/fonts\./, route => route.abort());
  await page.route(root+'sentinel-probe', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Probe</title>'}));
  await page.goto(root+'sentinel-probe');
  await page.evaluate(async ({authKey,privatePartition,student}) => {
    localStorage.setItem(authKey, 'fake-auth-sentinel');
    sessionStorage.setItem('private-session-sentinel', 'retained');
    await new Promise((resolve,reject) => {
      const opened=indexedDB.open('apartmender-practice-v1',1);
      opened.onupgradeneeded=()=>opened.result.createObjectStore('students');
      opened.onerror=()=>reject(opened.error);
      opened.onsuccess=()=>{
        const db=opened.result,tx=db.transaction('students','readwrite');
        tx.objectStore('students').put(privatePartition,student);
        tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
      };
    });
  }, {authKey,privatePartition,student});
  await page.exposeFunction('recordPrivateAccess', entry => privateAccess.push(entry));
  await page.addInitScript(() => {
    const storageMethods=new Set(['getItem','setItem','removeItem','clear','key']);
    for (const name of ['getItem','setItem','removeItem','clear','key']) {
      const original=Storage.prototype[name];
      Storage.prototype[name]=function(...args){
        if (args[0]!=='apartmender.practice-mode') void window.recordPrivateAccess('Storage.'+name);
        return original.apply(this,args);
      };
    }
    for (const name of ['localStorage','sessionStorage']) {
      const native=window[name];
      if(name==='sessionStorage')window.readSessionSentinel=()=>native['private-session-sentinel'];
      Object.defineProperty(window,name,{configurable:true,value:new Proxy(native,{
        get(target,key){
          if(storageMethods.has(key))return target[key].bind(target);
          if(typeof key==='string'&&key!=='apartmender.practice-mode')void window.recordPrivateAccess(name+'.'+key);
          return Reflect.get(target,key,target);
        },
        set(target,key,value){void window.recordPrivateAccess(name+'.write');return Reflect.set(target,key,value,target);},
        deleteProperty(target,key){void window.recordPrivateAccess(name+'.delete');return Reflect.deleteProperty(target,key);},
        ownKeys(target){void window.recordPrivateAccess(name+'.keys');return Reflect.ownKeys(target);},
      })});
    }
    for (const name of ['open','deleteDatabase','databases']) {
      const original=IDBFactory.prototype[name];
      if (original) IDBFactory.prototype[name]=function(...args){
        void window.recordPrivateAccess('IndexedDB.'+name);return original.apply(this,args);
      };
    }
    window.publicEffects={vibrations:[],wakeRequests:0};
    Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.publicEffects.vibrations.push(pattern);return true;}});
    Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{
      window.publicEffects.wakeRequests++;throw new DOMException('Unavailable','NotAllowedError');
    }}});
  });
});

test.afterEach(async ({page,context}) => {
  try {
    expect(errors).toEqual([]);
    expect(privateAccess).toEqual([]);
    expect(requests.filter(url=>/supabase|\/login\/|\/auth\/|\/rest\/|\/rpc\//.test(url))).toEqual([]);
    // An uninstrumented probe verifies unchanged durable state independently of
    // the access guards installed only in the application page.
    const probe=await context.newPage();
    await probe.route(root+'sentinel-probe',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Probe</title>'}));
    await probe.goto(root+'sentinel-probe');
    const actual=await probe.evaluate(async ({authKey,student})=>{
      const partition=await new Promise((resolve,reject)=>{
        const opened=indexedDB.open('apartmender-practice-v1',1);
        opened.onerror=()=>reject(opened.error);
        opened.onsuccess=()=>{
          const db=opened.result,tx=db.transaction('students'),read=tx.objectStore('students').get(student);
          read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);tx.oncomplete=()=>db.close();
        };
      });
      return {auth:localStorage.getItem(authKey),partition};
    },{authKey,student});
    expect(actual.auth).toBe('fake-auth-sentinel');expect(actual.partition).toEqual(privatePartition);
    // sessionStorage is tab-local; verify it in the original tab below.
    expect(await page.evaluate(()=>window.readSessionSentinel())).toBe('retained');
  } finally {
    await Promise.all(context.pages().map(tab=>tab.close())); await site.close();
  }
});

async function open(page) {
  await page.goto(root);
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
}
async function measure(page, ordinal) {
  const id=`m${String(ordinal).padStart(6,'0')}`;
  await expect(page.locator('#card-meta')).toHaveText(`m. ${ordinal} · ${35-ordinal} / 34`);
  await expect(page.locator(`.public-score-card .score-viewport [data-note-id^="${id}-"]`).first()).toBeVisible();
  await expect(page.locator('.public-score-status')).toHaveText('');
  await expect(page.locator('#card-image')).toBeHidden();
  return id;
}
async function advance(page) {
  for(let n=0;n<3;n++)await page.getByRole('button',{name:'Good',exact:true}).click();
  await page.getByRole('button',{name:'Advance',exact:true}).click();
}

test('an older cached root document still loads the public host stylesheet and displays Bach correctly',async({page})=>{
  await page.route(root,async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace(/\s*<link rel="stylesheet" href="\.\/notation\/public-score-card\.css" \/>/,'')});
  });
  await open(page);await measure(page,34);
  await expect(page.locator('#card-image')).toHaveCSS('display','none');
  expect(requests.some(url=>url.endsWith('/notation/public-score-card.css'))).toBe(true);
  await expect(page.locator('.public-score-card')).toHaveCSS('display','grid');
});

test('public Bach traverses all 34 real cards with original fingerings, final chord identities and no private access',async({page})=>{
  test.setTimeout(90000);await open(page);
  await measure(page,34);
  expect(inventory.measures.flatMap(m=>m.notes).filter(n=>n.originalFingering)).toEqual([]);
  const appeared=[];
  for(let ordinal=34;ordinal>=1;ordinal--){
    const id=await measure(page,ordinal);appeared.push(id);
    const current=page.locator(`.score-viewport [data-note-id^="${id}-"]`);
    await expect(current).toHaveCount(inventory.measures[ordinal-1].notes.length);
    await expect(page.locator('[data-fingering-for]')).toHaveCount(0);
    if(ordinal===34){
      const ids=await current.evaluateAll(nodes=>nodes.map(node=>node.dataset.noteId));
      expect(ids).toEqual([1,2,3,6].map(n=>`m000034-n${String(n).padStart(6,'0')}`));
      expect(await page.locator('.score-viewport [data-note-id]').count()).toBe(4);
      await expect(page.getByRole('button',{name:'Mistake',exact:true})).toBeEnabled();
      await page.getByRole('button',{name:'Good',exact:true}).click();
      await page.getByRole('button',{name:'Mistake',exact:true}).click();
      await expect(page.locator('#counter')).toHaveText('0');
    }
    if(ordinal===33){
      await expect(page.locator('.score-viewport [data-note-id^="m000034-"]')).toHaveCount(4);
      await page.getByRole('button',{name:'Previous playable measure'}).click();await measure(page,34);
      await expect(page.getByRole('button',{name:'Good',exact:true})).toBeDisabled();
      await page.getByRole('button',{name:'Resume',exact:true}).click();await measure(page,33);
    }
    await advance(page);
  }
  expect(new Set(appeared).size).toBe(34);
  await expect(page.locator('#home')).toBeVisible();await expect(page.locator('.public-score-card')).toHaveCount(0);
  expect(page.url()).toBe(root);
  const effects=await page.evaluate(()=>window.publicEffects);
  expect(effects.wakeRequests).toBe(1);expect(effects.vibrations).toEqual(expect.arrayContaining([12,24,[40,30,40]]));
  expect(requests.filter(url=>url.endsWith('/score.musicxml'))).toHaveLength(1);
});

test('Hard mode, note touch and swipe browsing retain the shared random progression',async({page})=>{
  test.setTimeout(90000);
  await page.addInitScript(()=>{Math.random=()=>0;});await page.goto(root);
  await page.locator('label[for="practice-mode-hard"]').click();
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();await measure(page,33);
  const note=page.locator('.score-viewport [data-note-id="m000033-n000001"]');
  await note.tap();await expect(note).toHaveAttribute('aria-pressed','true');await measure(page,33);
  const frame=await page.locator('.card-frame').boundingBox();
  await page.mouse.move(frame.x+110,frame.y+12);await page.mouse.down();
  await page.mouse.move(frame.x+20,frame.y+12);await page.mouse.up();await measure(page,34);
  await expect(page.getByRole('button',{name:'Good',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Resume',exact:true}).click();await measure(page,33);
  await page.getByRole('button',{name:'Next playable measure'}).click();await measure(page,32);
  await expect(page.getByRole('button',{name:'Mistake',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  for(const ordinal of [...Array.from({length:33},(_,i)=>33-i),34]){
    await measure(page,ordinal);await advance(page);
  }
  await expect(page.locator('#home')).toBeVisible();
});

test('load failure stays explicit, retries verified bytes, and legacy cards require a deliberate choice',async({page})=>{
  let fail=true;
  await page.route('**/score.musicxml',route=>fail?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await open(page);
  await expect(page.getByRole('alert')).toContainText('Public score unavailable');
  await expect(page.locator('.score-viewport svg')).toHaveCount(0);await expect(page.locator('#card-image')).toBeHidden();
  expect(requests.some(url=>url.endsWith('01-m34.png'))).toBe(false);
  fail=false;await page.getByRole('button',{name:'Retry score',exact:true}).click();await measure(page,34);
  await page.getByRole('button',{name:'Back home'}).click();fail=true;
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Public score unavailable');
  await page.getByRole('button',{name:'Use legacy PNG cards',exact:true}).click();
  await expect(page.locator('.public-score-card img')).toHaveAttribute('src',/01-m34.png$/);
  await expect(page.locator('.public-score-status')).toContainText('Legacy PNG');
  await advance(page);await expect(page.locator('.public-score-card img')).toHaveAttribute('src',/02-m33/);
  fail=false;await page.getByRole('button',{name:'Retry score',exact:true}).click();await measure(page,33);
});

test('engraving failure offers retry without silently presenting PNG or a stale score',async({page})=>{
  await page.goto(root);
  await page.evaluate(()=>{
    let failed=false;
    // WebKit can replace a FontFaceSet wrapper and lose instance expandos.
    Object.defineProperty(FontFaceSet.prototype,'ready',{configurable:true,get(){
      if(!failed){failed=true;return Promise.reject(new Error('Simulated font readiness failure'));}
      return Promise.resolve(document.fonts);
    }});
  });
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Simulated font readiness failure');
  await expect(page.locator('.score-viewport svg')).toHaveCount(0);
  expect(requests.some(url=>url.endsWith('.png'))).toBe(false);
  await page.getByRole('button',{name:'Retry score',exact:true}).click();await measure(page,34);
});

test('late previous loading cannot replace a newer card or the PNG Piece chosen after Home',async({page})=>{
  let release,started;
  const held=new Promise(resolve=>{started=resolve;});let first=true;
  await page.route('**/score.musicxml',async route=>{
    if(!first)return route.continue();first=false;started();await new Promise(resolve=>{release=resolve;});await route.continue();
  });
  await open(page);await held;
  try{
    await advance(page);await measure(page,33);release();
    await expect(page.locator('.score-viewport [data-note-id^="m000033-"]').first()).toBeVisible();
    await expect(page.locator('#card-meta')).toContainText('2 / 34');
  }finally{release?.();}
  await page.getByRole('button',{name:'Back home'}).click();first=true;
  const loading=new Promise(resolve=>{started=resolve;});
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();await loading;
  try{
    await page.getByRole('button',{name:'Back home'}).click();
    await page.getByRole('button',{name:'Czerny Op. 821, 2',exact:true}).click();release();
    await expect(page.locator('#card-image')).toBeVisible();
    await expect(page.locator('#card-image')).toHaveAttribute('src',/czerny-op-821-no-2\/01-m8.png$/);
    await expect(page.locator('.public-score-card')).toHaveCount(0);
  }finally{release?.();}
});

test('public Bach timing remains ephemeral and visible while portrait overlay is shown',async({page})=>{
  await page.clock.install({time:new Date('2026-11-25T08:00:00Z')});await page.goto(root);
  await page.clock.pauseAt(new Date('2026-11-25T08:01:00Z'));
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();await measure(page,34);
  await page.clock.runFor(5000);await expect(page.locator('#practice-timer-value')).toHaveText('0:05');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.runFor(10000);await expect(page.locator('#practice-timer-value')).toHaveText('0:05');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#rotate-hint')).toBeVisible();
  await page.clock.runFor(3000);await expect(page.locator('#practice-timer-value')).toHaveText('0:08');
  await page.setViewportSize({width:844,height:390});await expect(page.locator('#rotate-hint')).toBeHidden();
  await page.getByRole('button',{name:'Back home'}).click();await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await measure(page,34);await expect(page.locator('#practice-timer-value')).toHaveText('0:00');
});

test('an old font-delayed render cannot restore an old card or error after navigation',async({page})=>{
  await page.goto(root);
  await page.evaluate(()=>{
    let first=true;
    Object.defineProperty(FontFaceSet.prototype,'ready',{configurable:true,get(){
      if(!first)return Promise.resolve(document.fonts);first=false;
      window.oldRenderWaiting=true;return new Promise((resolve,reject)=>{window.rejectOldRender=()=>reject(Error('Old render failed'));});
    }});
  });
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.oldRenderWaiting)).toBe(true);
  await advance(page);await measure(page,33);
  await page.evaluate(()=>window.rejectOldRender());
  await measure(page,33);await expect(page.getByRole('alert')).toHaveCount(0);
});

test('changed descriptor or dependency fails closed, while disabling the pilot preserves PNG-only Practice',async({page})=>{
  await page.route('**/notation/score-index.js',async route=>{
    const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\n// changed byte'});
  });
  await open(page);await expect(page.getByRole('alert')).toContainText('Notation version changed');
  await expect(page.locator('.score-viewport svg')).toHaveCount(0);
  await page.unroute('**/notation/score-index.js');
  await page.getByRole('button',{name:'Retry score',exact:true}).click();await measure(page,34);
  await page.route('**/pieces.json',async route=>{
    const response=await route.fetch(),catalog=await response.json();
    const pointer=catalog.find(piece=>piece.id===slug).notation;
    pointer.descriptor.sha256='a'.repeat(64);pointer.version='sha256:'+pointer.descriptor.sha256;
    await route.fulfill({json:catalog});
  });
  await open(page);await expect(page.getByRole('alert')).toContainText('Public pilot descriptor version changed');
  await expect(page.locator('.score-viewport svg')).toHaveCount(0);await page.unroute('**/pieces.json');
  await page.route('**/notation/public-score-pilot.js',async route=>{
    const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('enabled: true','enabled: false')});
  });
  requests=[];await open(page);
  await expect(page.locator('#card-image')).toBeVisible();await expect(page.locator('#card-image')).toHaveAttribute('src',/01-m34.png$/);
  expect(requests.some(url=>/\.musicxml|verovio-module|\/editions\//.test(url))).toBe(false);
});
