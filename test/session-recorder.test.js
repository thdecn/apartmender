import test from "node:test";
import assert from "node:assert/strict";
import { createSessionRecorder } from "../docs/login/practice/session-recorder.js";
import { createMemorySessionJournal } from "../docs/login/practice/session-journal.js";

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
