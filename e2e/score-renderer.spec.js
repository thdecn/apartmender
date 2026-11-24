import { test, expect } from '@playwright/test';
import { serveSite } from './site.js';

test.use({ hasTouch: true });
let site;
test.beforeEach(async ({ page }) => {
  site = await serveSite();
  await page.route(`${site.origin}/renderer-test`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <link rel="stylesheet" href="/notation/score-renderer.css"><style>body{margin:16px}#score{max-width:1075px}</style>
    <button id="before">Before</button><div id="score"></div><button id="after">After</button>` }));
  await page.goto(`${site.origin}/renderer-test`);
  await page.evaluate(async () => {
    const { indexScore } = await import('/notation/score-index.js');
    const { projectMeasureCard } = await import('/notation/measure-card.js');
    const { createScoreRenderer } = await import('/notation/score-renderer.js');
    const base = '/scores/bach-bwv-779-invention-no-8';
    const bytes = new Uint8Array(await (await fetch(`${base}/score.musicxml`)).arrayBuffer());
    const inventory = await (await fetch(`${base}/review-inventory.json`)).json();
    window.score = await indexScore(bytes, { slug: inventory.slug, editionId: inventory.editionId, inventory });
    window.project = id => projectMeasureCard(score, id);
    window.selected = [];
    window.renderer = createScoreRenderer(document.querySelector('#score'), { onSelect: id => selected.push(id) });
    window.render = (id = 'm000034', options = {}) => renderer.render({ score, card: project(id), ...options });
  });
});
test.afterEach(async ({ page }) => { await page.close(); await site.close(); });

test('all 34 real cards engrave backward with exact individual current/preview identities', async ({ page }) => {
  const network = [];
  page.on('request', request => network.push(request.url()));
  const results = await page.evaluate(async () => {
    const before = new XMLSerializer().serializeToString(score.createDocument()), results = [];
    for (const measure of [...score.index.measures].reverse()) {
      const card = project(measure.measureId), result = await renderer.render({ score, card });
      if (result.outcome !== 'rendered') throw result.error ?? Error(result.outcome);
      const actual = [...document.querySelectorAll('.score-viewport [data-note-id]')].map(n => n.dataset.noteId);
      const expected = [...card.currentNoteIds, ...card.previewNoteIds];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Wrong heads');
      results.push(actual.length);
    }
    if (new XMLSerializer().serializeToString(score.createDocument()) !== before) throw Error('Source changed');
    return results;
  });
  expect(results).toHaveLength(34);
  expect(results[0]).toBe(4);
  expect(results.reduce((a,b) => a+b,0)).toBe(663);
  expect(network.every(url => url.startsWith(site.origin))).toBe(true);
  expect(network.some(url => /supabase|login|session|\.wasm|\.woff/.test(url))).toBe(false);
});

test('final chord tones activate independently by mouse, real touch and keyboard with visible SVG focus', async ({ page }) => {
  expect((await page.evaluate(() => render())).outcome).toBe('rendered');
  const ids = [1,2,3,6].map(n => `m000034-n${String(n).padStart(6,'0')}`);
  const target = id => page.locator(`.score-viewport [data-note-id="${id}"]`);
  await target(ids[0]).click();
  await expect(target(ids[0])).toHaveAttribute('aria-pressed','true');
  await target(ids[1]).tap();
  await expect(target(ids[1])).toBeFocused();
  await expect(target(ids[0])).toHaveAttribute('aria-pressed','false');
  await expect(target(ids[1])).toHaveAttribute('aria-pressed','true');
  await target(ids[2]).focus(); await page.keyboard.press('Enter');
  await expect(target(ids[2])).toHaveAttribute('aria-pressed','true');
  const styles = await target(ids[2]).evaluate(hit => ({ outline: getComputedStyle(hit).outlineStyle,
    stroke: getComputedStyle(hit).stroke, dash: getComputedStyle(hit).strokeDasharray,
    head: getComputedStyle(document.querySelector('.score-viewport g.note[id="'+hit.dataset.noteId+'"] .notehead')).fill }));
  expect(styles.outline).toBe('none'); expect(styles.stroke).toBe('rgb(0, 90, 156)');
  expect(styles.dash).not.toBe('none'); expect(styles.head).toBe('rgb(165, 66, 8)');
  expect(await target(ids[2]).evaluate(n=>getComputedStyle(n).fill)).toBe('rgba(0, 0, 0, 0)');
  await page.keyboard.press('Tab'); await page.keyboard.press('Space');
  await expect(target(ids[3])).toBeFocused();
  expect(await page.evaluate(() => selected)).toEqual(ids);
});

test('set, replace, default/opposite hands and suppression genuinely reengrave without mutating either XML copy', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const first='m000034-n000001', second='m000034-n000002', lower='m000034-n000006';
    const original = new XMLSerializer().serializeToString(score.createDocument()), card = project('m000034');
    const cardBefore = new XMLSerializer().serializeToString(card.document);
    const labels = () => [...document.querySelectorAll('.score-viewport g.fing')].map(n => [n.dataset.fingeringFor,n.textContent.trim()]);
    await renderer.render({score,card,overrides:{[first]:{kind:'set',hand:'R',finger:2},[second]:{kind:'set',hand:'L',finger:4},[lower]:{kind:'set',hand:'L',finger:5}}});
    const firstLabels=labels(), oldHead=document.querySelector('.score-viewport g.note[id="'+first+'"]');
    renderer.select(first,true);
    await renderer.render({score,card,overrides:{[first]:{kind:'set',hand:'L',finger:3},[second]:{kind:'suppress'}}});
    const replaced=labels(), oldReplaced=!oldHead.isConnected;
    const selected=document.querySelector('.score-viewport [aria-pressed="true"]').dataset.noteId;
    const focused=document.activeElement.dataset.noteId;
    await renderer.render({score,card,overrides:{[first]:{kind:'suppress'}}});
    return {firstLabels,replaced,oldReplaced,selected,focused,suppressed:labels(),
      intact:original===new XMLSerializer().serializeToString(score.createDocument()) && cardBefore===new XMLSerializer().serializeToString(card.document)};
  });
  expect(result.firstLabels).toEqual(expect.arrayContaining([['m000034-n000001','2'],['m000034-n000002','L4'],['m000034-n000006','5']]));
  expect(result.replaced).toEqual([['m000034-n000001','L3']]); expect(result.suppressed).toEqual([]);
  expect(result.oldReplaced && result.intact).toBe(true);
  expect(result.selected).toBe('m000034-n000001'); expect(result.focused).toBe(result.selected);
});

test('preview edits follow canonical identity into current measure and repeated reengraving leaves one focus frame', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const id='m000034-n000002', overrides={[id]:{kind:'set',hand:'L',finger:4}};
    await render('m000033',{overrides}); renderer.select(id,true);
    const preview=document.querySelector('.score-viewport [data-fingering-for="'+id+'"]').textContent.trim();
    for(let i=0;i<4;i++)await render('m000033',{overrides});
    const focusCount=document.querySelectorAll('.score-viewport :focus').length;
    await render('m000034',{overrides,selectedNoteId:id});
    return {preview,current:document.querySelector('.score-viewport [data-fingering-for="'+id+'"]').textContent.trim(),focusCount,
      selected:document.querySelector('.score-viewport [aria-pressed="true"]').dataset.noteId,staging:document.querySelectorAll('.score-staging').length};
  });
  expect(result).toEqual({preview:'L4',current:'L4',focusCount:1,selected:'m000034-n000002',staging:0});
});

test('compact previews preserve current musical ink and two staff-spaces after visible ink at desktop and phone widths', async ({ page }) => {
  await page.evaluate(() => render('m000033',{overrides:{'m000034-n000003':{kind:'set',hand:'L',finger:5}}}));
  const geometry = () => page.evaluate(() => {
    const svg=document.querySelector('.score-viewport > svg'), common=svg.querySelector('.page-margin');
    const measures=svg.querySelectorAll('g.measure'), staff=[...measures[1].querySelectorAll('g.staff > path')];
    const ends=staff.map(p=>p.getPointAtLength(p.getTotalLength()).x), start=staff[0].getPointAtLength(0);
    const space=Math.abs(staff[1].getPointAtLength(0).y-start.y), ink=[];
    const matrix=common.getScreenCTM().inverse();
    for(const node of svg.querySelectorAll('use,path,text')){
      if(node.closest('defs,.barLine,[visibility="hidden"]')||staff.includes(node)||node.matches('g.staff > path'))continue;
      const b=node.getBBox(),m=matrix.multiply(node.getScreenCTM());
      if(b.width||b.height)ink.push(new DOMPoint(b.x+b.width,b.y+b.height).matrixTransform(m).x);
    }
    const box=svg.getBoundingClientRect(), head=svg.querySelector('.notehead').getBoundingClientRect();
    return {end:Math.min(...ends),ink:Math.max(...ink),space,width:box.width,height:box.height,headWidth:head.width,headHeight:head.height,
      overflow:document.documentElement.scrollWidth>innerWidth};
  });
  const desktop=await geometry(); expect(desktop.end-desktop.ink).toBeGreaterThanOrEqual(desktop.space*1.95);
  await page.setViewportSize({width:375,height:700}); const phone=await geometry();
  expect(phone.overflow).toBe(false); expect(phone.width).toBeLessThanOrEqual(343);
  expect(phone.headWidth/phone.headHeight).toBeCloseTo(desktop.headWidth/desktop.headHeight,3);
  expect(phone.width/phone.height).toBeCloseTo(desktop.width/desktop.height,3);
  await page.locator('.score-viewport [data-note-id="m000034-n000003"]').tap();
  await expect(page.locator('.score-viewport [data-note-id="m000034-n000003"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.locator('.score-viewport g.note[id="m000034-n000003"] .notehead use').evaluate(n=>getComputedStyle(n).fill)).toBe('rgb(165, 66, 8)');
  await page.screenshot({path:'test-results/score-renderer-phone.png'});
});

test('newer context wins an overlapping render, stale errors cannot replace it, and cancellation is distinct from failure', async ({ page }) => {
  const outcomes=await page.evaluate(async()=>{
    await render();renderer.select('m000034-n000002');
    let reject;
    Object.defineProperty(document.fonts,'ready',{configurable:true,value:new Promise((_,no)=>{reject=no;})});
    const older=render('m000033');
    // Give the already-loaded engine continuation time to reach its font boundary.
    await new Promise(done=>setTimeout(done,0));
    Object.defineProperty(document.fonts,'ready',{configurable:true,value:Promise.resolve()});
    const newer=await render('m000034'); reject(Error('late font failure'));
    const stale=await older;
    const failed=await render('m000033',{overrides:{rest:{kind:'suppress'}}});
    const failureText=document.querySelector('#score > [role]').textContent;
    const controller=new AbortController();controller.abort();
    const cancelled=await render('m000033',{signal:controller.signal});
    const current=document.querySelector('.score-viewport [aria-pressed="true"]').dataset.noteId;
    return {newer:newer.outcome,stale:stale.outcome,failed:failed.outcome,cancelled:cancelled.outcome,failureText,current,
      busy:document.querySelector('#score').getAttribute('aria-busy'),staging:document.querySelectorAll('.score-staging').length};
  });
  expect(outcomes).toMatchObject({newer:'rendered',stale:'superseded',failed:'error',cancelled:'cancelled',current:'m000034-n000002',busy:'false',staging:0});
  expect(outcomes.failureText).toContain('Previous score remains shown.');
});

test('blocked runtime fails accessibly', async ({ page }) => {
  await page.route('**/vendor/verovio/verovio-module.mjs',route=>route.abort());
  expect((await page.evaluate(async()=>{const r=await render();return {outcome:r.outcome};})).outcome).toBe('error');
  await expect(page.locator('#score > [role="alert"]')).toContainText('Unable to render score');
  await expect(page.locator('.score-viewport svg')).toHaveCount(0);
  expect(await page.evaluate(async()=>{renderer.destroy();return (await render()).outcome;})).toBe('cancelled');
});

test('pending success, cancellation and destruction cannot resurrect an older score', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    await render();
    const delay=()=>new Promise(done=>setTimeout(done,0));
    const gate=()=>{
      let release; const ready=new Promise(done=>{release=done;});
      Object.defineProperty(document.fonts,'ready',{configurable:true,value:ready}); return release;
    };
    let release=gate(), older=render('m000033'); await delay();
    Object.defineProperty(document.fonts,'ready',{configurable:true,value:Promise.resolve()});
    const newer=await render('m000001');release();const stale=await older;
    release=gate();const controller=new AbortController();const aborting=render('m000034',{signal:controller.signal});
    await delay();controller.abort();release();const cancelled=await aborting;
    const retained=document.querySelector('.score-viewport [data-note-id]').dataset.noteId;
    release=gate();const pending=render('m000033');await delay();renderer.destroy();release();const destroyed=await pending;
    return {newer:newer.outcome,stale:stale.outcome,cancelled:cancelled.outcome,destroyed:destroyed.outcome,retained,children:document.querySelector('#score').childElementCount};
  });
  expect(result).toEqual({newer:'rendered',stale:'superseded',cancelled:'cancelled',destroyed:'superseded',retained:'m000001-n000002',children:0});
});

test('cold overlapping runtime initialization commits only the latest requested card', async ({ page }) => {
  let release, requested;
  const gate=new Promise(done=>{release=done;}), started=new Promise(done=>{requested=done;});
  await page.route('**/vendor/verovio/verovio-module.mjs',async route=>{requested();await gate;await route.continue();});
  await page.evaluate(()=>{window.firstRender=render('m000033');});await started;
  await page.evaluate(()=>{window.secondRender=render('m000034');});release();
  expect(await page.evaluate(async()=>[(await firstRender).outcome,(await secondRender).outcome])).toEqual(['superseded','rendered']);
  await expect(page.locator('.score-viewport [data-note-id]')).toHaveCount(4);
});

test('redundant preview signatures disappear, while renderer trimming leaves all current notation untouched', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const [{default:createModule},{VerovioToolkit},{compactPreview}]=await Promise.all([
      import('/vendor/verovio/verovio-module.mjs'),import('/vendor/verovio/verovio.mjs'),import('/notation/score-preview.js')]);
    const tk=new VerovioToolkit(await createModule());
    try{
      tk.setOptions({pageWidth:1450,pageHeight:650,scale:50,breaks:'encoded',adjustPageHeight:true,condense:'none',svgViewBox:true});
      tk.loadData(new XMLSerializer().serializeToString(project('m000033').document));
      const stage=document.createElement('div');document.body.append(stage);stage.innerHTML=tk.renderToSVG(1);
      const svg=stage.querySelector('svg'), current=svg.querySelector('g.measure');
      const before=current.innerHTML,boxBefore=current.getBBox();compactPreview(svg);const boxAfter=current.getBBox();
      const unchanged=before===current.innerHTML&&['x','y','width','height'].every(k=>boxBefore[k]===boxAfter[k]);stage.remove();
      await render('m000033');
      const preview=document.querySelectorAll('.score-viewport g.measure')[1];
      return {unchanged,clefs:preview.querySelectorAll('g.clef').length,meters:preview.querySelectorAll('g.meterSig').length};
    }finally{tk.destroy();}
  });
  expect(result).toEqual({unchanged:true,clefs:0,meters:0});
});

test('original fingerings, cross-staff chord heads and tie/grace preview identities survive actual engraving',async({page})=>{
  const result=await page.evaluate(async()=>{
    const {indexScore,scoreEditionId}=await import('/notation/score-index.js');
    const {projectMeasureCard}=await import('/notation/measure-card.js');
    const attrs='<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>1</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>';
    const pitch=step=>`<pitch><step>${step}</step><octave>4</octave></pitch>`;
    const n=(step,extra='',staff=1,before='')=>`<note>${before}${pitch(step)}<duration>4</duration><voice>1</voice><type>quarter</type><staff>${staff}</staff>${extra}</note>`;
    const start=n('C','<tie type="start"/><notations><tied type="start"/></notations>');
    const stop=n('C','<tie type="stop"/><notations><tied type="stop"/></notations>');
    const cross=n('E','<notations><technical><fingering>L3</fingering></technical></notations>',2,'<chord/>');
    const grace=`<note><grace/>${pitch('D')}<voice>1</voice><type>eighth</type><staff>1</staff></note>`;
    // The tie is in voice1; a separate voice supplies a newly attacked grace group.
    const next=stop+cross+'<backup><duration>4</duration></backup>'+grace.replace('<voice>1','<voice>2')+n('F').replace('<voice>1','<voice>2');
    const xml=`<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1">${attrs}${start+cross}</measure><measure number="2">${next}</measure></part></score-partwise>`;
    const bytes=new TextEncoder().encode(xml),source=await indexScore(bytes,{slug:'edge-score',editionId:await scoreEditionId(bytes)});
    const card=projectMeasureCard(source,'m000001');
    const first=await renderer.render({score:source,card});
    if(first.outcome!=='rendered')throw first.error;
    const heads=[...document.querySelectorAll('.score-viewport [data-note-id]')].map(n=>n.dataset.noteId);
    const labels=[...document.querySelectorAll('.score-viewport g.fing')].map(n=>n.textContent.trim());
    const second=await renderer.render({score:source,card,overrides:{'m000001-n000002':{kind:'suppress'},'m000002-n000002':{kind:'set',hand:'R',finger:4}}});
    return {heads,labels,outcome:second.outcome,edited:[...document.querySelectorAll('.score-viewport g.fing')].map(n=>n.textContent.trim())};
  });
  expect(result.heads).toEqual(['m000001-n000001','m000001-n000002','m000002-n000002','m000002-n000003','m000002-n000004']);
  expect(result.labels).toEqual(['3','3']);expect(result.outcome).toBe('rendered');expect(result.edited).toEqual(['R4']);
});
