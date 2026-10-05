import { browserData } from "../supabase.js";
import { mountPractice } from "../../practice-host.js";
import { buildAssignmentHome, studentComments } from "./student-home.js";
import { createSessionJournal, createMemorySessionJournal } from "./session-journal.js";
import { createSessionRecorder } from "./session-recorder.js";

const display = document.querySelector("#name-display");
const commentsSection = document.querySelector("#comments-section");
const commentsList = document.querySelector("#comments-list");
const piecesSection = document.querySelector("#pieces-section");
const pieceList = document.querySelector("#piece-list");
const pieceStatus = document.querySelector("#piece-status");
const syncStatus = document.querySelector("#sync-status");
const retrySync = document.querySelector("#retry-sync");
const modePicker = document.querySelector("#student-practice-mode");
const logout = document.querySelector("#logout");

initialize();

async function initialize() {
  let leaving = false;
  let recorder;
  let accessBlocked = false;
  let practiceHost;
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
    syncStatus.textContent = "";
    retrySync.hidden = true;
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

  const [assignmentRead, generationRead] = await Promise.all([
    browserData.readAssignments(), browserData.readPracticeGeneration(),
  ]);
  if (leaving) return;
  if (assignmentRead.outcome !== "assignments_loaded"
    || generationRead.outcome !== "generation_loaded") {
    display.textContent = "Assigned Practice is unavailable. Please reconnect later.";
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
  const home = buildAssignmentHome(assignmentRead.assignments, catalog ?? []);

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

  let memoryOnly = false;
  let journal = createSessionJournal(window.indexedDB);
  try {
    await journal.read(current.userId);
  } catch {
    journal = createMemorySessionJournal();
    memoryOnly = true;
  }
  try {
    recorder = createSessionRecorder({
      userId: current.userId,
      journal,
      submit: (event) => browserData.ingestPractice(event),
      onStatus: (status) => {
        if (leaving || accessBlocked) return;
        if (status === "hard_revoked" || status === "missing_identity") {
          accessBlocked = true;
          void practiceHost?.stop();
          commentsSection.hidden = true;
          piecesSection.hidden = true;
          modePicker.hidden = true;
          void (async () => {
            await recorder.clear();
            await browserData.signOut();
            window.location.replace(new URL("../", practiceDirectory()).href);
          })();
          return;
        }
        if (status === "disabled" || status === "password_change_required") {
          accessBlocked = true;
          void practiceHost?.finish();
          piecesSection.hidden = true;
          modePicker.hidden = true;
          syncStatus.textContent = "Account access has changed. Please contact your teacher.";
          return;
        }
        if (status === "unauthenticated" || status === "account_denied") {
          accessBlocked = true;
          piecesSection.hidden = true;
          modePicker.hidden = true;
          syncStatus.textContent = "Sign in again to sync Practice.";
          retrySync.hidden = true;
          return;
        }
        if (status === "practice_not_ready") {
          syncStatus.textContent = "Practice upload is not ready yet. Your session remains saved.";
          retrySync.hidden = true;
          return;
        }
        syncStatus.textContent = {
          retry: memoryOnly
            ? "Practice is unsaved on this device. Retry before closing this page."
            : "Practice is waiting to sync. Retry when connected.",
          rejected: "A Practice Session was rejected and will not retry. Contact your teacher.",
          synced: "",
        }[status] ?? "";
        retrySync.hidden = status !== "retry";
      },
    });
    await recorder.recover();
    if (accessBlocked || leaving) return;
  } catch {
    pieceStatus.textContent = "Practice storage is unavailable. Please reconnect later.";
    return;
  }
  window.addEventListener("online", () => { void recorder.sync().catch(() => {}); });
  retrySync.addEventListener("click", () => { void recorder.sync().catch(() => {}); });
  practiceHost = mountPractice({ pieces: home.pieces, lifecycle: {
    open: async (piece) => {
      if (accessBlocked) return false;
      const latest = await browserData.readAssignments();
      if (latest.outcome === "assignments_loaded"
        && !latest.assignments.some((a) => a.assignmentId === piece.assignmentId)) {
        pieceStatus.textContent = "This Piece is no longer assigned.";
        return false;
      }
      if (latest.outcome === "account_denied" || latest.outcome === "unauthenticated") {
        pieceStatus.textContent = "Account access has changed. Please sign in again.";
        return false;
      }
      if (memoryOnly && latest.outcome !== "assignments_loaded") {
        pieceStatus.textContent = "Connect to start Practice on this device.";
        return false;
      }
      return recorder.open({
        assignmentId: piece.assignmentId,
        pieceVersion: piece.version,
        credentialGeneration: generationRead.credentialGeneration,
      });
    },
    pause: (elapsedMs) => recorder.pause(elapsedMs),
    resume: () => recorder.resume(),
    finish: (elapsedMs) => recorder.finish(elapsedMs),
    onUnavailable: (message) => { pieceStatus.textContent = message; },
  } });
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
