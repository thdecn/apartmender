import test from "node:test";
import assert from "node:assert/strict";
import { createRecoveryProgress } from "../docs/login/recovery-progress.js";

function storage() {
  const records = new Map();
  return { records, getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
}

test("recovery progress resumes phases without persisting credentials", () => {
  const local = storage();
  const progress = createRecoveryProgress(local, "test");
  const record = progress.start("user-a");
  assert.equal(record.phase, "setup");
  progress.move({ ...record, access_token: "must-not-persist", password: "must-not-persist" }, "cleanup");
  const fresh = createRecoveryProgress(local, "test");
  assert.equal(fresh.read("user-a").phase, "cleanup");
  assert.equal([...local.records.values()].join("").includes("must-not-persist"), false);
  assert.equal(fresh.read("user-b"), null);
  assert.equal(fresh.move(fresh.read("user-a"), "unknown-phase"), null);
  assert.equal(fresh.read("user-a").phase, "cleanup");
});

test("a stale tab cannot overwrite or clear a newer recovery operation", () => {
  const progress = createRecoveryProgress(storage(), "test");
  const first = progress.start("user-a");
  const second = progress.start("user-a");
  assert.equal(progress.move(first, "cleanup"), null);
  assert.equal(progress.restore(first), null);
  assert.equal(progress.remove(first), false);
  assert.equal(progress.read("user-a").operationId, second.operationId);
});

test("unavailable progress storage fails explicitly", () => {
  const progress = createRecoveryProgress({ getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); } }, "test");
  assert.equal(progress.start("user-a"), null);
  assert.equal(progress.read("user-a"), null);
});
