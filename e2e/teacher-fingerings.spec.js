import {test,expect} from '@playwright/test';
import {serveSite} from './site.js';
import {mockAdapter,adapterModule,response,studentId,secondStudent} from './teacher-fixture.js';
const teacher='c1000000-0000-4000-8000-000000000001',assignment='c2000000-0000-4000-8000-000000000001',slug='bach-bwv-779-invention-no-8';
let site,values,revision,receipts,calls,denyTeacher,failRead,loseSave;
test.use({viewport:{width:1024,height:768}});
test.beforeEach(async({page})=>{
  site=await serveSite();values=new Map();revision=0;receipts=new Map();calls=[];denyTeacher=failRead=loseSave=false;
  const wire=async route=>{
    const name=route.request().url().split('/').at(-1),args=route.request().postDataJSON();calls.push({name,args});
    const isTeacher=name.startsWith('teacher_'),target=isTeacher?args.target_student_id:studentId;
    if(isTeacher&&denyTeacher)return route.fulfill({status:403,json:{code:'42501'}});
    if(failRead&&!name.includes('save'))return route.fulfill({status:503,json:{message:'Unavailable'}});
    const context={contractVersion:1,studentId:target,studentName:target===studentId?'Student B':'Student A',assignmentId:assignment,slug,editionId:args.requested_edition_id};
    if(!name.includes('save'))return route.fulfill({json:{...context,outcome:'fingerings',measureIds:args.requested_measure_ids,snapshotRevision:String(revision),
      overrides:[...values.values()].filter(row=>row.student===target).map(({student,...row})=>row)}});
    const old=receipts.get(args.request_id);if(!old){revision++;const row={student:target,noteId:args.requested_note_id,measureId:args.requested_note_id.split('-n')[0],revision:String(revision),...args.operation};
      values.set(target+'|'+row.noteId,row);receipts.set(args.request_id,{revision:String(revision),savedAt:'2026-11-25T14:00:00Z'});}
    if(loseSave){loseSave=false;return route.abort();}
    const {student,...current}=values.get(target+'|'+args.requested_note_id);
    return route.fulfill({json:{...context,outcome:old?'already_saved':'saved',requestId:args.request_id,acknowledgement:receipts.get(args.request_id),snapshotRevision:String(revision),current}});
  };
  await page.context().route('**/fingering-rpc/*',wire);
  const model=response();model.students[0].name='Student B';model.students[0].pieces=[{...model.students[0].pieces[0],slug}];
  model.students.push({...structuredClone(model.students[0]),studentId:secondStudent,name:'Student A'});
  await mockAdapter(page,{userId:teacher,loginId:teacher,response:model});
  const module=adapterModule.replace('state.calls.push(name);',`if(name.includes('fingering')){const r=await fetch('/fingering-rpc/'+name,{method:'POST',body:JSON.stringify(args)});const body=await r.json();return {data:r.ok?body:null,error:r.ok?null:body,status:r.status};}state.calls.push(name);`);
  await page.route('**/login/supabase.js*',route=>route.fulfill({contentType:'text/javascript',body:module}));
  await page.goto(site.origin+'/login/teacher/student/?student='+studentId);
  await expect(page.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true})).toBeVisible();
});
test.afterEach(async({page})=>{await page.close();await site.close();});
const dialog=page=>page.locator('dialog.teacher-score');
const hit=(page,n)=>dialog(page).locator(`[data-note-id="m000034-n${String(n).padStart(6,'0')}"]`);
const saved=page=>expect(dialog(page).locator('.fingering-status')).toContainText('Fingerings saved');
async function open(page){await page.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true}).click();await saved(page);}
async function lastPage(page){const next=dialog(page).getByRole('button',{name:'Next page',exact:true});for(let i=0;i<34&&await next.isEnabled();i++){await next.click();await saved(page);}await expect(hit(page,1)).toBeVisible();}

