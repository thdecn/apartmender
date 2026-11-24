import { test, expect } from '@playwright/test';
import { serveSite } from './site.js';

let site;
test.beforeEach(async({page})=>{
  site=await serveSite();await page.setViewportSize({width:844,height:390});
  await page.route(/https:\/\/fonts\./,route=>route.abort());
});
test.afterEach(async({page})=>{await page.close();await site.close();});

test('the real root retains its six Piece picker and opens the shared PNG card through the additive catalogue',async({page})=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto(site.origin+'/');await expect(page.locator('.piece-btn')).toHaveCount(6);
  await page.getByRole('button',{name:'Czerny Op. 821, 2',exact:true}).click();
  await expect(page.locator('#card-image')).toHaveAttribute('src',/cards\/czerny-op-821-no-2\/01-m8.png$/);
  await expect(page.locator('#practice')).toBeVisible();
  expect(requests.some(url=>/supabase|\/auth\/|\/rest\/v1/.test(url))).toBe(false);
});

test('curation changes only the public picker, preserving declaration and Assignment resolution',async({page})=>{
  const slug='bach-bwv-779-invention-no-8';
  await page.route('**/general-practice-collection.json',route=>route.fulfill({json:{collectionVersion:1,slugs:[slug]}}));
  await page.goto(site.origin+'/');await expect(page.locator('.piece-btn')).toHaveCount(1);
  await expect(page.locator('.piece-btn')).toHaveText('Bach Inv. No. 8');
  const result=await page.evaluate(async()=>{
    const catalog=await(await fetch('/pieces.json')).json();
    const {buildAssignmentHome}=await import('/login/practice/student-home.js');
    return buildAssignmentHome([{assignmentId:'same-assignment',slug:'czerny-op-821-no-2'}],catalog).pieces.map(p=>({id:p.id,assignmentId:p.assignmentId}));
  });
  expect(result).toEqual([{id:'czerny-op-821-no-2',assignmentId:'same-assignment'}]);
});

test('previous public entry module remains compatible with the expanded catalogue',async({page})=>{
  await page.route('**/app.js',route=>route.fulfill({contentType:'text/javascript',body:`
    import {mountPractice} from './practice-host.js';
    const response=await fetch(new URL('./pieces.json',import.meta.url));
    if(!response.ok)throw Error('Failed to load pieces.json');
    mountPractice({pieces:await response.json()});
  `}));
  await page.goto(site.origin+'/');await expect(page.locator('.piece-btn')).toHaveCount(6);
  await page.getByRole('button',{name:'Czerny Op. 821, 2',exact:true}).click();
  await expect(page.locator('#card-image')).toHaveAttribute('src',/01-m8.png$/);
});

for(const slugs of [['unknown-piece'],['czerny-op-821-no-2','czerny-op-821-no-2']]){
  test(`invalid General collection fails visibly without offering the full catalogue: ${slugs.join(',')}`,async({page})=>{
    await page.route('**/general-practice-collection.json',route=>route.fulfill({json:{collectionVersion:1,slugs}}));
    await page.goto(site.origin+'/');await expect(page.getByRole('alert')).toContainText('could not be loaded');
    await expect(page.locator('.piece-btn')).toHaveCount(0);
  });
}
