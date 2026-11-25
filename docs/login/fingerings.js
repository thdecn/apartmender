import { isUuid } from './teacher/teacher-practice.js';

const revision = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n;
const operationValid = value => value && (value.kind === 'suppress' ? Object.keys(value).length === 1
  : value.kind === 'set' && Object.keys(value).length === 3 && ['L','R'].includes(value.hand)
    && Number.isInteger(value.finger) && value.finger >= 1 && value.finger <= 5);
const rejected = new Set(['invalid_request','edition_not_supported','invalid_note_scope','idempotency_conflict']);
const clone = value => structuredClone(value);
const unavailable = () => ({ outcome: 'fingering_unavailable' });
const rpc = {
  student: { read: 'student_piece_fingerings_v1', save: 'student_save_piece_fingering_v1' },
  teacher: { read: 'teacher_student_piece_fingerings_v1', save: 'teacher_save_student_piece_fingering_v1' },
};

function contextFor(input, actor) {
  const { role = 'student', studentId, assignmentId, index, measureIds } = input;
  if (!['student','teacher'].includes(role) || (role === 'student' && studentId !== undefined)
    || (role === 'teacher' && !isUuid(studentId)) || !isUuid(assignmentId) || index?.indexVersion !== 1
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(index.slug) || index.slug.length > 100
    || !/^sha256:[a-f0-9]{64}$/.test(index.editionId) || !Array.isArray(measureIds)
    || measureIds.length < 1 || measureIds.length > 64 || new Set(measureIds).size !== measureIds.length) return null;
  const measures = measureIds.map(id => index.measures.find(m => m.measureId === id));
  if (measures.some(m => !m) || measures.reduce((n,m) => n+m.notes.length,0) > 4096) return null;
  return { role, actor, studentId: role === 'student' ? actor : studentId.toLowerCase(), assignmentId: assignmentId.toLowerCase(),
    slug: index.slug, editionId: index.editionId, measureIds: [...measureIds],
    notes: new Map(measures.flatMap(m => m.notes.map(n => [n.noteId,m.measureId]))) };
}

function decode(data, scope, intent) {
  if (data?.contractVersion !== 1) return null;
  if (rejected.has(data.outcome)) return { outcome: data.outcome };
  if (data.studentId !== scope.studentId || data.assignmentId !== scope.assignmentId || data.slug !== scope.slug
    || data.editionId !== scope.editionId || !(data.studentName === null || typeof data.studentName === 'string')
    || !revision(data.snapshotRevision)) return null;
  const validRow = row => row && scope.notes.has(row.noteId) && scope.notes.get(row.noteId) === row.measureId
    && revision(row.revision) && BigInt(row.revision) > 0n && BigInt(row.revision) <= BigInt(data.snapshotRevision)
    && (row.kind === 'suppress' || (row.kind === 'set' && ['L','R'].includes(row.hand)
      && Number.isInteger(row.finger) && row.finger >= 1 && row.finger <= 5));
  if (!intent) {
    if (data.outcome !== 'fingerings' || JSON.stringify(data.measureIds) !== JSON.stringify(scope.measureIds)
      || !Array.isArray(data.overrides) || !data.overrides.every(validRow)
      || new Set(data.overrides.map(row => row.noteId)).size !== data.overrides.length) return null;
  } else if (!['saved','already_saved'].includes(data.outcome) || data.requestId !== intent.requestId
    || !revision(data.acknowledgement?.revision) || BigInt(data.acknowledgement.revision) <= 0n
    || BigInt(data.acknowledgement.revision) > BigInt(data.snapshotRevision)
    || typeof data.acknowledgement.savedAt !== 'string' || !data.acknowledgement.savedAt.endsWith('Z')
    || !Number.isFinite(Date.parse(data.acknowledgement.savedAt)) || !validRow(data.current)
    || data.current.noteId !== intent.noteId || BigInt(data.current.revision) < BigInt(data.acknowledgement.revision)) return null;
  if (intent && data.outcome === 'saved' && (data.current.revision !== data.acknowledgement.revision
    || data.current.kind !== intent.operation.kind || (data.current.kind === 'set'
      && (data.current.hand !== intent.operation.hand || data.current.finger !== intent.operation.finger)))) return null;
  return data;
}

