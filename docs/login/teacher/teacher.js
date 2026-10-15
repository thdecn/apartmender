import { browserData } from "../supabase.js";
import { teacherRows } from "./teacher-model.js";
import { isUuid } from "./teacher-practice.js";
import { createTeacherDetail } from "./teacher-detail.js";

const status = document.querySelector("#teacher-status");
const content = document.querySelector("#teacher-content");
const table = document.querySelector("#teacher-table");
const heading = document.querySelector("h1");
const refresh = document.querySelector("#teacher-refresh");
const logout = document.querySelector("#teacher-logout");
const detail = document.body.dataset.view === "student";
const studentId = detail ? new URLSearchParams(location.search).get("student") : null;
const loginUrl = new URL("../", import.meta.url);
let requestNumber = 0;
let userId = null;
let leaving = false;
const detailView = detail ? createTeacherDetail({ data: browserData, studentId, onDenied() {
  requestNumber += 1; clearView(true); status.textContent = "This Student view is unavailable to this account.";
}, onSessionUnavailable() {
  requestNumber += 1; clearView(); status.textContent = "Could not verify your session. Refresh to continue; your draft is retained.";
} }) : null;

function clearView(forget = false) {
  content.hidden = true;
  table.replaceChildren();
  heading.textContent = detail ? "Student detail" : "Teacher dashboard";
  if (forget) detailView?.clear();
}

async function load() {
  if (leaving) return;
  const request = ++requestNumber;
  clearView();
  status.textContent = "Loading assigned Students…";
  const auth = await browserData.validateCurrentUser();
  if (request !== requestNumber || leaving) return;
  if (auth.outcome !== "authenticated" || (userId && auth.userId !== userId)) {
    if (auth.outcome === "unauthenticated" || (auth.userId && auth.userId !== userId)) clearView(true);
    status.textContent = "Sign in again to view your assigned Students.";
    return;
  }
  userId = auth.userId;
  if (detail && !isUuid(studentId)) {
    status.textContent = "This Student is unavailable to this account.";
    return;
  }
  const result = detail ? await browserData.readTeacherStudent(studentId) : await browserData.readTeacherStudents();
  const identity = await browserData.sessionIdentity();
  if (request !== requestNumber || leaving) return;
  if (identity.outcome !== "authenticated" || identity.userId !== userId) {
    if (identity.outcome === "unauthenticated" || (identity.userId && identity.userId !== userId)) clearView(true);
    status.textContent = "Sign in again to view your assigned Students.";
    return;
  }
  if (result.outcome !== "teacher_practice_loaded") {
    if (result.outcome === "account_denied") clearView(true);
    status.textContent = result.outcome === "account_denied"
      ? "This Student view is unavailable to this account."
      : result.outcome === "practice_not_ready"
        ? "Practice data is not ready. Please try again later."
        : "Could not load assigned Students. Please retry.";
    return;
  }
  const notesRevision = detailView?.revision;
  const notes = detail ? await browserData.readTeacherNotes(studentId) : null;
  if (request !== requestNumber || leaving) return;
  if (detail && notes.outcome !== "teacher_notes_loaded") {
    if (["account_denied", "unauthenticated"].includes(notes.outcome)) clearView(true);
    status.textContent = "Could not load this Student's notes. Please retry.";
    return;
  }
  let catalog = [];
  try {
    const response = await fetch(new URL("../../pieces.json", import.meta.url));
    if (response.ok) { const loaded = await response.json(); if (Array.isArray(loaded)) catalog = loaded; }
  } catch { /* Unknown catalog entries retain a readable slug. */ }
  if (request !== requestNumber || leaving) return;
  const latestIdentity = await browserData.sessionIdentity();
  if (request !== requestNumber || leaving) return;
  if (latestIdentity.outcome !== "authenticated" || latestIdentity.userId !== userId) {
    if (latestIdentity.outcome === "unauthenticated" || (latestIdentity.userId && latestIdentity.userId !== userId)) clearView(true);
    status.textContent = "Sign in again to view your assigned Students.";
    return;
  }
  if (!result.students.length) { status.textContent = "No assigned Students."; return; }
  if (detail && !detailView.show(result.students[0], notes.notes, userId, notesRevision)) {
    void load(); return;
  }
  if (detail) heading.textContent = result.students[0].name?.trim() || "Student detail";
  render(teacherRows(result.students, catalog));
  content.hidden = false;
  status.textContent = "Last completed week. Baselines include eligible earlier weeks.";
}

function render(rows) {
  const head = table.createTHead().insertRow();
  for (const title of ["Student", "Completed week", "Current Piece", "Practice", "Weekly average", "Baseline weeks", "Change"]) {
    const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = title; head.append(cell);
  }
  const body = table.createTBody();
  for (const data of rows) {
    const row = body.insertRow();
    const name = document.createElement("th"); name.scope = "row";
    const link = document.createElement("a");
    const url = new URL("student/", import.meta.url); url.searchParams.set("student", data.studentId);
    link.href = url.href; link.textContent = data.name; name.append(link); row.append(name);
    for (const key of ["period", "title", "minutes", "average", "count", "change"]) {
      const cell = row.insertCell(); cell.textContent = data[key];
      if (key === "change") cell.className = `teacher-change-${data.tone}`;
    }
  }
}

refresh.addEventListener("click", () => { void load(); });
logout.addEventListener("click", async (event) => {
  event.preventDefault();
  leaving = true; requestNumber += 1; clearView(true); refresh.disabled = true;
  const result = await browserData.signOut();
  if (result.outcome === "signed_out") window.location.replace(loginUrl.href);
  else status.textContent = "Could not sign out. Close this tab and try again.";
});
window.addEventListener("pagehide", () => { requestNumber += 1; clearView(true); });
window.addEventListener("pageshow", () => { void load(); });
window.addEventListener("focus", () => { void load(); });
window.addEventListener("online", () => { void load(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { requestNumber += 1; clearView(); } else void load();
});
void load();
