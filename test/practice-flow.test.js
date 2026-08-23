import test from "node:test";
import assert from "node:assert/strict";

import { createPracticeFlow } from "../docs/practice-flow.js";

test("Normal mode starts with the ending card", () => {
  const flow = createPracticeFlow(["ending", "middle", "beginning"], {
    now: () => 0,
  });

  assert.equal(flow.snapshot().currentCard, "ending");
});

test("The snapshot identifies the displayed card's position", () => {
  const flow = createPracticeFlow(["ending", "middle", "beginning"], {
    now: () => 0,
  });

  assert.equal(flow.snapshot().currentCardIndex, 0);
});

test("Good records a successful attempt on the current card", () => {
  const flow = createPracticeFlow(["ending", "beginning"], { now: () => 0 });

  flow.dispatch({ type: "good" });

  assert.equal(flow.snapshot().streak, 1);
});

test("Mistake resets the current card's Good streak", () => {
  const flow = createPracticeFlow(["ending", "beginning"], { now: () => 0 });

  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "mistake" });

  assert.equal(flow.snapshot().streak, 0);
});

test("Advance progresses from the ending card toward the beginning", () => {
  const flow = createPracticeFlow(["ending", "middle", "beginning"], {
    now: () => 0,
  });

  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "advance" });

  assert.equal(flow.snapshot().currentCard, "middle");
});

test("Advance waits for three consecutive Goods", () => {
  const flow = createPracticeFlow(["ending", "beginning"], { now: () => 0 });

  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "advance" });

  assert.equal(flow.snapshot().currentCard, "ending");
});

test("Good streaks stop at eight", () => {
  const flow = createPracticeFlow(["ending"], { now: () => 0 });

  for (let attempt = 0; attempt < 9; attempt += 1) {
    flow.dispatch({ type: "good" });
  }

  assert.equal(flow.snapshot().streak, 8);
});

test("Browsing revisits a completed card without changing its result", () => {
  const flow = createPracticeFlow(["ending", "middle", "beginning"], {
    now: () => 0,
  });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "advance" });

  flow.dispatch({ type: "browse", direction: -1 });

  const state = flow.snapshot();
  assert.deepEqual(
    {
      currentCard: state.currentCard,
      streak: state.streak,
      isBrowsing: state.isBrowsing,
    },
    { currentCard: "ending", streak: 3, isBrowsing: true },
  );
});

test("Advance acts as Resume while browsing", () => {
  const flow = createPracticeFlow(["ending", "middle", "beginning"], {
    now: () => 0,
  });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "advance" });
  flow.dispatch({ type: "browse", direction: -1 });

  flow.dispatch({ type: "advance" });

  const state = flow.snapshot();
  assert.deepEqual(
    { currentCard: state.currentCard, isBrowsing: state.isBrowsing },
    { currentCard: "middle", isBrowsing: false },
  );
});

test("Advancing the beginning card completes the session", () => {
  const flow = createPracticeFlow(["ending", "beginning"], { now: () => 0 });
  for (let card = 0; card < 2; card += 1) {
    flow.dispatch({ type: "good" });
    flow.dispatch({ type: "good" });
    flow.dispatch({ type: "good" });
    flow.dispatch({ type: "advance" });
  }

  assert.equal(flow.snapshot().status, "complete");
});

test("Session completion closes the practice controls", () => {
  const flow = createPracticeFlow(["ending", "beginning"], { now: () => 0 });
  for (let card = 0; card < 2; card += 1) {
    flow.dispatch({ type: "good" });
    flow.dispatch({ type: "good" });
    flow.dispatch({ type: "good" });
    flow.dispatch({ type: "advance" });
  }

  const state = flow.snapshot();
  assert.deepEqual(
    [state.canAdvance, state.canBrowsePrevious, state.canBrowseNext],
    [false, false, false],
  );
});

test("The timer reports elapsed active practice time from an injected clock", () => {
  let now = 1_000;
  const flow = createPracticeFlow(["ending"], { now: () => now });

  now = 3_500;

  assert.equal(flow.snapshot().elapsedPracticeMs, 2_500);
});

test("The timer excludes time while practice is hidden", () => {
  let now = 1_000;
  const flow = createPracticeFlow(["ending"], { now: () => now });
  now = 4_000;

  flow.dispatch({ type: "timer-paused" });
  now = 9_000;

  assert.equal(flow.snapshot().elapsedPracticeMs, 3_000);
});

test("The timer resumes accumulating when practice becomes visible", () => {
  let now = 1_000;
  const flow = createPracticeFlow(["ending"], { now: () => now });
  now = 4_000;
  flow.dispatch({ type: "timer-paused" });
  now = 9_000;

  flow.dispatch({ type: "timer-resumed" });
  now = 11_000;

  assert.equal(flow.snapshot().elapsedPracticeMs, 5_000);
});

test("Completing a session freezes its elapsed practice time", () => {
  let now = 1_000;
  const flow = createPracticeFlow(["ending"], { now: () => now });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  now = 4_000;

  flow.dispatch({ type: "advance" });
  now = 9_000;

  assert.equal(flow.snapshot().elapsedPracticeMs, 3_000);
});

test("The primary action becomes available for Advance and Resume", () => {
  const flow = createPracticeFlow(["ending", "middle"], { now: () => 0 });
  const availability = [flow.snapshot().canAdvance];
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  availability.push(flow.snapshot().canAdvance);
  flow.dispatch({ type: "advance" });
  availability.push(flow.snapshot().canAdvance);
  flow.dispatch({ type: "browse", direction: -1 });
  availability.push(flow.snapshot().canAdvance);

  assert.deepEqual(availability, [false, true, false, true]);
});

test("Browsing reports which completed cards are reachable", () => {
  const flow = createPracticeFlow(["ending", "middle"], { now: () => 0 });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "advance" });
  const atTarget = flow.snapshot();
  flow.dispatch({ type: "browse", direction: -1 });
  const atEnding = flow.snapshot();

  assert.deepEqual(
    [
      [atTarget.canBrowsePrevious, atTarget.canBrowseNext],
      [atEnding.canBrowsePrevious, atEnding.canBrowseNext],
    ],
    [
      [true, false],
      [false, true],
    ],
  );
});
