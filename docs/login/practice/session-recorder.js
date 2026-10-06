const PAUSE_LIMIT_MS = 24 * 60 * 60 * 1000;
const ACKNOWLEDGED = new Set(["accepted", "duplicate"]);
const PERMANENT = new Set([
  "invalid_event", "unsupported_version", "assignment_not_found",
  "stale_credential_generation", "event_id_conflict",
]);
const TRANSPORT_ACCESS_BLOCKED = new Set([
  "unauthenticated", "account_denied", "practice_not_ready",
]);
const ACCESS_BLOCKED = new Set([
  "password_change_required", "disabled", "hard_revoked", "missing_identity",
  ...TRANSPORT_ACCESS_BLOCKED,
]);

export function createSessionRecorder({ userId, journal, submit, now = Date.now,
  uuid = () => crypto.randomUUID(), onStatus = () => {},
  ownership = { claim: async () => () => {} } }) {
  let activeId = null;
  let releaseActive = null;
  let syncing = null;
  let awaitingOwner = null;

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
        } else if (ACCESS_BLOCKED.has(outcome?.outcome)
          && (outcome.contractVersion === 1
            || (outcome.contractVersion === undefined
              && TRANSPORT_ACCESS_BLOCKED.has(outcome.outcome)))) {
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

  async function recoverWithLock(release) {
    try {
      await journal.change(userId, (partition) => {
        for (const [id, marker] of Object.entries(partition.open)) {
          finalize(partition, id, marker.lastActiveAt, marker.elapsedMs);
        }
      });
      await sync();
    } finally { release(); }
  }

  function awaitOwnerExit() {
    if (awaitingOwner) return;
    awaitingOwner = (async () => {
      const release = await ownership.claim({ wait: true });
      if (release) await recoverWithLock(release);
    })().catch(() => onStatus("retry")).finally(() => { awaitingOwner = null; });
  }

  return Object.freeze({
    async recover() {
      const release = await ownership.claim();
      if (!release) {
        if (ownership.supported === false) await sync();
        else awaitOwnerExit();
        return;
      }
      await recoverWithLock(release);
    },
    async open({ assignmentId, pieceVersion, credentialGeneration }) {
      if (!assignmentId || !pieceVersion || !Number.isSafeInteger(credentialGeneration)
        || credentialGeneration < 1) return false;
      const release = await ownership.claim();
      if (!release) return false;
      const id = uuid();
      const startedAt = now();
      let recovered = false;
      try {
        await journal.change(userId, (partition) => {
          for (const [openId, marker] of Object.entries(partition.open)) {
            finalize(partition, openId, marker.lastActiveAt, marker.elapsedMs);
            recovered = true;
          }
          partition.open[id] = { assignmentId, pieceVersion, credentialGeneration,
            startedAt, lastActiveAt: startedAt, elapsedMs: 0, pausedAt: null };
        });
        activeId = id;
        releaseActive = release;
        if (recovered) void sync().catch(() => onStatus("retry"));
        return true;
      } catch (error) {
        release();
        throw error;
      }
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
      if (!resumed) {
        activeId = null;
        releaseActive?.();
        releaseActive = null;
        void sync().catch(() => onStatus("retry"));
      }
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
      releaseActive?.();
      releaseActive = null;
      void sync().catch(() => onStatus("retry"));
    },
    async cancelOpen() {
      if (!activeId) return;
      const id = activeId;
      await journal.change(userId, (partition) => { delete partition.open[id]; });
      activeId = null;
      releaseActive?.();
      releaseActive = null;
    },
    sync,
    async clear() {
      activeId = null;
      try { await journal.remove(userId); }
      finally { releaseActive?.(); releaseActive = null; }
    },
  });
}
