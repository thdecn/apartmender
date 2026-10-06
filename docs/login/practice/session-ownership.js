// A held Web Lock distinguishes a live Practice visit from an interrupted
// Open marker in another tab. The browser releases it if that tab disappears.
export function createSessionOwnership(locks, userId) {
  const name = `apartmender-practice:${userId}`;

  return Object.freeze({
    supported: Boolean(locks?.request),
    async claim({ wait = false } = {}) {
      if (!locks?.request) return null;
      let resolveClaim;
      const claimed = new Promise((resolve) => { resolveClaim = resolve; });
      let releaseLock;
      const lockHeld = new Promise((resolve) => { releaseLock = resolve; });
      let finishRequest;
      const requestFinished = new Promise((resolve) => { finishRequest = resolve; });
      const options = wait ? { mode: "exclusive" } : { mode: "exclusive", ifAvailable: true };
      void locks.request(name, options, async (lock) => {
        if (!lock) { resolveClaim(null); return; }
        resolveClaim(async () => { releaseLock(); await requestFinished; });
        await lockHeld;
      }).catch(() => resolveClaim(null)).finally(finishRequest);
      return claimed;
    },
  });
}
