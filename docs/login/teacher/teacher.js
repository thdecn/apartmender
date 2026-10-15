import { browserData } from "../supabase.js";
import { teacherRows } from "./teacher-model.js";
import { isUuid } from "./teacher-practice.js";

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

function clearView() {
  content.hidden = true;
  table.replaceChildren();
  heading.textContent = detail ? "Student detail" : "Teacher dashboard";
}

async function load() {
  if (leaving) return;
  const request = ++requestNumber;
  clearView();
  status.textContent = "Loading assigned Students…";
  const auth = await browserData.validateCurrentUser();
  if (request !== requestNumber || leaving) return;
  if (auth.outcome !== "authenticated" || (userId && auth.userId !== userId)) {
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
    status.textContent = "Sign in again to view your assigned Students.";
    return;
  }
  if (result.outcome !== "teacher_practice_loaded") {
    status.textContent = result.outcome === "account_denied"
      ? "This Student view is unavailable to this account."
      : result.outcome === "practice_not_ready"
        ? "Practice data is not ready. Please try again later."
        : "Could not load assigned Students. Please retry.";
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
    status.textContent = "Sign in again to view your assigned Students.";
    return;
  }
  if (!result.students.length) { status.textContent = "No assigned Students."; return; }
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
  leaving = true; requestNumber += 1; clearView(); refresh.disabled = true;
  const result = await browserData.signOut();
  if (result.outcome === "signed_out") window.location.replace(loginUrl.href);
  else status.textContent = "Could not sign out. Close this tab and try again.";
});
window.addEventListener("pagehide", () => { requestNumber += 1; clearView(); });
window.addEventListener("pageshow", () => { void load(); });
window.addEventListener("focus", () => { void load(); });
window.addEventListener("online", () => { void load(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { requestNumber += 1; clearView(); } else void load();
});
void load();