test('actual Teacher detail opens named pages, edits independent chord tones, suppresses and refreshes on reopen without Practice writes',async({page})=>{
  await open(page);await expect(dialog(page).locator('h2')).toHaveText('Student B — Bach Inv. No. 8');await lastPage(page);
  await hit(page,1).click();await dialog(page).getByRole('button',{name:'Left hand',exact:true}).click();await dialog(page).getByRole('button',{name:'4',exact:true}).click();await saved(page);
  await expect(dialog(page).locator('[data-fingering-for="m000034-n000001"]')).toHaveText('L4');
  await hit(page,2).click();await dialog(page).getByRole('button',{name:'Right hand',exact:true}).click();await dialog(page).getByRole('button',{name:'2',exact:true}).click();await saved(page);
  await hit(page,1).click();await dialog(page).getByRole('button',{name:'Remove number',exact:true}).click();await saved(page);
  await expect(dialog(page).locator('[data-fingering-for="m000034-n000001"]')).toHaveCount(0);
  await dialog(page).getByRole('button',{name:'Close score',exact:true}).click();await open(page);await lastPage(page);
  await expect(dialog(page).locator('[data-fingering-for="m000034-n000002"]')).toHaveText('2');
  expect(calls.every(c=>c.args.target_student_id===studentId)).toBe(true);
  const effects=await page.evaluate(async()=>({calls:teacherTest.calls,publications:teacherTest.publications,databases:await indexedDB.databases()}));
  expect(effects.publications).toEqual([]);expect(effects.databases).toEqual([]);expect(effects.calls.some(name=>/ingest|practice_generation/.test(name))).toBe(false);
});

test('lost save acknowledgement remains unsaved through page reflow and retries the identical operation',async({page})=>{
  await open(page);await lastPage(page);await hit(page,2).click();loseSave=true;
  await dialog(page).getByRole('button',{name:'5',exact:true}).click();await expect(dialog(page).getByRole('button',{name:'Retry fingering',exact:true})).toBeVisible();
  await dialog(page).getByLabel('Notation size').selectOption('60');await expect(dialog(page).locator('.fingering-status')).toContainText('unsaved');
  await hit(page,2).click();await dialog(page).getByRole('button',{name:'Retry fingering',exact:true}).click();await saved(page);
  const writes=calls.filter(c=>c.name.includes('save'));expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);
});

test('failed latest reads and reassignment denial hide score state and never display defaults',async({page})=>{
  failRead=true;await page.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true}).click();
  await expect(dialog(page).locator('.fingering-status')).toContainText('Latest fingerings unavailable');await expect(dialog(page).locator('svg')).toHaveCount(0);
  failRead=false;await dialog(page).getByRole('button',{name:'Reload fingerings',exact:true}).click();await saved(page);await lastPage(page);
  denyTeacher=true;await hit(page,1).click();await dialog(page).getByRole('button',{name:'3',exact:true}).click();
  await expect(dialog(page).locator('.fingering-status')).toContainText('access changed');await expect(dialog(page).locator('svg')).toHaveCount(0);
});

test('switching Student context cannot carry private overrides to the other Student',async({page})=>{
  await open(page);await lastPage(page);await hit(page,1).click();await dialog(page).getByRole('button',{name:'5',exact:true}).click();await saved(page);
  await page.evaluate(second=>{teacherTest.noteData.studentId=second;},secondStudent);
  await page.goto(site.origin+'/login/teacher/student/?student='+secondStudent);
  await page.evaluate(second=>{teacherTest.noteData.studentId=second;},secondStudent);await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await open(page);await lastPage(page);await expect(dialog(page).locator('h2')).toHaveText('Student A — Bach Inv. No. 8');
  await expect(dialog(page).locator('[data-fingering-for="m000034-n000001"]')).toHaveCount(0);
  expect(calls.filter(c=>c.name.includes('save'))).toHaveLength(1);expect(calls.at(-1).args.target_student_id).toBe(secondStudent);
});

