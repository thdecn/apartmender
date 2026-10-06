// A held Web Lock distinguishes a live Practice visit from an interrupted
// Open marker in another tab. The browser releases it if that tab disappears.
export function createSessionOwnership(locks, userId) {
  const name = `apartmender-practice:${userId}`;

  return Object.freeze({
    async claim() {
      if (!locks?.request) return null;
      let decide;
      const claimed = new Promise((resolve) => { decide = resolve; });
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      void locks.request(name, { mode: "exclusive", ifAvailable: true }, async (lock) => {
        if (!lock) { decide(null); return; }
        decide(release);
        await held;
      }).catch(() => decide(null));
      return claimed;
    },
  });
}
