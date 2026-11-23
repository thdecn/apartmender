// Musical projection only. Consume a validated indexScore() result, never edited XML.
const check = (value, message) => { if (!value) throw Error(`Measure card: ${message}`); };
const direct = (node, name) => [...node.children].filter(child => child.localName === name);
const childText = (node, name) => direct(node, name)[0]?.textContent.trim();
const append = (parent, name, value, attributes = {}) => {
  const element = parent.ownerDocument.createElement(name);
  for (const [key, val] of Object.entries(attributes)) element.setAttribute(key, val);
  if (value !== null) element.textContent = String(value);
  parent.append(element);
  return element;
};
const ticks = (time, divisions) => {
  const value = BigInt(time.numerator) * BigInt(divisions), divisor = BigInt(time.denominator);
  check(value % divisor === 0n && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER), 'nonintegral source time');
  return Number(value / divisor);
};

function contextAttributes(measure, context) {
  const attrs = measure.ownerDocument.createElement('attributes');
  append(attrs, 'divisions', context.divisions);
  const key = append(attrs, 'key', null);
  append(key, 'fifths', context.key.fifths);
  append(key, 'mode', context.key.mode);
  const time = append(attrs, 'time', null);
  append(time, 'beats', context.time.beats);
  append(time, 'beat-type', context.time.beatType);
  append(attrs, 'staves', 2);
  for (const staff of [1, 2]) {
    const clef = append(attrs, 'clef', null, { number: staff });
    append(clef, 'sign', context.clefs[staff].sign);
    append(clef, 'line', context.clefs[staff].line);
  }
  measure.prepend(attrs);
}

function completeCurrent(measure, entry) {
  // Materialize inherited context. Keep timed changes, all notes/rests and source notation.
  let cursor = 0;
  for (const child of [...measure.children]) {
    if (child.localName === 'print') child.remove();
    if (child.localName === 'attributes' && cursor === 0) child.remove();
    if (child.localName === 'backup') cursor -= Number(childText(child, 'duration'));
    if (child.localName === 'forward') cursor += Number(childText(child, 'duration'));
    if (child.localName === 'note' && !direct(child, 'chord').length && !direct(child, 'grace').length)
      cursor += Number(childText(child, 'duration'));
  }
  measure.removeAttribute('width');
  contextAttributes(measure, entry.contextAtStart);
}

function previewSelection(entry) {
  const attacks = entry.notes.filter(note => !note.grace && !note.tieStop && note.onset.numerator === 0);
  const mainIds = new Set(attacks.map(note => note.noteId));
  const notes = entry.notes.filter(note => mainIds.has(note.noteId)
    || (note.grace && mainIds.has(note.graceMainNoteId)));
  return { notes, byHand: { R: notes.filter(note => note.staff === 1).map(note => note.noteId),
    L: notes.filter(note => note.staff === 2).map(note => note.noteId) } };
}

function trimSpans(note) {
  // Preview ties lead outside the attack-only excerpt; original flags remain in the index.
  for (const item of [...note.querySelectorAll('tie, tied')]) item.remove();
}

function validateGraceBeams(group) {
  for (const level of new Set(group.flatMap(node => direct(node, 'beam').map(beam => beam.getAttribute('number') ?? '1')))) {
    const members = group.map(node => direct(node, 'beam').find(beam => (beam.getAttribute('number') ?? '1') === level)).filter(Boolean);
    let open = false;
    for (const beam of members) {
      const value = beam.textContent.trim();
      if (value === 'begin') { check(!open, 'overlapping grace beams'); open = true; }
      if (value === 'continue' || value === 'end') check(open, 'grace beam outside selected group');
      if (value === 'end') open = false;
    }
    check(!open, 'grace beam outside selected group');
  }
}

function closePreviewSpans(notes) {
  const open = new Map(), tuplets = new Set();
  for (const [position, note] of notes.entries()) for (const mark of [...note.querySelectorAll('slur, tuplet')]) {
    const key = `${mark.localName}:${mark.getAttribute('number') ?? '1'}`;
    const type = mark.getAttribute('type');
    if (type === 'start') {
      check(!open.has(key), 'overlapping notation span'); open.set(key, { mark, position });
    } else if (type === 'stop' && open.has(key)) {
      if (mark.localName === 'tuplet') for (let i = open.get(key).position; i <= position; i++) tuplets.add(notes[i]);
      open.delete(key);
    }
    else mark.remove(); // Incoming/outside or layout-only continuation.
  }
  for (const { mark } of open.values()) mark.remove();
  for (const note of notes) {
    if (direct(note, 'time-modification').length && !direct(note, 'chord').length && !tuplets.has(note)) {
      const notations = direct(note, 'notations')[0] ?? append(note, 'notations', null);
      append(notations, 'tuplet', null, { type: 'start', number: '1' });
      append(notations, 'tuplet', null, { type: 'stop', number: '1' });
    }
    for (const empty of [...note.querySelectorAll('notations')]) if (!empty.children.length) empty.remove();
  }
}