// A single open Student/edition/page view. Drafts and retry keys live only here.
export function createFingeringAdapter({ identity, request, newRequestId = () => crypto.randomUUID(), timeoutMs = 15000, onChange = () => {} }) {
  let epoch = 0, closed = false, scope = null, loaded = false, actor = null, snapshotRevision = '0', studentName = null;
  const confirmed = new Map(), drafts = new Map();
  const notify = () => queueMicrotask(() => onChange(snapshot()));
  async function bounded(work) {
    let timer;
    try { return await Promise.race([Promise.resolve().then(work), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('Fingering request timed out')), timeoutMs);
    })]); } finally { clearTimeout(timer); }
  }
  function clear() {
    epoch++; scope = null; loaded = false; actor = null; snapshotRevision = '0'; studentName = null;
    confirmed.clear(); drafts.clear();
    notify();
  }
  function snapshot() {
    if (!loaded) return { outcome: 'not_loaded' };
    return clone({ outcome: 'fingerings', studentId: scope.studentId, studentName, assignmentId: scope.assignmentId,
      slug: scope.slug, editionId: scope.editionId, measureIds: scope.measureIds, snapshotRevision,
      overrides: [...scope.notes.keys()].filter(id => confirmed.has(id)).map(id => confirmed.get(id)), drafts: [...drafts.values()].map(({noteId,requestId,operation,status,error}) =>
        ({noteId,requestId,operation,status,error})) });
  }
  async function authenticate(expectedEpoch) {
    let auth;
    try { auth = await bounded(identity); } catch { return epoch === expectedEpoch ? unavailable() : {outcome:'superseded'}; }
    if (epoch !== expectedEpoch) return { outcome: 'superseded' };
    if (auth.outcome !== 'authenticated' && !['unauthenticated','account_denied','password_completion_required'].includes(auth.outcome)) return unavailable();
    if (auth.outcome !== 'authenticated' || !isUuid(auth.userId) || (actor && actor !== auth.userId.toLowerCase())) {
      clear(); return { outcome: 'fingering_access_denied' };
    }
    actor = auth.userId.toLowerCase(); return null;
  }
  async function call(scopeAtStart, expectedEpoch, intent) {
    const authError = await authenticate(expectedEpoch); if (authError) return authError;
    const args = { requested_slug: scopeAtStart.slug, requested_edition_id: scopeAtStart.editionId };
    if (scopeAtStart.role === 'teacher') args.target_student_id = scopeAtStart.studentId;
    if (intent) Object.assign(args, { requested_note_id: intent.noteId, request_id: intent.requestId, operation: clone(intent.operation) });
    else args.requested_measure_ids = [...scopeAtStart.measureIds];
    if (new TextEncoder().encode(JSON.stringify(args)).length > 16384) return { outcome: 'invalid_request' };
    let response;
    try { response = await bounded(() => request(rpc[scopeAtStart.role][intent ? 'save' : 'read'], args)); }
    catch { response = null; }
    // A denial is authoritative for this view even if a later Auth lookup fails.
    if (epoch !== expectedEpoch) return { outcome: 'superseded' };
    if (response?.error?.code === '42501' || response?.status === 401) {
      clear(); return { outcome: 'fingering_access_denied' };
    }
    const after = await authenticate(expectedEpoch); if (after) return after;
    if (response?.error?.code === '22P02') return { outcome: 'invalid_request' };
    if (!response || response.error) return unavailable();
    return decode(response.data, scopeAtStart, intent) ?? unavailable();
  }
  function incorporate(data) {
    const rows = data.overrides ?? [data.current];
    for (const row of rows) if (!confirmed.has(row.noteId) || BigInt(row.revision) >= BigInt(confirmed.get(row.noteId).revision))
      confirmed.set(row.noteId, clone(row));
    if (BigInt(data.snapshotRevision) >= BigInt(snapshotRevision)) { snapshotRevision = data.snapshotRevision; studentName = data.studentName; }
    loaded = true;
    notify();
  }
  async function readLatest(expectedEpoch) {
    const data = await call(scope, expectedEpoch);
    if (epoch !== expectedEpoch) return data.outcome === 'fingering_access_denied' ? data : { outcome: 'superseded' };
    if (data.outcome === 'fingerings') incorporate(data);
    return data.outcome === 'fingerings' ? snapshot() : data;
  }
  async function send(intent) {
    const expectedEpoch = epoch, scopeAtStart = scope;
    intent.status = 'saving'; delete intent.error;
    notify();
    const data = await call(scopeAtStart, expectedEpoch, intent);
    if (epoch !== expectedEpoch) return data.outcome === 'fingering_access_denied' ? data : { outcome: 'superseded' };
    const latest = drafts.get(intent.noteId) === intent;
    if (['saved','already_saved'].includes(data.outcome)) {
      incorporate(data);
      if (latest) drafts.delete(intent.noteId);
      notify();
      return { outcome: data.outcome, requestId: intent.requestId, acknowledgement: clone(data.acknowledgement), snapshot: snapshot() };
    }
    if (latest) { intent.status = 'unsaved'; intent.error = data.outcome; }
    notify();
    if (['fingering_unavailable','idempotency_conflict'].includes(data.outcome)) {
      // A read can reconcile confirmed values, but cannot acknowledge the lost save.
      const reconciled = await readLatest(expectedEpoch);
      if (reconciled.outcome === 'fingering_access_denied') return reconciled;
      if (epoch !== expectedEpoch) return { outcome: 'superseded' };
    }
    return data;
  }
  return {
    snapshot, clear,
    async refresh() {
      if (closed || !loaded || !scope) return unavailable();
      return readLatest(epoch);
    },
    destroy() { closed = true; clear(); },
    authChanged(userId) { if (!userId || (actor && userId.toLowerCase() !== actor)) clear(); },
    async open(input) {
      if (closed) return unavailable();
      clear(); const expectedEpoch = epoch;
      const authError = await authenticate(expectedEpoch); if (authError) return authError;
      try { scope = contextFor(input, actor); } catch { scope = null; }
      if (!scope) return { outcome: 'invalid_request' };
      return readLatest(expectedEpoch);
    },
    async save(noteId, operation) {
      if (!loaded || !scope?.notes.has(noteId) || !operationValid(operation)) return { outcome: 'invalid_request' };
      const intent = { noteId, operation: clone(operation), requestId: newRequestId(), status: 'saving' };
      if (!isUuid(intent.requestId)) return { outcome: 'invalid_request' };
      drafts.set(noteId, intent); return send(intent);
    },
    async retry(noteId) {
      const intent = drafts.get(noteId);
      if (!loaded || !intent || intent.status !== 'unsaved') return { outcome: 'invalid_request' };
      return send(intent);
    },
  };
}
