// Bounded MusicXML index v1. No fetch, Auth, renderer or private-state access.
const fail = message => { throw new Error(`Score index: ${message}`); };
const require = (condition, message) => { if (!condition) fail(message); };
const children = (node, name) => [...node.children].filter(item => item.localName === name);
const one = (node, name) => {
  const matches = children(node, name);
  require(matches.length <= 1, `duplicate ${name}`);
  return matches[0] ?? null;
};
const text = (node, name, fallback = null) => one(node, name)?.textContent.trim() ?? fallback;
const integer = (value, minimum, maximum, label) => {
  require(typeof value === 'string' && /^-?\d+$/.test(value), `invalid ${label}`);
  const number = Number(value);
  require(Number.isSafeInteger(number) && number >= minimum && number <= maximum, `unsupported ${label}`);
  return number;
};
const gcd = (a, b) => b ? gcd(b, a % b) : a < 0n ? -a : a;
const rational = (numerator, denominator = 1) => {
  const n = BigInt(numerator), d = BigInt(denominator);
  require(d > 0n, 'invalid score denominator');
  const divisor = gcd(n, d), result = { numerator: Number(n / divisor), denominator: Number(d / divisor) };
  require(Number.isSafeInteger(result.numerator) && Number.isSafeInteger(result.denominator), 'unsafe score time');
  return result;
};
const plus = (a, b) => rational(BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator), BigInt(a.denominator) * BigInt(b.denominator));
const minus = (a, b) => plus(a, rational(-b.numerator, b.denominator));
const compare = (a, b) => {
  const delta = BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
};
const zero = () => rational(0);
const clone = value => structuredClone(value);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const supported = (node, names) => {
  for (const child of node.children) require(names.includes(child.localName), `unsupported ${node.localName}/${child.localName}`);
};

