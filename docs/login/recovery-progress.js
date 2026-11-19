// Non-sensitive UI intent only. These records never grant application access.
export function createRecoveryProgress(storage, prefix) {
  const transitions = { setup: ["write_pending"], write_pending: ["setup", "cleanup", "complete"],
    cleanup: ["complete"], complete: [] };
  const key = userId => `${prefix}-recovery-${encodeURIComponent(userId)}`;
  function read(userId) {
    try {
      const value = JSON.parse(storage?.getItem(key(userId)) ?? "null");
      return value?.version === 1 && typeof value.operationId === "string"
        && Object.hasOwn(transitions, value.phase)
        ? { ...value, userId } : null;
    } catch { return null; }
  }
  function write(record) {
    if (!Object.hasOwn(transitions, record.phase)) return null;
    try {
      storage.setItem(key(record.userId), JSON.stringify({ version: 1,
        operationId: record.operationId, phase: record.phase }));
      const saved = read(record.userId);
      return saved?.operationId === record.operationId && saved.phase === record.phase ? saved : null;
    } catch { return null; }
  }
  return {
    read,
    start(userId) {
      const current = read(userId);
      if (["write_pending", "cleanup"].includes(current?.phase)) return current;
      return write({ userId, operationId: crypto.randomUUID(), phase: "setup" });
    },
    restore(record) {
      try {
        if (storage.getItem(key(record.userId)) !== null) return null;
        return write(record);
      } catch { return null; }
    },
    move(record, phase) {
      const current = read(record.userId);
      if (current?.operationId !== record.operationId || current.phase !== record.phase
        || !transitions[record.phase]?.includes(phase)) return null;
      return write({ ...record, phase });
    },
    remove(record) {
      try {
        const raw = storage.getItem(key(record.userId));
        if (raw === null) return true;
        const current = read(record.userId);
        if (!current || current.operationId !== record.operationId || current.phase !== record.phase) return false;
        storage.removeItem(key(record.userId));
        return storage.getItem(key(record.userId)) === null;
      }
      catch { return false; }
    },
  };
}
