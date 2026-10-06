import test from "node:test";
import assert from "node:assert/strict";
import { createSessionRecorder } from "../docs/login/practice/session-recorder.js";
import { createMemorySessionJournal } from "../docs/login/practice/session-journal.js";
import { createSessionOwnership } from "../docs/login/practice/session-ownership.js";

const assignmentId = "86000000-0000-4000-8000-000000000001";
const eventId = "85000000-0000-4000-8000-000000000001";
const details = { assignmentId, pieceVersion: "sha256:card-and-metadata", credentialGeneration: 7 };

test("Home finalizes one durable event; uncertain upload replays exact bytes and duplicate acknowledges", async () => {
  const store = createMemorySessionJournal();
  let time = Date.parse("2026-10-03T22:00:00Z");
  const submitted = [];
  let response = new Error("lost response");
  const makeRecorder = () => createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, uuid: () => eventId, submit: async (event) => {
      submitted.push(structuredClone(event));
      if (response instanceof Error) throw response;
      return response;
    } });
  const recorder = makeRecorder();
  assert.equal(await recorder.open(details), true);
  time += 90_250;
  await recorder.finish(45_999);
  const pending = (await store.read("student-a")).queue[eventId].event;
  assert.deepEqual(pending, {
    eventVersion: 1, eventId, assignmentId,
    clientStartedAt: "2026-10-03T22:00:00.000Z",
    clientEndedAt: "2026-10-03T22:01:30.250Z",
    durationSeconds: 45, credentialGeneration: 7,
  });
  assert.equal(Object.keys((await store.read("student-a")).open).length, 0);
  response = { contractVersion: 1, outcome: "duplicate", eventId };
  await makeRecorder().sync();
  assert.deepEqual(submitted, [pending, pending]);
  assert.equal(Object.keys((await store.read("student-a")).queue).length, 0);
});

test("recovery uses last checkpoint, isolates identities, and never resumes an interrupted visit", async () => {
  const store = createMemorySessionJournal();
  let time = 1_000_000;
  const options = { userId: "student-a", journal: store, now: () => time,
    uuid: () => eventId, submit: async () => { throw new Error("offline"); } };
  const recorder = createSessionRecorder(options);
  await recorder.open(details);
  time += 5_000;
  await recorder.pause(3_200);
  time += 60_000;
  await createSessionRecorder(options).recover();
  const event = (await store.read("student-a")).queue[eventId].event;
  assert.equal(event.durationSeconds, 3);
  assert.equal(event.clientEndedAt, new Date(1_005_000).toISOString());
  assert.deepEqual(await store.read("student-b"), { open: {}, queue: {} });
  assert.equal(Object.keys((await store.read("student-a")).open).length, 0);
});

test("a second tab cannot recover or replace a live tab's Open marker", async () => {
  const store = createMemorySessionJournal();
  let time = 1_000_000;
  let held = false;
  const locks = { async request(_name, _options, callback) {
    const granted = !held;
    if (granted) held = true;
    try { return await callback(granted ? {} : null); }
    finally { if (granted) held = false; }
  } };
  const options = { userId: "student-a", journal: store, now: () => time,
    uuid: () => eventId, submit: async () => { throw Error("offline"); } };
  const first = createSessionRecorder({ ...options,
    ownership: createSessionOwnership(locks, "student-a") });
  const second = createSessionRecorder({ ...options,
    ownership: createSessionOwnership(locks, "student-a") });
  assert.equal(await first.open(details), true);
  time += 3_000;
  await second.recover();
  assert.deepEqual(Object.keys((await store.read("student-a")).open), [eventId]);
  assert.equal(await second.open(details), false);
  await first.finish(3_000);
  assert.equal((await store.read("student-a")).queue[eventId].event.durationSeconds, 3);
  assert.equal(await second.open(details), true);
  await second.cancelOpen();
});

