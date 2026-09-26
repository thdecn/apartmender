import { browserData } from "../supabase.js";

const display = document.querySelector("#name-display");
const record = document.querySelector("#student-record");
const piece = document.querySelector("#piece");
const note = document.querySelector("#teacher-note");
const logout = document.querySelector("#logout");

initialize();

async function initialize() {
  const invitation = await browserData.acceptInvitation();
  if (invitation.outcome !== "no_invitation") {
    if (invitation.outcome === "invite_accepted") await browserData.signOut();
    window.location.replace(new URL("../", practiceDirectory()).href);
    return;
  }

  logout.addEventListener("click", async (event) => {
    event.preventDefault();
    logout.setAttribute("aria-disabled", "true");
    await browserData.signOut();
    window.location.assign(new URL("../", practiceDirectory()).href);
  });

  const current = await browserData.validateCurrentUser();
  if (current.outcome === "unauthenticated") {
    window.location.replace(new URL("../", practiceDirectory()).href);
    return;
  }
  if (current.outcome !== "authenticated") {
    display.textContent = messageForFailure(current.outcome);
    return;
  }

  const result = await browserData.readStudent();
  if (result.outcome === "unauthenticated") {
    window.location.replace(new URL("../", practiceDirectory()).href);
    return;
  }
  if (result.outcome === "student_missing") {
    display.textContent = "No practice record for this account.";
    return;
  }
  if (result.outcome !== "student_loaded") {
    display.textContent = messageForFailure(result.outcome);
    return;
  }

  display.textContent = result.student.name || "Hello";
  piece.textContent = result.student.piece_1 || "—";
  note.textContent = result.student.teacher_note_1 || "—";
  record.hidden = false;
}

function messageForFailure(outcome) {
  if (outcome === "configuration_error") return "This site is not configured for login.";
  if (outcome === "student_cardinality_violation") {
    return "This account has an unexpected data error.";
  }
  return "Could not load this account.";
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
