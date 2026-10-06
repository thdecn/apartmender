import { browserData } from "../../supabase.js";
import { createSessionJournal } from "../session-journal.js";
import { createSessionRecorder } from "../session-recorder.js";
import { createSessionOwnership } from "../session-ownership.js";
import { buildWeeklySummary } from "../weekly-summary-model.js";
import { safeLocalStorage, summarySnapshot } from "../weekly-summary-cache.js";

const heading = document.querySelector("#summary-heading");
const status = document.querySelector("#summary-status");
const updated = document.querySelector("#last-updated");
const content = document.querySelector("#summary-content");
const currentTable = document.querySelector("#current-table");
const historicalSection = document.querySelector("#historical-section");
const historicalTable = document.querySelector("#historical-table");
const empty = document.querySelector("#empty-week");
const uploadStatus = document.querySelector("#upload-status");
const retryUpload = document.querySelector("#retry-upload");
const retrySummary = document.querySelector("#retry-summary");

void initialize();

async function initialize() {
  const identity = await browserData.sessionIdentity();
  if (identity.outcome !== "authenticated") {
    status.textContent = "Sign in as a Student to view your Weekly Summary.";
    return;
  }
  const userId = identity.userId;
  const storage = safeLocalStorage();
  let snapshot = summarySnapshot(storage, userId);
  let catalog = [];
  let requestNumber = 0;
  let accessBlocked = false;
  let authorizedOnline = false;
  const journal = createSessionJournal(window.indexedDB);
  let locks = null;
  try { locks = window.navigator.locks; } catch { /* Web Locks are unavailable. */ }
  const recorder = createSessionRecorder({ userId, journal,
    ownership: createSessionOwnership(locks, userId),
    syncWhenAnotherTabActive: true,
    submit: (event) => authorizedOnline && navigator.onLine
      ? browserData.ingestPractice(event) : Promise.resolve({ outcome: "retry" }),
    onStatus: (state) => {
      if (accessBlocked) return;
      if (["account_denied", "unauthenticated", "disabled", "hard_revoked",
        "missing_identity", "password_change_required"].includes(state)) {
        denyAccess();
        return;
      }
      if (state === "synced") void refreshSummary();
      void showQueue(state);
    },
  });

  function clearSummaryView() {
    requestNumber += 1;
    snapshot = null;
    authorizedOnline = false;
    heading.textContent = "Weekly Summary";
    content.hidden = true;
    updated.textContent = "";
    retrySummary.hidden = true;
  }

  function denyAccess() {
    accessBlocked = true;
    clearSummaryView();
    summarySnapshot(storage, userId, null);
    uploadStatus.textContent = "";
    retryUpload.hidden = true;
    status.textContent = "This account cannot view a Student Weekly Summary.";
  }

  function showSnapshot() {
    if (!snapshot || accessBlocked) return;
    const view = buildWeeklySummary(snapshot, catalog);
    heading.textContent = view.heading;
    updated.textContent = `Last updated ${view.lastUpdated}`;
    renderTable(currentTable, view.current, view.days, "current", view.total);
    historicalSection.hidden = view.historical.length === 0;
    if (view.historical.length) renderTable(historicalTable, view.historical, view.days, "historical");
    empty.textContent = view.empty;
    content.hidden = false;
  }

  async function refreshSummary() {
    if (accessBlocked) return;
    const request = ++requestNumber;
    if (!navigator.onLine) {
      authorizedOnline = false;
      status.textContent = snapshot ? "Offline. Showing your saved summary." :
        "Connect to view your Weekly Summary.";
      retrySummary.hidden = true;
      return;
    }
    status.textContent = snapshot ? "Refreshing summary…" : "Loading summary…";
    const auth = await browserData.validateCurrentUser();
    if (request !== requestNumber || accessBlocked) return;
    if (auth.outcome === "unauthenticated" ||
      (auth.outcome === "authenticated" && auth.userId !== userId)) {
      denyAccess();
      return;
    }
    if (auth.outcome !== "authenticated") {
      authorizedOnline = false;
      status.textContent = snapshot ? "Could not refresh. Showing your saved summary." :
        "Could not load your summary. Please reconnect.";
      retrySummary.hidden = false;
      return;
    }
    authorizedOnline = true;
    const result = await browserData.readWeeklySummary();
    if (request !== requestNumber || accessBlocked) return;
    if (["account_denied", "unauthenticated"].includes(result.outcome)) {
      denyAccess();
    } else if (result.outcome === "summary_loaded") {
      snapshot = result.summary;
      summarySnapshot(storage, userId, snapshot);
      showSnapshot();
      status.textContent = "";
      retrySummary.hidden = true;
    } else {
      status.textContent = snapshot ? "Could not refresh. Showing your saved summary." :
        "Could not load your summary. Please reconnect.";
      retrySummary.hidden = false;
    }
  }

  async function showQueue(state = "") {
    if (accessBlocked) return;
    try {
      const { queue } = await journal.read(userId);
      if (accessBlocked) return;
      const pending = Object.values(queue).some((item) => item.state === "pending");
      const rejected = Object.values(queue).some((item) => item.state === "rejected");
      uploadStatus.textContent = state === "retry" && pending && navigator.onLine
        ? "Not synced—retry" :
        pending && state === "syncing" ? "Practice still syncing" :
          pending ? "Waiting to sync" : rejected ? "A Practice Session was rejected." : "";
      retryUpload.hidden = !(state === "retry" && pending && navigator.onLine);
    } catch {
      uploadStatus.textContent = "Practice storage is unavailable.";
    }
  }

  showSnapshot();
  if (snapshot) status.textContent = "Showing your saved summary.";
  try {
    const response = await fetch(new URL("../../../pieces.json", import.meta.url));
    if (response.ok) {
      const loaded = await response.json();
      if (Array.isArray(loaded)) catalog = loaded;
    }
  } catch { /* Slugs remain visible when the public catalog is unavailable. */ }
  showSnapshot();
  await refreshSummary();
  await showQueue();
  if (!accessBlocked) {
    try { await recorder.recover(); } catch { await showQueue("retry"); }
  }
  window.addEventListener("online", () => {
    void (async () => {
      await refreshSummary();
      if (!accessBlocked) {
        try { await recorder.sync(); } catch { await showQueue("retry"); }
      }
    })();
  });
  window.addEventListener("offline", () => { void refreshSummary(); void showQueue(); });
  retryUpload.addEventListener("click", () => {
    void recorder.sync().catch(() => showQueue("retry"));
  });
  retrySummary.addEventListener("click", () => { void refreshSummary(); });
  async function recheckIdentity() {
    if (accessBlocked) return;
    const identityNow = await browserData.sessionIdentity();
    if (identityNow.outcome === "unauthenticated" ||
      (identityNow.outcome === "authenticated" && identityNow.userId !== userId)) {
      denyAccess();
    } else {
      void refreshSummary();
    }
  }
  window.addEventListener("pageshow", () => { void recheckIdentity(); });
  window.addEventListener("focus", () => { void recheckIdentity(); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void recheckIdentity();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === `apartmender-weekly-summary-v1:${userId}` && event.newValue === null) {
      // Another tab cleared the shared snapshot. Its sessionStorage Auth state
      // does not decide whether this tab's still-active session may read again.
      clearSummaryView();
      status.textContent = "Checking your Weekly Summary…";
      void recheckIdentity();
    } else if (event.key === "apartmender-auth-session") {
      void recheckIdentity();
    }
  });
}

