import test from "node:test";
import assert from "node:assert/strict";

import { createPracticeFlow } from "../docs/practice-flow.js";

function completeCurrentCard(flow) {
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "good" });
  flow.dispatch({ type: "advance" });
}

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

test("Hard mode uses one fixed random progression", () => {
  const randomValues = [0.5, 0, 0.5];
  let randomIndex = 0;
  const flow = createPracticeFlow(
    ["ending", "later-middle", "earlier-middle", "beginning"],
    {
      mode: "hard",
      now: () => 0,
      random: () => randomValues[randomIndex++],
    },
  );
  const targets = [];

  while (flow.snapshot().status === "active") {
    targets.push(flow.snapshot().currentCard);
    completeCurrentCard(flow);
  }

  assert.deepEqual(targets, ["beginning", "later-middle", "ending", "earlier-middle"]);
});

test("Hard mode includes every card once at the random boundaries", () => {
  const cards = ["ending", "later-middle", "earlier-middle", "beginning"];

  for (const randomValue of [0, 0.999999]) {
    const flow = createPracticeFlow(cards, {
      mode: "hard",
      now: () => 0,
      random: () => randomValue,
    });
    const targets = [];

    while (flow.snapshot().status === "active") {
      targets.push(flow.snapshot().currentCard);
      completeCurrentCard(flow);
    }

    assert.equal(targets.length, cards.length);
    assert.deepEqual([...targets].sort(), [...cards].sort());
  }
});

test("Hard mode handles a one-card permutation without requesting randomness", () => {
  const flow = createPracticeFlow(["only-card"], {
    mode: "hard",
    now: () => 0,
    random: () => {
      throw new Error("A one-card permutation does not need randomness");
    },
  });

  completeCurrentCard(flow);

  assert.equal(flow.snapshot().status, "complete");
});

test("Hard mode browsing follows card order instead of random progression", () => {
  const flow = createPracticeFlow(["ending", "middle", "beginning"], {
    mode: "hard",
    now: () => 0,
    random: () => 0,
  });

  flow.dispatch({ type: "browse", direction: 1 });

  const state = flow.snapshot();
  assert.deepEqual(
    {
      currentCard: state.currentCard,
      isBrowsing: state.isBrowsing,
      canAdvance: state.canAdvance,
    },
    { currentCard: "beginning", isBrowsing: true, canAdvance: true },
  );
});
