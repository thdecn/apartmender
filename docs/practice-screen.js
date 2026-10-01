export function mountPracticeScreen(practiceEl) {
  practiceEl.innerHTML = `
<header class="practice-top">
  <button type="button" id="home-btn" class="text-btn" aria-label="Back home">
    Home
  </button>
  <p id="piece-title" class="piece-title"></p>
  <div class="practice-meta">
    <p id="practice-timer" class="practice-timer" aria-label="Practice time">
      <span class="practice-timer-icon" aria-hidden="true">◷</span>
      <span id="practice-timer-value">0:00</span>
    </p>
    <div class="card-nav" aria-label="Practice measures">
      <button
        type="button"
        id="next-card-btn"
        class="card-nav-btn"
        aria-label="Next playable measure"
        disabled
      >
        ‹
      </button>
      <p id="card-meta" class="card-meta" aria-live="polite"></p>
      <button
        type="button"
        id="previous-card-btn"
        class="card-nav-btn"
        aria-label="Previous playable measure"
        disabled
      >
        ›
      </button>
    </div>
  </div>
</header>

<section class="stage">
  <div id="counter" class="counter" aria-live="polite">0</div>
  <figure class="card-frame">
    <img id="card-image" alt="Practice card" draggable="false" />
  </figure>
</section>

<nav class="controls">
  <button type="button" id="mistake-btn" class="btn btn-mistake">Mistake</button>
  <button type="button" id="good-btn" class="btn btn-good">Good</button>
  <button type="button" id="advance-btn" class="btn btn-advance" disabled>
    Advance
  </button>
</nav>
`;
}
