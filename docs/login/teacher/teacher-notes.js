import { isUuid } from "./teacher-practice.js";
const instant = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const noteSet = (value) => value && ["note1", "note2", "note3"].every((key) =>
  value[key] === null || typeof value[key] === "string");

export function decodeTeacherNotes(data, studentId) {
  if (data?.contractVersion !== 1 || data.outcome !== "notes" || !isUuid(data.studentId) || data.studentId !== studentId ||
    !isUuid(data.episodeId) || !instant(data.asOf) || !noteSet(data.currentNotes)) return null;
  const period = data.precedingPeriod;
  if (period !== null) {
    if (!period || !["lesson", "calendar"].includes(period.kind) || !instant(period.startsAt) ||
      !instant(period.endsAt) || Date.parse(period.startsAt) >= Date.parse(period.endsAt) ||
      typeof period.studentTimeZone !== "string" || !noteSet(period.notes)) return null;
    try { new Intl.DateTimeFormat("en", { timeZone: period.studentTimeZone }); } catch { return null; }
  }
  return { outcome: "teacher_notes_loaded", notes: data };
}

export function decodeNotePublication(data) {
  if (data?.contractVersion !== 1) return null;
  if (["invalid_request", "invalid_notes", "idempotency_conflict"].includes(data.outcome)) return { outcome: data.outcome };
  return ["published", "already_published"].includes(data.outcome) && isUuid(data.publicationId) && instant(data.publishedAt)
    ? { outcome: data.outcome, publicationId: data.publicationId, publishedAt: data.publishedAt } : null;
}

export function validateTeacherNotes(notes) {
  if (!/[^\p{White_Space}\uFEFF]/u.test(notes.note1)) return "Note 1 must contain non-whitespace text.";
  return Object.values(notes).some((note) => [...note].length > 4000)
    ? "Each note must be at most 4,000 characters." : "";
}

export function adminRequestUrl(mailbox, teacherId) {
  if (!isUuid(teacherId) || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(mailbox)) return null;
  return `mailto:${encodeURIComponent(mailbox)}?subject=${encodeURIComponent("Apartmender Admin Request")}` +
    `&body=${encodeURIComponent(`Teacher Auth ID: ${teacherId}\n\nRequest:\n`)}`;
}
