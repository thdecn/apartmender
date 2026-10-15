import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserData } from "../docs/login/browser-data.js";
import { decodeTeacherPractice } from "../docs/login/teacher/teacher-practice.js";
import { teacherRows } from "../docs/login/teacher/teacher-model.js";

const studentId = "c1000000-0000-4000-8000-000000000003";
const assignmentId = "c2000000-0000-4000-8000-000000000003";
export function sampleResponse() {
  return { contractVersion: 1, outcome: "students", asOf: "2026-10-14T15:00:00.000000Z", students: [{
    studentId, name: "<b>Student</b>", schedule: { hasLesson: false, studentTimeZone: "Europe/Brussels" },
    completedWeek: { kind: "calendar", startsAt: "2026-10-04T22:00:00.000000Z",
      endsAt: "2026-10-11T22:00:00.000000Z", studentTimeZone: "Europe/Brussels" },
    pieces: [{ assignmentId, slug: "known", position: 1, totalSeconds: 301,
      baselineWeekCount: 2, baselineTotalSeconds: 601, baselineMeanSeconds: 300.5,
      baselineStatus: "available", percentageChange: 0.16638935108153078 }],
  }] };
}

test("Teacher metrics retain exact values and reject malformed or mismatched scope", () => {
  const data = sampleResponse();
  assert.equal(decodeTeacherPractice(data).students[0].pieces[0].totalSeconds, 301);
  assert.equal(decodeTeacherPractice({ ...data, outcome: "student", student: data.students[0] }, studentId).students.length, 1);
  assert.equal(decodeTeacherPractice({ ...data, outcome: "student", student: data.students[0] }, assignmentId), null);
  for (const change of [
    (d) => { d.contractVersion = 2; },
    (d) => { d.students.push(d.students[0]); },
    (d) => { d.students[0].pieces[0].totalSeconds = Number.MAX_SAFE_INTEGER + 1; },
    (d) => { d.students[0].pieces[0].position = 2; },
    (d) => { d.students[0].completedWeek.studentTimeZone = "invalid"; },
    (d) => { d.students[0].completedWeek.endsAt = "invalid"; },
    (d) => { d.students[0].completedWeek.kind = "lesson"; },
    (d) => { d.students[0].pieces[0].baselineWeekCount = 0; },
  ]) { const invalid = structuredClone(data); change(invalid); assert.equal(decodeTeacherPractice(invalid), null); }
});

test("display uses catalog text, local boundaries, zero Pieces, and exact baseline signs before rounding", () => {
  const data = sampleResponse();
  const catalog = [{ id: "known", label: "Catalog title" }];
  let row = teacherRows(data.students, catalog)[0];
  assert.equal(row.title, "Catalog title"); assert.equal(row.name, "<b>Student</b>");
  assert.match(row.period, /Calendar week: 5 Oct 2026 – 12 Oct 2026/);
  assert.equal(row.minutes, "5 min"); assert.equal(row.average, "5 min");
  assert.equal(row.change, "+0.2%"); assert.equal(row.tone, "positive");
  const piece = data.students[0].pieces[0];
  piece.totalSeconds = 300;
  row = teacherRows(data.students, [])[0]; assert.equal(row.tone, "negative"); assert.equal(row.change, "−0.2%");
  assert.equal(row.title, "Unavailable Piece (known)");
  piece.baselineTotalSeconds = 600;
  assert.equal(teacherRows(data.students, [])[0].change, "0%");
  piece.baselineTotalSeconds = Number.MAX_SAFE_INTEGER - 1;
  piece.baselineWeekCount = 3; piece.totalSeconds = 3_002_399_751_580_330;
  assert.equal(teacherRows(data.students, [])[0].tone, "neutral");
  piece.totalSeconds += 1;
  assert.equal(teacherRows(data.students, [])[0].change, "+<0.1%");
  piece.baselineStatus = "no_baseline"; piece.baselineTotalSeconds = 0; piece.totalSeconds = 0;
  row = teacherRows(data.students, [])[0];
  assert.equal(row.change, "No baseline yet"); assert.equal(row.tone, "neutral"); assert.equal(row.count, "3");
  assert.equal(row.minutes, "0 min"); assert.equal(row.average, "0 min");
  piece.baselineWeekCount = 0;
  assert.equal(teacherRows(data.students, [])[0].average, "—");
  data.students[0].pieces = [];
  assert.equal(teacherRows(data.students, [])[0].title, "No current Pieces");
});

function adapter(rpc, user = { id: "teacher-a" }) {
  return createBrowserData({ config: {}, storage: {}, history: {}, location: { hash: "" },
    createClient: () => ({ auth: {
      onAuthStateChange(callback) { queueMicrotask(() => callback()); },
      getUser: async () => ({ data: { user }, error: null }),
    }, rpc }),
  });
}

test("routing uses authoritative RPCs and never falls back after unavailable or unready responses", async () => {
  const calls = [];
  let response = sampleResponse();
  const data = adapter(async (name) => {
    calls.push(name);
    return name === "teacher_students_practice_v1" ? response :
      { data: { contractVersion: 1, outcome: "generation", credentialGeneration: 1 }, status: 200 };
  });
  response = { data: response, status: 200 };
  assert.deepEqual(await data.resolveWorkspace(), { outcome: "workspace", workspace: "teacher" });
  assert.deepEqual(calls, ["teacher_students_practice_v1"]);
  response = { error: { code: "42501" }, status: 403 };
  assert.deepEqual(await data.resolveWorkspace(), { outcome: "workspace", workspace: "student" });
  for (const [code, expected] of [["55000", "practice_not_ready"], ["XX000", "practice_unavailable"]]) {
    calls.length = 0; response = { error: { code }, status: 400 };
    assert.equal((await data.resolveWorkspace()).outcome, expected); assert.equal(calls.length, 1);
  }
  const denied = adapter(async () => ({ error: { code: "42501" }, status: 403 }));
  assert.equal((await denied.resolveWorkspace()).outcome, "account_denied");
});

test("Teacher adapter uses only scoped RPC arguments, normalizes denial, and never returns malformed data", async () => {
  const calls = [];
  const data = adapter(async (name, args) => { calls.push({ name, args });
    return { data: { ...sampleResponse(), outcome: "student", student: sampleResponse().students[0] }, status: 200 }; });
  assert.equal((await data.readTeacherStudent(studentId)).outcome, "teacher_practice_loaded");
  assert.deepEqual(calls, [{ name: "teacher_student_practice_v1", args: { target_student_id: studentId } }]);
  assert.equal((await data.readTeacherStudents()).outcome, "practice_unavailable");
  const signedOut = adapter(async () => { throw new Error("Unexpected RPC"); }, null);
  assert.equal((await signedOut.readTeacherStudents()).outcome, "unauthenticated");
  const noConfig = createBrowserData({ config: null });
  assert.equal((await noConfig.resolveWorkspace()).outcome, "configuration_error");
});
