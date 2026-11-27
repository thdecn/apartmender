import {test,expect} from '@playwright/test';
import {serveSite} from './site.js';
import {pilotFixture,studentId} from './notation-pilot-fixture.js';

let site,fixture;
test.use({viewport:{width:1024,height:768},hasTouch:true});
test.beforeEach(async({context})=>{site=await serveSite();fixture=await pilotFixture(context);});
test.afterEach(async({context})=>{try{expect(fixture.state.errors).toEqual([]);}finally{await Promise.all(context.pages().map(page=>page.close()));await site.close();}});
const note=(page,n)=>page.locator(`[data-note-id="m000034-n${String(n).padStart(6,'0')}"]`);
const saved=page=>expect(page.locator('.fingering-status')).toContainText('Fingerings saved');
async function openStudent(page){
  await page.goto(site.origin+'/login/practice/');await page.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();await saved(page);
}
async function openTeacher(page){
  await page.goto(site.origin+'/login/teacher/student/?student='+studentId);
  await page.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true}).click();await saved(page);
  const next=page.getByRole('button',{name:'Next page',exact:true});
  for(let n=0;n<34&&await next.isEnabled();n++){await next.click();await saved(page);}
  await expect(note(page,1)).toBeVisible();
}
async function partition(page){
  return page.evaluate(studentId=>new Promise((resolve,reject)=>{
    const opened=indexedDB.open('apartmender-practice-v1',1);opened.onerror=()=>reject(opened.error);
    opened.onsuccess=()=>{const db=opened.result,tx=db.transaction('students'),read=tx.objectStore('students').get(studentId);
      read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);tx.oncomplete=()=>db.close();};
  }),studentId);
}

