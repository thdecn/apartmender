const DIVISIONS = 4;
const VALUES = [[16, 'whole'], [12, 'half', true], [8, 'half'], [6, 'quarter', true],
  [4, 'quarter'], [3, 'eighth', true], [2, 'eighth'], [1, '16th']];
const SPELLING = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const fraction = ticks => {
  const divisor = ticks % 4 === 0 ? 4 : ticks % 2 === 0 ? 2 : 1;
  return { numerator: ticks / divisor, denominator: 4 / divisor };
};

function quantize(take) {
  if (take?.schemaVersion !== 1 || take.timeOrigin !== 'count-in-end' || take.timeUnit !== 'seconds'
    || ![2, 3, 4].includes(take.meter?.beats) || take.meter.beatType !== 4
    || !Number.isFinite(take.tempoBPM) || take.tempoBPM <= 0
    || !Number.isFinite(take.durationSeconds) || take.durationSeconds <= 0 || !Array.isArray(take.notes)) {
    throw new Error('Invalid transcription for straight-rhythm score construction.');
  }
  const ticksPerSecond = take.tempoBPM / 60 * DIVISIONS;
  const notes = take.notes.map((note, index) => {
    if (!Number.isInteger(note.pitchMidi) || note.pitchMidi < 21 || note.pitchMidi > 108
      || !Number.isFinite(note.onsetSeconds) || !Number.isFinite(note.offsetSeconds)
      || note.onsetSeconds < 0 || note.offsetSeconds <= note.onsetSeconds || note.offsetSeconds > take.durationSeconds) {
      throw new Error('Invalid note event for score construction.');
    }
    const start = Math.round(note.onsetSeconds * ticksPerSecond);
    const end = Math.max(start + 1, Math.round(note.offsetSeconds * ticksPerSecond));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) throw new Error('Score timing exceeds safe integer precision.');
    return { id: index + 1, pitchMidi: note.pitchMidi, start, end, staff: note.pitchMidi >= 60 ? 1 : 2,
      onsetQuarters: fraction(start), durationQuarters: fraction(end - start) };
  });
  return { notes, ticksPerSecond };
}

function voicesFor(notes) {
  const voices = [];
  for (const staff of [1, 2]) {
    const groups = [];
    for (const note of notes.filter(note => note.staff === staff)
      .sort((a, b) => a.start - b.start || b.end - a.end || a.pitchMidi - b.pitchMidi || a.id - b.id)) {
      const chord = groups.findLast(group => group.start === note.start && group.end === note.end
        && !group.notes.some(member => member.pitchMidi === note.pitchMidi));
      if (chord) chord.notes.push(note);
      else groups.push({ start: note.start, end: note.end, notes: [note] });
    }
    const lanes = [];
    for (const group of groups) {
      let lane = lanes.find(lane => lane.end <= group.start);
      if (!lane) { lane = { staff, number: voices.length + lanes.length + 1, end: 0, groups: [] }; lanes.push(lane); }
      lane.groups.push(group); lane.end = group.end;
      for (const note of group.notes) note.voice = lane.number;
    }
    if (!lanes.length) lanes.push({ staff, number: voices.length + 1, groups: [] });
    for (const [index, lane] of lanes.entries()) lane.stem = lanes.length > 1 ? (index % 2 ? 'down' : 'up') : null;
    voices.push(...lanes);
  }
  return voices;
}

function splitSpan(start, end, measureTicks) {
  const parts = [];
  while (start < end) {
    const inBar = start % measureTicks;
    const remaining = Math.min(end - start, measureTicks - inBar);
    // Longer/dotted values begin on their metric boundary; off-beat spans
    // split and tie instead of obscuring the following beat or half-bar.
    const value = VALUES.find(([ticks, , dotted]) => ticks <= remaining
      && (inBar === 0 || (ticks <= 4 ? inBar % (dotted ? 4 : ticks) === 0
        : inBar % (dotted ? ticks / 1.5 * 2 : ticks) === 0)));
    parts.push({ start, duration: value[0], type: value[1], dotted: Boolean(value[2]) });
    start += value[0];
  }
  return parts;
}

function beamVoice(segments) {
  const short = segment => segment.notes && segment.duration <= 3;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!short(segment)) continue;
    const adjacent = other => other && short(other)
      && Math.floor(other.start / 4) === Math.floor(segment.start / 4);
    const before = adjacent(segments[i - 1]), after = adjacent(segments[i + 1]);
    if (!before && !after) continue;
    segment.beams = [{ number: 1, value: before ? (after ? 'continue' : 'end') : 'begin' }];
    if (segment.duration === 1) {
      const left = before && segments[i - 1].duration === 1, right = after && segments[i + 1].duration === 1;
      segment.beams.push({ number: 2, value: left ? (right ? 'continue' : 'end') : right ? 'begin' : after ? 'forward hook' : 'backward hook' });
    }
  }
}

function pitch(note) {
  const [step, alter] = SPELLING[note.pitchMidi % 12];
  return { step, alter, octave: Math.floor(note.pitchMidi / 12) - 1 };
}

