import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFingeringAdapter } from '../docs/login/fingerings.js';
import { createBrowserData } from '../docs/login/browser-data.js';
import { createRecoveryProgress } from '../docs/login/recovery-progress.js';

const student='11111111-1111-4111-8111-111111111111', teacher='22222222-2222-4222-8222-222222222222';
const assignment='33333333-3333-4333-8333-333333333333', stranger='44444444-4444-4444-8444-444444444444';
const edition='sha256:'+'a'.repeat(64), measure='m000034', a=measure+'-n000001', b=measure+'-n000002';
const index={indexVersion:1,slug:'bach-bwv-779-invention-no-8',editionId:edition,measures:[{measureId:measure,notes:[{noteId:a},{noteId:b}]}]};
const input={assignmentId:assignment,index,measureIds:[measure]};
const context={contractVersion:1,studentId:student,studentName:'Student B',assignmentId:assignment,slug:index.slug,editionId:edition};
const read=(overrides=[],snapshotRevision='0')=>({...context,outcome:'fingerings',measureIds:[measure],snapshotRevision,overrides});
const row=(noteId,revision,kind='set',finger=3)=>({measureId:measure,noteId,revision,kind,...(kind==='set'?{hand:'R',finger}:{})});
const saved=(args,current,snapshotRevision=current.revision,outcome='saved',ack=current.revision)=>({...context,outcome,
  requestId:args.request_id,snapshotRevision,current,acknowledgement:{revision:ack,savedAt:'2026-11-24T12:00:00.000000Z'}});
const wire=data=>({data,error:null,status:200});
const tick=()=>new Promise(done=>setImmediate(done));
function setup(handler,options={}){
  let userId=student;const calls=[];
  const adapter=createFingeringAdapter({identity:async()=>({outcome:'authenticated',userId}),request:async(name,args)=>{
    calls.push({name,args:structuredClone(args)});return handler(name,args);
  },...options});
  return {adapter,calls,switchUser:id=>{userId=id;}};
}

test('own Student read has no target selector and Teacher read uses the exact public RPC/context',async()=>{
  const own=setup(()=>wire(read()));assert.equal((await own.adapter.open(input)).outcome,'fingerings');
  assert.deepEqual(own.calls[0],{name:'student_piece_fingerings_v1',args:{requested_slug:index.slug,requested_edition_id:edition,requested_measure_ids:[measure]}});
  assert.deepEqual(await own.adapter.open({...input,studentId:stranger}),{outcome:'invalid_request'});
  assert.equal(own.calls.length,1);
  const other=setup(()=>wire(read()));other.switchUser(teacher);
  assert.equal((await other.adapter.open({...input,role:'teacher',studentId:student})).outcome,'fingerings');
  assert.equal(other.calls[0].name,'teacher_student_piece_fingerings_v1');assert.equal(other.calls[0].args.target_student_id,student);
});

test('set/suppress use exact save names, genuine acknowledgements and immutable operation copies',async()=>{
  let counter=0;
  const own=setup((name,args)=>name==='student_piece_fingerings_v1'?wire(read()):wire(saved(args,row(args.requested_note_id,String(++counter),args.operation.kind))));
  await own.adapter.open(input);
  const op={kind:'set',hand:'R',finger:3},pending=own.adapter.save(a,op);op.finger=5;
  assert.equal((await pending).outcome,'saved');assert.equal(own.calls[1].name,'student_save_piece_fingering_v1');assert.equal(own.calls[1].args.operation.finger,3);
  assert.equal((await own.adapter.save(a,{kind:'suppress'})).outcome,'saved');
  assert.deepEqual(own.adapter.snapshot().overrides,[row(a,'2','suppress')]);assert.equal(own.adapter.snapshot().drafts.length,0);
  const other=setup((name,args)=>name==='teacher_student_piece_fingerings_v1'?wire(read()):wire(saved(args,row(a,'1'))));
  other.switchUser(teacher);await other.adapter.open({...input,role:'teacher',studentId:student});
  assert.equal((await other.adapter.save(a,{kind:'set',hand:'R',finger:3})).outcome,'saved');
  assert.equal(other.calls[1].name,'teacher_save_student_piece_fingering_v1');assert.equal(other.calls[1].args.target_student_id,student);
});

test('failed read differs from an authorized empty scope; reopen always fetches latest',async()=>{
  let response={error:{code:'network'},status:503};const {adapter,calls}=setup(()=>response);
  assert.equal((await adapter.open(input)).outcome,'fingering_unavailable');assert.equal(adapter.snapshot().outcome,'not_loaded');
  response=wire(read());assert.equal((await adapter.open(input)).outcome,'fingerings');assert.deepEqual(adapter.snapshot().overrides,[]);
  response=wire(read([row(a,'9','suppress')],'10'));await adapter.open(input);
  assert.equal(adapter.snapshot().overrides[0].revision,'9');assert.equal(calls.length,3);
});