test('a Teacher UI save is visible in actual Student Practice when the measure reopens',async({page})=>{
  await open(page);await lastPage(page);await hit(page,2).click();await dialog(page).getByRole('button',{name:'4',exact:true}).click();await saved(page);
  await dialog(page).getByRole('button',{name:'Close score',exact:true}).click();
  const studentPage=await page.context().newPage();
  await studentPage.route('**/login/supabase.js*',route=>route.fulfill({contentType:'text/javascript',body:`
    import {createBrowserData} from '/login/browser-data.js';
    const client={auth:{getUser:async()=>({data:{user:{id:'${studentId}'}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}},
      rpc:async(name,args)=>{const r=await fetch('/fingering-rpc/'+name,{method:'POST',body:JSON.stringify(args)});const body=await r.json();return {data:r.ok?body:null,error:r.ok?null:body,status:r.status}}};
    const data=createBrowserData({config:{},createClient:()=>client,storage:sessionStorage,location,history});
    export const browserData={...data,acceptInvitation:async()=>({outcome:'no_invitation'}),validateCurrentUser:async()=>({outcome:'authenticated',userId:'${studentId}'}),
      readAssignments:async()=>({outcome:'assignments_loaded',assignments:[{assignmentId:'${assignment}',slug:'${slug}',position:1}]}),
      readPracticeGeneration:async()=>({outcome:'generation_loaded',credentialGeneration:1}),readStudent:async()=>({outcome:'student_loaded',student:{name:'Student B'}}),
      ingestPractice:async event=>({outcome:'accepted',eventId:event.eventId})};
  `}));
  try{
    await studentPage.goto(site.origin+'/login/practice/');await studentPage.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
    await expect(studentPage.locator('.fingering-status')).toContainText('Fingerings saved');
    await expect(studentPage.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('4');
    await page.bringToFront();await expect(page.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true})).toBeVisible();await open(page);await lastPage(page);
    await hit(page,2).click();await dialog(page).getByRole('button',{name:'Left hand',exact:true}).click();await dialog(page).getByRole('button',{name:'3',exact:true}).click();await saved(page);
    await studentPage.bringToFront();await studentPage.getByRole('button',{name:'Reload fingerings',exact:true}).click();
    await expect(studentPage.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('L3');
  }finally{await studentPage.close();}
});

test('an identity change immediately clears the private Teacher engraving and editor',async({page})=>{
  await open(page);await lastPage(page);await hit(page,2).click();
  await page.evaluate(()=>{teacherTest.userId='c1000000-0000-4000-8000-000000000009';teacherTest.authEventCallback('SIGNED_IN',{user:{id:teacherTest.userId}});});
  await expect(dialog(page).locator('svg')).toHaveCount(0);await expect(dialog(page).locator('.fingering-status')).toContainText('access changed');
  await expect(dialog(page).getByRole('button',{name:'Remove number',exact:true})).toBeDisabled();
});

for(const action of ['switch identity','sign out'])test(`${action} during a held page refresh immediately clears private state`,async({page})=>{
  await open(page);await lastPage(page);await hit(page,2).click();await dialog(page).getByRole('button',{name:'5',exact:true}).click();await saved(page);
  await expect(dialog(page).locator('[data-fingering-for="m000034-n000002"]')).toHaveText('5');
  let release,started,heldRequest;const waiting=new Promise(resolve=>{started=resolve;});
  await page.route('**/fingering-rpc/teacher_student_piece_fingerings_v1',async route=>{heldRequest=route.request();started();await new Promise(resolve=>{release=resolve;});await route.fallback();});
  await dialog(page).getByLabel('Notation size').selectOption('60');await waiting;
  await page.evaluate(action=>{
    teacherTest.userId=action==='sign out'?null:'c1000000-0000-4000-8000-000000000009';
    teacherTest.authEventCallback(teacherTest.userId?'SIGNED_IN':'SIGNED_OUT',teacherTest.userId?{user:{id:teacherTest.userId}}:null);
  },action);
  try{
    // Invalidation must clear even before the old RPC finishes.
    await expect(dialog(page).locator('svg')).toHaveCount(0);
    await expect(dialog(page).locator('h2')).toHaveText('Score unavailable');
    await expect(dialog(page).locator('.fingering-status')).toContainText('access changed');
    await expect(dialog(page).getByRole('button',{name:'Remove number',exact:true})).toBeDisabled();
    await expect(dialog(page).getByRole('button',{name:'Reload fingerings',exact:true})).toBeDisabled();
    await expect(page.locator('#teacher-score-entry')).toBeEmpty();
  }finally{const response=page.waitForResponse(response=>response.request()===heldRequest);release();await (await response).finished();}
  await expect(dialog(page).locator('svg')).toHaveCount(0);
  await expect(dialog(page).locator('h2')).toHaveText('Score unavailable');
});

