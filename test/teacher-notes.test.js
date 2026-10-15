import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserData } from "../docs/login/browser-data.js";
import { decodeTeacherNotes, decodeNotePublication, validateTeacherNotes, adminRequestUrl } from "../docs/login/teacher/teacher-notes.js";
import { notesResponse, studentId } from "../e2e/teacher-fixture.js";

test("note reads validate scope and immutable period shape, preserving legacy text and nulls", () => {
  const data = notesResponse();
  data.currentNotes.note1 = "x".repeat(5001);
  assert.deepEqual(decodeTeacherNotes(data, studentId).notes, data);
  assert.equal(decodeTeacherNotes(data, "other-student"), null);
  for (const change of [
    (d) => { d.episodeId = "invalid"; }, (d) => { d.currentNotes.note2 = 5; },
    (d) => { d.precedingPeriod.studentTimeZone = "invalid"; },
    (d) => { d.precedingPeriod.endsAt = d.precedingPeriod.startsAt; },
    (d) => { delete d.precedingPeriod; },
  ]) { const invalid = structuredClone(data); change(invalid); assert.equal(decodeTeacherNotes(invalid, studentId), null); }
  data.precedingPeriod = null;
  assert.equal(decodeTeacherNotes(data, studentId).notes.precedingPeriod, null);
});

test("validation counts Unicode characters, rejects whitespace, and never transforms free text", () => {
  const notes = { note1: "  你好 <script>text</script>  ", note2: "", note3: "" };
  const before = structuredClone(notes);
  assert.equal(validateTeacherNotes(notes), ""); assert.deepEqual(notes, before);
  for (const blank of ["", " \n\t", "\u0085\u00a0\u1680\u2003\u2028\u2029\u202f\u205f\u3000\ufeff"]) {
    assert.match(validateTeacherNotes({ ...notes, note1: blank }), /non-whitespace/);
  }
  assert.equal(validateTeacherNotes({ ...notes, note1: "🎹".repeat(4000) }), "");
  assert.match(validateTeacherNotes({ ...notes, note3: "🎹".repeat(4001) }), /4,000/);
});

test("publication decoder accepts typed receipts and failures without exposing unvalidated data", () => {
  for (const outcome of ["published", "already_published"]) {
    const receipt = { contractVersion: 1, outcome, publicationId: studentId, publishedAt: notesResponse().asOf };
    assert.equal(decodeNotePublication(receipt).outcome, outcome);
    assert.equal(decodeNotePublication({ ...receipt, publicationId: "bad" }), null);
  }
  for (const outcome of ["invalid_notes", "invalid_request", "idempotency_conflict"]) {
    assert.deepEqual(decodeNotePublication({ contractVersion: 1, outcome, privateExtra: true }), { outcome });
  }
  assert.equal(decodeNotePublication({ contractVersion: 2, outcome: "published" }), null);
});

test("Admin Request creates one encoded mail draft with Teacher identity and rejects invalid recipients", () => {
  const link = new URL(adminRequestUrl("admin+requests@example.invalid", studentId));
  assert.equal(link.protocol, "mailto:");
  assert.equal(decodeURIComponent(link.pathname), "admin+requests@example.invalid");
  assert.equal(link.searchParams.get("subject"), "Apartmender Admin Request");
  assert.equal(link.searchParams.get("body"), `Teacher Auth ID: ${studentId}\n\nRequest:\n`);
  for (const mailbox of ["", "a@b.invalid,c@d.invalid", "a@b.invalid\r\nBcc: x@y.invalid", "mailto:a@b.invalid"]) {
    assert.equal(adminRequestUrl(mailbox, studentId), null);
  }
});

test("adapter uses scoped note RPCs with exact payload and request key; denials are normalized", async () => {
  const calls = [];
  let deny = false;
  const data = createBrowserData({ config: {}, storage: {}, location: { hash: "" },
    createClient: () => ({ auth: { onAuthStateChange(cb) { queueMicrotask(cb); },
      getUser: async () => ({ data: { user: { id: studentId } } }) },
      rpc: async (name, args) => { calls.push({ name, args });
        return deny ? { error: { code: "42501" }, status: 403 } : { data: name === "teacher_student_notes_v1"
          ? notesResponse() : { contractVersion: 1, outcome: "published", publicationId: studentId, publishedAt: notesResponse().asOf } }; },
    }),
  });
  assert.equal((await data.readTeacherNotes(studentId)).outcome, "teacher_notes_loaded");
  const notes = { note1: "  Keep raw text  ", note2: "", note3: "" };
  assert.equal((await data.publishTeacherNotes(studentId, studentId, notes)).outcome, "published");
  assert.deepEqual(calls, [{ name: "teacher_student_notes_v1", args: { target_student_id: studentId } },
    { name: "teacher_publish_notes_v1", args: { target_student_id: studentId, request_id: studentId,
      note_1: notes.note1, note_2: "", note_3: "" } }]);
  deny = true; assert.equal((await data.readTeacherNotes(studentId)).outcome, "account_denied");
  const failed = createBrowserData({ config: null });
  assert.equal((await failed.publishTeacherNotes(studentId, studentId, notes)).outcome, "configuration_error");
});