test('unknown write outcome rereads confirmed values but retains an unsaved immutable retry key',async()=>{
  let writes=0,readState=read();
  const {adapter,calls}=setup((name,args)=>{
    if(name==='student_piece_fingerings_v1')return wire(readState);
    if(++writes===1){readState=read([row(a,'1')],'1');throw Error('Lost acknowledgement after commit');}
    return wire(saved(args,row(a,'2','suppress'),'2','already_saved','1'));
  });
  await adapter.open(input);assert.equal((await adapter.save(a,{kind:'set',hand:'R',finger:3})).outcome,'fingering_unavailable');
  assert.equal(adapter.snapshot().drafts[0].status,'unsaved');assert.equal(adapter.snapshot().overrides[0].revision,'1');
  const retry=await adapter.retry(a);assert.equal(retry.outcome,'already_saved');assert.equal(retry.acknowledgement.revision,'1');
  assert.equal(adapter.snapshot().overrides[0].kind,'suppress');assert.equal(adapter.snapshot().drafts.length,0);
  const mutations=calls.filter(c=>c.name==='student_save_piece_fingering_v1');assert.deepEqual(mutations[0].args,mutations[1].args);
});

test('overlapping same-note replies cannot replace a newer authoritative suppression',async()=>{
  const waiting=[];const {adapter}=setup((name,args)=>name==='student_piece_fingerings_v1'?wire(read()):new Promise(done=>waiting.push({args,done})));
  await adapter.open(input);const first=adapter.save(a,{kind:'set',hand:'R',finger:3}),second=adapter.save(a,{kind:'suppress'});await tick();
  waiting[1].done(wire(saved(waiting[1].args,row(a,'10','suppress'))));await second;
  waiting[0].done(wire(saved(waiting[0].args,row(a,'9'))));const old=await first;
  assert.equal(old.snapshot.overrides[0].kind,'suppress');assert.equal(adapter.snapshot().snapshotRevision,'10');assert.equal(adapter.snapshot().drafts.length,0);
});

test('out-of-order independent notes retain separate values and integer-safe revisions',async()=>{
  const waiting=[];const {adapter}=setup((name,args)=>name==='student_piece_fingerings_v1'?wire(read()):new Promise(done=>waiting.push({args,done})));
  await adapter.open(input);const first=adapter.save(a,{kind:'set',hand:'R',finger:3}),second=adapter.save(b,{kind:'suppress'});await tick();
  waiting[1].done(wire(saved(waiting[1].args,row(b,'9007199254740993','suppress'))));await second;
  waiting[0].done(wire(saved(waiting[0].args,row(a,'9007199254740992'))));await first;
  assert.deepEqual(adapter.snapshot().overrides.map(r=>r.noteId),[a,b]);assert.equal(adapter.snapshot().snapshotRevision,'9007199254740993');
});

test('timeout is unsaved, its late success ignored, and retry reuses the original payload',async()=>{
  let late, firstArgs, attempt=0;
  const {adapter}=setup((name,args)=>{
    if(name==='student_piece_fingerings_v1')return wire(read());
    if(++attempt===1){firstArgs=structuredClone(args);return new Promise(done=>{late=done;});}
    assert.deepEqual(args,firstArgs);return wire(saved(args,row(a,'2','suppress'),'2','already_saved','1'));
  },{timeoutMs:10});
  await adapter.open(input);assert.equal((await adapter.save(a,{kind:'set',hand:'R',finger:3})).outcome,'fingering_unavailable');
  assert.equal(adapter.snapshot().drafts[0].status,'unsaved');await adapter.retry(a);
  late(wire(saved(firstArgs,row(a,'1'))));await tick();assert.equal(adapter.snapshot().overrides[0].kind,'suppress');
});

test('permission/lifecycle denial clears private data and remains distinct from transport failure',async()=>{
  let deny=false;const {adapter}=setup(()=>deny?{error:{code:'42501'},status:403}:wire(read([row(a,'1')],'1')));
  await adapter.open(input);deny=true;assert.equal((await adapter.save(a,{kind:'suppress'})).outcome,'fingering_access_denied');
  assert.deepEqual(adapter.snapshot(),{outcome:'not_loaded'});
});