test('an older held refresh cannot clear a newly reopened Teacher editor',async({page})=>{
  await open(page);await lastPage(page);
  let release,started,heldRequest,held=false;const waiting=new Promise(resolve=>{started=resolve;});
  await page.route('**/fingering-rpc/teacher_student_piece_fingerings_v1',async route=>{
    if(!held){held=true;heldRequest=route.request();started();await new Promise(resolve=>{release=resolve;});}await route.fallback();
  });
  await dialog(page).getByLabel('Notation size').selectOption('60');await waiting;
  await dialog(page).getByRole('button',{name:'Close score',exact:true}).click();await open(page);
  const response=page.waitForResponse(response=>response.request()===heldRequest);release();await (await response).finished();
  await saved(page);await expect(dialog(page).locator('h2')).toHaveText('Student B — Bach Inv. No. 8');
  await expect(dialog(page).locator('.score-pages-viewport > svg')).toBeVisible();
  await dialog(page).locator('[data-note-id]').first().click();await dialog(page).getByRole('button',{name:'3',exact:true}).click();await saved(page);
});

for(const action of ['switch identity','sign out'])test(`${action} during the initial private read clears the opening context`,async({page})=>{
  let release,started,request;const waiting=new Promise(resolve=>{started=resolve;});
  await page.route('**/fingering-rpc/teacher_student_piece_fingerings_v1',async route=>{request=route.request();started();await new Promise(resolve=>{release=resolve;});await route.fallback();});
  await page.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true}).click();await waiting;
  await page.evaluate(action=>{teacherTest.userId=action==='sign out'?null:'c1000000-0000-4000-8000-000000000009';
    teacherTest.authEventCallback(teacherTest.userId?'SIGNED_IN':'SIGNED_OUT',teacherTest.userId?{user:{id:teacherTest.userId}}:null);},action);
  try{
    await expect(dialog(page).locator('h2')).toHaveText('Score unavailable');
    await expect(dialog(page).locator('svg')).toHaveCount(0);await expect(page.locator('#teacher-score-entry')).toBeEmpty();
    await expect(dialog(page).getByRole('button',{name:'Reload fingerings',exact:true})).toBeDisabled();
  }finally{const response=page.waitForResponse(response=>response.request()===request);release();await (await response).finished();}
  await expect(dialog(page).locator('h2')).toHaveText('Score unavailable');
  await expect(dialog(page).locator('.fingering-status')).toContainText('access changed');
});

