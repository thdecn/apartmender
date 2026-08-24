import { createPracticeFlow } from "./practice-flow.js";

const PRACTICE_MODE_STORAGE_KEY = "apartmender.practice-mode";

const homeEl = document.getElementById("home");
const practiceEl = document.getElementById("practice");
const pieceListEl = document.getElementById("piece-list");
const pieceTitleEl = document.getElementById("piece-title");
const cardMetaEl = document.getElementById("card-meta");
const practiceTimerEl = document.getElementById("practice-timer");
const practiceTimerValueEl = document.getElementById("practice-timer-value");
const previousCardBtn = document.getElementById("previous-card-btn");
const nextCardBtn = document.getElementById("next-card-btn");
const cardFrameEl = document.querySelector(".card-frame");
const cardImageEl = document.getElementById("card-image");
const counterEl = document.getElementById("counter");
const mistakeBtn = document.getElementById("mistake-btn");
const goodBtn = document.getElementById("good-btn");
const advanceBtn = document.getElementById("advance-btn");
const homeBtn = document.getElementById("home-btn");
const rotateHintEl = document.getElementById("rotate-hint");
const practiceModeInputs = document.querySelectorAll('input[name="practice-mode"]');

/** @type {{ id: string, label: string, cards: string[] }[]} */
let pieces = [];

/** @type {"normal" | "hard"} */
let practiceMode = readPracticeMode();

/** @type {{ id: string, label: string, cards: string[] } | null} */
let activePiece = null;
/** @type {ReturnType<typeof createPracticeFlow> | null} */
let practiceFlow = null;
let swipeStart = null;
let screenTouchStart = null;
let lastScreenTapAt = 0;
let timerInterval = null;
/** @type {WakeLockSentinel | null} */
let wakeLock = null;

function readPracticeMode() {
  try {
    return localStorage.getItem(PRACTICE_MODE_STORAGE_KEY) === "hard" ? "hard" : "normal";
  } catch {
    return "normal";
  }
}

function savePracticeMode() {
  try {
    localStorage.setItem(PRACTICE_MODE_STORAGE_KEY, practiceMode);
  } catch {
    // Storage can be unavailable; keep the choice for this page session.
  }
}

function renderPracticeMode() {
  practiceModeInputs.forEach((input) => {
    input.checked = input.value === practiceMode;
  });
}

function currentElapsedPracticeMs() {
  return practiceFlow?.snapshot().elapsedPracticeMs ?? 0;
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
  if (!practiceFlow || timerInterval !== null) return;
  practiceFlow.dispatch({ type: "timer-resumed" });
  renderPracticeTimer();
  timerInterval = window.setInterval(renderPracticeTimer, 1000);
}

