import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createBrowserData } from "../docs/login/browser-data.js";
import { createPracticeStart } from "../docs/login/practice/practice-start.js";
import { createMemorySessionJournal } from "../docs/login/practice/session-journal.js";
import { createSessionRecorder } from "../docs/login/practice/session-recorder.js";
import { createLocalPracticeStudent } from "./local-supabase-fixture.js";

// Run after resetting a disposable Sludge local Supabase database:
// SLUDGE_REPO=/path/to/Sludge SUPABASE_CLI=/path/to/supabase \
//   APARTMENDER_LOCAL_SUPABASE=1 node --test test/local-supabase.integration.test.js
test("authenticated Student records one assigned Session through local Sludge RPCs",
  { skip: process.env.APARTMENDER_LOCAL_SUPABASE !== "1" }, async () => {
    const { config, userId, token, query } = await createLocalPracticeStudent();
    const headers = { apikey: config.publishableKey, Authorization: `Bearer ${token}` };
    const request = async (path, options = {}) => {
      const response = await fetch(`${config.projectUrl}${path}`, {
        ...options, headers: { ...headers, ...options.headers },
      });
      const body = await response.json();
      return { data: response.ok ? body : null,
        error: response.ok ? null : { code: body.code, status: response.status },
        status: response.status };
    };
    const client = {
      auth: {
        async getUser() {
          const result = await request("/auth/v1/user");
          return { data: { user: result.data }, error: result.error };
        },
        onAuthStateChange(callback) { queueMicrotask(() => callback("INITIAL_SESSION", null)); },
      },
      from(table) {
        return { select: (columns) => request(`/rest/v1/${table}?select=${columns}`) };
      },
      rpc(name, args) {
        return request(`/rest/v1/rpc/${name}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args ?? {}),
        });
      },
    };
    const browserData = createBrowserData({ config, createClient: () => client,
      location: { hash: "", href: `${config.projectUrl}/login/` }, history: {},
      storage: { getItem: () => null, setItem() {}, removeItem() {} },
    });
    assert.deepEqual(await browserData.validateCurrentUser(),
      { outcome: "authenticated", userId });
    assert.equal((await browserData.readStudent()).outcome, "student_loaded");
    const assignments = await browserData.readAssignments();
    assert.equal(assignments.outcome, "assignments_loaded");
    assert.equal(assignments.assignments.length, 1);
    const generation = await browserData.readPracticeGeneration();
    assert.deepEqual(generation, { outcome: "generation_loaded", credentialGeneration: 1 });

    const authorize = createPracticeStart({
      readAssignments: () => browserData.readAssignments(),
      readGeneration: () => browserData.readPracticeGeneration(),
      initialGeneration: generation.credentialGeneration, durable: true,
    });
    const assignmentId = assignments.assignments[0].assignmentId;
    const start = await authorize(assignmentId);
    assert.deepEqual(start, { outcome: "ready", credentialGeneration: 1 });
    const journal = createMemorySessionJournal();
    const eventId = randomUUID();
    let time = Date.now() - 120_000;
    let immutableEvent;
    const recorder = createSessionRecorder({ userId, journal, now: () => time,
      uuid: () => eventId, submit: async (event) => {
        immutableEvent = event;
        return browserData.ingestPractice(event);
      } });
    assert.equal(await recorder.open({ assignmentId,
      pieceVersion: "sha256:9435d1fec47956939db4ce4e7ad2c430936222e70e5a6d6c9dabd5343df55671",
      credentialGeneration: start.credentialGeneration }), true);
    time += 120_000;
    await recorder.finish(90_000);
    await recorder.sync();
    assert.deepEqual(await journal.read(userId), { open: {}, queue: {} });
    assert.equal(immutableEvent.eventId, eventId);
    assert.equal(immutableEvent.durationSeconds, 90);
    assert.equal((await browserData.ingestPractice(immutableEvent)).outcome, "duplicate");
    assert.equal(query(`select count(*) || ':' || sum(duration_seconds)
      from public.practice_sessions where event_id='${eventId}'`), "1:90");
  });
