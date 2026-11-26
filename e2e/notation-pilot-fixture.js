import {mockAdapter,adapterModule,response,studentId} from './teacher-fixture.js';

export {studentId};
export const slug='bach-bwv-779-invention-no-8';
export const assignment='c2000000-0000-4000-8000-000000000001';
const teacher='c1000000-0000-4000-8000-000000000001';

// One synthetic wire store shared by real Student, Teacher and public entrypoints.
// Backend authorization is covered separately by Sludge/local/hosted evidence.
export async function pilotFixture(context){
  const state={values:new Map(),receipts:new Map(),revision:0,calls:[],lostAck:false,teacherAllowed:true,
    publicEnabled:true,studentEnabled:true,teacherEnabled:true,uploads:[],holdPractice:false,errors:[]};
  context.on('page',page=>page.on('pageerror',error=>state.errors.push(error.message)));
  await context.route(/https:\/\/fonts\./,route=>route.abort());
  await context.route('**/notation/public-score-pilot.js',async route=>{
    const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('enabled: true',`enabled: ${state.publicEnabled}`)});
  });
  await context.route('**/login/notation-pilot.js',async route=>{
    const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())
      .replace('student: true',`student: ${state.studentEnabled}`).replace('teacher: true',`teacher: ${state.teacherEnabled}`)});
  });
  await context.route('**/pilot-rpc/*',async route=>{
    const name=route.request().url().split('/').at(-1),args=route.request().postDataJSON();state.calls.push({name,args});
    const isTeacher=name.startsWith('teacher_');
    if(isTeacher&&(!state.teacherAllowed||args.target_student_id!==studentId))return route.fulfill({status:403,json:{code:'42501'}});
    const scope={contractVersion:1,studentId,studentName:'Student B',assignmentId:assignment,slug,editionId:args.requested_edition_id};
    if(!name.includes('save'))return route.fulfill({json:{...scope,outcome:'fingerings',measureIds:args.requested_measure_ids,
      snapshotRevision:String(state.revision),overrides:[...state.values.values()].filter(row=>args.requested_measure_ids.includes(row.measureId))}});
    const previous=state.receipts.get(args.request_id);
    const payload=JSON.stringify({name,...args});
    if(previous&&previous.payload!==payload)return route.fulfill({json:{...scope,outcome:'idempotency_conflict'}});
    if(!previous){
      state.revision++;state.values.set(args.requested_note_id,{noteId:args.requested_note_id,
        measureId:args.requested_note_id.split('-n')[0],revision:String(state.revision),...args.operation});
      state.receipts.set(args.request_id,{payload,acknowledgement:{revision:String(state.revision),savedAt:'2026-11-26T08:00:00Z'}});
    }
    if(state.lostAck){state.lostAck=false;return route.abort();}
    await route.fulfill({json:{...scope,outcome:previous?'already_saved':'saved',requestId:args.request_id,
      acknowledgement:state.receipts.get(args.request_id).acknowledgement,snapshotRevision:String(state.revision),current:state.values.get(args.requested_note_id)}});
  });
  await context.route('**/pilot-practice-upload',async route=>{
    const event=route.request().postDataJSON();state.uploads.push(event);
    await route.fulfill({json:state.holdPractice?{outcome:'retryable_failure'}:{contractVersion:1,outcome:'accepted',eventId:event.eventId}});
  });
  async function student(page){
    await page.route('**/login/supabase.js*',route=>route.fulfill({contentType:'text/javascript',body:`
      import {createBrowserData} from './browser-data.js';
      const client={auth:{getUser:async()=>({data:{user:{id:'${studentId}'}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}},
        rpc:async(name,args)=>{const r=await fetch('/pilot-rpc/'+name,{method:'POST',body:JSON.stringify(args)});const body=await r.json();return {data:r.ok?body:null,error:r.ok?null:body,status:r.status}}};
      const data=createBrowserData({config:{},createClient:()=>client,storage:sessionStorage,location,history});
      export const browserData={...data,acceptInvitation:async()=>({outcome:'no_invitation'}),validateCurrentUser:async()=>({outcome:'authenticated',userId:'${studentId}'}),
        readAssignments:async()=>({outcome:'assignments_loaded',assignments:[{assignmentId:'${assignment}',slug:'${slug}',position:1}]}),
        readPracticeGeneration:async()=>({outcome:'generation_loaded',credentialGeneration:1}),readStudent:async()=>({outcome:'student_loaded',student:{name:'Student B'}}),
        ingestPractice:async event=>(await fetch('/pilot-practice-upload',{method:'POST',body:JSON.stringify(event)})).json()};
    `}));
  }
  async function teacherPage(page){
    const model=response();model.students[0].name='Student B';model.students[0].pieces=[{...model.students[0].pieces[0],slug}];
    await mockAdapter(page,{userId:teacher,loginId:teacher,response:model});
    const module=adapterModule.replace('state.calls.push(name);',`if(name.includes('fingering')){const r=await fetch('/pilot-rpc/'+name,{method:'POST',body:JSON.stringify(args)});const body=await r.json();return {data:r.ok?body:null,error:r.ok?null:body,status:r.status};}state.calls.push(name);`);
    await page.route('**/login/supabase.js*',route=>route.fulfill({contentType:'text/javascript',body:module}));
  }
  return {state,student,teacher:teacherPage};
}