export async function scoreEditionId(bytes) {
  require(bytes instanceof Uint8Array && bytes.byteLength > 0 && bytes.byteLength <= 8 * 1024 * 1024, 'source byte limit/type');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function attributes(node, state, onset, changes, hasNotes) {
  supported(node, ['divisions', 'key', 'time', 'staves', 'clef']);
  require(children(node, 'key').length <= 1 && children(node, 'time').length <= 1, 'duplicate key/time');
  if (one(node, 'divisions')) {
    const divisions = integer(text(node, 'divisions'), 1, 1_000_000, 'divisions');
    require(!hasNotes || divisions === state.divisions, 'divisions change after notes');
    state.divisions = divisions;
  }
  if (one(node, 'staves')) require(text(node, 'staves') === '2', 'requires two staves');
  for (const key of children(node, 'key')) {
    supported(key, ['fifths', 'mode']);
    require(compare(onset, zero()) === 0 && !key.hasAttribute('number'), 'staff-specific or mid-measure key');
    const value = { fifths: integer(text(key, 'fifths'), -7, 7, 'key'), mode: text(key, 'mode', 'major') };
    require(['major', 'minor'].includes(value.mode), 'key mode');
    changes.push({ onset: clone(onset), kind: 'key', value });
  }
  for (const time of children(node, 'time')) {
    supported(time, ['beats', 'beat-type']);
    require(compare(onset, zero()) === 0 && !time.hasAttribute('number'), 'staff-specific or mid-measure meter');
    const value = { beats: integer(text(time, 'beats'), 1, 64, 'beats'), beatType: integer(text(time, 'beat-type'), 1, 128, 'beat type') };
    require((value.beatType & (value.beatType - 1)) === 0, 'beat type');
    changes.push({ onset: clone(onset), kind: 'time', value });
  }
  for (const clef of children(node, 'clef')) {
    supported(clef, ['sign', 'line']);
    const staff = integer(clef.getAttribute('number') ?? '1', 1, 2, 'clef staff');
    const value = { sign: text(clef, 'sign'), line: integer(text(clef, 'line'), 1, 5, 'clef line') };
    require((value.sign === 'G' && value.line === 2) || (value.sign === 'F' && value.line === 4), 'clef');
    require(!changes.some(change => change.kind === 'clef' && change.staff === staff && compare(change.onset, onset) === 0), 'duplicate clef change');
    changes.push({ onset: clone(onset), kind: 'clef', staff, value });
  }
}

function applyContext(state, change) {
  if (change.kind === 'clef') state.clefs[change.staff] = clone(change.value);
  else state[change.kind] = clone(change.value);
}

function noteValue(node, ordinal, measureId, cursor, previous, divisions) {
  supported(node, ['pitch', 'rest', 'duration', 'voice', 'type', 'dot', 'accidental', 'stem', 'staff', 'beam', 'chord', 'grace', 'tie', 'notations', 'time-modification']);
  const grace = !!one(node, 'grace'), chord = !!one(node, 'chord');
  const voice = text(node, 'voice', '1');
  require(/^[A-Za-z0-9_-]{1,32}$/.test(voice), 'voice');
  const staff = integer(text(node, 'staff', '1'), 1, 2, 'note staff');
  const duration = grace ? zero() : rational(integer(text(node, 'duration'), 1, 1_000_000_000, 'duration'), divisions);
  require(!grace || !one(node, 'duration'), 'timed grace note');
  if (chord) require(previous && previous.pitch && previous.voice === voice && previous.grace === grace && compare(previous.duration, duration) === 0, 'chord without compatible head');
  const onset = chord ? clone(previous.onset) : clone(cursor);
  const pitchNode = one(node, 'pitch'), rest = one(node, 'rest');
  require(!!pitchNode !== !!rest && !((grace || chord) && rest), 'pitched note or rest required');
  let pitch = null;
  if (pitchNode) {
    supported(pitchNode, ['step', 'alter', 'octave']);
    pitch = { step: text(pitchNode, 'step'), alter: integer(text(pitchNode, 'alter', '0'), -2, 2, 'pitch alter'), octave: integer(text(pitchNode, 'octave'), 0, 9, 'octave') };
    require(/^[A-G]$/.test(pitch.step), 'pitch step');
  }
  const notations = one(node, 'notations');
  if (notations) supported(notations, ['tied', 'technical', 'slur', 'articulations', 'tuplet']);
  const technical = notations && one(notations, 'technical');
  if (technical) supported(technical, ['fingering']);
  const fingers = technical ? children(technical, 'fingering') : [];
  require(fingers.length <= 1 && (!fingers.length || pitch), 'multiple/rest fingerings');
  let originalFingering = null;
  if (fingers.length) {
    const match = /^([LR])([1-5])$/.exec(fingers[0].textContent.trim());
    require(match && !['yes', 'true'].includes(fingers[0].getAttribute('substitution')) && !['yes', 'true'].includes(fingers[0].getAttribute('alternate')), 'ambiguous original fingering; needs reviewed explicit L/R');
    originalFingering = { hand: match[1], finger: Number(match[2]) };
  }
  const ties = [...children(node, 'tie'), ...(notations ? children(notations, 'tied') : [])];
  require(!ties.length || pitch, 'rest tie');
  require(ties.every(tie => ['start', 'stop', 'continue'].includes(tie.getAttribute('type'))), 'tie type');
  const beams = children(node, 'beam').map(beam => ({ number: integer(beam.getAttribute('number') ?? '1', 1, 8, 'beam number'), value: beam.textContent.trim() }));
  require(new Set(beams.map(beam => beam.number)).size === beams.length && beams.every(beam => ['begin', 'continue', 'end', 'forward hook', 'backward hook'].includes(beam.value)), 'beam');
  const modification = one(node, 'time-modification');
  if (modification) supported(modification, ['actual-notes', 'normal-notes', 'normal-type', 'normal-dot']);
  const tuplet = modification ? { actual: integer(text(modification, 'actual-notes'), 1, 64, 'tuplet actual'), normal: integer(text(modification, 'normal-notes'), 1, 64, 'tuplet normal') } : null;
  const accidental = text(node, 'accidental');
  require(accidental === null || ['sharp', 'flat', 'natural', 'double-sharp', 'sharp-sharp', 'flat-flat', 'natural-sharp', 'natural-flat'].includes(accidental), 'accidental glyph');
  return { noteId: `${measureId}-n${String(ordinal).padStart(6, '0')}`, sourceNoteOrdinal: ordinal,
    staff, voice, pitch, onset, duration, grace, chord,
    tieStart: ties.some(tie => ['start', 'continue'].includes(tie.getAttribute('type'))),
    tieStop: ties.some(tie => ['stop', 'continue'].includes(tie.getAttribute('type'))),
    graceMainNoteId: null, originalFingering, beams, tuplet, accidental };
}

function contextualize(measure, state, absoluteStart, openTies) {
  const initial = clone(state), changes = measure.contextChanges;
  changes.sort((a, b) => compare(a.onset, b.onset));
  for (const change of changes.filter(change => compare(change.onset, zero()) === 0)) applyContext(initial, change);
  require(initial.key && initial.time && initial.clefs[1] && initial.clefs[2], 'missing key/time/two-clef context');
  measure.contextAtStart = clone(initial);
  const ordered = [...measure.events].sort((a, b) => compare(a.onset, b.onset) || a.sourceNoteOrdinal - b.sourceNoteOrdinal);
  const current = clone(state), accidentals = {}, voices = new Map(), pending = new Map();
  let changeIndex = 0;
  for (const note of ordered) {
    while (changeIndex < changes.length && compare(changes[changeIndex].onset, note.onset) <= 0) applyContext(current, changes[changeIndex++]);
    const accidentalKey = note.pitch && `${note.staff}:${note.pitch.step}:${note.pitch.octave}`;
    const keyOrder = current.key.fifths < 0 ? 'BEADGCF' : 'FCGDAEB';
    const keyAlter = note.pitch && keyOrder.slice(0, Math.abs(current.key.fifths)).includes(note.pitch.step) ? Math.sign(current.key.fifths) : 0;
    note.context = { key: clone(current.key), time: clone(current.time), clef: clone(current.clefs[note.staff]),
      accidentalBefore: note.pitch ? (accidentals[accidentalKey] ?? keyAlter) : null };
    if (!note.chord && !note.grace) {
      require(!voices.has(note.voice) || compare(voices.get(note.voice), note.onset) <= 0, 'overlapping notes require distinct voices or chord');
      voices.set(note.voice, plus(note.onset, note.duration));
    }
    if (note.grace) {
      pending.set(note.voice, [...(pending.get(note.voice) ?? []), note]);
    } else if (!note.chord && pending.has(note.voice)) {
      require(note.pitch && pending.get(note.voice).every(grace => compare(grace.onset, note.onset) === 0), 'grace without same-onset pitched main note');
      for (const grace of pending.get(note.voice)) grace.graceMainNoteId = note.noteId;
      pending.delete(note.voice);
    }
    if (!note.pitch) continue;
    const key = `${note.voice}:${note.pitch.step}:${note.pitch.alter}:${note.pitch.octave}`;
    const absolute = plus(absoluteStart, note.onset);
    if (note.tieStop) require(!note.grace && openTies.has(key) && compare(openTies.get(key), absolute) === 0, 'unmatched tie continuation');
    else require(!openTies.has(key), 'missing tie continuation');
    if (note.tieStop) openTies.delete(key);
    if (note.tieStart) { require(!note.grace, 'grace tie'); openTies.set(key, plus(absolute, note.duration)); }
    accidentals[`${note.staff}:${note.pitch.step}:${note.pitch.octave}`] = note.pitch.alter;
  }
  require(pending.size === 0, 'unanchored grace group');
  while (changeIndex < changes.length) applyContext(current, changes[changeIndex++]);
  measure.contextAtEnd = clone(current);
  return current;
}

export function assertScoreInventory(index, expected) {
  require(expected && expected.editionId === index.editionId && expected.slug === index.slug && expected.partId === index.partId, 'inventory edition/context mismatch');
  require(Array.isArray(expected.measures) && expected.measures.every(measure => Array.isArray(measure.notes) && Object.hasOwn(measure, 'sourceLabel') && Object.hasOwn(measure, 'nextMeasureId')), 'incomplete inventory');
  const signature = value => value.measures.map(measure => [measure.measureId, measure.sourceOrdinal, measure.sourceLabel, measure.nextMeasureId,
    measure.notes.map(note => [note.noteId, note.sourceNoteOrdinal, note.staff, note.voice,
      note.pitch.step, note.pitch.alter, note.pitch.octave, note.onset.numerator, note.onset.denominator, note.duration.numerator, note.duration.denominator])]);
  require(JSON.stringify(signature(index)) === JSON.stringify(signature(expected)), 'inventory missing/duplicate/foreign target');
}

export async function indexScore(bytes, { slug, editionId, inventory = null }) {
  require(typeof slug === 'string' && slug.length <= 100 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug), 'Piece slug');
  // Copy the caller's buffer before awaiting so later caller edits cannot race hashing/decoding.
  require(bytes instanceof Uint8Array && bytes.byteLength > 0 && bytes.byteLength <= 8 * 1024 * 1024, 'source byte limit/type');
  const source = bytes.slice(), actualId = await scoreEditionId(source);
  require(/^sha256:[0-9a-f]{64}$/.test(editionId) && actualId === editionId, 'edition digest mismatch');
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(source);
  require(!/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml), 'DTD/entities are forbidden');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  require(!doc.querySelector('parsererror') && doc.documentElement.localName === 'score-partwise', 'malformed/unsupported XML');
  require([...doc.querySelectorAll('*')].every(node => !node.namespaceURI), 'XML namespace');
  const parts = children(doc.documentElement, 'part'), declared = doc.querySelectorAll('part-list > score-part');
  require(parts.length === 1 && declared.length === 1 && parts[0].getAttribute('id') && parts[0].getAttribute('id') === declared[0].getAttribute('id'), 'one declared piano part required');
  require(/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(parts[0].getAttribute('id')), 'part ID');
  supported(parts[0], ['measure']);
  const sourceMeasures = children(parts[0], 'measure');
  require(sourceMeasures.length > 0 && sourceMeasures.length <= 1024, 'measure limit');
  const originalIds = new Set(), openTies = new Map();
  const bindId = (node, id) => {
    const supplied = ['id', 'xml:id'].filter(name => node.hasAttribute(name)).map(name => node.getAttribute(name));
    require(supplied.every(value => /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(value)) && new Set(supplied).size <= 1, 'invalid source ID');
    if (supplied.length) { require(!originalIds.has(supplied[0]), 'duplicate source note/measure ID'); originalIds.add(supplied[0]); }
    node.removeAttribute('xml:id'); node.setAttribute('id', id);
  };
  let state = { divisions: null, key: null, time: null, clefs: {} }, absolute = zero(), pitchedTotal = 0;
  const measures = [];
  for (const [position, node] of sourceMeasures.entries()) {
    const measureId = `m${String(position + 1).padStart(6, '0')}`;
    const measure = { measureId, sourceOrdinal: position + 1, sourceLabel: node.getAttribute('number'),
      nextMeasureId: position + 1 < sourceMeasures.length ? `m${String(position + 2).padStart(6, '0')}` : null,
      sourceNoteCount: 0, notes: [], events: [], contextChanges: [] };
    supported(node, ['attributes', 'note', 'backup', 'forward', 'barline', 'print']);
    let cursor = zero(), extent = zero(), previous = null;
    for (const child of node.children) {
      if (child.localName !== 'note') previous = null;
      if (child.localName === 'barline') supported(child, ['bar-style']);
      if (child.localName === 'attributes') attributes(child, state, cursor, measure.contextChanges, measure.sourceNoteCount > 0);
      if (['backup', 'forward'].includes(child.localName)) {
        require(state.divisions, 'duration before divisions');
        const duration = rational(integer(text(child, 'duration'), 1, 1_000_000_000, 'cursor duration'), state.divisions);
        cursor = child.localName === 'backup' ? minus(cursor, duration) : plus(cursor, duration);
        require(compare(cursor, zero()) >= 0, 'backup before measure start');
        if (compare(cursor, extent) > 0) extent = clone(cursor);
      }
      if (child.localName !== 'note') continue;
      require(state.divisions && ++measure.sourceNoteCount <= 4096, 'note/divisions limit');
      const value = noteValue(child, measure.sourceNoteCount, measureId, cursor, previous, state.divisions);
      value.sourceXPath = `/score-partwise/part[@id="${parts[0].getAttribute('id')}"]/measure[${position + 1}]/note[${measure.sourceNoteCount}]`;
      bindId(child, value.noteId);
      measure.events.push(value);
      if (value.pitch) { measure.notes.push(value); require(++pitchedTotal <= 65536, 'pitched-note limit'); }
      if (!value.chord) cursor = plus(cursor, value.duration);
      if (compare(cursor, extent) > 0) extent = clone(cursor);
      previous = value;
    }
    const effective = contextualize(measure, state, absolute, openTies);
    const nominal = rational(effective.time.beats * 4, effective.time.beatType);
    require(compare(extent, zero()) > 0 && compare(extent, nominal) <= 0 && (node.getAttribute('implicit') === 'yes' || compare(extent, nominal) === 0), 'unsupported incomplete/overfull measure');
    measure.duration = extent;
    measure.rests = measure.events.filter(event => !event.pitch);
    delete measure.events;
    state = effective; absolute = plus(absolute, extent);
    bindId(node, measureId);
    measures.push(measure);
  }
  require(openTies.size === 0, 'unclosed tie');
  const index = { manifestVersion: 1, indexVersion: 1, slug, editionId, partId: parts[0].getAttribute('id'), measures };
  if (inventory) assertScoreInventory(index, inventory);
  freeze(index);
  return Object.freeze({ index, createDocument: () => doc.cloneNode(true) });
}
