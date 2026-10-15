import { administratorMailbox } from "./teacher-config.js";
import { adminRequestUrl, validateTeacherNotes } from "./teacher-notes.js";

export function createTeacherDetail({ data, studentId, onDenied, onSessionUnavailable }) {
  const editor = document.querySelector("#teacher-notes");
  const form = document.querySelector("#note-form");
  const fields = document.querySelector("#note-fields");
  const status = document.querySelector("#note-status");
  const previous = document.querySelector("#previous-notes");
  const previousPeriod = document.querySelector("#previous-period");
  const admin = document.querySelector("#admin-request");
  const contact = document.querySelector("#admin-info");
  const keys = ["note1", "note2", "note3"];
  let episodeId = null, teacherId = null, pending = null;
  let dirty = false, saving = false, epoch = 0, revision = 0;

  const values = () => Object.fromEntries(keys.map((key) => [key, form.elements[key].value]));
  const fill = (notes) => { for (const key of keys) form.elements[key].value = notes[key] ?? ""; };

  function clear() {
    epoch += 1; revision += 1; episodeId = null; teacherId = null; pending = null; dirty = false; saving = false;
    fill({}); previous.replaceChildren(); previousPeriod.textContent = "";
    status.textContent = ""; fields.disabled = true; editor.hidden = true;
    document.querySelector("#lesson-info").textContent = "";
    admin.removeAttribute("href"); admin.hidden = true; contact.textContent = "";
  }

  function renderHistory(period) {
    previous.replaceChildren();
    previousPeriod.textContent = "No completed note period yet.";
    if (!period) return;
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: period.studentTimeZone,
      dateStyle: "medium", timeStyle: "short" });
    previousPeriod.textContent = `${period.kind === "calendar" ? "Calendar" : "Lesson"} period: ` +
      `${date.format(new Date(period.startsAt))} – ${date.format(new Date(period.endsAt))} (${period.studentTimeZone})`;
    for (const [index, key] of keys.entries()) {
      const label = document.createElement("dt"); label.textContent = `Note ${index + 1}`;
      const note = document.createElement("dd"); note.textContent = period.notes[key] ?? "No note";
      previous.append(label, note);
    }
  }

  function show(student, notes, actorId, readRevision) {
    // A read begun before a completed publication cannot replace its reread.
    if (readRevision !== revision) return false;
    const changed = episodeId !== null && episodeId !== notes.episodeId;
    if (episodeId !== notes.episodeId) {
      epoch += 1; revision += 1; pending = null; dirty = false; saving = false;
      status.textContent = changed ? "The Teacher assignment changed. Notes have been reset." : "";
    }
    episodeId = notes.episodeId; teacherId = actorId;
    if (!dirty) fill(notes.currentNotes);
    const schedule = student.schedule;
    document.querySelector("#lesson-info").textContent = schedule.hasLesson
      ? `Lesson: ${schedule.lessonStartDay[0].toUpperCase() + schedule.lessonStartDay.slice(1)} at ${schedule.lessonStartTime.slice(0, 5)} (${schedule.studentTimeZone})`
      : `No lesson scheduled. Calendar weeks begin Monday at 00:00 (${schedule.studentTimeZone}).`;
    renderHistory(notes.precedingPeriod);
    const href = adminRequestUrl(administratorMailbox, teacherId);
    admin.hidden = !href; if (href) admin.href = href; else admin.removeAttribute("href");
    contact.textContent = href ? "Opens your email app. Review and send your request there." : "Admin contact is unavailable.";
    fields.disabled = saving; editor.hidden = false;
    return true;
  }

  form.addEventListener("input", () => { dirty = true; status.textContent = "Unpublished changes."; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving || !episodeId) return;
    const notes = values();
    const error = validateTeacherNotes(notes);
    if (error) { status.textContent = error; return; }
    try {
      if (!pending || JSON.stringify(pending.notes) !== JSON.stringify(notes)) {
        pending = { requestId: crypto.randomUUID(), notes };
      }
    } catch { status.textContent = "Could not prepare Update. Your draft is unchanged."; return; }
    const publication = pending;
    const requestEpoch = epoch;
    saving = true; fields.disabled = true;
    status.textContent = "Updating notes…";
    try {
      const result = await data.publishTeacherNotes(studentId, publication.requestId, publication.notes);
      const identity = await data.sessionIdentity();
      if (requestEpoch !== epoch) return;
      if (identity.outcome === "auth_unavailable") { onSessionUnavailable(); return; }
      if (identity.outcome !== "authenticated" || identity.userId !== teacherId ||
        ["account_denied", "unauthenticated"].includes(result.outcome)) { clear(); onDenied(); return; }
      if (["published", "already_published"].includes(result.outcome)) {
        const read = await data.readTeacherNotes(studentId);
        const latestIdentity = await data.sessionIdentity();
        if (requestEpoch !== epoch) return;
        if (latestIdentity.outcome === "auth_unavailable") { onSessionUnavailable(); return; }
        if (latestIdentity.outcome !== "authenticated" || latestIdentity.userId !== teacherId ||
          ["account_denied", "unauthenticated"].includes(read.outcome)) { clear(); onDenied(); return; }
        if (read.outcome === "teacher_notes_loaded") {
          if (read.notes.episodeId !== episodeId) { clear(); onDenied(); return; }
          revision += 1; fill(read.notes.currentNotes); dirty = false; pending = null;
          renderHistory(read.notes.precedingPeriod);
          status.textContent = "Notes updated.";
        } else status.textContent = "Notes saved, but the latest notes could not be loaded. Your draft is retained; retry to refresh.";
      } else {
        if (["invalid_request", "invalid_notes", "idempotency_conflict"].includes(result.outcome)) pending = null;
        status.textContent = result.outcome === "invalid_notes" ? "Update rejected. Check note 1 and the 4,000-character limit." :
          result.outcome === "idempotency_conflict" ? "Update conflicted. Your draft is retained; review it and try again." :
            "Could not confirm Update. Your draft is retained; retry sends the same request.";
      }
    } finally {
      if (requestEpoch === epoch) { saving = false; fields.disabled = false; }
    }
  });
  return { show, clear, get revision() { return revision; } };
}