function previewMeasure(source, entry, selected) {
  const measure = source.cloneNode(false);
  measure.removeAttribute('width');
  contextAttributes(measure, entry.contextAtStart);
  const sourceNotes = new Map(direct(source, 'note').map(note => [note.getAttribute('id'), note]));
  const voices = new Map();
  for (const note of selected.notes) {
    if (!voices.has(note.voice)) voices.set(note.voice, []);
    voices.get(note.voice).push(note);
  }
  const usedStaves = new Set(selected.notes.map(note => note.staff));
  const extent = ticks(entry.duration, entry.contextAtStart.divisions);
  let layer = 0;
  const startLayer = () => {
    if (layer++) append(append(measure, 'backup', null), 'duration', extent);
  };
  for (const [voice, notes] of voices) {
    startLayer();
    const emitted = [], graceGroup = [];
    let previous = null, duration = 0;
    for (const value of notes) {
      const original = sourceNotes.get(value.noteId);
      check(original, 'missing preview source identity');
      const note = original.cloneNode(true);
      trimSpans(note);
      // Filtering a tied chord head may leave a newly attacked member as the new head.
      if (value.chord && (!previous || previous.grace !== value.grace)) direct(note, 'chord').forEach(node => node.remove());
      if (!value.grace) {
        direct(note, 'beam').forEach(node => node.remove()); // One downbeat chord cannot retain a beam into omitted later notes.
        if (!direct(note, 'chord').length) duration = ticks(value.duration, entry.contextAtStart.divisions);
      } else {
        if (direct(note, 'chord').length) direct(note, 'beam').forEach(node => node.remove());
        graceGroup.push(note);
      }
      measure.append(note); emitted.push(note); previous = value;
    }
    validateGraceBeams(graceGroup.filter(node => !direct(node, 'chord').length));
    closePreviewSpans(emitted);
    check(duration > 0 && duration <= extent, 'preview voice extent');
    if (duration < extent) {
      const forward = append(measure, 'forward', null);
      append(forward, 'duration', extent - duration);
      append(forward, 'voice', voice);
      append(forward, 'staff', notes.find(note => !note.grace).staff);
    }
  }
  for (const staff of [1, 2].filter(staff => !usedStaves.has(staff))) {
    startLayer();
    const rest = append(measure, 'note', null, { 'print-object': 'no', 'print-spacing': 'yes' });
    append(rest, 'rest', null);
    append(rest, 'duration', extent);
    append(rest, 'voice', `preview-empty-${staff}`);
    append(rest, 'staff', staff);
  }
  const barline = append(measure, 'barline', null, { location: 'right' });
  append(barline, 'bar-style', 'none');
  return measure;
}

function boundaryTies(current, preview) {
  const divisions = current.contextAtStart.divisions;
  const extent = ticks(current.duration, divisions);
  return Object.freeze({
    incomingCurrent: Object.freeze(current.notes.filter(note => note.tieStop && note.onset.numerator === 0).map(note => note.noteId)),
    outgoingCurrent: Object.freeze(current.notes.filter(note => note.tieStart
      && ticks(note.onset, divisions) + ticks(note.duration, divisions) === extent).map(note => note.noteId)),
    outgoingPreview: Object.freeze((preview?.notes ?? []).filter(note => !note.grace && note.tieStart && !note.tieStop
      && note.onset.numerator === 0).map(note => note.noteId)),
  });
}

export function projectMeasureCard(score, measureId) {
  const { index } = score;
  check(index?.indexVersion === 1 && typeof score.createDocument === 'function', 'validated score required');
  const position = index.measures.findIndex(measure => measure.measureId === measureId);
  check(position >= 0, 'unknown measure occurrence');
  const current = index.measures[position], next = index.measures[position + 1] ?? null;
  check(current.nextMeasureId === (next?.measureId ?? null), 'inconsistent next occurrence');
  const doc = score.createDocument(), parts = direct(doc.documentElement, 'part');
  check(parts.length === 1 && parts[0].getAttribute('id') === index.partId, 'source part mismatch');
  const measures = direct(parts[0], 'measure');
  check(measures.length === index.measures.length
    && measures.every((measure, i) => measure.getAttribute('id') === index.measures[i].measureId), 'source occurrence mismatch');
  const sourceCurrent = measures[position], sourceNext = next && measures[position + 1];
  const selected = next ? previewSelection(next) : { notes: [], byHand: { R: [], L: [] } };
  const preview = next ? previewMeasure(sourceNext, next, selected) : null;
  for (const measure of measures) if (measure !== sourceCurrent) measure.remove();
  completeCurrent(sourceCurrent, current);
  if (preview) parts[0].append(preview);
  const byHand = Object.freeze({ R: Object.freeze(selected.byHand.R), L: Object.freeze(selected.byHand.L) });
  return Object.freeze({ document: doc, slug: index.slug, editionId: index.editionId, projectionVersion: 1,
    currentMeasureId: current.measureId, previewMeasureId: next?.measureId ?? null,
    currentNoteIds: Object.freeze(current.notes.map(note => note.noteId)), previewNoteIds: Object.freeze(selected.notes.map(note => note.noteId)),
    previewByHand: byHand, boundaryTies: boundaryTies(current, next) });
}
