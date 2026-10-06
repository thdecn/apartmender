const snapshotPrefix = "apartmender-weekly-summary-v1:";

export function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

export function summarySnapshot(storage, userId, next) {
  if (!storage || !userId) return null;
  const key = `${snapshotPrefix}${userId}`;
  try {
    if (next === null) { storage.removeItem(key); return null; }
    if (next !== undefined) { storage.setItem(key, JSON.stringify(next)); return next; }
    const saved = JSON.parse(storage.getItem(key));
    return saved?.contractVersion === 1 && saved.outcome === "summary" ? saved : null;
  } catch { return null; }
}