function accidentalMap(voices) {
  const states = new Map(), result = new Map();
  const attacks = voices.flatMap(voice => voice.segments.flatMap(segment => (segment.notes ?? [])
    .filter(note => segment.start === note.start).map(note => ({ note, start: segment.start }))));
  attacks.sort((a, b) => a.start - b.start || a.note.id - b.note.id);
  for (const { note, start } of attacks) {
    const p = pitch(note), key = `${note.staff}:${p.step}:${p.octave}`;
    const conflicting = attacks.some(other => {
      const otherPitch = pitch(other.note);
      return other.start === start && other.note.staff === note.staff && otherPitch.step === p.step
        && otherPitch.octave === p.octave && otherPitch.alter !== p.alter;
    });
    if (conflicting || (states.has(key) ? states.get(key) : 0) !== p.alter) result.set(note.id, p.alter ? 'sharp' : 'natural');
    states.set(key, conflicting ? 'ambiguous' : p.alter);
  }
  return result;
}

function noteXML(segment, voice, accidentals) {
  const common = `<duration>${segment.duration}</duration><voice>${voice.number}</voice><type>${segment.type}</type>${segment.dotted ? '<dot/>' : ''}`;
  if (!segment.notes) return segment.measureRest
    ? `<note><rest measure="yes"/><duration>${segment.duration}</duration><voice>${voice.number}</voice><staff>${voice.staff}</staff></note>`
    : `<note><rest/>${common}<staff>${voice.staff}</staff></note>`;
  return segment.notes.map((note, index) => {
    const p = pitch(note), stop = segment.start > note.start, start = segment.start + segment.duration < note.end;
    const ties = `${stop ? '<tie type="stop"/>' : ''}${start ? '<tie type="start"/>' : ''}`;
    const marks = `${stop ? '<tied type="stop"/>' : ''}${start ? '<tied type="start"/>' : ''}`;
    const accidental = !stop && accidentals.get(note.id);
    return `<note id="n${note.id}t${segment.start}">${index ? '<chord/>' : ''}<pitch><step>${p.step}</step><alter>${p.alter}</alter><octave>${p.octave}</octave></pitch>`
      + `<duration>${segment.duration}</duration>${ties}<voice>${voice.number}</voice><type>${segment.type}</type>${segment.dotted ? '<dot/>' : ''}`
      + `${accidental ? `<accidental>${accidental}</accidental>` : ''}${voice.stem ? `<stem>${voice.stem}</stem>` : ''}<staff>${voice.staff}</staff>`
      + `${index ? '' : (segment.beams ?? []).map(beam => `<beam number="${beam.number}">${beam.value}</beam>`).join('')}`
      + `${marks ? `<notations>${marks}</notations>` : ''}</note>`;
  }).join('');
}

export function buildStraightScore(take) {
  const { notes, ticksPerSecond } = quantize(take), voices = voicesFor(notes);
  const measureTicks = take.meter.beats * DIVISIONS;
  const end = notes.reduce((end, note) => Math.max(end, note.end), Math.max(1, Math.round(take.durationSeconds * ticksPerSecond)));
  const measureCount = Math.ceil(end / measureTicks);
  if (!Number.isSafeInteger(end) || !Number.isSafeInteger(measureCount)) throw new Error('Score timing exceeds safe integer precision.');
  const measures = [];
  for (let m = 0; m < measureCount; m++) {
    const start = m * measureTicks, end = start + measureTicks;
    const current = voices.map(voice => {
      const segments = [];
      let cursor = start;
      for (const group of voice.groups.filter(group => group.start < end && group.end > start)) {
        const from = Math.max(start, group.start), to = Math.min(end, group.end);
        segments.push(...splitSpan(cursor, from, measureTicks));
        segments.push(...splitSpan(from, to, measureTicks).map(segment => ({ ...segment, notes: group.notes })));
        cursor = to;
      }
      segments.push(...splitSpan(cursor, end, measureTicks));
      for (const segment of segments) segment.measureRest = !segment.notes && segment.duration === measureTicks;
      beamVoice(segments);
      return { ...voice, segments };
    });
    const accidentals = accidentalMap(current);
    const attributes = m ? '' : `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>${take.meter.beats}</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
    const tempo = m ? '' : `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${take.tempoBPM}</per-minute></metronome></direction-type><staff>1</staff><sound tempo="${take.tempoBPM}"/></direction>`;
    measures.push(`<measure number="${m + 1}">${attributes}${tempo}${current.map((voice, index) =>
      `${index ? `<backup><duration>${measureTicks}</duration></backup>` : ''}${voice.segments.map(segment => noteXML(segment, voice, accidentals)).join('')}`).join('')}</measure>`);
  }
  const musicXML = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`;
  return { schemaVersion: 1, rhythm: 'straight', divisions: DIVISIONS, meter: { ...take.meter }, tempoBPM: take.tempoBPM,
    measureCount, voiceCount: voices.length, noteCount: notes.length, notes, musicXML,
    quantization: { gridQuarterNotes: { numerator: 1, denominator: 4 }, policy: 'Nearest sixteenth from count-in zero; minimum one tick; final measure padded with rests.',
      maxOnsetErrorSeconds: notes.reduce((max, note) => Math.max(max, Math.abs(note.start / ticksPerSecond - take.notes[note.id - 1].onsetSeconds)), 0),
      maxOffsetErrorSeconds: notes.reduce((max, note) => Math.max(max, Math.abs(note.end / ticksPerSecond - take.notes[note.id - 1].offsetSeconds)), 0) } };
}
