import {test, expect} from '@playwright/test';
import {serveSite} from './site.js';

const student = '11111111-1111-4111-8111-111111111111', assignment = '33333333-3333-4333-8333-333333333333';
const slug = 'bach-bwv-779-invention-no-8';
let site, values, revision, calls, failRead, loseSave, denySave, acknowledgements;
test.use({viewport:{width:1024,height:768},hasTouch:true});
test.beforeEach(async ({page}) => {
  site = await serveSite(); values = new Map(); revision = 0; calls = []; failRead = loseSave = denySave = false; acknowledgements = new Map();
  await page.route(/https:\/\/fonts\./, route => route.abort());
  await page.route('**/login/supabase.js?*', route => route.fulfill({contentType:'text/javascript',body:`
    import {createBrowserData} from '/login/browser-data.js';
    let actor='${student}'; const callbacks=new Set(); window.uploads=[];
    const client={auth:{getUser:async()=>({data:{user:actor?{id:actor}:null}}),onAuthStateChange(cb){callbacks.add(cb);return {data:{subscription:{unsubscribe(){callbacks.delete(cb)}}}}}},
      rpc:async(name,args)=>{const r=await fetch('/rpc/'+name,{method:'POST',body:JSON.stringify(args)}); const body=await r.json();return {data:r.ok?body:null,error:r.ok?null:body,status:r.status}}};
    const data=createBrowserData({config:{projectUrl:location.origin,publishableKey:'fixture'},createClient:()=>client,storage:localStorage,location,history});
    window.changeActor=id=>{actor=id;for(const cb of callbacks)cb('SIGNED_IN',id?{user:{id}}:null)};
    const assignments=[{assignmentId:'${assignment}',slug:'${slug}',position:1},{assignmentId:'44444444-4444-4444-8444-444444444444',slug:'czerny-op-821-no-2',position:2}];
    export const browserData={...data,acceptInvitation:async()=>({outcome:'no_invitation'}),
      validateCurrentUser:async()=>({outcome:'authenticated',userId:actor}),readAssignments:async()=>({outcome:'assignments_loaded',assignments}),
      readPracticeGeneration:async()=>({outcome:'generation_loaded',credentialGeneration:1}),
      readStudent:async()=>({outcome:'student_loaded',student:{name:'Student fixture'}}),
      ingestPractice:async event=>{uploads.push(event);return {outcome:'accepted',eventId:event.eventId}},signOut:async()=>{changeActor(null)}};
  `}));
  await page.route('**/rpc/*', async route => {
    const name=route.request().url().split('/').at(-1), args=route.request().postDataJSON(); calls.push({name,args});
    const context={contractVersion:1,studentId:student,studentName:'Student fixture',assignmentId:assignment,slug,editionId:args.requested_edition_id};
    if(name==='student_piece_fingerings_v1') {
      if(failRead)return route.fulfill({status:503,json:{message:'unavailable'}});
      return route.fulfill({json:{...context,outcome:'fingerings',measureIds:args.requested_measure_ids,snapshotRevision:String(revision),
        overrides:[...values.values()].filter(row=>args.requested_measure_ids.includes(row.measureId))}});
    }
    expect(name).toBe('student_save_piece_fingering_v1');expect(args.target_student_id).toBeUndefined();
    if(denySave)return route.fulfill({status:403,json:{code:'42501'}});
    const existing=acknowledgements.get(args.request_id);
    if(!existing){revision++;const row={noteId:args.requested_note_id,measureId:args.requested_note_id.split('-n')[0],revision:String(revision),...args.operation};
      values.set(row.noteId,row);acknowledgements.set(args.request_id,{revision:String(revision),savedAt:'2026-11-25T08:00:00Z'});}
    if(loseSave){loseSave=false;return route.abort();}
    return route.fulfill({json:{...context,outcome:existing?'already_saved':'saved',requestId:args.request_id,acknowledgement:acknowledgements.get(args.request_id),snapshotRevision:String(revision),current:values.get(args.requested_note_id)}});
  });
  await page.goto(site.origin+'/login/practice/');
  await expect(page.locator('.piece-btn')).toHaveCount(2);
});
test.afterEach(async({page})=>{await page.close();await site.close();});
const hit=(page,n)=>page.locator(`.score-viewport [data-note-id="m000034-n${String(n).padStart(6,'0')}"]`);
const saved=page=>expect(page.locator('.fingering-status')).toContainText('Fingerings saved');
async function advance(page){for(let i=0;i<3;i++)await page.getByRole('button',{name:'Good',exact:true}).click();await page.getByRole('button',{name:'Advance',exact:true}).click();}
async function open(page){await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();await saved(page);}

