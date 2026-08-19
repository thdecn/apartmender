const MAX_STREAK = 8;
const ADVANCE_AT = 3;

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

/** @type {{ id: string, label: string, cards: string[] }[]} */
let pieces = [];

/** @type {{ id: string, label: string, cards: string[] } | null} */
let activePiece = null;
let cardIndex = 0;
let learningCardIndex = 0;
let streaks = [];
let swipeStart = null;
let screenTouchStart = null;
let lastScreenTapAt = 0;
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

function currentStreak() {
  return streaks[cardIndex] ?? 0;
}

function measureLabelForCard(file) {
  return file.match(/-m(\d+[a-z]?)(?:-|\.)/i)?.[1] ?? null;
}

function reachableCardIndices() {
  if (!activePiece) return [];
  return activePiece.cards
    .map((_, index) => index)
    .filter(
      (index) =>
        streaks[index] >= ADVANCE_AT ||
        index === learningCardIndex ||
        index === cardIndex,
    );
}

function updateCardNavigation() {
  const reachable = reachableCardIndices();
  const position = reachable.indexOf(cardIndex);
  previousCardBtn.disabled = position <= 0;
  nextCardBtn.disabled = position < 0 || position >= reachable.length - 1;
}

function updateControls() {
  const streak = currentStreak();
  const reviewing = cardIndex !== learningCardIndex;
  counterEl.textContent = String(streak);
  mistakeBtn.disabled = reviewing;
  goodBtn.disabled = reviewing;
  advanceBtn.textContent = reviewing ? "Resume" : "Advance";
  advanceBtn.disabled = !reviewing && streak < ADVANCE_AT;
  if (activePiece) {
    const measureLabel = measureLabelForCard(activePiece.cards[cardIndex]);
    const position = `${cardIndex + 1} / ${activePiece.cards.length}`;
    cardMetaEl.textContent = measureLabel ? `m. ${measureLabel} · ${position}` : position;
    cardMetaEl.setAttribute(
      "aria-label",
      measureLabel ? `Measure ${measureLabel}, card ${position}` : `Card ${position}`,
    );
  }
  updateCardNavigation();
}

function showCard() {
  if (!activePiece) return;
  const file = activePiece.cards[cardIndex];
  cardImageEl.classList.remove("portrait-card");
  cardImageEl.src = `./cards/${activePiece.id}/${file}`;
  cardImageEl.alt = `${activePiece.label} card ${cardIndex + 1}`;
  updateControls();
}

function navigatePlayableCard(direction) {
  const reachable = reachableCardIndices();
  const position = reachable.indexOf(cardIndex);
  const target = reachable[position + direction];
  if (target === undefined) return;
  cardIndex = target;
  showCard();
  haptic(8);
}

async function startPiece(piece) {
  activePiece = piece;
  cardIndex = 0;
  learningCardIndex = 0;
  streaks = Array(piece.cards.length).fill(0);
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
  learningCardIndex = 0;
  streaks = [];
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
  if (cardIndex !== learningCardIndex) return;
  streaks[cardIndex] = 0;
  updateControls();
  haptic([40, 30, 40]);
  flash("flash-mistake");
}

function onGood() {
  if (cardIndex !== learningCardIndex) return;
  const streak = currentStreak();
  if (streak >= MAX_STREAK) {
    haptic(8);
    return;
  }
  streaks[cardIndex] = streak + 1;
  updateControls();
  haptic(12);
  flash("flash-good");
}

async function onAdvance() {
  if (!activePiece) return;
  if (cardIndex !== learningCardIndex) {
    cardIndex = learningCardIndex;
    showCard();
    haptic(12);
    return;
  }
  if (currentStreak() < ADVANCE_AT) return;
  haptic(24);
  const next = learningCardIndex + 1;
  if (next >= activePiece.cards.length) {
    await goHome();
    return;
  }
  learningCardIndex = next;
  cardIndex = next;
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
cardImageEl.addEventListener("load", () => {
  cardImageEl.classList.toggle(
    "portrait-card",
    cardImageEl.naturalHeight > cardImageEl.naturalWidth,
  );
});
document.addEventListener("touchstart", onScreenTouchStart, { passive: true });
document.addEventListener("touchend", onScreenTouchEnd, { passive: false });
document.addEventListener("dblclick", (event) => event.preventDefault());
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
