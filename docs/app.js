const MAX_STREAK = 8;
const ADVANCE_AT = 3;

const homeEl = document.getElementById("home");
const practiceEl = document.getElementById("practice");
const pieceListEl = document.getElementById("piece-list");
const pieceTitleEl = document.getElementById("piece-title");
const cardMetaEl = document.getElementById("card-meta");
const practiceTimerEl = document.getElementById("practice-timer");
const practiceTimerValueEl = document.getElementById("practice-timer-value");
const cardImageEl = document.getElementById("card-image");
const counterEl = document.getElementById("counter");
const mistakeBtn = document.getElementById("mistake-btn");
const goodBtn = document.getElementById("good-btn");
const advanceBtn = document.getElementById("advance-btn");
const homeBtn = document.getElementById("home-btn");
const rotateHintEl = document.getElementById("rotate-hint");

/** @type {{ id: string, label: string, cards: string[] }[]} */
let pieces = [];

/** @type {{ id: string, label: string, cards: string[] } | null} */
let activePiece = null;
let cardIndex = 0;
let streak = 0;
let elapsedPracticeMs = 0;
let timerStartedAt = null;
let timerInterval = null;
/** @type {WakeLockSentinel | null} */
let wakeLock = null;

function currentElapsedPracticeMs() {
  if (timerStartedAt === null) return elapsedPracticeMs;
  return elapsedPracticeMs + (performance.now() - timerStartedAt);
}

function renderPracticeTimer() {
  const totalSeconds = Math.floor(currentElapsedPracticeMs() / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  practiceTimerValueEl.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  practiceTimerEl.setAttribute(
    "aria-label",
    `Practice time: ${minutes} minutes, ${seconds} seconds`,
  );
}

function startPracticeTimer() {
  if (timerStartedAt !== null) return;
  timerStartedAt = performance.now();
  renderPracticeTimer();
  timerInterval = window.setInterval(renderPracticeTimer, 1000);
}

function pausePracticeTimer() {
  if (timerStartedAt === null) return;
  elapsedPracticeMs += performance.now() - timerStartedAt;
  timerStartedAt = null;
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
  renderPracticeTimer();
}

function resetPracticeTimer() {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
  elapsedPracticeMs = 0;
  timerStartedAt = null;
  renderPracticeTimer();
}

function haptic(pattern) {
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

function flash(kind) {
  practiceEl.classList.remove("flash-mistake", "flash-good");
  // Force reflow so repeated taps retrigger the class effect.
  void practiceEl.offsetWidth;
  practiceEl.classList.add(kind);
  window.setTimeout(() => practiceEl.classList.remove(kind), 180);
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    // Permission or battery policies may deny; practice still works.
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // ignore
  } finally {
    wakeLock = null;
  }
}

function updateRotateHint() {
  const portraitPhone = window.matchMedia(
    "(orientation: portrait) and (hover: none) and (pointer: coarse)",
  ).matches;
  rotateHintEl.hidden = !(portraitPhone && !practiceEl.hidden);
}

function renderHome() {
  pieceListEl.replaceChildren(
    ...pieces.map((piece) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "piece-btn";
      btn.textContent = piece.label;
      btn.addEventListener("click", () => startPiece(piece));
      return btn;
    }),
  );
}

function updateControls() {
  counterEl.textContent = String(streak);
  advanceBtn.disabled = streak < ADVANCE_AT;
  if (activePiece) {
    cardMetaEl.textContent = `${cardIndex + 1} / ${activePiece.cards.length}`;
  }
}

function showCard() {
  if (!activePiece) return;
  const file = activePiece.cards[cardIndex];
  cardImageEl.src = `./cards/${activePiece.id}/${file}`;
  cardImageEl.alt = `${activePiece.label} card ${cardIndex + 1}`;
  updateControls();
}

async function startPiece(piece) {
  activePiece = piece;
  cardIndex = 0;
  streak = 0;
  resetPracticeTimer();
  pieceTitleEl.textContent = piece.label;
  homeEl.hidden = true;
  practiceEl.hidden = false;
  showCard();
  startPracticeTimer();
  updateRotateHint();
  await requestWakeLock();
}

async function goHome() {
  resetPracticeTimer();
  activePiece = null;
  cardIndex = 0;
  streak = 0;
  practiceEl.hidden = true;
  homeEl.hidden = false;
  cardImageEl.removeAttribute("src");
  updateRotateHint();
  await releaseWakeLock();
}

function onMistake() {
  streak = 0;
  updateControls();
  haptic([40, 30, 40]);
  flash("flash-mistake");
}

function onGood() {
  if (streak >= MAX_STREAK) {
    haptic(8);
    return;
  }
  streak += 1;
  updateControls();
  haptic(12);
  flash("flash-good");
}

async function onAdvance() {
  if (!activePiece || streak < ADVANCE_AT) return;
  haptic(24);
  const next = cardIndex + 1;
  if (next >= activePiece.cards.length) {
    await goHome();
    return;
  }
  cardIndex = next;
  streak = 0;
  showCard();
}

mistakeBtn.addEventListener("click", onMistake);
goodBtn.addEventListener("click", onGood);
advanceBtn.addEventListener("click", onAdvance);
homeBtn.addEventListener("click", () => {
  void goHome();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !practiceEl.hidden) {
    startPracticeTimer();
    void requestWakeLock();
  } else if (document.visibilityState === "hidden") {
    pausePracticeTimer();
  }
});

window.addEventListener("orientationchange", updateRotateHint);
window.addEventListener("resize", updateRotateHint);

const data = await fetch("./pieces.json").then((r) => {
  if (!r.ok) throw new Error("Failed to load pieces.json");
  return r.json();
});
pieces = data;
renderHome();
updateRotateHint();