test('actual assigned Practice edits independent chord members, persists suppression and retries the identical lost acknowledgement',async({page})=>{
  await open(page);await expect(page.locator('#card-meta')).toContainText('1 / 34');await expect(page.locator('#card-image')).toBeHidden();
  await hit(page,1).click();await page.getByRole('button',{name:'Left hand',exact:true}).click();await page.getByRole('button',{name:'4',exact:true}).click();await saved(page);
  await expect(page.locator('[data-fingering-for="m000034-n000001"]')).toHaveText('L4');
  await expect(hit(page,1)).toHaveAttribute('aria-pressed','true');
  loseSave=true;await hit(page,2).click();await page.getByRole('button',{name:'Right hand',exact:true}).click();await page.getByRole('button',{name:'2',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry fingering',exact:true})).toBeVisible();
  await expect(page.locator('.fingering-status')).toContainText('unsaved');
  await page.getByRole('button',{name:'Retry fingering',exact:true}).click();await saved(page);
  const saves=calls.filter(c=>c.name.includes('save'));expect(saves.at(-1).args).toEqual(saves.at(-2).args);
  expect(values.size).toBe(2);await hit(page,1).click();await page.getByRole('button',{name:'Remove number',exact:true}).click();await saved(page);
  await expect(page.locator('[data-fingering-for="m000034-n000001"]')).toHaveCount(0);
  await page.getByRole('button',{name:'Back home',exact:true}).click();await open(page);
  await expect(page.locator('[data-fingering-for="m000034-n000001"]')).toHaveCount(0);
  await expect(page.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('2');
  expect(calls.every(c=>!c.args.target_student_id)).toBe(true);
});

test('all real assigned cards traverse backward; Teacher changes refresh and preview identity follows the current measure',async({page})=>{
  test.setTimeout(90000);
  await open(page);
  const measureIds=[];
  for(let i=0;i<34;i++){
    await expect(page.locator('#card-meta')).toContainText(`${i+1} / 34`);await saved(page);
    const read=calls.filter(c=>c.name==='student_piece_fingerings_v1').at(-1);measureIds.push(read.args.requested_measure_ids[0]);
    if(i<33)await advance(page);
  }
  expect(new Set(measureIds).size).toBe(34);expect(measureIds[0]).toBe('m000034');expect(measureIds.at(-1)).toBe('m000001');
  await advance(page);await expect(page.locator('#practice')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>uploads.length)).toBe(1);
  expect(await page.evaluate(()=>uploads[0].assignmentId)).toBe(assignment);
  expect(await page.evaluate(()=>uploads[0].durationSeconds)).toBeGreaterThan(0);
  await open(page);
  await advance(page);await saved(page);
  await hit(page,2).click();await page.getByRole('button',{name:'Left hand',exact:true}).click();await page.getByRole('button',{name:'5',exact:true}).click();await saved(page);
  await expect(page.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('L5');
  const frame=await page.locator('.card-frame').boundingBox();
  await page.mouse.move(frame.x+110,frame.y+12);await page.mouse.down();await page.mouse.move(frame.x+20,frame.y+12);await page.mouse.up();
  await expect(page.locator('#card-meta')).toContainText('1 / 34');await saved(page);
  await expect(page.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('L5');
  revision++;values.set('m000034-n000002',{noteId:'m000034-n000002',measureId:'m000034',kind:'set',hand:'R',finger:3,revision:String(revision)});
  await page.getByRole('button',{name:'Reload fingerings',exact:true}).click();await saved(page);
  await expect(page.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('3');
});

test('late old-measure read cannot expose overrides in a new measure',async({page})=>{
  let release, started;
  const waiting=new Promise(resolve=>{started=resolve;});
  await page.route('**/rpc/student_piece_fingerings_v1',async route=>{
    const args=route.request().postDataJSON();
    if(args.requested_measure_ids[0]!=='m000034')return route.fallback();
    started();await new Promise(resolve=>{release=resolve;});await route.fallback();
  });
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();await waiting;
  await advance(page);await saved(page);
  await expect(page.locator('#card-meta')).toContainText('2 / 34');
  release();await expect(page.locator('.score-viewport [data-note-id^="m000033-"]').first()).toBeVisible();
  await expect(page.locator('.score-viewport [data-note-id="m000034-n000001"]')).toHaveCount(1); // only its canonical downbeat preview
  await expect(page.locator('#card-meta')).toContainText('2 / 34');
});

test('verified byte loader ignores a poisoned bare module cache and rejects changed assets before private reads',async({page})=>{
  await page.route('**/notation/score-renderer.js',route=>route.fulfill({contentType:'text/javascript',body:'export function createScoreRenderer(){throw Error("Unverified cache executed")}'}));
  await page.evaluate(()=>import('/notation/score-renderer.js'));await page.unroute('**/notation/score-renderer.js');
  await open(page);await expect(hit(page,1)).toBeVisible();
  await page.getByRole('button',{name:'Back home',exact:true}).click();await page.reload();await expect(page.locator('.piece-btn')).toHaveCount(2);const previous=calls.length;
  await page.route('**/notation/score-index.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\n// altered byte'});});
  await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect(page.locator('.fingering-status')).toContainText('Latest fingerings unavailable');
  expect(calls.length).toBe(previous);await expect(page.locator('.score-viewport svg')).toHaveCount(0);
});

test('failed fresh read never displays defaults; denial and identity change remove private SVG; legacy PNG Practice remains',async({page})=>{
  failRead=true;await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect(page.locator('.fingering-status')).toContainText('Latest fingerings unavailable');
  await expect(page.locator('.score-viewport svg')).toHaveCount(0);await expect(page.locator('#card-image')).toBeHidden();
  failRead=false;await page.getByRole('button',{name:'Reload fingerings',exact:true}).click();await saved(page);
  denySave=true;await hit(page,1).click();await page.getByRole('button',{name:'3',exact:true}).click();
  await expect(page.locator('.fingering-status')).toContainText('access changed');await expect(page.locator('.score-viewport svg')).toHaveCount(0);
  denySave=false;await page.getByRole('button',{name:'Reload fingerings',exact:true}).click();await saved(page);
  await page.evaluate(()=>changeActor('55555555-5555-4555-8555-555555555555'));
  await expect(page.locator('.score-viewport svg')).toHaveCount(0);
  await page.getByRole('button',{name:'Back home',exact:true}).click();const previous=calls.length;
  await page.getByRole('button',{name:/Czerny/}).click();await expect(page.locator('#card-image')).toBeVisible();expect(calls.length).toBe(previous);
});

test('landscape phone keeps note touch selection and editor controls usable',async({page})=>{
  await page.setViewportSize({width:844,height:390});await open(page);
  await hit(page,2).tap();await expect(hit(page,2)).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Left hand',exact:true}).tap();await page.getByRole('button',{name:'5',exact:true}).tap();await saved(page);
  await expect(page.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('L5');
  await expect(page.getByRole('button',{name:'Remove number',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Good',exact:true})).toBeInViewport();
  await page.screenshot({path:'/private/tmp/apt-63-phone.png'});
  const contained=await page.locator('.score-viewport [data-note-id]').evaluateAll(nodes=>nodes.every(node=>{
    const box=node.getBoundingClientRect(),frame=node.closest('.score-renderer').getBoundingClientRect();
    return box.top>=frame.top && box.bottom<=frame.bottom;
  }));expect(contained).toBe(true);
  await page.screenshot({path:'/private/tmp/apt-63-phone.png'});
});
