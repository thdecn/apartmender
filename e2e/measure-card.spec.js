import { test, expect } from '@playwright/test';
import { serveSite } from './site.js';

let site;
test.beforeEach(async ({ page }) => {
  site = await serveSite();
  await page.route(`${site.origin}/card-test`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Projection tests</title>' }));
  await page.goto(`${site.origin}/card-test`);
});
test.afterEach(async ({ page }) => { await page.close(); await site.close(); });

const attrs = '<attributes><divisions>12</divisions><key><fifths>-1</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>';
const pitch = (step='C', octave=4, alter=0) => `<pitch><step>${step}</step><alter>${alter}</alter><octave>${octave}</octave></pitch>`;
const note = (step='C', duration=24, voice='1', staff=1, before='', after='') => {
  const ties=(after.match(/<tie\b[^>]*\/>/g)??[]).join('');
  return `<note>${before}${pitch(step)}<duration>${duration}</duration>${ties}<voice>${voice}</voice><staff>${staff}</staff>${after.replace(/<tie\b[^>]*\/>/g,'')}</note>`;
};
const rest = (duration=24, voice='2', staff=2) => `<note><rest/><duration>${duration}</duration><voice>${voice}</voice><staff>${staff}</staff></note>`;
const backup = '<backup><duration>24</duration></backup>';
const first = note('C') + backup + note('F',24,'2',2);
const score = (next, current=first, extra='') => `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="7">${attrs}${current}</measure><measure number="7">${extra}${next}</measure></part></score-partwise>`;

async function project(page, xml, measureId='m000001') {
  return page.evaluate(async ({xml,measureId}) => {
    const {indexScore,scoreEditionId} = await import('/notation/score-index.js');
    const {projectMeasureCard} = await import('/notation/measure-card.js');
    const bytes=new TextEncoder().encode(xml);
    const loaded=await indexScore(bytes,{slug:'synthetic-score',editionId:await scoreEditionId(bytes)});
    const card=projectMeasureCard(loaded,measureId);
    const measures=[...card.document.querySelectorAll('part > measure')];
    const current=measures[0],preview=measures[1];
    const xmlText=node=>node&&new XMLSerializer().serializeToString(node);
    return {currentId:card.currentMeasureId,nextId:card.previewMeasureId,ids:card.previewNoteIds,byHand:card.previewByHand,
      current:xmlText(current),preview:xmlText(preview),boundary:card.boundaryTies,
      previewNotes:preview?[...preview.children].filter(n=>n.localName==='note'&&n.querySelector('pitch')).map(n=>({id:n.id,chord:!!n.querySelector('chord'),
        voice:n.querySelector('voice')?.textContent,staff:n.querySelector('staff')?.textContent,xml:xmlText(n)})):[],
      contexts:loaded.index.measures.map(m=>m.contextAtStart),
      sourceIntact:new XMLSerializer().serializeToString(loaded.createDocument()).includes('<measure number="7" id="m000001">')};
  }, {xml,measureId});
}

test('complete Bach traverses backward with exact current source notes and independently checked preview membership',async({page})=>{
  const result=await page.evaluate(async()=>{
    const {indexScore}=await import('/notation/score-index.js');
    const {projectMeasureCard}=await import('/notation/measure-card.js');
    const base='/scores/bach-bwv-779-invention-no-8';
    const bytes=new Uint8Array(await(await fetch(`${base}/score.musicxml`)).arrayBuffer());
    const inventory=await(await fetch(`${base}/review-inventory.json`)).json();
    const loaded=await indexScore(bytes,{slug:inventory.slug,editionId:inventory.editionId,inventory});
    const original=loaded.createDocument(),serialize=n=>new XMLSerializer().serializeToString(n);
    const before=serialize(original),results=[];
    for(const entry of [...loaded.index.measures].reverse()){
      const card=projectMeasureCard(loaded,entry.measureId),bars=card.document.querySelectorAll('part > measure');
      const source=original.querySelector(`measure[id="${entry.measureId}"]`);
      const projected=bars[0];
      if([...source.querySelectorAll('note')].map(serialize).join('')!==[...projected.querySelectorAll('note')].map(serialize).join('')) throw Error('Incomplete current measure');
      const next=inventory.measures[entry.sourceOrdinal];
      // Reviewed source inventory has independent source onsets; accepted Bach has no ties/graces.
      const expected=next?next.notes.filter(n=>n.onset.numerator===0).map(n=>n.noteId):[];
      if(JSON.stringify(card.previewNoteIds)!==JSON.stringify(expected))throw Error('Unexpected downbeat IDs');
      const actual=bars[1]?[...bars[1].querySelectorAll('note')].filter(n=>n.querySelector('pitch')).map(n=>n.id):[];
      if(JSON.stringify([...actual].sort())!==JSON.stringify([...expected].sort()))throw Error('Hidden/later pitched source survived');
      if(projected.querySelectorAll('attributes > clef').length<2)throw Error('Missing inherited context');
      results.push({current:card.currentMeasureId,next:card.previewMeasureId,ids:card.previewNoteIds,bars:bars.length});
    }
    if(serialize(loaded.createDocument())!==before)throw Error('Shared source mutated');
    return results;
  });
  expect(result).toHaveLength(34);
  expect(result[0]).toEqual({current:'m000034',next:null,ids:[],bars:1});
  expect(result[1].ids).toEqual([1,2,3,6].map(n=>`m000034-n${String(n).padStart(6,'0')}`));
  expect(result[33].current).toBe('m000001');
  expect(result[33].next).toBe('m000002');
});

for(const [name,next,expectedR,expectedL] of [
  ['aggregate complete chords across voices',note('C',12)+note('E',12,'1',1,'<chord/>')+note('D',12)+backup+note('G',24,'2',1)+backup+note('A',24,'3',2)+note('B',24,'3',2,'<chord/>'),[1,2,4],[5,6]],
  ['initial rest excludes early offbeat entry',rest(6,'1',1)+note('E',18)+backup+note('F',24,'2',2),[],[3]],
  ['late entry does not become first attack',rest(18,'1',1)+note('E',6)+backup+note('F',24,'2',2),[],[3]],
  ['both hands rest',rest(24,'1',1)+backup+rest(),[],[]],
  ['cross-staff voice follows source staff, not inferred hand',note('C',24)+note('E',24,'1',2,'<chord/>'),[1],[2]],
])test(name,async({page})=>{
  const result=await project(page,score(next));
  const ids=ns=>ns.map(n=>`m000002-n${String(n).padStart(6,'0')}`);
  expect(result.byHand).toEqual({R:ids(expectedR),L:ids(expectedL)});
  expect([...result.ids].sort()).toEqual([...ids([...expectedR,...expectedL])].sort());
  expect(result.previewNotes.map(n=>n.id).sort()).toEqual([...result.ids].sort());
  expect(result.preview).toContain('<staves>2</staves>');
  expect(result.currentId).toBe('m000001');
  expect(result.nextId).toBe('m000002');
});

test('barline tie continuation is omitted while a new chord member becomes a standalone head',async({page})=>{
  const start=note('C',24,'1',1,'','<tie type="start"/><notations><tied type="start"/></notations>');
  const stop=note('C',24,'1',1,'','<tie type="stop"/><notations><tied type="stop"/></notations>');
  const result=await project(page,score(stop+note('E',24,'1',1,'<chord/>'),start));
  expect(result.ids).toEqual(['m000002-n000002']);
  expect(result.previewNotes[0].chord).toBe(false);
  expect(result.preview).not.toContain('<tie');
  expect(result.current).toContain('<tied type="start"');
  expect(result.boundary.outgoingCurrent).toEqual(['m000001-n000001']);
});

test('current barline stop and internal ties retain source semantics; next attack starting a tie has no orphan preview endpoint',async({page})=>{
  const firstTie=note('C',24,'1',1,'','<tie type="start"/>');
  const next=note('C',12,'1',1,'','<tie type="stop"/>')+note('D',12);
  const current=await project(page,score(next,firstTie),'m000002');
  expect(current.current).toContain('<tie type="stop"');
  expect(current.boundary.incomingCurrent).toEqual(['m000002-n000001']);
  const inside=note('C',12,'1',1,'','<tie type="start"/>')+note('C',12,'1',1,'','<tie type="stop"/>');
  const result=await project(page,score(inside));
  expect(result.previewNotes).toHaveLength(1);
  expect(result.preview).not.toContain('<tie');
  expect(result.boundary.outgoingPreview).toEqual(['m000002-n000001']);
});

test('grace beams and groups follow eligible main note; offbeat grace group is absent',async({page})=>{
  const grace=(step,beam)=>`<note><grace/>${pitch(step)}<voice>1</voice><staff>1</staff><beam number="1">${beam}</beam></note>`;
  const next=grace('D','begin')+grace('E','end')+note('F',12)+grace('G','begin')+note('A',12);
  const result=await project(page,score(next));
  expect(result.ids).toEqual([1,2,3].map(n=>`m000002-n${String(n).padStart(6,'0')}`));
  expect(result.previewNotes[0].xml).toContain('>begin</beam>');
  expect(result.previewNotes[1].xml).toContain('>end</beam>');
  expect(result.previewNotes).toHaveLength(3);
});

test('grace group attached to a tied downbeat main note is not a new attack',async({page})=>{
  const start=note('C',24,'1',1,'','<tie type="start"/>');
  const grace=`<note><grace/>${pitch('D')}<voice>1</voice><staff>1</staff></note>`;
  const result=await project(page,score(grace+note('C',24,'1',1,'','<tie type="stop"/>'),start));
  expect(result.ids).toEqual([]);
  expect(result.previewNotes).toEqual([]);
});

test('separate grace beam runs, secondary hooks and complete grace tuplets/slurs are retained',async({page})=>{
  const grace=(step,beam,marks='',extra='')=>`<note><grace/>${pitch(step)}<voice>1</voice><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification><staff>1</staff><beam number="1">${beam}</beam>${extra}${marks?`<notations>${marks}</notations>`:''}</note>`;
  const next=grace('C','begin','<tuplet type="start"/><slur type="start"/>','<beam number="2">forward hook</beam>')
    +grace('D','end')+grace('E','begin','<tuplet type="stop"/>')+grace('F','end')
    +note('G',24,'1',1,'','<notations><slur type="stop"/></notations>');
  const result=await project(page,score(next));
  expect(result.previewNotes.slice(0,4).map(n=>n.xml.match(/<beam number="1">(.*?)<\/beam>/)[1])).toEqual(['begin','end','begin','end']);
  expect(result.previewNotes[0].xml).toContain('<beam number="2">forward hook</beam>');
  expect(result.previewNotes[1].xml).not.toContain('<tuplet');
  expect(result.previewNotes[0].xml).toContain('<slur type="start"');
  expect(result.previewNotes[4].xml).toContain('<slur type="stop"');
});

test('incomplete grace beam across the preview boundary fails instead of inventing a grouping',async({page})=>{
  const grace=`<note><grace/>${pitch('D')}<voice>1</voice><staff>1</staff><beam number="1">begin</beam></note>`;
  await expect(project(page,score(grace+note('C')))).rejects.toThrow('grace beam outside selected group');
});

test('tuplets retain exact timing/ratio with closed preview notation and no beam into removed notes',async({page})=>{
  const ratio='<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
  const triplet=(step,beam,span)=>note(step,4,'1',1,'',`<beam number="1">${beam}</beam>${span?`<notations><tuplet type="${span}" number="1"/></notations>`:''}`).replace('<staff>',ratio+'<staff>');
  const result=await project(page,score(triplet('C','begin','start')+triplet('D','continue',null)+triplet('E','end','stop')+note('G',12)));
  expect(result.previewNotes).toHaveLength(1);
  expect(result.previewNotes[0].xml).toContain('<duration>4</duration>');
  expect(result.previewNotes[0].xml).toContain('<actual-notes>3</actual-notes>');
  expect(result.previewNotes[0].xml).toContain('<tuplet type="start"');
  expect(result.previewNotes[0].xml).toContain('<tuplet type="stop"');
  expect(result.previewNotes[0].xml).not.toContain('<beam');
  expect(result.preview).toContain('<forward><duration>20</duration>');
});

test('inherited clefs and current timed changes survive while next key/time and explicit accidental are materialized',async({page})=>{
  const clef='<attributes><clef number="1"><sign>F</sign><line>4</line></clef></attributes>';
  const current=note('C',12)+clef+note('D',12)+backup+note('E',24,'2',1);
  const next=note('B',24).replace('<alter>0</alter>','<alter>0</alter>').replace('<staff>','<accidental>natural</accidental><staff>');
  const result=await project(page,score(next,current,'<attributes><key><fifths>0</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time></attributes>'));
  expect(result.current.match(/<clef number="1">/g)).toHaveLength(2);
  expect(result.preview).toContain('<clef number="1"><sign>F</sign><line>4</line></clef>');
  expect(result.preview).toContain('<fifths>0</fifths>');
  expect(result.previewNotes[0].xml).toContain('<accidental>natural</accidental>');
});

test('each projection is isolated and invalid occurrence/index mappings fail explicitly',async({page})=>{
  const result=await page.evaluate(async xml=>{
    const {indexScore,scoreEditionId}=await import('/notation/score-index.js');
    const {projectMeasureCard}=await import('/notation/measure-card.js');
    const bytes=new TextEncoder().encode(xml),loaded=await indexScore(bytes,{slug:'synthetic-score',editionId:await scoreEditionId(bytes)});
    const a=projectMeasureCard(loaded,'m000001');a.document.querySelector('note').remove();
    const b=projectMeasureCard(loaded,'m000001'),errors=[];
    try{projectMeasureCard(loaded,'m000999');}catch(e){errors.push(e.message);}
    const bad=structuredClone(loaded.index);bad.measures[0].nextMeasureId=null;
    try{projectMeasureCard({...loaded,index:bad},'m000001');}catch(e){errors.push(e.message);}
    return{notes:b.document.querySelectorAll('measure[id="m000001"] note').length,errors};
  },score(note('D')));
  expect(result.notes).toBe(2);
  expect(result.errors[0]).toContain('unknown measure occurrence');
  expect(result.errors[1]).toContain('inconsistent next occurrence');
});

test('implicit partial measures keep their actual duration without inventing full-bar spacer rests',async({page})=>{
  const pickup=score(note('D'),note('C',12)).replace('<measure number="7">','<measure number="0" implicit="yes">');
  const first=await project(page,pickup);
  expect(first.current).toContain('<duration>12</duration>');
  const partial=score(note('D',12)).replace('</measure><measure number="7">','</measure><measure number="7" implicit="yes">');
  const next=await project(page,partial);
  expect(next.preview).toContain('implicit="yes"');
  expect(next.preview).toContain('<rest/><duration>12</duration>');
  expect(next.preview).not.toContain('measure="yes"');
});
