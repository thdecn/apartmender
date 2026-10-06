import test from "node:test";
import assert from "node:assert/strict";

import { buildStudentHome, buildAssignmentHome } from "../docs/login/practice/student-home.js";

const catalog = [
  { id: "first", label: "First Piece", cards: ["ending.png", "beginning.png"] },
  { id: "second", label: "Second Piece", cards: ["only.png"] },
];

test("Student comments and Pieces retain independent slot order", () => {
  const result = buildStudentHome(
    {
      teacher_note_1: "  First comment  ",
      teacher_note_2: null,
      teacher_note_3: "Third comment",
      piece_1: "second",
      piece_2: "   ",
      piece_3: "first",
    },
    catalog,
  );

  assert.deepEqual(result.comments, ["First comment", "Third comment"]);
  assert.deepEqual(result.pieces, [catalog[1], catalog[0]]);
  assert.equal(result.hasAssignedPiece, true);
  assert.equal(result.unavailable, 0);
});

test("unknown and duplicate Piece slugs cannot create extra Practice buttons", () => {
  const result = buildStudentHome(
    {
      piece_1: "unknown",
      piece_2: "first",
      piece_3: " first ",
    },
    catalog,
  );

  assert.deepEqual(result.pieces, [catalog[0]]);
  assert.equal(result.unavailable, 1);
});

test("empty slots and unavailable catalog Pieces have safe states", () => {
  const empty = buildStudentHome(
    { teacher_note_1: null, teacher_note_2: " \n ", piece_1: null, piece_2: " " },
    catalog,
  );
  assert.deepEqual(empty.comments, []);
  assert.deepEqual(empty.pieces, []);
  assert.equal(empty.hasAssignedPiece, false);

  const unavailable = buildStudentHome({ piece_1: "first" }, []);
  assert.deepEqual(unavailable.pieces, []);
  assert.equal(unavailable.hasAssignedPiece, true);
  assert.equal(unavailable.unavailable, 1);
});

test("Assignment Home follows server position and carries durable IDs, not legacy slots", () => {
  const versioned = catalog.map((piece) => ({ ...piece, version: "sha256:version" }));
  const home = buildAssignmentHome([
    { assignmentId: "id-second", slug: "second", position: 1 },
    { assignmentId: "id-first", slug: "first", position: 2 },
  ], versioned);
  assert.deepEqual(home.pieces.map(({ id, assignmentId }) => [id, assignmentId]), [
    ["second", "id-second"], ["first", "id-first"],
  ]);
  assert.equal(home.unavailable, 0);
  assert.equal(buildAssignmentHome([{ assignmentId: "id-unknown", slug: "unknown", position: 1 }],
    versioned).pieces.length, 0);
});