function renderTable(target, pieces, days, section, weekTotal = "") {
  const table = document.createElement("table");
  table.className = "summary-table";
  table.setAttribute("aria-label", section === "current" ? "Current Pieces" : "Other Pieces practiced this week");
  const head = table.createTHead().insertRow();
  appendCell(head, "Day", "th");
  for (const piece of pieces) {
    const cell = appendCell(head, piece.title, "th");
    cell.scope = "col";
    if (section === "historical") {
      const label = document.createElement("small");
      label.textContent = "No longer assigned";
      cell.append(label);
    }
  }
  if (section === "current") appendCell(head, "Total", "th").scope = "col";
  const body = table.createTBody();
  for (const day of days) {
    const row = body.insertRow();
    if (day.future) row.className = "summary-future";
    const dayCell = appendCell(row, day.weekday, "th");
    dayCell.scope = "row";
    for (const note of [day.from, day.until]) {
      if (!note) continue;
      const small = document.createElement("small");
      small.textContent = note;
      dayCell.append(small);
    }
    for (const value of day[section]) appendCell(row, value, "td");
    if (section === "current") appendCell(row, day.total, "td");
  }
  const foot = table.createTFoot().insertRow();
  appendCell(foot, "Week total", "th").scope = "row";
  for (const piece of pieces) appendCell(foot, piece.total, "td");
  // The overall exact total is formatted independently from the Piece totals.
  if (section === "current") appendCell(foot, weekTotal, "td");
  target.replaceChildren(table);
}

function appendCell(row, value, tag) {
  const cell = document.createElement(tag);
  cell.textContent = value;
  row.append(cell);
  return cell;
}
