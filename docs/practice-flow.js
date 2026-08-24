const ADVANCE_AT = 3;
const MAX_STREAK = 8;

function progressionOrder(cardCount, mode, random) {
  const order = Array.from({ length: cardCount }, (_, index) => index);
  if (mode !== "hard") return order;

  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

/**
 * Create a practice session for cards ordered from the end of a piece to its beginning.
 *
 * @param {string[]} cards
 * @param {{ mode?: "normal" | "hard", now?: () => number, random?: () => number }} [dependencies]
 */
export function createPracticeFlow(
  cards,
  { mode = "normal", now = () => performance.now(), random = Math.random } = {},
) {
  let elapsedPracticeMs = 0;
  let timerStartedAt = now();
  const targetOrder = progressionOrder(cards.length, mode, random);
  let targetPosition = 0;
  let targetIndex = targetOrder[targetPosition];
  let currentIndex = targetIndex;
  const streaks = Array(cards.length).fill(0);
  let status = "active";

  function pauseTimer() {
    if (timerStartedAt === null) return;
    elapsedPracticeMs += now() - timerStartedAt;
    timerStartedAt = null;
  }

  function lastBrowsableIndex() {
    return mode === "hard" ? cards.length - 1 : targetIndex;
  }

  return {
    dispatch(event) {
      if (status === "complete") return;
      if (event.type === "timer-paused") {
        pauseTimer();
        return;
      }
      if (event.type === "timer-resumed" && timerStartedAt === null) {
        timerStartedAt = now();
        return;
      }
      if (event.type === "advance" && currentIndex !== targetIndex) {
        currentIndex = targetIndex;
        return;
      }
      if (
        event.type === "good" &&
        currentIndex === targetIndex &&
        streaks[currentIndex] < MAX_STREAK
      ) {
        streaks[currentIndex] += 1;
      }
      if (event.type === "mistake" && currentIndex === targetIndex) {
        streaks[currentIndex] = 0;
      }
      if (
        event.type === "advance" &&
        currentIndex === targetIndex &&
        streaks[currentIndex] >= ADVANCE_AT
      ) {
        if (targetPosition === targetOrder.length - 1) {
          pauseTimer();
          status = "complete";
          return;
        }
        targetPosition += 1;
        targetIndex = targetOrder[targetPosition];
        currentIndex = targetIndex;
      }
      if (event.type === "browse") {
        const browseIndex = currentIndex + event.direction;
        if (browseIndex >= 0 && browseIndex <= lastBrowsableIndex()) {
          currentIndex = browseIndex;
        }
      }
    },
    snapshot() {
      const isBrowsing = currentIndex !== targetIndex;
      const streak = streaks[currentIndex];
      return {
        currentCard: cards[currentIndex],
        currentCardIndex: currentIndex,
        streak,
        isBrowsing,
        status,
        canAdvance: status === "active" && (isBrowsing || streak >= ADVANCE_AT),
        canBrowsePrevious: status === "active" && currentIndex > 0,
        canBrowseNext: status === "active" && currentIndex < lastBrowsableIndex(),
        elapsedPracticeMs:
          elapsedPracticeMs + (timerStartedAt === null ? 0 : now() - timerStartedAt),
      };
    },
  };
}
