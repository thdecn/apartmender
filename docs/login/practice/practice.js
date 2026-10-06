import { browserData } from "../supabase.js";
import { mountPractice } from "../../practice-host.js";
import { buildAssignmentHome, studentComments } from "./student-home.js";
import { createSessionJournal, createMemorySessionJournal } from "./session-journal.js";
import { createSessionRecorder } from "./session-recorder.js";
import { createSessionOwnership } from "./session-ownership.js";
import { createPracticeStart } from "./practice-start.js";

// A 401 is this tab's session state; it must not stop another tab with valid Auth.
const SHARED_ACCESS_BLOCKS = new Set([
  "account_denied", "disabled", "password_change_required", "hard_revoked", "missing_identity",
]);

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
  let backlogRecorder;
  let accessBlocked = false;
  let practiceHost;
  function blockPracticeAccess() {
    accessBlocked = true;
    piecesSection.hidden = true;
    modePicker.hidden = true;
  }
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
    if (current.outcome === "auth_unavailable") retryPageWhenOnline();
    return;
  }

  let memoryOnly = false;
  let journal = createSessionJournal(window.indexedDB);
  try {
    await journal.read(current.userId);
  } catch {
    journal = createMemorySessionJournal();
    memoryOnly = true;
  }
  let locks = null;
  try { locks = window.navigator.locks; } catch { /* Web Locks are unavailable. */ }
  let backlogJournal = null;
  if (!memoryOnly && !locks?.request) {
    // Keep older durable events retryable, but new Open markers must stay in
    // this tab when the browser cannot coordinate shared markers.
    backlogJournal = journal;
    journal = createMemorySessionJournal();
    memoryOnly = true;
  }
  let accessChannel = null;
  try {
    if (window.BroadcastChannel) {
      accessChannel = new window.BroadcastChannel(`apartmender-practice-access:${current.userId}`);
    }
  } catch { /* Cross-tab notices are unavailable in this browser. */ }
  function onRecorderStatus(status, fromPeer = false) {
    if (leaving || accessBlocked) return;
    if (!fromPeer && SHARED_ACCESS_BLOCKS.has(status)) {
      try { accessChannel?.postMessage({ status }); } catch { /* Retry remains local. */ }
    }
    if (status === "hard_revoked" || status === "missing_identity") {
      blockPracticeAccess();
      void practiceHost?.stop();
      commentsSection.hidden = true;
      void (async () => {
        await Promise.all([recorder.clear(), backlogRecorder?.clear()]);
        await browserData.signOut();
        window.location.replace(new URL("../", practiceDirectory()).href);
      })();
      return;
    }
    if (status === "disabled" || status === "password_change_required") {
      blockPracticeAccess();
      void practiceHost?.finish();
      syncStatus.textContent = "Account access has changed. Please contact your teacher.";
      return;
    }
    if (status === "unauthenticated" || status === "account_denied") {
      blockPracticeAccess();
      void practiceHost?.finish();
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
  }
  accessChannel?.addEventListener("message", (event) => {
    if (SHARED_ACCESS_BLOCKS.has(event.data?.status)) {
      onRecorderStatus(event.data.status, true);
    }
  });
  try {
    recorder = createSessionRecorder({
      userId: current.userId,
      journal,
      ownership: memoryOnly ? undefined
        : createSessionOwnership(locks, current.userId),
      syncWhenAnotherTabActive: Boolean(accessChannel),
      submit: (event) => browserData.ingestPractice(event),
      onStatus: onRecorderStatus,
    });
    if (backlogJournal) {
      backlogRecorder = createSessionRecorder({
        userId: current.userId,
        journal: backlogJournal,
        ownership: createSessionOwnership(null, current.userId),
        submit: (event) => browserData.ingestPractice(event),
        onStatus: onRecorderStatus,
      });
    }
    await Promise.all([recorder.recover(), backlogRecorder?.recover()]);
    if (accessBlocked || leaving) return;
  } catch {
    pieceStatus.textContent = "Practice storage is unavailable. Please reconnect later.";
    return;
  }
  const [assignmentRead, generationRead] = await Promise.all([
    browserData.readAssignments(), browserData.readPracticeGeneration(),
  ]);
  if (leaving || accessBlocked) return;
  const deniedRead = [assignmentRead, generationRead].find((read) =>
    read.outcome === "account_denied" || read.outcome === "unauthenticated");
  if (deniedRead) {
    onRecorderStatus(deniedRead.outcome);
    return;
  }
  if (assignmentRead.outcome !== "assignments_loaded"
    || generationRead.outcome !== "generation_loaded") {
    display.textContent = "Assigned Practice is unavailable. Please reconnect later.";
    retryPageWhenOnline();
    return;
  }

  const result = await browserData.readStudent();
  if (leaving || accessBlocked) return;
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
    retryPageWhenOnline();
    return;
  }

  display.textContent = result.student.name?.trim() || "Hello";
  const comments = studentComments(result.student);
  commentsList.replaceChildren(...comments.map(commentNode));
  commentsSection.hidden = comments.length === 0;

  const catalog = await loadCatalog();
  if (leaving || accessBlocked) return;
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

  const syncAll = () => Promise.all([recorder.sync(), backlogRecorder?.sync()]);
  window.addEventListener("online", () => { void syncAll().catch(() => {}); });
  retrySync.addEventListener("click", () => { void syncAll().catch(() => {}); });
  const authorizeStart = createPracticeStart({
    readAssignments: () => browserData.readAssignments(),
    readGeneration: () => browserData.readPracticeGeneration(),
    initialGeneration: generationRead.credentialGeneration,
    durable: !memoryOnly,
  });
  practiceHost = mountPractice({ pieces: home.pieces, lifecycle: {
    open: async (piece) => {
      if (accessBlocked) return false;
      const authority = await authorizeStart(piece.assignmentId);
      if (authority.outcome === "archived") {
        pieceStatus.textContent = "This Piece is no longer assigned.";
        return false;
      }
      if (authority.outcome === "account_denied" || authority.outcome === "unauthenticated") {
        onRecorderStatus(authority.outcome);
        pieceStatus.textContent = "Account access has changed. Please sign in again.";
        return false;
      }
      if (authority.outcome !== "ready") {
        pieceStatus.textContent = memoryOnly
          ? "Connect to start Practice on this device."
          : "Assigned Practice is unavailable. Please reconnect later.";
        return false;
      }
      if (accessBlocked) return false;
      const opened = await recorder.open({
        assignmentId: piece.assignmentId,
        pieceVersion: piece.version,
        credentialGeneration: authority.credentialGeneration,
      });
      if (!opened) pieceStatus.textContent = "Practice is already open in another tab or unavailable here.";
      if (accessBlocked) {
        await recorder.cancelOpen();
        return false;
      }
      return opened;
    },
    canContinue: () => !accessBlocked,
    cancel: () => recorder.cancelOpen(),
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

function retryPageWhenOnline() {
  window.addEventListener("online", () => window.location.reload(), { once: true });
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