test("a waiting tab recovers the checkpoint when the owning tab disappears", async () => {
  const store = createMemorySessionJournal();
  let time = 1_000_000;
  let held = false;
  const waiters = [];
  const locks = {
    async request(_name, options, callback) {
      if (held && options.ifAvailable) return callback(null);
      if (held) await new Promise((resolve) => waiters.push(resolve));
      held = true;
      try { return await callback({}); }
      finally {
        held = false;
        waiters.shift()?.();
      }
    },
    ownerDisappeared() { held = false; waiters.shift()?.(); },
  };
  const options = { userId: "student-a", journal: store, now: () => time,
    uuid: () => eventId, submit: async () => { throw Error("offline"); } };
  const first = createSessionRecorder({ ...options,
    ownership: createSessionOwnership(locks, "student-a") });
  const second = createSessionRecorder({ ...options,
    ownership: createSessionOwnership(locks, "student-a") });
  await first.open(details);
  time += 3_000;
  await first.pause(3_000);
  await second.recover();
  assert.equal(waiters.length, 1);
  locks.ownerDisappeared();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const partition = await store.read("student-a");
  assert.equal(Object.keys(partition.open).length, 0);
  assert.equal(partition.queue[eventId].event.durationSeconds, 3);
});

test("a second tab can acknowledge older queued work while another visit is live", async () => {
  const store = createMemorySessionJournal();
  let time = 1_000_000;
  let held = false;
  let nextId = 0;
  const locks = { async request(_name, _options, callback) {
    const granted = !held;
    if (granted) held = true;
    try { return await callback(granted ? {} : null); }
    finally { if (granted) held = false; }
  } };
  const first = createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, uuid: () => `85000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
    ownership: createSessionOwnership(locks, "student-a"),
    submit: async () => { throw Error("offline"); } });
  await first.open(details);
  time += 2_000;
  await first.finish(2_000);
  assert.equal(await first.open(details), true);
  const second = createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, ownership: createSessionOwnership(locks, "student-a"),
    syncWhenAnotherTabActive: true,
    submit: async (event) => ({ contractVersion: 1, outcome: "accepted", eventId: event.eventId }) });
  await second.recover();
  const partition = await store.read("student-a");
  assert.equal(Object.keys(partition.open).length, 1);
  assert.equal(Object.keys(partition.queue).length, 0);
  await first.cancelOpen();
});

test("abrupt loss after an uncheckpointed visible stretch may lose that stretch", async () => {
  const store = createMemorySessionJournal();
  let time = 1_000_000;
  const options = { userId: "student-a", journal: store, now: () => time,
    uuid: () => eventId, submit: async () => { throw Error("offline"); } };
  await createSessionRecorder(options).open(details);
  time += 20_000; // No visibility, rotation, or ownership checkpoint occurred.
  await createSessionRecorder(options).recover();
  assert.equal(Object.keys((await store.read("student-a")).queue).length, 0);
});

test("a short pause resumes one visit without counting the paused interval", async () => {
  const store = createMemorySessionJournal();
  let time = 1_000_000;
  const recorder = createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, uuid: () => eventId, submit: async () => { throw Error("offline"); } });
  await recorder.open(details);
  time += 3_000;
  await recorder.pause(3_000);
  time += 60_000;
  assert.equal(await recorder.resume(), true);
  time += 2_000;
  await recorder.finish(5_000);
  const event = (await store.read("student-a")).queue[eventId].event;
  assert.equal(event.durationSeconds, 5);
  assert.equal(event.clientStartedAt, new Date(1_000_000).toISOString());
  assert.equal(event.clientEndedAt, new Date(1_065_000).toISOString());
});

test("final-card end instant is captured before an IndexedDB write crosses midnight", async () => {
  const backing = createMemorySessionJournal();
  let time = Date.parse("2026-10-04T23:59:40Z");
  const journal = {
    read: (id) => backing.read(id),
    remove: (id) => backing.remove(id),
    change: async (id, update) => {
      time += 10_000;
      return backing.change(id, update);
    },
  };
  const recorder = createSessionRecorder({ userId: "student-a", journal,
    now: () => time, uuid: () => eventId, submit: async () => { throw Error("offline"); } });
  await recorder.open(details);
  await recorder.finish(5_000);
  const event = (await backing.read("student-a")).queue[eventId].event;
  assert.equal(event.clientEndedAt, "2026-10-04T23:59:50.000Z");
});

test("short visits discard, paused time is excluded, and 24-hour pause finalizes at checkpoint", async () => {
  const store = createMemorySessionJournal();
  let time = 100_000;
  const recorder = createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, uuid: () => eventId, submit: async () => { throw Error("offline"); } });
  await recorder.open(details);
  time += 999;
  await recorder.finish(999);
  assert.equal(Object.keys((await store.read("student-a")).queue).length, 0);
  await recorder.open(details);
  time += 4_000;
  await recorder.pause(2_000);
  time += 24 * 60 * 60 * 1000;
  assert.equal(await recorder.resume(), false);
  const event = (await store.read("student-a")).queue[eventId].event;
  assert.equal(event.durationSeconds, 2);
  assert.equal(event.clientEndedAt, new Date(104_999).toISOString());
});

test("permanent rejection is quarantined while a later event is acknowledged", async () => {
  const store = createMemorySessionJournal();
  let time = 1_000_000;
  let count = 0;
  const statuses = [];
  const recorder = createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, uuid: () => `85000000-0000-4000-8000-${String(++count).padStart(12, "0")}`,
    onStatus: (status) => statuses.push(status),
    submit: async (event) => ({ contractVersion: 1,
      outcome: event.eventId.endsWith("1") ? "event_id_conflict" : "accepted",
      eventId: event.eventId }) });
  await recorder.open(details);
  time += 2_000;
  await recorder.finish(2_000);
  await recorder.sync();
  await recorder.open(details);
  time += 2_000;
  await recorder.finish(2_000);
  await recorder.sync();
  const queue = (await store.read("student-a")).queue;
  assert.equal(Object.keys(queue).length, 1);
  assert.equal(Object.values(queue)[0].state, "rejected");
  assert.equal(statuses[0], "rejected");
  assert.ok(statuses.includes("synced"));
  assert.equal(statuses.at(-1), "rejected");
});

test("a memory-only visit retries while the page lives and an account gate preserves its event", async () => {
  const store = createMemorySessionJournal();
  let time = 2_000_000;
  let outcome = { contractVersion: 1, outcome: "disabled" };
  const statuses = [];
  const recorder = createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, uuid: () => eventId, onStatus: (status) => statuses.push(status),
    submit: async () => outcome });
  await recorder.open(details);
  time += 3_000;
  await recorder.finish(3_000);
  await recorder.sync();
  assert.equal((await store.read("student-a")).queue[eventId].state, "pending");
  assert.ok(statuses.includes("disabled"));
  outcome = { contractVersion: 1, outcome: "accepted", eventId };
  await recorder.sync();
  assert.equal(Object.keys((await store.read("student-a")).queue).length, 0);
});

test("transport authorization denial blocks sync while preserving the pending event", async () => {
  const store = createMemorySessionJournal();
  let time = 2_000_000;
  const statuses = [];
  const recorder = createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, uuid: () => eventId, onStatus: (status) => statuses.push(status),
    submit: async () => ({ outcome: "account_denied" }) });
  await recorder.open(details);
  time += 3_000;
  await recorder.finish(3_000);
  await recorder.sync();
  assert.ok(statuses.includes("account_denied"));
  assert.equal((await store.read("student-a")).queue[eventId].state, "pending");
});

test("cancelling a start after access changes removes only its Open marker", async () => {
  const store = createMemorySessionJournal();
  let time = 1_000_000;
  let id = 0;
  const recorder = createSessionRecorder({ userId: "student-a", journal: store,
    now: () => time, uuid: () => `85000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    submit: async () => { throw Error("offline"); } });
  await recorder.open(details);
  time += 2_000;
  await recorder.finish(2_000);
  await recorder.open(details);
  await recorder.cancelOpen();
  const partition = await store.read("student-a");
  assert.equal(Object.keys(partition.open).length, 0);
  assert.equal(Object.keys(partition.queue).length, 1);
});
