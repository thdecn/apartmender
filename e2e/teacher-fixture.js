export const studentId = "c1000000-0000-4000-8000-000000000003";
export const secondStudent = "c1000000-0000-4000-8000-000000000004";
export function response() {
  return { contractVersion: 1, outcome: "students", asOf: "2026-10-14T15:00:00.000000Z", students: [{
    studentId, name: "<img src=x onerror=alert(1)>", schedule: { hasLesson: false, studentTimeZone: "Europe/Brussels" },
    completedWeek: { kind: "calendar", startsAt: "2026-10-04T22:00:00.000000Z", endsAt: "2026-10-11T22:00:00.000000Z", studentTimeZone: "Europe/Brussels" },
    pieces: [301, 300, 0].map((totalSeconds, i) => ({ assignmentId: `c2000000-0000-4000-8000-00000000000${i + 1}`,
      slug: ["czerny-op-821-no-2", "unknown-piece", "bach-bwv-772-invention-no-1"][i], position: i + 1,
      totalSeconds, baselineWeekCount: 2, baselineTotalSeconds: i === 2 ? 0 : 601,
      baselineMeanSeconds: i === 2 ? 0 : 300.5, baselineStatus: i === 2 ? "no_baseline" : "available",
      percentageChange: i === 2 ? null : (i === 0 ? 0.166389351 : -0.166389351) })),
  }] };
}

// Exercise the real adapter/page boundary with deterministic Auth and RPC responses.
// The separate local-backend test covers real JWT role/ownership enforcement.
export const adapterModule = `
  import { createBrowserData } from './browser-data.js';
  const state = window.teacherTest;
  const user = () => state.userId ? { id: state.userId, user_metadata: { role: 'Student' } } : null;
  const client = { auth: {
    onAuthStateChange(callback) { queueMicrotask(() => callback()); },
    getUser: async () => ({ data: { user: user() } }),
    getSession: async () => state.sessionUnavailable ? { error: { status: 503 } }
      : ({ data: { session: user() ? { user: user() } : null } }),
    signInWithPassword: async () => { state.userId = state.loginId;
      sessionStorage.setItem('teacher-test-user', state.userId); return { data: { user: user() } }; },
    updateUser: async () => { state.passwordChanged = true; return { data: { user: user() } }; },
    signOut: async () => { state.userId = null; sessionStorage.setItem('teacher-test-user', 'signed-out'); return {}; },
  }, rpc: async (name, args) => {
    state.calls.push(name);
    if (state.delay) await new Promise((done) => { state.release = done; });
    if (state.error) return { error: { code: state.error }, status: 403 };
    if (name === 'student_practice_generation_v1' && state.role === 'Student')
      return { data: { contractVersion: 1, outcome: 'generation', credentialGeneration: 1 } };
    if (state.role !== 'Teacher') return { error: { code: '42501' }, status: 403 };
    if (name === 'teacher_students_practice_v1') return { data: structuredClone(state.response) };
    if (name === 'teacher_student_notes_v1') {
      if (state.notesDenied || args.target_student_id !== state.noteData.studentId)
        return { error: { code: '42501' }, status: 403 };
      if (state.noteReadUnavailable) return { error: { code: 'XX000' }, status: 503 };
      return { data: structuredClone(state.noteData) };
    }
    if (name === 'teacher_publish_notes_v1') {
      state.publications.push(structuredClone(args));
      if (state.holdPublish) await new Promise((done) => { state.releasePublish = done; });
      if (state.notesDenied) return { error: { code: '42501' }, status: 403 };
      if (state.publishOutcome) return { data: { contractVersion: 1, outcome: state.publishOutcome } };
      const encoded = JSON.stringify([args.target_student_id, state.noteData.episodeId, args.note_1, args.note_2, args.note_3]);
      const receipt = state.receipts[args.request_id];
      if (receipt) return { data: receipt.payload === encoded ? { ...receipt.data, outcome: 'already_published' }
        : { contractVersion: 1, outcome: 'idempotency_conflict' } };
      const saved = { contractVersion: 1, outcome: 'published', publicationId: crypto.randomUUID(), publishedAt: state.noteData.asOf };
      state.receipts[args.request_id] = { payload: encoded, data: saved };
      state.noteData.currentNotes = { note1: args.note_1, note2: args.note_2, note3: args.note_3 };
      if (state.dropAcknowledgement) { state.dropAcknowledgement = false; return { error: { code: 'XX000' }, status: 503 }; }
      return { data: saved };
    }
    if (name === 'teacher_student_practice_v1') {
      const student = state.response.students.find((s) => s.studentId === args.target_student_id);
      return student ? { data: { contractVersion: 1, outcome: 'student', asOf: state.response.asOf, student } }
        : { error: { code: '42501' }, status: 403 };
    }
    return { error: { code: '42501' }, status: 403 };
  }};
  export const browserData = createBrowserData({ config: {}, createClient: () => client,
    storage: sessionStorage, location, history });
`;

export function notesResponse() {
  return { contractVersion: 1, outcome: "notes", asOf: "2026-10-14T15:00:00.000000Z",
    studentId, episodeId: "c3000000-0000-4000-8000-000000000001",
    currentNotes: { note1: "  Keep <b>steady</b>\n你好  ", note2: "Optional two", note3: null },
    precedingPeriod: { startsAt: "2026-10-05T04:00:00.000000Z", endsAt: "2026-10-12T04:00:00.000000Z",
      kind: "calendar", studentTimeZone: "America/New_York",
      notes: { note1: "Earlier <script>text</script>", note2: "Earlier second", note3: null } } };
}

export async function mockAdapter(page, options = {}) {
  await page.addInitScript(({ data, notes, options }) => {
    window.teacherTest = { response: data, noteData: notes, role: "Teacher", userId: "teacher-a", loginId: "teacher-a", calls: [], publications: [], receipts: {}, ...options };
    const saved = sessionStorage.getItem("teacher-test-user");
    if (saved) window.teacherTest.userId = saved === "signed-out" ? null : saved;
    localStorage.setItem("unrelated-sentinel", "keep");
  }, { data: response(), notes: notesResponse(), options });
  await page.route("**/login/supabase.js", (route) => route.fulfill({ contentType: "text/javascript", body: adapterModule }));
}
