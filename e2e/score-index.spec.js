import { test, expect } from '@playwright/test';
import { serveSite } from './site.js';

let site;
test.beforeEach(async ({ page }) => {
  site = await serveSite();
  await page.route(`${site.origin}/index-test`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Index tests</title>' }));
  await page.goto(`${site.origin}/index-test`);
});
test.afterEach(async ({ page }) => { await page.close(); await site.close(); });

const attributes = '<attributes><divisions>4</divisions><key><fifths>-1</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>';
const pitch = (step, octave = 4) => `<pitch><step>${step}</step><octave>${octave}</octave></pitch>`;
const note = (step = 'C', duration = 8, extra = '', voice = '1', staff = 1) => `<note>${extra}${pitch(step)}<duration>${duration}</duration><voice>${voice}</voice><staff>${staff}</staff></note>`;
const score = measures => `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
const simple = score(`<measure number="1">${attributes}${note()}</measure>`);
const complex = score(`<measure number="7">${attributes}
  <note id="grace-source"><grace/>${pitch('D',5)}<voice>1</voice><staff>1</staff></note>
  <note id="main-source">${pitch('C',5)}<duration>8</duration><tie type="start"/><voice>1</voice><staff>1</staff><notations><technical><fingering>R3</fingering></technical><tied type="start"/></notations></note>
  <note><chord/>${pitch('E',3)}<duration>8</duration><voice>1</voice><staff>2</staff><notations><technical><fingering>L2</fingering></technical></notations></note>
  <backup><duration>8</duration></backup>${note('F',4,'','2',2)}${note('G',4,'','2',2)}
  </measure><measure number="7"><note>${pitch('C',5)}<duration>8</duration><tie type="stop"/><voice>1</voice><staff>1</staff></note>
  <backup><duration>8</duration></backup>${note('A',8,'','2',2)}</measure>`);

async function parse(page, xml) {
  return page.evaluate(async xml => {
    const { indexScore, scoreEditionId } = await import('/notation/score-index.js');
    const bytes = new TextEncoder().encode(xml);
    return (await indexScore(bytes, { slug: 'synthetic-score', editionId: await scoreEditionId(bytes) })).index;
  }, xml);
}

test('complete accepted Bach source has stable first/penultimate/final identities and contexts', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { indexScore } = await import('/notation/score-index.js');
    const base = '/scores/bach-bwv-779-invention-no-8';
    const bytes = new Uint8Array(await (await fetch(`${base}/score.musicxml`)).arrayBuffer());
    const inventory = await (await fetch(`${base}/review-inventory.json`)).json();
    const options = { slug: inventory.slug, editionId: inventory.editionId, inventory };
    const first = await indexScore(bytes, options), second = await indexScore(bytes.slice(), options);
    return { index: first.index, independentlyEqual: JSON.stringify(first.index) === JSON.stringify(second.index),
      frozen: Object.isFrozen(first.index.measures[0].notes[0]), ids: [...first.createDocument().querySelectorAll('measure')].map(m => m.id) };
  });
  expect(result.independentlyEqual).toBe(true);
  expect(result.frozen).toBe(true);
  expect(result.index.measures).toHaveLength(34);
  expect(result.index.measures.flatMap(m => m.notes)).toHaveLength(598);
  expect(result.index.measures.flatMap(m => m.rests)).toHaveLength(11);
  expect(result.index.measures[0].notes.map(n => n.noteId)).toEqual([2,3,4,5,6].map(n => `m000001-n${String(n).padStart(6,'0')}`));
  expect(result.index.measures[32].notes[0].noteId).toBe('m000033-n000001');
  expect(result.index.measures[32].nextMeasureId).toBe('m000034');
  expect(result.index.measures[33].notes.map(n => n.noteId)).toEqual([1,2,3,6].map(n => `m000034-n${String(n).padStart(6,'0')}`));
  expect(result.index.measures[33].nextMeasureId).toBeNull();
  expect(result.index.measures[4].notes.find(n => n.staff===2).context.clef.sign).toBe('G');
  expect(result.index.measures[7].notes.find(n => n.staff===2).context.clef.sign).toBe('F');
  expect(result.index.measures[6].notes[0].context.accidentalBefore).toBe(-1);
  expect(result.ids[33]).toBe('m000034');
});

test('multiple voices, repeated labels, grace chord grouping, ties and cross-staff notes retain source order', async ({ page }) => {
  const index = await parse(page, complex);
  expect(index.measures.map(m => m.sourceLabel)).toEqual(['7','7']);
  expect(index.measures.map(m => m.measureId)).toEqual(['m000001','m000002']);
  const [grace,main,chord,lower] = index.measures[0].notes;
  expect(grace.graceMainNoteId).toBe(main.noteId);
  expect(grace.duration).toEqual({numerator:0,denominator:1});
  expect(main.tieStart).toBe(true);
  expect(index.measures[1].notes[0].tieStop).toBe(true);
  expect(chord.onset).toEqual(main.onset);
  expect(chord.staff).toBe(2);
  expect(chord.voice).toBe('1');
  expect(chord.originalFingering).toEqual({hand:'L',finger:2});
  expect(main.originalFingering).toEqual({hand:'R',finger:3});
  expect(lower.voice).toBe('2');
});

test('copy extraction, page regrouping and fingering edits keep IDs and cannot mutate shared index/source', async ({ page }) => {
  const result = await page.evaluate(async xml => {
    const { indexScore,scoreEditionId } = await import('/notation/score-index.js');
    const bytes = new TextEncoder().encode(xml), editionId = await scoreEditionId(bytes);
    const loaded = await indexScore(bytes,{slug:'synthetic-score',editionId});
    const changed = loaded.createDocument(), untouched = loaded.createDocument();
    changed.querySelector('part > measure').remove();
    const selected = changed.querySelector('note');
    const originalId = selected.id;
    const mark = changed.createElement('notations'); mark.innerHTML = '<technical><fingering>L5</fingering></technical>';
    selected.append(mark);
    const reflowPage = changed.querySelector('measure').cloneNode(true);
    let reindexError;
    try { await indexScore(new TextEncoder().encode(new XMLSerializer().serializeToString(changed)),{slug:'synthetic-score',editionId}); }
    catch(error) { reindexError = error.message; }
    return { originalId, projectedId: reflowPage.querySelector('note').id,
      untouchedMeasures: untouched.querySelectorAll('measure').length, pristine: untouched.querySelectorAll('fingering').length,
      originalFinger: loaded.index.measures[1].notes[0].originalFingering, reindexError };
  }, complex);
  expect(result.originalId).toBe('m000002-n000001');
  expect(result.projectedId).toBe(result.originalId);
  expect(result.untouchedMeasures).toBe(2);
  expect(result.pristine).toBe(2);
  expect(result.originalFinger).toBeNull();
  expect(result.reindexError).toContain('edition digest mismatch');
});

test('fractional tuplets and forward gaps keep exact quarter-note timing', async ({ page }) => {
  const xml = score(`<measure number="0">${attributes.replace('<divisions>4</divisions>','<divisions>3</divisions>').replace('<beats>2</beats>','<beats>1</beats>')}${['C','D','E'].map(p=>note(p,1).replace('<staff>','<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification><staff>')).join('')}</measure>`);
  const index = await parse(page,xml);
  expect(index.measures[0].notes.map(n=>n.onset)).toEqual([{numerator:0,denominator:1},{numerator:1,denominator:3},{numerator:2,denominator:3}]);
  expect(index.measures[0].notes[0].tuplet).toEqual({actual:3,normal:2});
  const gap = await parse(page,score(`<measure number="-1" implicit="yes">${attributes}<forward><duration>2</duration></forward>${note('C',2)}</measure>`));
  expect(gap.measures[0].notes[0].onset).toEqual({numerator:1,denominator:2});
  expect(gap.measures[0].duration).toEqual({numerator:1,denominator:1});
});

test('full inventory rejects missing/duplicate/foreign targets and ignores JSON object key order', async ({ page }) => {
  const result = await page.evaluate(async xml => {
    const { indexScore,scoreEditionId,assertScoreInventory } = await import('/notation/score-index.js');
    const bytes = new TextEncoder().encode(xml);
    const {index} = await indexScore(bytes,{slug:'synthetic-score',editionId:await scoreEditionId(bytes)});
    const errors=[];
    for(const mutate of [x=>x.measures[0].notes.pop(),x=>x.measures[0].notes.push(x.measures[0].notes[0]),x=>{x.measures[0].notes[0].noteId='m999999-n000001';}]) {
      const expected=structuredClone(index);mutate(expected);
      try { assertScoreInventory(index,expected); } catch(error){errors.push(error.message);}
    }
    const expected=structuredClone(index),p=expected.measures[0].notes[0].pitch;
    expected.measures[0].notes[0].pitch={octave:p.octave,alter:p.alter,step:p.step};
    assertScoreInventory(index,expected);
    return errors;
  },simple);
  expect(result).toHaveLength(3);
  expect(result.every(message=>message.includes('inventory missing/duplicate/foreign'))).toBe(true);
});

for(const [name,xml,message] of [
  ['malformed XML', '<score-partwise>', 'XML'],
  ['DTD/entity', '<!DOCTYPE score-partwise [<!ENTITY ext SYSTEM "https://example.invalid/private">]>'+simple, 'DTD/entities'],
  ['transposition', simple.replace('</attributes>','<transpose><chromatic>2</chromatic></transpose></attributes>'), 'attributes/transpose'],
  ['unpitched', simple.replace(pitch('C'),'<unpitched><display-step>C</display-step><display-octave>4</display-octave></unpitched>'), 'note/unpitched'],
  ['duplicate source ID', simple.replace('<note>','<note id="same">').replace('</measure>',note('D',8).replace('<note>','<note id="same">')+'</measure>'), 'duplicate source note/measure ID'],
  ['duplicate measure ID', score(`<measure number="1" id="same">${attributes}${note()}</measure><measure number="2" id="same">${note()}</measure>`),'duplicate source note/measure ID'],
  ['empty source ID', simple.replace('<note>','<note id="">'),'invalid source ID'],
  ['unknown accidental',simple.replace('<staff>','<accidental>quarter-sharp</accidental><staff>'),'accidental glyph'],
  ['unanchored grace', simple.replace('</measure>',`<note><grace/>${pitch('D')}<voice>1</voice><staff>1</staff></note></measure>`),'unanchored grace'],
  ['orphan chord', simple.replace('<note>','<note><chord/>'),'chord without compatible'],
  ['incomplete measure', simple.replace('<duration>8</duration>','<duration>4</duration>'),'incomplete/overfull'],
  ['ambiguous original fingering', simple.replace('</note>','<notations><technical><fingering>3</fingering></technical></notations></note>'),'ambiguous original fingering'],
  ['unclosed tie', simple.replace('</note>','<tie type="start"/></note>'),'unclosed tie'],
  ['multiple parts', simple.replace('</score-partwise>','<part id="P2"><measure number="1"/></part></score-partwise>'),'one declared piano part'],
]) test(`reject ${name} explicitly`,async({page})=>{await expect(parse(page,xml)).rejects.toThrow(message);});

test('mid-measure clef context is timed and does not leak backwards into another voice',async({page})=>{
  const xml=score(`<measure number="1">${attributes}${note('C',4)}<attributes><clef number="1"><sign>F</sign><line>4</line></clef></attributes>${note('D',4)}<backup><duration>8</duration></backup>${note('E',8,'','2',1)}</measure>`);
  const index=await parse(page,xml);
  expect(index.measures[0].notes.map(n=>n.context.clef.sign)).toEqual(['G','F','G']);
  expect(index.measures[0].contextAtEnd.clefs[1].sign).toBe('F');
});

test('byte mutation under same expected edition and oversized source fail before parsing', async({page})=>{
  const result=await page.evaluate(async xml=>{
    const {indexScore,scoreEditionId}=await import('/notation/score-index.js');
    const bytes=new TextEncoder().encode(xml),editionId=await scoreEditionId(bytes),errors=[];
    for(const source of [new TextEncoder().encode(xml+'\n'),new Uint8Array(8*1024*1024+1)]){
      try{await indexScore(source,{slug:'synthetic-score',editionId});}catch(error){errors.push(error.message);}
    }
    return errors;
  },simple);
  expect(result[0]).toContain('edition digest mismatch');
  expect(result[1]).toContain('source byte limit/type');
});
