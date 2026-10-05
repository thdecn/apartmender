const PAUSE_LIMIT_MS = 24 * 60 * 60 * 1000;
const ACKNOWLEDGED = new Set(["accepted", "duplicate"]);
const PERMANENT = new Set([
  "invalid_event", "unsupported_version", "assignment_not_found",
  "stale_credential_generation", "event_id_conflict",
]);
const ACCESS_BLOCKED = new Set([
  "password_change_required", "disabled", "hard_revoked", "missing_identity",
  "unauthenticated", "account_denied", "practice_not_ready",
]);

export function createSessionRecorder({ userId, journal, submit, now = Date.now,
  uuid = () => crypto.randomUUID(), onStatus = () => {} }) {
  let activeId = null;
  let syncing = null;

  function finalize(partition, id, endedAt, elapsedMs) {
    const marker = partition.open[id];
    if (!marker) return null;
    delete partition.open[id];
    const seconds = Math.floor(Math.max(0, elapsedMs) / 1000);
    if (seconds < 1 || endedAt <= marker.startedAt) return null;
    const event = {
      eventVersion: 1,
      eventId: id,
      assignmentId: marker.assignmentId,
      clientStartedAt: new Date(marker.startedAt).toISOString(),
      clientEndedAt: new Date(endedAt).toISOString(),
      durationSeconds: Math.min(seconds, Math.floor((endedAt - marker.startedAt) / 1000)),
      credentialGeneration: marker.credentialGeneration,
    };
    if (event.durationSeconds < 1) return null;
    partition.queue[id] = { event, pieceVersion: marker.pieceVersion, state: "pending" };
    return event;
  }

  async function sync() {
    if (syncing) {
      await syncing;
      return sync();
    }
    syncing = (async () => {
      const { queue } = await journal.read(userId);
      let hasRejected = Object.values(queue).some((item) => item.state === "rejected");
      for (const [id, queued] of Object.entries(queue)) {
        if (queued.state !== "pending") continue;
        let outcome;
        try { outcome = await submit(queued.event); }
        catch { onStatus("retry"); break; }
        if (ACKNOWLEDGED.has(outcome?.outcome) && outcome.eventId === id && outcome.contractVersion === 1) {
          await journal.change(userId, (partition) => {
            if (JSON.stringify(partition.queue[id]?.event) === JSON.stringify(queued.event)) {
              delete partition.queue[id];
            }
          });
          onStatus("synced");
        } else if (PERMANENT.has(outcome?.outcome) && outcome.contractVersion === 1) {
          await journal.change(userId, (partition) => {
            if (partition.queue[id]) {
              partition.queue[id].state = "rejected";
              partition.queue[id].reason = outcome.outcome;
            }
          });
          hasRejected = true;
        } else if (ACCESS_BLOCKED.has(outcome?.outcome) && outcome.contractVersion === 1) {
          onStatus(outcome.outcome);
          break;
        } else {
          onStatus("retry");
          break;
        }
      }
      if (hasRejected) onStatus("rejected");
    })().finally(() => { syncing = null; });
    return syncing;
  }

  return Object.freeze({
    async recover() {
      await journal.change(userId, (partition) => {
        for (const [id, marker] of Object.entries(partition.open)) {
          finalize(partition, id, marker.lastActiveAt, marker.elapsedMs);
        }
      });
      await sync();
    },
    async open({ assignmentId, pieceVersion, credentialGeneration }) {
      if (!assignmentId || !pieceVersion || !Number.isSafeInteger(credentialGeneration)
        || credentialGeneration < 1) return false;
      const id = uuid();
      const startedAt = now();
      await journal.change(userId, (partition) => {
        partition.open[id] = { assignmentId, pieceVersion, credentialGeneration,
          startedAt, lastActiveAt: startedAt, elapsedMs: 0, pausedAt: null };
      });
      activeId = id;
      return true;
    },
    async pause(elapsedMs) {
      if (!activeId) return;
      const checkpointAt = now();
      await journal.change(userId, (partition) => {
        const marker = partition.open[activeId];
        if (!marker) return;
        marker.elapsedMs = elapsedMs;
        marker.lastActiveAt = checkpointAt;
        marker.pausedAt = checkpointAt;
      });
    },
    async resume() {
      if (!activeId) return false;
      const resumedAt = now();
      const resumed = await journal.change(userId, (partition) => {
        const marker = partition.open[activeId];
        if (!marker) return false;
        if (marker.pausedAt !== null && resumedAt - marker.pausedAt >= PAUSE_LIMIT_MS) {
          finalize(partition, activeId, marker.lastActiveAt, marker.elapsedMs);
          return false;
        }
        marker.pausedAt = null;
        return true;
      });
      if (!resumed) { activeId = null; void sync().catch(() => onStatus("retry")); }
      return resumed;
    },
    async finish(elapsedMs) {
      if (!activeId) return;
      const id = activeId;
      const finishedAt = now();
      await journal.change(userId, (partition) => {
        const marker = partition.open[id];
        if (!marker) return;
        finalize(partition, id, marker.pausedAt ?? finishedAt,
          marker.pausedAt === null ? elapsedMs : marker.elapsedMs);
      });
      activeId = null;
      void sync().catch(() => onStatus("retry"));
    },
    async cancelOpen() {
      if (!activeId) return;
      const id = activeId;
      await journal.change(userId, (partition) => { delete partition.open[id]; });
      activeId = null;
    },
    sync,
    async clear() { activeId = null; await journal.remove(userId); },
  });
}
