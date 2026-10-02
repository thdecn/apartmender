import { browserData } from "../supabase.js";
import { mountPractice } from "../../practice-host.js";
import { buildStudentHome, studentComments } from "./student-home.js";

const display = document.querySelector("#name-display");
const commentsSection = document.querySelector("#comments-section");
const commentsList = document.querySelector("#comments-list");
const piecesSection = document.querySelector("#pieces-section");
const pieceList = document.querySelector("#piece-list");
const pieceStatus = document.querySelector("#piece-status");
const modePicker = document.querySelector("#student-practice-mode");
const logout = document.querySelector("#logout");

initialize();

async function initialize() {
  let leaving = false;
  const invitation = await browserData.acceptInvitation();
  if (invitation.outcome !== "no_invitation") {
    if (invitation.outcome === "invite_accepted") await browserData.signOut();
    window.location.replace(new URL("../", practiceDirectory()).href);
    return;
  }

  logout.addEventListener("click", async (event) => {
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    logout.setAttribute("aria-disabled", "true");
    commentsSection.hidden = true;
    piecesSection.hidden = true;
    modePicker.hidden = true;
    display.textContent = "";
    commentsList.replaceChildren();
    pieceList.replaceChildren();
    pieceStatus.textContent = "";
    await browserData.signOut();
    window.location.assign(new URL("../", practiceDirectory()).href);
  });

  const current = await browserData.validateCurrentUser();
  if (leaving) return;
  if (current.outcome === "unauthenticated") {
    window.location.replace(new URL("../", practiceDirectory()).href);
    return;
  }
  if (current.outcome !== "authenticated") {
    display.textContent = messageForFailure(current.outcome);
    return;
  }

  const result = await browserData.readStudent();
  if (leaving) return;
  if (result.outcome === "unauthenticated") {
    window.location.replace(new URL("../", practiceDirectory()).href);
    return;
  }
  if (result.outcome === "student_missing") {
    display.textContent = "No Student record for this account.";
    return;
  }
  if (result.outcome !== "student_loaded") {
    display.textContent = messageForFailure(result.outcome);
    return;
  }

  display.textContent = result.student.name?.trim() || "Hello";
  const comments = studentComments(result.student);
  commentsList.replaceChildren(...comments.map(commentNode));
  commentsSection.hidden = comments.length === 0;

  const catalog = await loadCatalog();
  if (leaving) return;
  const home = buildStudentHome(result.student, catalog ?? []);

  if (catalog === null) {
    pieceStatus.textContent = "Pieces are unavailable right now.";
  } else if (home.pieces.length === 0 && !home.hasAssignedPiece) {
    pieceStatus.textContent = "No Pieces assigned yet.";
  } else if (home.pieces.length === 0) {
    pieceStatus.textContent = "Assigned Pieces are unavailable right now.";
  } else if (home.unavailable > 0) {
    pieceStatus.textContent = "Some assigned Pieces are unavailable.";
  } else {
    pieceStatus.textContent = "";
  }

  mountPractice({ pieces: home.pieces });
  piecesSection.hidden = false;
  modePicker.hidden = false;
}

function commentNode(comment) {
  const paragraph = document.createElement("p");
  paragraph.textContent = comment;
  return paragraph;
}

async function loadCatalog() {
  try {
    const response = await fetch(new URL("../../pieces.json", import.meta.url));
    if (!response.ok) return null;
    const catalog = await response.json();
    return Array.isArray(catalog) ? catalog : null;
  } catch {
    return null;
  }
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