test('navigation and actual identity switches reject late private replies',async()=>{
  let release, wait=false;const view=setup(()=>wait?new Promise(done=>{release=done;}):wire(read([row(a,'1')],'1')));
  await view.adapter.open(input);wait=true;const old=view.adapter.open(input);await tick();view.adapter.clear();
  release(wire(read([row(a,'2')],'2')));assert.equal((await old).outcome,'superseded');assert.equal(view.adapter.snapshot().outcome,'not_loaded');
  wait=false;await view.adapter.open(input);wait=true;const saving=view.adapter.save(a,{kind:'suppress'});await tick();
  view.switchUser(stranger);release(wire(saved({request_id:'55555555-5555-4555-8555-555555555555'},row(a,'3','suppress'))));
  assert.equal((await saving).outcome,'fingering_access_denied');assert.equal(view.adapter.snapshot().outcome,'not_loaded');
});

test('Auth invalidation notifications cannot resurrect old private values',async()=>{
  const events=[];const {adapter}=setup(()=>wire(read([row(a,'1')],'1')),{onChange:value=>events.push(value)});
  await adapter.open(input);adapter.authChanged(null);await tick();assert.equal(events.at(-1).outcome,'not_loaded');
  assert.deepEqual(adapter.snapshot(),{outcome:'not_loaded'});
});

test('foreign/malformed snapshots and invalid note/operation scopes fail closed',async()=>{
  for(const bad of [read([row(a,'1')],'0'),{...read(),studentId:stranger},{...read(),assignmentId:stranger},
    {...read(),editionId:'sha256:'+'b'.repeat(64)},read([row(a,'1'),row(a,'1')],'1'),read([row('m000001-n000001','1')],'1')]){
    const {adapter}=setup(()=>wire(bad));assert.equal((await adapter.open(input)).outcome,'fingering_unavailable');assert.equal(adapter.snapshot().outcome,'not_loaded');
  }
  const {adapter,calls}=setup(()=>wire(read()));await adapter.open(input);
  for(const op of [{kind:'set',hand:'R',finger:0},{kind:'set',hand:'R',finger:1.5},{kind:'set',hand:'L',finger:3,extra:true},{kind:'suppress',finger:2}])
    assert.equal((await adapter.save(a,op)).outcome,'invalid_request');
  assert.equal((await adapter.save('m000034-n000004',{kind:'suppress'})).outcome,'invalid_request');assert.equal(calls.length,1);
});

test('known JSON rejections and changed-content conflicts are not saved successes',async()=>{
  let reject=false;const {adapter,calls}=setup((name,args)=>name==='student_piece_fingerings_v1'?wire(read()):wire({contractVersion:1,outcome:reject?'invalid_note_scope':'idempotency_conflict'}));
  await adapter.open(input);assert.equal((await adapter.save(a,{kind:'suppress'})).outcome,'idempotency_conflict');
  assert.equal(calls.at(-1).name,'student_piece_fingerings_v1');reject=true;
  assert.equal((await adapter.save(a,{kind:'suppress'})).outcome,'invalid_note_scope');assert.equal(adapter.snapshot().drafts[0].status,'unsaved');
});

test('BrowserData factory uses its authenticated SDK, observes sign-out and releases its Auth listener',async()=>{
  const callbacks=new Set(),values=new Map();let userId=student,calls=0,unsubscribed=0;
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const client={auth:{
    getUser:async()=>({data:{user:userId?{id:userId}:null},error:null}),
    onAuthStateChange(callback){callbacks.add(callback);queueMicrotask(()=>callback('INITIAL_SESSION',{user:{id:userId}}));
      return {data:{subscription:{unsubscribe(){callbacks.delete(callback);unsubscribed++;}}}};},
    signOut:async()=>{userId=null;for(const callback of callbacks)callback('SIGNED_OUT',null);return {error:null};},
  },rpc:async(name,args)=>{calls++;assert.equal(name,'student_piece_fingerings_v1');assert.equal(args.requested_edition_id,edition);return wire(read([row(a,'1')],'1'));}};
  const data=createBrowserData({config:{projectUrl:'https://synthetic.invalid',publishableKey:'public'},createClient:()=>client,
    storage,location:{hash:'',href:'https://synthetic.invalid/login/'},history:{}});
  const adapter=data.createFingerings();await adapter.open(input);assert.equal(calls,1);
  await data.signOut();assert.equal(adapter.snapshot().outcome,'not_loaded');adapter.destroy();assert.equal(unsubscribed,1);
  userId=student;assert.equal((await adapter.open(input)).outcome,'fingering_unavailable');assert.equal(calls,1);
  const blocked=data.createFingerings();createRecoveryProgress(storage,'apartmender-auth-session').start(student);
  assert.equal((await blocked.open(input)).outcome,'fingering_access_denied');assert.equal(calls,1);blocked.destroy();
  const unavailable=createBrowserData({config:null}).createFingerings();
  assert.equal((await unavailable.open(input)).outcome,'fingering_unavailable');unavailable.destroy();
});