test('a late save acknowledgement cannot erase a failed page read or reveal stale overrides',async({page})=>{
  await open(page);await lastPage(page);await hit(page,2).click();
  let release,started,request;const waiting=new Promise(resolve=>{started=resolve;});
  await page.route('**/fingering-rpc/teacher_save_student_piece_fingering_v1',async route=>{request=route.request();started();await new Promise(resolve=>{release=resolve;});await route.fallback();});
  await dialog(page).getByRole('button',{name:'5',exact:true}).click();await waiting;
  const note='m000025-n000001';revision++;values.set(studentId+'|'+note,{student:studentId,noteId:note,measureId:'m000025',revision:String(revision),kind:'set',hand:'L',finger:4});
  failRead=true;await dialog(page).getByRole('button',{name:'Previous page',exact:true}).click();
  await expect(dialog(page).locator('.fingering-status')).toContainText('Latest fingerings unavailable');
  const response=page.waitForResponse(response=>response.request()===request);release();await (await response).finished();
  await expect(dialog(page).locator('.score-pages-viewport > svg')).not.toBeVisible();
  await expect(dialog(page).locator('.fingering-status')).toContainText('Latest fingerings unavailable');
  failRead=false;await dialog(page).getByRole('button',{name:'Reload fingerings',exact:true}).click();await saved(page);
  for(let i=0;i<34&&!await dialog(page).locator(`[data-note-id="${note}"]`).count();i++){
    await dialog(page).getByRole('button',{name:'Next page',exact:true}).click();await saved(page);
  }
  await expect(dialog(page).locator(`[data-fingering-for="${note}"]`)).toHaveText('L4');
});

for(const action of ['switch identity','sign out'])test(`${action} while public score assets load clears the opening context`,async({page})=>{
  let release,started,finished;const waiting=new Promise(resolve=>{started=resolve;}),done=new Promise(resolve=>{finished=resolve;});
  await page.route('**/notation/editions/*.json',async route=>{started();await new Promise(resolve=>{release=resolve;});
    try{await route.fallback();}catch{/* Auth invalidation aborted this public request. */}finally{finished();}});
  await page.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true}).click();await waiting;
  await page.evaluate(action=>{teacherTest.userId=action==='sign out'?null:'c1000000-0000-4000-8000-000000000009';
    teacherTest.authEventCallback(teacherTest.userId?'SIGNED_IN':'SIGNED_OUT',teacherTest.userId?{user:{id:teacherTest.userId}}:null);},action);
  try{
    await expect(dialog(page).locator('h2')).toHaveText('Score unavailable');await expect(page.locator('#teacher-score-entry')).toBeEmpty();
    await expect(dialog(page).getByRole('button',{name:'Reload fingerings',exact:true})).toBeDisabled();
  }finally{release();await done;}
  await expect(dialog(page).locator('svg')).toHaveCount(0);expect(calls).toEqual([]);
});

test('phone reflow retains the selected chord member with named context and reachable controls',async({page})=>{
  await open(page);await lastPage(page);await hit(page,6).click();
  await page.setViewportSize({width:844,height:390});await expect(hit(page,6)).toHaveAttribute('aria-pressed','true');await expect(hit(page,6)).toBeVisible();
  await dialog(page).getByRole('button',{name:'Left hand',exact:true}).click();await dialog(page).getByRole('button',{name:'5',exact:true}).click();await saved(page);
  await expect(dialog(page).locator('[data-fingering-for="m000034-n000006"]')).toHaveText('5');
  await expect(dialog(page).getByRole('button',{name:'Remove number',exact:true})).toBeInViewport();
  await expect(dialog(page).locator('h2')).toHaveText('Student B — Bach Inv. No. 8');
  await page.screenshot({path:'/private/tmp/apt-65-phone.png'});
});

test('a closed score cannot be resurrected by an older pending private read',async({page})=>{
  let release,started;const waiting=new Promise(resolve=>{started=resolve;});
  await page.route('**/fingering-rpc/teacher_student_piece_fingerings_v1',async route=>{started();await new Promise(resolve=>{release=resolve;});await route.fallback();});
  await page.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true}).click();await waiting;
  await dialog(page).getByRole('button',{name:'Close score',exact:true}).click();release();
  await expect(dialog(page)).not.toBeVisible();await expect(dialog(page).locator('svg')).toHaveCount(0);
  expect(calls.some(c=>c.name.includes('save'))).toBe(false);
});
