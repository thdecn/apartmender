import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserData } from "../docs/login/browser-data.js";
import { readPublicSupabaseConfig } from "../docs/login/config.js";

class MapStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  setItem(key, value) {
    this.#values.set(key, value);
  }
}

const config = {
  projectUrl: "https://example.supabase.co",
  publishableKey: "sb_publishable_test-value-long-enough",
};
const storage = new MapStorage();
const storageKey = "apartmender-auth-session";

test("public configuration selects local and hosted Sludge without a secret fallback", () => {
  const local = readPublicSupabaseConfig({
    protocol: "http:",
    hostname: "127.0.0.1",
  });
  const hosted = readPublicSupabaseConfig({
    protocol: "https:",
    hostname: "thdecn.github.io",
  });
  const unknown = readPublicSupabaseConfig({ protocol: "https:", hostname: "example.com" });

  assert.equal(local.projectUrl, "http://127.0.0.1:54331");
  assert.equal(hosted.projectUrl, "https://jxhxerchsxonsgmqsatd.supabase.co");
  assert.equal(unknown, null);
  assert.ok(!local.publishableKey.startsWith("sb_secret_"));
  assert.ok(!hosted.publishableKey.startsWith("sb_secret_"));
});

test("invalid configuration fails closed before creating a Supabase client", async () => {
  let clientCreated = false;
  const replaced = [];
  const data = createBrowserData({
    config: null,
    createClient: () => {
      clientCreated = true;
    },
    history: { replaceState: (_state, _title, url) => replaced.push(url) },
    location: {
      hash: "#type=invite&access_token=private",
      href: "https://example.com/login/#type=invite&access_token=private",
    },
    storage,
  });

  assert.deepEqual(await data.acceptInvitation(), { outcome: "configuration_error" });
  assert.deepEqual(await data.signIn({ email: "student@example.invalid", password: "secret" }), {
    outcome: "configuration_error",
  });
  assert.equal(clientCreated, false);
  assert.deepEqual(replaced, ["https://example.com/login/"]);
});

test("unavailable session storage fails closed before creating a Supabase client", async () => {
  let clientCreated = false;
  const data = createBrowserData({
    config,
    createClient: () => {
      clientCreated = true;
    },
    history: {},
    location: { hash: "", href: "https://example.com/login/" },
    storage: null,
  });

  assert.deepEqual(await data.signIn({ email: "student@example.invalid", password: "secret" }), {
    outcome: "auth_unavailable",
  });
  assert.equal(clientCreated, false);
});

test("client creation opts into the implicit flow while keeping sessions private", async () => {
  let argumentsReceived;
  const client = fakeClient();
  const data = createBrowserData({
    config,
    createClient: (...args) => {
      argumentsReceived = args;
      return client;
    },
    history: {},
    location: { hash: "", href: "https://example.com/login/" },
    storage,
  });

  assert.deepEqual(await data.acceptInvitation(), { outcome: "no_invitation" });
  assert.deepEqual(argumentsReceived, [
    config.projectUrl,
    config.publishableKey,
    {
      auth: {
        detectSessionInUrl: true,
        flowType: "implicit",
        persistSession: true,
        storage,
        storageKey,
      },
    },
  ]);
});

test("an invitation is validated and its fragment is removed", async () => {
  const replaced = [];
  const client = fakeClient({ user: { id: "91ef348a-84fe-4b67-8122-5090f95472ae" } });
  const data = createBrowserData({
    config,
    createClient: () => client,
    history: { replaceState: (_state, _title, url) => replaced.push(url) },
    location: {
      hash: "#type=invite&access_token=private&refresh_token=private-too",
      href: "https://example.com/login/#type=invite&access_token=private&refresh_token=private-too",
    },
    storage,
  });

  assert.deepEqual(await data.acceptInvitation(), {
    outcome: "invite_accepted",
    userId: "91ef348a-84fe-4b67-8122-5090f95472ae",
  });
  assert.deepEqual(replaced, ["https://example.com/login/"]);
});

test("an unsupported Auth fragment discards its session when sign-out reports an error", async () => {
  const signOutScopes = [];
  const redirectStorage = new MapStorage();
  redirectStorage.setItem(storageKey, "private-session");
  const client = fakeClient();
  client.auth.signOut = async (options) => {
    signOutScopes.push(options);
    return { error: { status: 503 } };
  };
  const data = createBrowserData({
    config,
    createClient: () => client,
    history: { replaceState() {} },
    location: {
      hash: "#type=recovery&access_token=private",
      href: "https://example.com/login/#type=recovery&access_token=private",
    },
    storage: redirectStorage,
  });

  assert.deepEqual(await data.acceptInvitation(), { outcome: "invite_invalid_or_expired" });
  assert.deepEqual(signOutScopes, [{ scope: "local" }]);
  assert.equal(redirectStorage.getItem(storageKey), null);
});

