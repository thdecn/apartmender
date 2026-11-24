import { test, expect } from '@playwright/test';
import { serveSite } from './site.js';

const student='11111111-1111-4111-8111-111111111111',teacher='22222222-2222-4222-8222-222222222222';
const assignment='33333333-3333-4333-8333-333333333333',edition='sha256:'+'a'.repeat(64),note='m000034-n000001';
const context={contractVersion:1,studentId:student,studentName:'Student B',assignmentId:assignment,slug:'bach-bwv-779-invention-no-8',editionId:edition};
const read=(overrides=[],snapshotRevision='0')=>({...context,outcome:'fingerings',measureIds:['m000034'],snapshotRevision,overrides});
const current=(revision,kind='set')=>({measureId:'m000034',noteId:note,revision,kind,...(kind==='set'?{hand:'L',finger:4}:{})});
let site;
test.beforeEach(async({page})=>{
  site=await serveSite();
  await page.route(`${site.origin}/fingering-test`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Private adapter test</title>'}));
  await page.goto(site.origin+'/fingering-test');
  await page.evaluate(async({student,assignment,edition,note})=>{
    const {createBrowserData}=await import('/login/browser-data.js');
    let userId=student;const callbacks=new Set(),values=new Map();
    const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
    const client={auth:{getUser:async()=>({data:{user:{id:userId}},error:null}),
      onAuthStateChange(callback){callbacks.add(callback);queueMicrotask(()=>callback('INITIAL_SESSION',{user:{id:userId}}));
        return {data:{subscription:{unsubscribe(){callbacks.delete(callback);}}}};}},
      rpc:async(name,args)=>{const response=await fetch('/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});
        const body=await response.json();return {data:response.ok?body:null,error:response.ok?null:body,status:response.status};}};
    window.data=createBrowserData({config:{projectUrl:location.origin,publishableKey:'synthetic-public'},createClient:()=>client,storage,location,history});
    window.view=data.createFingerings();window.switchActor=id=>{userId=id;for(const cb of callbacks)cb('SIGNED_IN',{user:{id}});};
    window.input={assignmentId:assignment,index:{indexVersion:1,slug:'bach-bwv-779-invention-no-8',editionId:edition,
      measures:[{measureId:'m000034',notes:[{noteId:note}]}]},measureIds:['m000034']};
  },{student,assignment,edition,note});
});
test.afterEach(async({page})=>{await page.close();await site.close();});

test('served Student adapter keeps uncertain save unsaved and retries the identical HTTP payload',async({page})=>{
  let state=read(),savedPayload,attempts=0;
  await page.route('**/rpc/*',async route=>{
    const name=route.request().url().split('/').at(-1),args=route.request().postDataJSON();
    expect(args.target_student_id).toBeUndefined();
    if(name==='student_piece_fingerings_v1')return route.fulfill({json:state});
    expect(name).toBe('student_save_piece_fingering_v1');
    if(++attempts===1){savedPayload=args;state=read([current('1')],'1');return route.abort('failed');}
    expect(args).toEqual(savedPayload);
    return route.fulfill({json:{...context,outcome:'already_saved',requestId:args.request_id,
      acknowledgement:{revision:'1',savedAt:'2026-11-24T12:00:00.000Z'},snapshotRevision:'2',current:current('2','suppress')}});
  });
  expect((await page.evaluate(()=>view.open(input))).outcome).toBe('fingerings');
  expect((await page.evaluate(note=>view.save(note,{kind:'set',hand:'L',finger:4}),note)).outcome).toBe('fingering_unavailable');
  expect((await page.evaluate(()=>view.snapshot())).drafts[0].status).toBe('unsaved');
  const result=await page.evaluate(note=>view.retry(note),note);expect(result.outcome).toBe('already_saved');
  expect(result.snapshot.overrides[0].kind).toBe('suppress');expect(result.snapshot.drafts).toEqual([]);
});

test('served Teacher adapter names the selected Student and clears state on real HTTP permission denial',async({page})=>{
  let denied=false;
  await page.route('**/rpc/*',route=>{
    expect(route.request().postDataJSON().target_student_id).toBe(student);
    if(denied)return route.fulfill({status:403,json:{code:'42501',message:'Access denied'}});
    expect(route.request().url()).toContain('/teacher_student_piece_fingerings_v1');return route.fulfill({json:read([current('1')],'1')});
  });
  await page.evaluate(teacher=>switchActor(teacher),teacher);
  expect((await page.evaluate(student=>view.open({...input,role:'teacher',studentId:student}),student)).studentName).toBe('Student B');
  denied=true;expect((await page.evaluate(note=>view.save(note,{kind:'suppress'}),note)).outcome).toBe('fingering_access_denied');
  expect(await page.evaluate(()=>view.snapshot())).toEqual({outcome:'not_loaded'});
});

test('real public Practice never imports or initializes the new private adapter',async({page})=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));await page.route(/https:\/\/fonts\./,route=>route.abort());
  await page.goto(site.origin+'/');await expect(page.locator('.piece-btn')).toHaveCount(6);
  expect(requests.some(url=>/\/login\/|\/rpc\/|supabase|fingerings\.js/.test(url))).toBe(false);
});
