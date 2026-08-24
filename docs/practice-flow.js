const ADVANCE_AT = 3;
const MAX_STREAK = 8;

/**
 * Create a Normal-mode session for cards ordered from the end of a piece to its beginning.
 *
 * @param {string[]} cards
 * @param {{ now?: () => number }} [dependencies]
 */
export function createPracticeFlow(cards, { now = () => performance.now() } = {}) {
  let elapsedPracticeMs = 0;
  let timerStartedAt = now();
  let currentIndex = 0;
  let targetIndex = 0;
  const streaks = Array(cards.length).fill(0);
  let status = "active";

  function pauseTimer() {
    if (timerStartedAt === null) return;
    elapsedPracticeMs += now() - timerStartedAt;
    timerStartedAt = null;
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
        if (targetIndex === cards.length - 1) {
          pauseTimer();
          status = "complete";
          return;
        }
        targetIndex += 1;
        currentIndex = targetIndex;
      }
      if (event.type === "browse") {
        const browseIndex = currentIndex + event.direction;
        if (browseIndex >= 0 && browseIndex <= targetIndex) {
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
        canBrowseNext: status === "active" && currentIndex < targetIndex,
        elapsedPracticeMs:
          elapsedPracticeMs + (timerStartedAt === null ? 0 : now() - timerStartedAt),
      };
    },
  };
}
