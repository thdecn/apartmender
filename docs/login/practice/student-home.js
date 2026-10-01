const noteSlots = ["teacher_note_1", "teacher_note_2", "teacher_note_3"];
const pieceSlots = ["piece_1", "piece_2", "piece_3"];

export function buildStudentHome(student, catalog) {
  const comments = noteSlots
    .map((slot) => student[slot])
    .filter((value) => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim());

  const catalogBySlug = new Map(catalog.map((piece) => [piece.id, piece]));
  const seenSlugs = new Set();
  const pieces = [];
  let unavailable = 0;

  for (const slot of pieceSlots) {
    const value = student[slot];
    const slug = typeof value === "string" ? value.trim() : "";
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const piece = catalogBySlug.get(slug);
    if (typeof piece?.label === "string" && Array.isArray(piece.cards) && piece.cards.length > 0) {
      pieces.push(piece);
    } else {
      unavailable += 1;
    }
  }

  return { comments, pieces, hasAssignedPiece: seenSlugs.size > 0, unavailable };
}
