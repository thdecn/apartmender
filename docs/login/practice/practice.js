import { clearSession, loadOwnStudent, readSession } from "../supabase.js";

const display = document.querySelector("#name-display");
const record = document.querySelector("#student-record");
const piece = document.querySelector("#piece");
const note = document.querySelector("#teacher-note");
const logout = document.querySelector("#logout");

logout.addEventListener("click", (event) => {
  event.preventDefault();
  clearSession();
  window.location.assign(new URL("../", practiceDirectory()).href);
});

if (window.location.hash.includes("access_token=") || window.location.hash.includes("error=")) {
  const login = new URL("../", practiceDirectory());
  login.hash = window.location.hash;
  window.location.replace(login.href);
} else {
  const session = readSession();
  if (!session || session.mustSetPassword) {
    clearSession();
    window.location.replace(new URL("../", practiceDirectory()).href);
  } else {
    showStudent(session);
  }
}

async function showStudent(session) {
  try {
    const result = await loadOwnStudent(session);
    if (result.status === "signed_out") {
      clearSession();
      window.location.replace(new URL("../", practiceDirectory()).href);
      return;
    }
    if (result.status !== "ok") {
      display.textContent = "Could not load this account.";
      return;
    }
    if (!result.student) {
      display.textContent = "No practice record for this account.";
      return;
    }
    display.textContent = result.student.name || "Hello";
    piece.textContent = result.student.piece_1 || "—";
    note.textContent = result.student.teacher_note_1 || "—";
    record.hidden = false;
  } catch {
    display.textContent = "Could not load this account.";
  }
}

function practiceDirectory() {
  const url = new URL(window.location.href);
  if (url.pathname.endsWith("/index.html")) {
    url.pathname = url.pathname.slice(0, -"index.html".length);
  } else if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }
  url.search = "";
  url.hash = "";
  return url;
}
