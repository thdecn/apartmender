import test from "node:test";
import assert from "node:assert/strict";

import { createPracticeStart } from "../docs/login/practice/practice-start.js";

test("each assigned Practice start pins a fresh server generation", async () => {
  let generation = 2;
  const start = createPracticeStart({
    readAssignments: async () => ({ outcome: "assignments_loaded", assignments: [
      { assignmentId: "assigned" },
    ] }),
    readGeneration: async () => ({ outcome: "generation_loaded", credentialGeneration: generation }),
    initialGeneration: 1,
    durable: true,
  });

  assert.deepEqual(await start("assigned"), { outcome: "ready", credentialGeneration: 2 });
  generation = 3;
  assert.deepEqual(await start("assigned"), { outcome: "ready", credentialGeneration: 3 });
});

test("an archived Assignment cannot start another Session", async () => {
  let generationReads = 0;
  const start = createPracticeStart({
    readAssignments: async () => ({ outcome: "assignments_loaded", assignments: [] }),
    readGeneration: async () => { generationReads += 1; return { outcome: "generation_loaded", credentialGeneration: 1 }; },
    initialGeneration: 1,
    durable: true,
  });

  assert.deepEqual(await start("archived"), { outcome: "archived" });
  assert.equal(generationReads, 0);
});

test("durable offline Practice reuses the last verified generation", async () => {
  const start = createPracticeStart({
    readAssignments: async () => ({ outcome: "practice_unavailable" }),
    readGeneration: async () => ({ outcome: "practice_unavailable" }),
    initialGeneration: 7,
    durable: true,
  });

  assert.deepEqual(await start("assigned"), { outcome: "ready", credentialGeneration: 7 });
});

test("storage-denied Practice requires a reachable backend", async () => {
  const start = createPracticeStart({
    readAssignments: async () => ({ outcome: "practice_unavailable" }),
    readGeneration: async () => ({ outcome: "practice_unavailable" }),
    initialGeneration: 7,
    durable: false,
  });

  assert.deepEqual(await start("assigned"), { outcome: "unavailable" });
});

test("account denial cannot fall back to a cached generation", async () => {
  const start = createPracticeStart({
    readAssignments: async () => ({ outcome: "assignments_loaded", assignments: [
      { assignmentId: "assigned" },
    ] }),
    readGeneration: async () => ({ outcome: "account_denied" }),
    initialGeneration: 7,
    durable: true,
  });

  assert.deepEqual(await start("assigned"), { outcome: "account_denied" });
});