test('Student and Teacher share ordered chord edits, uncertain retry and suppression while public stays original-only',async({context})=>{
  test.setTimeout(90000);
  const student=await context.newPage(),teacher=await context.newPage(),publicPage=await context.newPage();
  await fixture.student(student);await fixture.teacher(teacher);await openStudent(student);
  await note(student,1).tap();await student.getByRole('button',{name:'Left hand',exact:true}).click();
  await student.getByRole('button',{name:'4',exact:true}).click();await saved(student);
  await student.getByRole('button',{name:'Back home'}).click();
  await expect.poll(async()=>Object.keys((await partition(student)).queue).length).toBe(0);
  const practiceBeforeTeacher=await partition(student);
  await openTeacher(teacher);
  await expect(teacher.locator('dialog h2')).toHaveText('Student B — Bach Inv. No. 8');
  await expect(teacher.locator('[data-fingering-for="m000034-n000001"]')).toHaveText('L4');
  await note(teacher,2).tap();fixture.state.lostAck=true;
  await teacher.getByRole('button',{name:'5',exact:true}).click();
  await expect(teacher.getByRole('button',{name:'Retry fingering',exact:true})).toBeVisible();
  await expect(teacher.locator('.fingering-status')).toContainText('unsaved');
  await teacher.getByLabel('Notation size').selectOption('60');await note(teacher,2).tap();
  await expect(note(teacher,2)).toHaveAttribute('aria-pressed','true');
  await teacher.getByRole('button',{name:'Retry fingering',exact:true}).click();await saved(teacher);
  const teacherSaves=fixture.state.calls.filter(call=>call.name==='teacher_save_student_piece_fingering_v1');
  expect(teacherSaves).toHaveLength(2);expect(teacherSaves[1]).toEqual(teacherSaves[0]);expect(fixture.state.revision).toBe(2);
  expect(await partition(student)).toEqual(practiceBeforeTeacher);
  const publications=await teacher.evaluate(()=>teacherTest.publications);expect(publications).toEqual([]);
  await teacher.getByRole('button',{name:'Close score',exact:true}).click();
  await student.bringToFront();await student.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();await saved(student);
  await expect(student.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('5');
  await note(student,2).tap();await student.getByRole('button',{name:'Remove number',exact:true}).click();await saved(student);
  await student.getByRole('button',{name:'Back home'}).click();await openTeacher(teacher);
  await expect(teacher.locator('[data-fingering-for="m000034-n000002"]')).toHaveCount(0);
  await expect(teacher.locator('[data-fingering-for="m000034-n000001"]')).toHaveText('L4');
  const privateBeforePublic=[...fixture.state.values],callsBeforePublic=fixture.state.calls.length;
  const privateRequests=[];publicPage.on('request',r=>{if(/\/login\/|supabase|\/auth\/|\/rpc\/|pilot-rpc|pilot-practice/.test(r.url()))privateRequests.push(r.url());});
  await publicPage.goto(site.origin+'/');await publicPage.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect(publicPage.locator('.score-viewport > svg')).toBeVisible();
  await expect(publicPage.locator('[data-fingering-for]')).toHaveCount(0);
  await expect(publicPage.getByRole('button',{name:'Remove number',exact:true})).toHaveCount(0);
  expect(privateRequests).toEqual([]);expect(fixture.state.calls.length).toBe(callsBeforePublic);expect([...fixture.state.values]).toEqual(privateBeforePublic);
  await teacher.bringToFront();fixture.state.teacherAllowed=false;
  await teacher.getByRole('button',{name:'Reload fingerings',exact:true}).click();
  await expect(teacher.locator('dialog .fingering-status')).toContainText('access changed');
  await expect(teacher.locator('dialog svg')).toHaveCount(0);expect([...fixture.state.values]).toEqual(privateBeforePublic);
});

test('reviewed host switches revert to explicit PNG/no-editor views and preserve overrides and queued Practice for re-enable',async({context})=>{
  const student=await context.newPage(),teacher=await context.newPage(),publicPage=await context.newPage();
  await fixture.student(student);await fixture.teacher(teacher);fixture.state.holdPractice=true;
  await student.bringToFront();
  await openStudent(student);await note(student,2).tap();await student.getByRole('button',{name:'3',exact:true}).click();await saved(student);
  await expect(student.locator('#practice-timer-value')).not.toHaveText('0:00');
  await student.getByRole('button',{name:'Back home'}).click();
  await expect.poll(()=>fixture.state.uploads.length).toBeGreaterThan(0);
  const before=await partition(student),overrides=[...fixture.state.values];expect(Object.keys(before.queue)).toHaveLength(1);
  fixture.state.publicEnabled=fixture.state.studentEnabled=fixture.state.teacherEnabled=false;
  const callsBefore=fixture.state.calls.length;
  await student.reload();await student.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect(student.locator('#card-image')).toBeVisible();await expect(student.locator('#card-image')).toHaveAttribute('src',/01-m34.png$/);
  await expect(student.locator('.notation-pilot-notice')).toContainText('PNG cards cannot display saved fingerings');
  await expect(student.locator('.fingering-controls')).toHaveCount(0);
  expect((await partition(student)).queue).toEqual(before.queue);
  await teacher.goto(site.origin+'/login/teacher/student/?student='+studentId);
  await expect(teacher.locator('#teacher-score-entry')).toContainText('Saved changes are retained');
  await expect(teacher.getByRole('button',{name:'Open Bach Inv. No. 8 score',exact:true})).toHaveCount(0);
  await publicPage.goto(site.origin+'/');await publicPage.getByRole('button',{name:'Bach Inv. No. 8',exact:true}).click();
  await expect(publicPage.locator('#card-image')).toBeVisible();await expect(publicPage.locator('.score-viewport')).toHaveCount(0);
  expect(fixture.state.calls.length).toBe(callsBefore);expect([...fixture.state.values]).toEqual(overrides);
  await student.getByRole('button',{name:'Back home'}).click();fixture.state.studentEnabled=fixture.state.teacherEnabled=true;
  await openStudent(student);await expect(student.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('3');
  expect(Object.entries((await partition(student)).queue)).toEqual(expect.arrayContaining(Object.entries(before.queue)));
  await openTeacher(teacher);await expect(teacher.locator('[data-fingering-for="m000034-n000002"]')).toHaveText('3');
  expect([...fixture.state.values]).toEqual(overrides);
});