test("an unsupported Auth fragment discards its session when sign-out throws", async () => {
  const redirectStorage = new MapStorage();
  redirectStorage.setItem(storageKey, "private-session");
  const client = fakeClient();
  client.auth.signOut = async () => {
    throw new Error("network unavailable");
  };
  const data = createBrowserData({
    config,
    createClient: () => client,
    history: { replaceState() {} },
    location: {
      hash: "#type=recovery&access_token=private",
      href: "https://example.com/login/#type=recovery&access_token=private",
    },
    storage: redirectStorage,
  });

  assert.deepEqual(await data.acceptInvitation(), { outcome: "invite_invalid_or_expired" });
  assert.equal(redirectStorage.getItem(storageKey), null);
});

test("sign-in normalizes credentials and service failures", async () => {
  const successClient = fakeClient({ user: { id: "91ef348a-84fe-4b67-8122-5090f95472ae" } });
  const invalidClient = fakeClient();
  invalidClient.auth.signInWithPassword = async () => ({
    data: {},
    error: { status: 400 },
  });
  const unavailableClient = fakeClient();
  unavailableClient.auth.signInWithPassword = async () => ({
    data: {},
    error: { status: 0 },
  });

  const credentials = { email: "student@example.invalid", password: "secret" };

  assert.deepEqual(await createData(successClient).signIn(credentials), {
    outcome: "authenticated",
    userId: "91ef348a-84fe-4b67-8122-5090f95472ae",
  });
  assert.deepEqual(await createData(invalidClient).signIn(credentials), {
    outcome: "invalid_credentials",
  });
  assert.deepEqual(await createData(unavailableClient).signIn(credentials), {
    outcome: "auth_unavailable",
  });
});

test("session validation and refresh classify status-zero network failures as unavailable", async () => {
  const validationClient = fakeClient();
  validationClient.auth.getUser = async () => ({ data: {}, error: { status: 0 } });
  assert.deepEqual(await createData(validationClient).validateCurrentUser(), {
    outcome: "auth_unavailable",
  });

  const refreshClient = fakeClient();
  refreshClient.auth.getSession = async () => ({ data: {}, error: { status: 0 } });
  assert.deepEqual(await createData(refreshClient).refresh(), {
    outcome: "auth_unavailable",
  });
});

test("Auth throttling is unavailable rather than a credential or session failure", async () => {
  const signInClient = fakeClient();
  signInClient.auth.signInWithPassword = async () => ({ data: {}, error: { status: 429 } });
  assert.deepEqual(
    await createData(signInClient).signIn({
      email: "student@example.invalid",
      password: "secret",
    }),
    { outcome: "auth_unavailable" },
  );

  const validationClient = fakeClient();
  validationClient.auth.getUser = async () => ({ data: {}, error: { status: 429 } });
  assert.deepEqual(await createData(validationClient).validateCurrentUser(), {
    outcome: "auth_unavailable",
  });

  const refreshClient = fakeClient();
  refreshClient.auth.getSession = async () => ({
    data: { session: { user: { id: "current-user" } } },
    error: null,
  });
  refreshClient.auth.refreshSession = async () => ({ data: {}, error: { status: 429 } });
  assert.deepEqual(await createData(refreshClient).refresh(), {
    outcome: "auth_unavailable",
  });
});

test("an accepted invitation can establish a password without exposing its session", async () => {
  const client = fakeClient({ user: { id: "91ef348a-84fe-4b67-8122-5090f95472ae" } });

  assert.deepEqual(await createData(client).establishPassword({ password: "not-a-real-password" }), {
    outcome: "password_established",
    userId: "91ef348a-84fe-4b67-8122-5090f95472ae",
  });
});

