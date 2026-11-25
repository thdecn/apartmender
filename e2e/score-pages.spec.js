import {test,expect} from '@playwright/test';
import {serveSite} from './site.js';
let site;
test.beforeEach(async({page})=>{
  site=await serveSite();
  await page.route(site.origin+'/pages-test',route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
    <link rel="stylesheet" href="/notation/score-renderer.css"><style>body{margin:0}header{height:48px}#pages{width:1024px;height:650px}</style>
    <header>Teacher score toolbar</header><main id="pages"></main>`}));
  await page.setViewportSize({width:1400,height:1000});await page.goto(site.origin+'/pages-test');
  await page.evaluate(async()=>{
    const {indexScore}=await import('/notation/score-index.js');const {createScorePages}=await import('/notation/score-renderer.js');
    const base='/scores/bach-bwv-779-invention-no-8';
    const inventory=await (await fetch(base+'/score-index.json')).json();
    window.score=await indexScore(new Uint8Array(await (await fetch(base+'/score.musicxml')).arrayBuffer()),{slug:inventory.slug,editionId:inventory.editionId,inventory});
    window.pages=createScorePages(document.querySelector('#pages'));window.render=options=>pages.render({score,...options});
  });
});
test.afterEach(async({page})=>{await page.close();await site.close();});
async function rendered(page){return page.evaluate(()=>render());}

test('complete variable-density score paginates at phone, tablet and desktop sizes without losing or duplicating measures',async({page})=>{
  test.setTimeout(60000);const results=[];const network=[];page.on('request',r=>network.push(r.url()));
  for(const [width,height] of [[390,780],[844,260],[1024,650],[1366,700]]){
    await page.locator('#pages').evaluate((n,{width,height})=>{n.style.width=width+'px';n.style.height=height+'px';},{width,height});
    const result=await rendered(page);expect(result.outcome).toBe('pages');results.push(result.pageCount);
    expect(Object.keys(result.measurePages)).toHaveLength(34);expect(Object.keys(result.notePages)).toHaveLength(598);
    expect(Object.keys(result.measurePages)).toEqual(Array.from({length:34},(_,i)=>'m'+String(i+1).padStart(6,'0')));
    expect(result.pageCount).toBeGreaterThan(1);
    await expect(page.getByRole('button',{name:'Previous page',exact:true})).toBeDisabled();
    const fit=await page.locator('.score-pages-viewport').evaluate(n=>n.scrollWidth<=n.clientWidth+1);expect(fit).toBe(true);
    const final=await page.evaluate(()=>{for(let i=0;i<40;i++)pages.next();return pages.snapshot();});expect(final.page).toBe(final.pageCount);
    await expect(page.getByRole('button',{name:'Next page',exact:true})).toBeDisabled();
    expect(await page.locator('.score-pages-viewport g.measure[id="m000034"]').count()).toBe(1);
    await page.evaluate(()=>{for(let i=0;i<40;i++)pages.previous();});
  }
  expect(new Set(results).size).toBeGreaterThan(1);
  expect(network.some(url=>/login|supabase|practice|rpc/.test(url))).toBe(false);
  expect(await page.evaluate(()=>indexedDB.databases())).toEqual([]);
});

test('selected independent chord member remains highlighted on its new page after resize and notation-size reflow',async({page})=>{
  expect((await rendered(page)).outcome).toBe('pages');
  const id='m000034-n000002';await page.evaluate(id=>pages.select(id,true),id);
  const hit=page.locator(`.score-pages-viewport [data-note-id="${id}"]`);await hit.click();
  await expect(hit).toHaveAttribute('aria-pressed','true');
  const before=await page.evaluate(()=>pages.snapshot());
  await page.locator('#pages').evaluate(n=>{n.style.width='390px';n.style.height='780px';});
  await expect.poll(()=>page.evaluate(()=>pages.snapshot().pageCount)).not.toBe(before.pageCount);
  await expect(hit).toHaveAttribute('aria-pressed','true');await expect(hit).toBeInViewport();
  await page.getByLabel('Notation size').selectOption('70');
  await expect.poll(()=>page.evaluate(()=>pages.snapshot().size)).toBe(70);
  await expect(page.locator('#pages')).toHaveAttribute('aria-busy','false');
  await expect(hit).toHaveAttribute('aria-pressed','true');
  const after=await page.evaluate(()=>pages.snapshot());expect(after.page).toBe(after.notePages[id]);
  expect(Object.keys(after.notePages)).toHaveLength(598);
  await expect(page.locator('.score-pages-viewport [aria-pressed="true"]')).toHaveCount(1);
  await page.screenshot({path:'/private/tmp/apt-64-phone-pages.png'});
});

test('height-only growth fills available content and automatically repaginates with selection retained',async({page})=>{
  expect((await rendered(page)).outcome).toBe('pages');
  const id='m000034-n000002';await page.evaluate(id=>pages.select(id),id);
  await expect(page.locator('#pages > [role="status"]')).toBeEmpty();
  const before={height:await page.locator('.score-pages-viewport').evaluate(n=>n.clientHeight),
    pageCount:await page.evaluate(()=>pages.snapshot().pageCount)};
  await page.locator('#pages').evaluate(n=>{n.style.height='1000px';});
  await expect.poll(()=>page.locator('.score-pages-viewport').evaluate(n=>n.clientHeight)).toBeGreaterThan(before.height+300);
  await expect.poll(()=>page.evaluate(()=>pages.snapshot().pageCount)).toBeLessThan(before.pageCount);
  await expect(page.locator('#pages')).toHaveAttribute('aria-busy','false');
  const grown=await page.evaluate(()=>pages.snapshot());expect(grown.selectedNoteId).toBe(id);expect(grown.page).toBe(grown.notePages[id]);
  const bottomGap=await page.locator('#pages').evaluate(n=>n.getBoundingClientRect().bottom-n.querySelector('.score-pages-viewport').getBoundingClientRect().bottom);
  expect(Math.abs(bottomGap)).toBeLessThan(1);
  await page.locator('#pages').evaluate(n=>{n.style.height='650px';});
  await expect.poll(()=>page.evaluate(()=>pages.snapshot().pageCount)).toBe(before.pageCount);
  await expect(page.locator(`.score-pages-viewport [data-note-id="${id}"]`)).toHaveAttribute('aria-pressed','true');
});

test('full-score overrides reengrave the same selected chord member and keep the immutable source unchanged',async({page})=>{
  const result=await page.evaluate(async()=>{
    const original=new XMLSerializer().serializeToString(score.createDocument()),id='m000034-n000002';
    await render();pages.select(id,true);const old=document.querySelector(`.score-pages-viewport g.note[id="${id}"]`);
    const state=await render({overrides:{[id]:{kind:'set',hand:'L',finger:4}}});
    return {outcome:state.outcome,selected:state.selectedNoteId,oldGone:!old.isConnected,
      label:document.querySelector(`[data-fingering-for="${id}"]`)?.textContent.trim(),
      unchanged:original===new XMLSerializer().serializeToString(score.createDocument())};
  });expect(result).toEqual({outcome:'pages',selected:'m000034-n000002',oldGone:true,label:'L4',unchanged:true});
});

test('undersized content keeps readable systems scrollable with an explicit notice and safe boundaries',async({page})=>{
  await page.locator('#pages').evaluate(n=>{n.style.width='220px';n.style.height='260px';});
  const result=await rendered(page);expect(result.outcome).toBe('pages');
  await expect(page.locator('#pages > [role="status"]')).toContainText('Scroll the score');
  expect(await page.locator('.score-pages-viewport').evaluate(n=>getComputedStyle(n).overflow)).toBe('auto');
  await page.getByLabel('Notation size').selectOption('40');
  await expect(page.locator('#pages')).toHaveAttribute('aria-busy','false');
  expect(await page.evaluate(()=>pages.snapshot().size)).toBe(40);
  await page.evaluate(()=>pages.select('m000034-n000006',true));
  const visible=await page.locator('.score-pages-viewport [aria-pressed="true"]').evaluate(n=>{
    const box=n.getBoundingClientRect(),area=n.closest('.score-pages-viewport').getBoundingClientRect();
    return box.top>=area.top && box.bottom<=area.bottom && box.left>=area.left && box.right<=area.right;
  });expect(visible).toBe(true);
});

test('layout failure retains prior pages and destroy ignores in-flight reflow',async({page})=>{
  expect((await rendered(page)).outcome).toBe('pages');
  const result=await page.evaluate(()=>render({selectedNoteId:'foreign-note'}));expect(result.outcome).toBe('error');
  await expect(page.locator('#pages > [role="alert"]')).toContainText('Previous pages remain shown');
  await expect(page.locator('.score-pages-viewport svg').first()).toBeVisible();
  const outcome=await page.evaluate(async()=>{const pending=render();pages.destroy();return (await pending).outcome;});
  expect(outcome).toBe('superseded');await expect(page.locator('#pages')).toBeEmpty();
});

test('a selection made while reflow awaits fonts wins over the captured host selection',async({page})=>{
  expect((await rendered(page)).outcome).toBe('pages');
  const result=await page.evaluate(async()=>{
    const first='m000034-n000001',second='m000034-n000002';pages.select(first);
    const own=Object.getOwnPropertyDescriptor(document.fonts,'ready');let release;
    const waiting=new Promise(resolve=>{release=resolve;});
    Object.defineProperty(document.fonts,'ready',{configurable:true,get:()=>waiting});
    const pending=render({selectedNoteId:first});await new Promise(resolve=>setTimeout(resolve,0));
    pages.select(second);release();const result=await pending;
    if(own)Object.defineProperty(document.fonts,'ready',own);else delete document.fonts.ready;
    return {selected:result.selectedNoteId,page:result.page,expected:result.notePages[second]};
  });expect(result.selected).toBe('m000034-n000002');expect(result.page).toBe(result.expected);
});
