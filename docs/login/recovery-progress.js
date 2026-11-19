// Non-sensitive UI intent only. These records never grant application access.
export function createRecoveryProgress(storage, prefix) {
  const phases = new Set(["setup", "write_pending", "cleanup"]);
  const key = userId => `${prefix}-recovery-${encodeURIComponent(userId)}`;
  function read(userId) {
    try {
      const value = JSON.parse(storage?.getItem(key(userId)) ?? "null");
      return value?.version === 1 && typeof value.operationId === "string"
        && phases.has(value.phase)
        ? { ...value, userId } : null;
    } catch { return null; }
  }
  function write(record) {
    if (!phases.has(record.phase)) return null;
    try {
      storage.setItem(key(record.userId), JSON.stringify({ version: 1,
        operationId: record.operationId, phase: record.phase }));
      const saved = read(record.userId);
      return saved?.operationId === record.operationId && saved.phase === record.phase ? saved : null;
    } catch { return null; }
  }
  return {
    read,
    start(userId) { return write({ userId, operationId: crypto.randomUUID(), phase: "setup" }); },
    move(record, phase) {
      if (read(record.userId)?.operationId !== record.operationId) return null;
      return write({ ...record, phase });
    },
    remove(record) {
      const current = read(record.userId);
      if (!current) return true;
      if (current.operationId !== record.operationId) return false;
      try { storage.removeItem(key(record.userId)); return read(record.userId) === null; }
      catch { return false; }
    },
  };
}