test("student reads preserve zero, one, and unexpected-many cardinality", async () => {
  const cases = [
    [[], { outcome: "student_missing" }],
    [
      [{
        name: "Ada",
        teacher_note_1: "First comment",
        teacher_note_2: null,
        teacher_note_3: "Third comment",
        piece_1: "arabesque",
        piece_2: null,
        piece_3: "prelude",
        id: "not-part-of-the-response",
        email: "not-part-of-the-response@example.invalid",
      }],
      {
        outcome: "student_loaded",
        student: {
          name: "Ada",
          teacher_note_1: "First comment",
          teacher_note_2: null,
          teacher_note_3: "Third comment",
          piece_1: "arabesque",
          piece_2: null,
          piece_3: "prelude",
        },
      },
    ],
    [
      [
        { name: "Ada", piece_1: null, teacher_note_1: null },
        { name: "Grace", piece_1: null, teacher_note_1: null },
      ],
      { outcome: "student_cardinality_violation" },
    ],
  ];

  for (const [rows, expected] of cases) {
    const client = fakeClient({ user: { id: "91ef348a-84fe-4b67-8122-5090f95472ae" } });
    client.from = (table) => {
      assert.equal(table, "students");
      return {
        select: async (columns) => {
          assert.equal(
            columns,
            "name,teacher_note_1,teacher_note_2,teacher_note_3,piece_1,piece_2,piece_3",
          );
          return { data: rows, error: null, status: 200 };
        },
      };
    };

    assert.deepEqual(await createData(client).readStudent(), expected);
  }
});

test("a student permission failure remains a read failure rather than signing out", async () => {
  const client = fakeClient({ user: { id: "91ef348a-84fe-4b67-8122-5090f95472ae" } });
  client.from = () => ({
    select: async () => ({ data: null, error: { code: "42501" }, status: 403 }),
  });

  assert.deepEqual(await createData(client).readStudent(), {
    outcome: "student_read_failed",
  });
});

test("refresh keeps replacement tokens inside the adapter and returns only the user ID", async () => {
  const client = fakeClient();
  client.auth.getSession = async () => ({ data: { session: { user: { id: "old" } } }, error: null });
  client.auth.refreshSession = async () => ({
    data: { session: { user: { id: "replacement-user" }, access_token: "private" } },
    error: null,
  });

  assert.deepEqual(await createData(client).refresh(), {
    outcome: "authenticated",
    userId: "replacement-user",
  });
});

test("authenticated Assignment and generation reads use protected RPCs and reject incomplete authority", async () => {
  const client = fakeClient({ user: { id: "student-a" } });
  const calls = [];
  client.rpc = async (name, args) => {
    calls.push([name, args]);
    if (name === "student_active_assignments_v1") return { data: {
      contractVersion: 1, outcome: "assignments", assignments: [
        { assignmentId: "assignment-a", slug: "piece-a", position: 1 },
      ],
    }, error: null, status: 200 };
    return { data: { contractVersion: 1, outcome: "generation", credentialGeneration: 7 },
      error: null, status: 200 };
  };
  const data = createData(client);
  assert.deepEqual(await data.readAssignments(), { outcome: "assignments_loaded", assignments: [
    { assignmentId: "assignment-a", slug: "piece-a", position: 1 },
  ] });
  assert.deepEqual(await data.readPracticeGeneration(), {
    outcome: "generation_loaded", credentialGeneration: 7,
  });
  assert.deepEqual(calls, [
    ["student_active_assignments_v1", undefined],
    ["student_practice_generation_v1", undefined],
  ]);
  client.rpc = async () => ({ data: { contractVersion: 1, outcome: "generation" },
    error: null, status: 200 });
  assert.deepEqual(await data.readPracticeGeneration(), { outcome: "practice_unavailable" });
});

test("Practice ingestion sends only the immutable event under the Student session", async () => {
  const client = fakeClient({ user: { id: "student-a" } });
  const event = { eventVersion: 1, eventId: "event-a", assignmentId: "assignment-a",
    clientStartedAt: "2026-10-03T22:00:00Z", clientEndedAt: "2026-10-03T22:01:00Z",
    durationSeconds: 30, credentialGeneration: 7 };
  client.rpc = async (name, args) => {
    assert.equal(name, "student_ingest_practice_session_v1");
    assert.deepEqual(args, { payload: event });
    return { data: { contractVersion: 1, outcome: "accepted", eventId: "event-a" },
      error: null, status: 200 };
  };
  const data = createData(client);
  assert.deepEqual(await data.validateCurrentUser(), { outcome: "authenticated", userId: "student-a" });
  assert.deepEqual(await data.ingestPractice(event), {
    contractVersion: 1, outcome: "accepted", eventId: "event-a",
  });
});

function createData(client) {
  return createBrowserData({
    config,
    createClient: () => client,
    history: {},
    location: { hash: "", href: "https://example.com/login/" },
    storage,
  });
}

function fakeClient({ user = null } = {}) {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange(callback) {
        queueMicrotask(() => callback("INITIAL_SESSION", null));
        return { data: { subscription: { unsubscribe() {} } } };
      },
      refreshSession: async () => ({ data: {}, error: { status: 400 } }),
      signInWithPassword: async () => ({ data: { user }, error: null }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: { user }, error: null }),
    },
    from: () => ({ select: async () => ({ data: [], error: null, status: 200 }) }),
  };
}