function pausePracticeTimer() {
  if (!practiceFlow) return;
  practiceFlow.dispatch({ type: "timer-paused" });
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
  practiceFlow?.dispatch({ type: "timer-paused" });
  practiceFlow = null;
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

function measureLabelForCard(file) {
  return file.match(/-m(\d+[a-z]?)(?:-|\.)/i)?.[1] ?? null;
}

function updateCardNavigation() {
  const state = practiceFlow?.snapshot();
  previousCardBtn.disabled = !state?.canBrowsePrevious;
  nextCardBtn.disabled = !state?.canBrowseNext;
}

function updateControls() {
  const state = practiceFlow?.snapshot();
  if (!state) return;
  counterEl.textContent = String(state.streak);
  mistakeBtn.disabled = state.isBrowsing;
  goodBtn.disabled = state.isBrowsing;
  advanceBtn.textContent = state.isBrowsing ? "Resume" : "Advance";
  advanceBtn.disabled = !state.canAdvance;
  if (activePiece) {
    const measureLabel = measureLabelForCard(state.currentCard);
    const position = `${state.currentCardIndex + 1} / ${activePiece.cards.length}`;
    cardMetaEl.textContent = measureLabel ? `m. ${measureLabel} · ${position}` : position;
    cardMetaEl.setAttribute(
      "aria-label",
      measureLabel ? `Measure ${measureLabel}, card ${position}` : `Card ${position}`,
    );
  }
  updateCardNavigation();
}

function showCard() {
  if (!activePiece || !practiceFlow) return;
  const state = practiceFlow.snapshot();
  const file = state.currentCard;
  cardImageEl.src = `./cards/${activePiece.id}/${file}`;
  cardImageEl.alt = `${activePiece.label} card ${state.currentCardIndex + 1}`;
  updateControls();
}

function navigatePlayableCard(direction) {
  if (!practiceFlow) return;
  const previousIndex = practiceFlow.snapshot().currentCardIndex;
  practiceFlow.dispatch({ type: "browse", direction });
  if (practiceFlow.snapshot().currentCardIndex === previousIndex) return;
  showCard();
  haptic(8);
}

async function startPiece(piece) {
  resetPracticeTimer();
  activePiece = piece;
  practiceFlow = createPracticeFlow(piece.cards, { mode: practiceMode });
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
  swipeStart = null;
  screenTouchStart = null;
  lastScreenTapAt = 0;
  practiceEl.hidden = true;
  homeEl.hidden = false;
  cardImageEl.removeAttribute("src");
  updateRotateHint();
  await releaseWakeLock();
}

function onMistake() {
  if (!practiceFlow || practiceFlow.snapshot().isBrowsing) return;
  practiceFlow.dispatch({ type: "mistake" });
  updateControls();
  haptic([40, 30, 40]);
  flash("flash-mistake");
}

function onGood() {
  if (!practiceFlow || practiceFlow.snapshot().isBrowsing) return;
  const previousStreak = practiceFlow.snapshot().streak;
  practiceFlow.dispatch({ type: "good" });
  if (practiceFlow.snapshot().streak === previousStreak) {
    haptic(8);
    return;
  }
  updateControls();
  haptic(12);
  flash("flash-good");
}

async function onAdvance() {
  if (!activePiece || !practiceFlow) return;
  const state = practiceFlow.snapshot();
  if (!state.canAdvance) return;
  haptic(state.isBrowsing ? 12 : 24);
  practiceFlow.dispatch({ type: "advance" });
  if (practiceFlow.snapshot().status === "complete") {
    await goHome();
    return;
  }
  showCard();
}

function onCardPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  swipeStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
  cardFrameEl.setPointerCapture?.(event.pointerId);
}

function onCardPointerUp(event) {
  if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
  navigatePlayableCard(deltaX < 0 ? -1 : 1);
}

function isRapidTapControl(target) {
  return (
    target instanceof Element &&
    target.closest("button, a, input, select, textarea, label") !== null
  );
}

function onScreenTouchStart(event) {
  if (event.touches.length !== 1 || isRapidTapControl(event.target)) {
    screenTouchStart = null;
    lastScreenTapAt = 0;
    return;
  }
  const touch = event.touches[0];
  screenTouchStart = { x: touch.clientX, y: touch.clientY };
}

function onScreenTouchEnd(event) {
  if (!screenTouchStart || event.changedTouches.length !== 1) {
    screenTouchStart = null;
    return;
  }
  const touch = event.changedTouches[0];
  const moved = Math.hypot(
    touch.clientX - screenTouchStart.x,
    touch.clientY - screenTouchStart.y,
  );
  screenTouchStart = null;
  if (moved > 12) {
    lastScreenTapAt = 0;
    return;
  }

  const now = performance.now();
  if (lastScreenTapAt !== 0 && now - lastScreenTapAt < 350) {
    event.preventDefault();
    lastScreenTapAt = 0;
    return;
  }
  lastScreenTapAt = now;
}

mistakeBtn.addEventListener("click", onMistake);
goodBtn.addEventListener("click", onGood);
advanceBtn.addEventListener("click", onAdvance);
previousCardBtn.addEventListener("click", () => navigatePlayableCard(-1));
nextCardBtn.addEventListener("click", () => navigatePlayableCard(1));
cardFrameEl.addEventListener("pointerdown", onCardPointerDown);
cardFrameEl.addEventListener("pointerup", onCardPointerUp);
cardFrameEl.addEventListener("pointercancel", () => {
  swipeStart = null;
});
document.addEventListener("touchstart", onScreenTouchStart, { passive: true });
document.addEventListener("touchend", onScreenTouchEnd, { passive: false });
document.addEventListener("dblclick", (event) => event.preventDefault());
homeBtn.addEventListener("click", () => {
  void goHome();
});
practiceModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    practiceMode = input.value === "hard" ? "hard" : "normal";
    savePracticeMode();
    renderPracticeMode();
  });
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
renderPracticeMode();
updateRotateHint();
