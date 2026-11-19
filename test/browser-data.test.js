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

  assert.deepEqual(await data.acceptInvitation(), { outcome: "configuration_error", retry: "reload" });
  assert.deepEqual(await data.signIn({ email: "student@example.invalid", password: "secret" }), {
    outcome: "configuration_error",
  });
  assert.equal(clientCreated, false);
  assert.deepEqual(replaced, []);
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

test("transient client initialization failures preserve recovery links for a working reload", async () => {
  for (const createClient of [undefined, () => { throw new Error("initialization unavailable"); }]) {
    const replaced = [];
    const options = { config, storage: new MapStorage(),
      location: { hash: "#type=recovery&access_token=synthetic", href: "https://example.com/login/#type=recovery&access_token=synthetic" },
      history: { replaceState: (_state, _title, url) => replaced.push(url) } };
    const failed = createBrowserData({ ...options, createClient });
    assert.deepEqual(await failed.acceptInvitation(), { outcome: "auth_unavailable", retry: "reload" });
    assert.deepEqual(replaced, []);
    const user = { id: "recovery-user" };
    const client = fakeClient({ user });
    client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
    const reloaded = createBrowserData({ ...options, createClient: () => client });
    assert.deepEqual(await reloaded.acceptInvitation(), { outcome: "password_recovery", userId: user.id });
  }
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

test("unavailable invitation validation retains setup for a fresh Login adapter", async () => {
  const user = { id: "invited-user" };
  const location = { hash: "#type=invite&access_token=synthetic", href: "https://example.com/login/" };
  const history = { replaceState: (_state, _title, url) => { location.href = url; location.hash = new URL(url).hash; } };
  const unavailable = fakeClient({ user });
  unavailable.auth.onAuthStateChange = callback => {
    location.hash = "";
    queueMicrotask(() => callback("INITIAL_SESSION", { user }));
  };
  unavailable.auth.getUser = async () => ({ error: { status: 503 } });
  const first = createBrowserData({ config, createClient: () => unavailable, location, history, storage: new MapStorage() });
  assert.deepEqual(await first.acceptInvitation({ handoffToLogin: true }), { outcome: "auth_unavailable" });
  assert.equal(location.hash, "#type=invite&access_token=synthetic");
  const fresh = createBrowserData({ config, createClient: () => fakeClient({ user }), location, history, storage: new MapStorage() });
  assert.deepEqual(await fresh.acceptInvitation(), { outcome: "invite_accepted", userId: user.id });
  assert.equal(location.hash, "");
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
      hash: "#type=magiclink&access_token=private",
      href: "https://example.com/login/#type=magiclink&access_token=private",
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
      hash: "#type=magiclink&access_token=private",
      href: "https://example.com/login/#type=magiclink&access_token=private",
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

test("sign-in throttling is distinct from credential failures; other session throttling is unavailable", async () => {
  const signInClient = fakeClient();
  signInClient.auth.signInWithPassword = async () => ({ data: {}, error: { status: 429 } });
  assert.deepEqual(
    await createData(signInClient).signIn({
      email: "student@example.invalid",
      password: "secret",
    }),
    { outcome: "auth_rate_limited" },
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
  const client = fakeClient({ user: { id: "91ef348a-84fe-4b67-8122-5090f95472ae", email: "teacher@example.invalid" } });

  assert.deepEqual(await (await createPasswordData(client)).establishPassword({ password: "not-a-real-password" }), {
    outcome: "password_established",
    userId: "91ef348a-84fe-4b67-8122-5090f95472ae",
  });
});

test("email provider configuration failures are not reported as incorrect passwords", async () => {
  const client = fakeClient();
  client.auth.signInWithPassword = async () => ({ data: {}, error: { status: 422, code: "email_provider_disabled" } });
  assert.deepEqual(await createData(client).signIn({ email: "teacher@example.invalid", password: "synthetic" }),
    { outcome: "auth_configuration_error" });
});

test("password setup verifies the submitted password with a real password-sign-in operation", async () => {
  const user = { id: "91ef348a-84fe-4b67-8122-5090f95472ae", email: "teacher@example.invalid" };
  const client = fakeClient({ user });
  const calls = [];
  client.auth.updateUser = async (input) => { calls.push(["save", input]); return { data: { user }, error: null }; };
  client.auth.signInWithPassword = async (input) => { calls.push(["verify", input]); return { data: { user }, error: null }; };
  assert.equal((await (await createPasswordData(client)).establishPassword({ password: "synthetic-only" })).outcome, "password_established");
  assert.deepEqual(calls, [["save", { password: "synthetic-only" }],
    ["verify", { email: user.email, password: "synthetic-only" }]]);
});

test("a saved password is distinguished from failed subsequent sign-in verification", async () => {
  const user = { id: "91ef348a-84fe-4b67-8122-5090f95472ae", email: "teacher@example.invalid" };
  const client = fakeClient({ user });
  client.auth.signInWithPassword = async () => ({ data: {}, error: { status: 503 } });
  assert.deepEqual(await (await createPasswordData(client)).establishPassword({ password: "synthetic-only" }),
    { outcome: "password_saved_signin_failed", reason: "auth_unavailable" });
});

test("password setup cannot report success for a different authenticated UUID", async () => {
  const user = { id: "expected-user", email: "teacher@example.invalid" };
  const client = fakeClient({ user });
  client.auth.signInWithPassword = async () => ({ data: { user: { id: "different-user" } }, error: null });
  assert.deepEqual(await (await createPasswordData(client)).establishPassword({ password: "synthetic-only" }),
    { outcome: "password_saved_signin_failed", reason: "auth_unavailable" });
});

test("an account switch after recovery acceptance prevents writing another user's password", async () => {
  const original = { id: "recovery-user", email: "original@example.invalid" };
  const client = fakeClient({ user: original });
  client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user: original })); };
  let writes = 0;
  client.auth.updateUser = async () => { writes++; return { data: { user: { id: "different-user" } }, error: null }; };
  const adapter = createBrowserData({ config, createClient: () => client, storage: new MapStorage(),
    location: { hash: "#type=recovery&access_token=synthetic", href: "https://example.com/login/#type=recovery&access_token=synthetic" },
    history: { replaceState() {} } });
  assert.equal((await adapter.acceptInvitation()).userId, original.id);
  client.auth.getUser = async () => ({ data: { user: { id: "different-user" } }, error: null });
  assert.deepEqual(await adapter.establishPassword({ password: "synthetic-only" }), { outcome: "unauthenticated" });
  assert.equal(writes, 0);
});

test("a mismatched password-write identity cannot be verified as setup success", async () => {
  const client = fakeClient({ user: { id: "original-user", email: "original@example.invalid" } });
  let verificationCalls = 0;
  const adapter = await createPasswordData(client);
  client.auth.updateUser = async () => ({ data: { user: { id: "different-user", email: "other@example.invalid" } }, error: null });
  client.auth.signInWithPassword = async () => { verificationCalls++; return { data: {}, error: null }; };
  assert.deepEqual(await adapter.establishPassword({ password: "synthetic-only" }),
    { outcome: "password_saved_signin_failed", reason: "auth_unavailable" });
  assert.equal(verificationCalls, 0);
});

test("recovery requires its Auth event and a matching network-validated user", async () => {
  const user = { id: "91ef348a-84fe-4b67-8122-5090f95472ae" };
  for (const event of ["PASSWORD_RECOVERY", "INITIAL_SESSION"]) {
    let discarded = false;
    const client = fakeClient({ user });
    client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback(event, { user })); };
    client.auth.signOut = async () => { discarded = true; return { error: null }; };
    const replaced = [];
    const adapter = createBrowserData({ config, createClient: () => client, storage: new MapStorage(), initialSessionTimeoutMs: 5,
      location: { hash: "#type=recovery&access_token=synthetic", href: "https://example.com/login/#type=recovery&access_token=synthetic" },
      history: { replaceState: (_state, _title, url) => replaced.push(url) } });
    assert.deepEqual(await adapter.acceptInvitation(), event === "PASSWORD_RECOVERY"
      ? { outcome: "password_recovery", userId: user.id } : { outcome: "auth_link_validation_pending" });
    assert.equal(discarded, false);
    assert.deepEqual(replaced, event === "PASSWORD_RECOVERY" ? ["https://example.com/login/"] : []);
  }
});

test("recovery waits for PASSWORD_RECOVERY when INITIAL_SESSION arrives first", async () => {
  const user = { id: "network-user" };
  const client = fakeClient({ user });
  client.auth.onAuthStateChange = callback => {
    queueMicrotask(() => callback("INITIAL_SESSION", { user }));
    setTimeout(() => callback("PASSWORD_RECOVERY", { user }), 0);
  };
  const adapter = createBrowserData({ config, createClient: () => client, storage: new MapStorage(),
    location: { hash: "#type=recovery&access_token=synthetic", href: "https://example.com/login/#type=recovery&access_token=synthetic" },
    history: { replaceState() {} } });
  assert.deepEqual(await adapter.acceptInvitation(), { outcome: "password_recovery", userId: user.id });
});

test("recovery retries a late event after timeout without consuming the link or accepting a stored session", async () => {
  const user = { id: "late-recovery-user" };
  const client = fakeClient({ user });
  let authEvent;
  client.auth.onAuthStateChange = callback => {
    authEvent = callback;
    queueMicrotask(() => callback("INITIAL_SESSION", { user }));
  };
  const replaced = [];
  const adapter = createBrowserData({ config, createClient: () => client, storage: new MapStorage(), initialSessionTimeoutMs: 5,
    location: { hash: "#type=recovery&access_token=synthetic", href: "https://example.com/login/#type=recovery&access_token=synthetic" },
    history: { replaceState: (_state, _title, url) => replaced.push(url) } });
  assert.deepEqual(await adapter.acceptInvitation(), { outcome: "auth_link_validation_pending" });
  assert.deepEqual(await adapter.establishPassword({ password: "synthetic-only" }), { outcome: "unauthenticated" });
  assert.deepEqual(replaced, []);
  authEvent("PASSWORD_RECOVERY", { user });
  assert.deepEqual(await adapter.acceptInvitation(), { outcome: "password_recovery", userId: user.id });
  assert.deepEqual(replaced, ["https://example.com/login/"]);
});

test("a late recovery event persists intent before Retry so an SDK-cleaned URL can reload safely", async () => {
  const user = { id: "late-recovery-user" };
  const client = fakeClient({ user });
  const progress = new MapStorage();
  let authEvent;
  client.auth.onAuthStateChange = callback => {
    authEvent = callback;
    queueMicrotask(() => callback("INITIAL_SESSION", { user }));
  };
  const adapter = createBrowserData({ config, createClient: () => client, storage: new MapStorage(), completionStorage: progress,
    initialSessionTimeoutMs: 5, location: { hash: "#type=recovery&access_token=synthetic", href: "https://example.com/login/" }, history: {} });
  assert.deepEqual(await adapter.acceptInvitation(), { outcome: "auth_link_validation_pending" });
  authEvent("PASSWORD_RECOVERY", { user });
  const fresh = recoveryData(fakeClient({ user }), progress);
  assert.deepEqual(await fresh.resumePasswordRecovery(), { outcome: "password_recovery", userId: user.id });
  assert.deepEqual(await fresh.validateCurrentUser(), { outcome: "password_completion_required" });
});

test("pending initialization restores an SDK-cleared fragment until recovery intent is durable", async () => {
  const user = { id: "late-recovery-user" };
  const location = { hash: "#type=recovery&access_token=synthetic", href: "https://example.com/login/" };
  const client = fakeClient({ user });
  let authEvent;
  client.auth.onAuthStateChange = callback => {
    authEvent = callback;
    location.hash = "";
    queueMicrotask(() => callback("INITIAL_SESSION", { user }));
  };
  const adapter = createBrowserData({ config, createClient: () => client, storage: new MapStorage(), initialSessionTimeoutMs: 5,
    location, history: { replaceState: (_state, _title, url) => { location.href = url; location.hash = new URL(url).hash; } } });
  assert.deepEqual(await adapter.acceptInvitation(), { outcome: "auth_link_validation_pending" });
  assert.equal(location.hash, "#type=recovery&access_token=synthetic");
  authEvent("PASSWORD_RECOVERY", { user });
  assert.equal(location.hash, "");
  assert.deepEqual(await adapter.resumePasswordRecovery(), { outcome: "password_recovery", userId: user.id });
});

test("a recovery event for another user cannot authorize password setup", async () => {
  const client = fakeClient({ user: { id: "network-user" } });
  client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user: { id: "other-user" } })); };
  const adapter = createBrowserData({ config, createClient: () => client, storage: new MapStorage(),
    location: { hash: "#type=recovery&access_token=synthetic", href: "https://example.com/login/#type=recovery&access_token=synthetic" },
    history: { replaceState() {} } });
  assert.deepEqual(await adapter.acceptInvitation(), { outcome: "invite_invalid_or_expired" });
});

test("recovery can globally sign out without changing ordinary tab-local sign-out", async () => {
  const client = fakeClient();
  const scopes = [];
  client.auth.signOut = async options => { scopes.push(options.scope); return { error: null }; };
  const data = createData(client);
  await data.signOut();
  await data.signOut({ scope: "global" });
  assert.deepEqual(scopes, ["local", "global"]);
});

test("recovery intent survives unavailable validation and reload without keeping link credentials", async () => {
  const user = { id: "recovery-user", email: "teacher@example.invalid" };
  const progress = new MapStorage();
  const unavailable = fakeClient({ user });
  unavailable.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
  unavailable.auth.getUser = async () => ({ error: { status: 503 } });
  const first = recoveryData(unavailable, progress, true);
  assert.deepEqual(await first.acceptInvitation(), { outcome: "auth_link_validation_pending" });
  const fresh = recoveryData(fakeClient({ user }), progress);
  assert.deepEqual(await fresh.resumePasswordRecovery(), { outcome: "password_recovery", userId: user.id });
});

test("acknowledged password writes retain cleanup across reload and do not block another identity", async () => {
  const user = { id: "recovery-user", email: "teacher@example.invalid" };
  const progress = new MapStorage();
  const client = fakeClient({ user });
  client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
  client.auth.signInWithPassword = async () => ({ error: { status: 503 } });
  client.auth.signOut = async () => ({ error: { status: 503 } });
  const first = recoveryData(client, progress, true);
  await first.acceptInvitation();
  assert.equal((await first.establishPassword({ password: "synthetic-only" })).outcome, "password_saved_signin_failed");
  assert.deepEqual(await first.completePasswordRecovery(), { outcome: "logout_failed" });
  const other = recoveryData(fakeClient({ user: { id: "other-user" } }), progress);
  assert.deepEqual(await other.resumePasswordRecovery(), { outcome: "no_invitation" });
  const resumedClient = fakeClient({ user });
  const scopes = [];
  resumedClient.auth.signOut = async options => { scopes.push(options.scope); return { error: null }; };
  const resumed = recoveryData(resumedClient, progress);
  assert.deepEqual(await resumed.resumePasswordRecovery(), { outcome: "password_cleanup_pending", userId: user.id, passwordSaved: true });
  assert.deepEqual(await resumed.validateCurrentUser(), { outcome: "password_completion_required" });
  assert.deepEqual(await resumed.readTeacherStudents(), { outcome: "account_denied" });
  assert.deepEqual(await resumed.completePasswordRecovery(), { outcome: "signed_out" });
  assert.deepEqual(scopes, ["global"]);
});

test("an uncertain recovery write resumes cleanup without asserting password success", async () => {
  const user = { id: "recovery-user", email: "teacher@example.invalid" };
  const progress = new MapStorage();
  const client = fakeClient({ user });
  client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
  let writes = 0;
  client.auth.updateUser = async () => { writes++; return { error: { status: 503 } }; };
  const first = recoveryData(client, progress, true);
  await first.acceptInvitation();
  assert.deepEqual(await first.establishPassword({ password: "synthetic-only" }), { outcome: "password_change_uncertain" });
  const resumed = recoveryData(fakeClient({ user }), progress);
  assert.deepEqual(await resumed.resumePasswordRecovery(), { outcome: "password_cleanup_pending", userId: user.id, passwordSaved: false });
  assert.deepEqual(await resumed.completePasswordRecovery(), { outcome: "signed_out" });
  assert.equal(writes, 1);
});

test("uncertain invitation writes discard the session and expose normal sign-in without another write", async () => {
  for (const throws of [false, true]) {
    const user = { id: "invite-user", email: "teacher@example.invalid" };
    const client = fakeClient({ user });
    let writes = 0;
    const scopes = [];
    client.auth.updateUser = async () => {
      writes++;
      if (throws) throw new Error("response lost");
      return { error: { status: 503 } };
    };
    client.auth.signOut = async options => { scopes.push(options.scope); return { error: null }; };
    const adapter = await createPasswordData(client);
    assert.deepEqual(await adapter.establishPassword({ password: "synthetic-only" }), { outcome: "password_change_uncertain" });
    assert.deepEqual(await adapter.establishPassword({ password: "synthetic-only" }), { outcome: "unauthenticated" });
    assert.equal((await adapter.signIn({ email: user.email, password: "synthetic-only" })).outcome, "authenticated");
    assert.equal(writes, 1);
    assert.deepEqual(scopes, ["local"]);
  }
});

test("revoked tab storage cannot hide uncertain or saved-but-unverified invitation outcomes", async () => {
  for (const saved of [false, true]) {
    const user = { id: "invite-user", email: "teacher@example.invalid" };
    const client = fakeClient({ user });
    client.auth.updateUser = async () => saved ? { data: { user }, error: null } : { error: { status: 503 } };
    client.auth.signInWithPassword = async () => ({ error: { status: 503 } });
    const revoked = { getItem() { return null; }, setItem() {}, removeItem() { throw new Error("storage revoked"); } };
    const adapter = createBrowserData({ config, createClient: () => client, storage: revoked,
      location: { hash: "#type=invite&access_token=synthetic", href: "https://example.com/login/" }, history: {} });
    await adapter.acceptInvitation();
    assert.deepEqual(await adapter.establishPassword({ password: "synthetic-only" }), saved
      ? { outcome: "password_saved_signin_failed", reason: "auth_unavailable" }
      : { outcome: "password_change_uncertain" });
  }
});

test("recovery cleanup uses its validated identity when progress disappears or cannot be read", async () => {
  for (const unreadable of [false, true]) {
    const user = { id: "recovery-user", email: "teacher@example.invalid" };
    const saved = new MapStorage();
    let blocked = false;
    const progressKey = `${storageKey}-recovery-${user.id}`;
    const progress = { getItem(key) { if (blocked) throw new Error("read blocked"); return saved.getItem(key); },
      setItem: (key, value) => saved.setItem(key, value), removeItem: key => saved.removeItem(key) };
    const client = fakeClient({ user });
    client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
    const scopes = [];
    client.auth.signOut = async options => { scopes.push(options.scope); blocked = false; return { error: null }; };
    const adapter = recoveryData(client, progress, true);
    await adapter.acceptInvitation();
    await adapter.establishPassword({ password: "synthetic-only" });
    if (unreadable) blocked = true;
    else saved.removeItem(progressKey);
    assert.equal((await adapter.validateCurrentUser()).outcome, "password_completion_required");
    assert.deepEqual(await adapter.completePasswordRecovery(), { outcome: "signed_out" });
    assert.deepEqual(scopes, ["global"]);
    assert.equal(saved.getItem(progressKey), null);
  }
});

test("deleted recovery progress is restored before a failed global sign-out for later resumption", async () => {
  const user = { id: "recovery-user", email: "teacher@example.invalid" };
  const progress = new MapStorage();
  const client = fakeClient({ user });
  client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
  client.auth.signOut = async () => ({ error: { status: 503 } });
  const adapter = recoveryData(client, progress, true);
  await adapter.acceptInvitation();
  await adapter.establishPassword({ password: "synthetic-only" });
  progress.removeItem(`${storageKey}-recovery-${user.id}`);
  assert.deepEqual(await adapter.completePasswordRecovery(), { outcome: "logout_failed" });
  const resumed = recoveryData(fakeClient({ user }), progress);
  assert.deepEqual(await resumed.resumePasswordRecovery(), { outcome: "password_cleanup_pending", userId: user.id, passwordSaved: true });
});

test("a rejected rate-limited recovery write preserves setup and its authenticated retry", async () => {
  const user = { id: "recovery-user", email: "teacher@example.invalid" };
  const storage = new MapStorage();
  const client = fakeClient({ user });
  client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
  let writes = 0;
  let logouts = 0;
  client.auth.updateUser = async () => ++writes === 1 ? { error: { status: 429 } } : { data: { user }, error: null };
  client.auth.signOut = async () => { logouts++; return { error: null }; };
  const adapter = recoveryData(client, storage, true);
  await adapter.acceptInvitation();
  assert.deepEqual(await adapter.establishPassword({ password: "synthetic-only" }), { outcome: "auth_rate_limited" });
  assert.equal(logouts, 0);
  const restored = recoveryData(fakeClient({ user }), storage);
  assert.deepEqual(await restored.resumePasswordRecovery(), { outcome: "password_recovery", userId: user.id });
  assert.equal((await adapter.establishPassword({ password: "synthetic-only" })).outcome, "password_established");
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

test("Practice RPC errors preserve authorization and rollout distinctions", async () => {
  const client = fakeClient({ user: { id: "student-a" } });
  const data = createData(client);
  await data.validateCurrentUser();
  for (const [code, expected] of [
    ["42501", "account_denied"], ["55000", "practice_not_ready"],
    ["XX000", "retry"],
  ]) {
    client.rpc = async () => ({ data: null, error: { code }, status: 400 });
    assert.deepEqual(await data.ingestPractice({ eventId: "event-a" }), { outcome: expected });
  }
  client.rpc = async () => ({ data: null, error: { code: "42501" }, status: 403 });
  assert.deepEqual(await data.readAssignments(), { outcome: "account_denied" });
});

test("Student summary RPC uses no selector and denies unauthorized access", async () => {
  const client = fakeClient({ user: { id: "student-a" } });
  let call;
  client.rpc = async (name, args) => {
    call = [name, args];
    return { data: { contractVersion: 1, outcome: "summary", asOf: "2026-10-08T00:00:00Z",
      week: { studentTimeZone: "UTC", isoWeekNumber: 41, isoWeekYear: 2026 },
      days: [], pieces: [], totalSeconds: 0 }, error: null, status: 200 };
  };
  const data = createData(client);
  assert.equal((await data.readWeeklySummary()).outcome, "summary_loaded");
  assert.deepEqual(call, ["student_weekly_summary_v1", undefined]);
  client.rpc = async () => ({ data: null, error: { code: "42501" }, status: 403 });
  assert.deepEqual(await data.readWeeklySummary(), { outcome: "account_denied" });
  const anonymous = createData(fakeClient());
  assert.deepEqual(await anonymous.readWeeklySummary(), { outcome: "unauthenticated" });
});

test("offline snapshot identity follows the active Auth session across account changes", async () => {
  const client = fakeClient();
  let userId = "student-a";
  client.auth.getSession = async () => ({ data: { session: userId ? { user: { id: userId } } : null },
    error: null });
  const data = createData(client);
  assert.deepEqual(await data.sessionIdentity(), { outcome: "authenticated", userId: "student-a" });
  userId = "student-b";
  assert.deepEqual(await data.sessionIdentity(), { outcome: "authenticated", userId: "student-b" });
  userId = null;
  assert.deepEqual(await data.sessionIdentity(), { outcome: "unauthenticated" });
});

test("transient session errors preserve an uncertain summary identity", async () => {
  const client = fakeClient();
  const data = createData(client);
  for (const status of [0, 429, 503]) {
    client.auth.getSession = async () => ({ data: { session: null }, error: { status } });
    assert.deepEqual(await data.sessionIdentity(), { outcome: "auth_unavailable" });
  }
  client.auth.getSession = async () => ({
    data: { session: { user: { id: "student-a" } } }, error: { status: 503 },
  });
  assert.deepEqual(await data.sessionIdentity(), { outcome: "auth_unavailable" });
  client.auth.getSession = async () => ({ data: { session: null }, error: { status: 401 } });
  assert.deepEqual(await data.sessionIdentity(), { outcome: "unauthenticated" });
});

async function createPasswordData(client) {
  const adapter = createBrowserData({ config, createClient: () => client, storage: new MapStorage(),
    location: { hash: "#type=invite&access_token=synthetic", href: "https://example.com/login/#type=invite&access_token=synthetic" },
    history: { replaceState() {} } });
  assert.equal((await adapter.acceptInvitation()).outcome, "invite_accepted");
  return adapter;
}

test("ordinary no-fragment invitation inspection is network-free for offline Student entry", async () => {
  let validations = 0;
  const client = fakeClient({ user: { id: "offline-student" } });
  client.auth.getUser = async () => { validations++; return { error: { status: 503 } }; };
  assert.deepEqual(await createData(client).acceptInvitation(), { outcome: "no_invitation" });
  assert.equal(validations, 0);
});

test("failed progress deletion records completed cleanup without repeating global logout", async () => {
  const user = { id: "recovery-user", email: "teacher@example.invalid" };
  const saved = new MapStorage();
  const storage = { getItem: key => saved.getItem(key), setItem: (key, value) => saved.setItem(key, value),
    removeItem() { throw new Error("deletion blocked"); } };
  const client = fakeClient({ user });
  client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
  let logouts = 0;
  client.auth.signOut = async () => { logouts++; return { error: null }; };
  const adapter = recoveryData(client, storage, true);
  await adapter.acceptInvitation();
  await adapter.establishPassword({ password: "synthetic-only" });
  assert.deepEqual(await adapter.completePasswordRecovery(), { outcome: "signed_out" });
  const fresh = recoveryData(fakeClient({ user }), storage);
  assert.deepEqual(await fresh.resumePasswordRecovery(), { outcome: "no_invitation" });
  assert.equal((await fresh.validateCurrentUser()).outcome, "authenticated");
  assert.equal(logouts, 1);
});

test("failed progress deletion and completion write expose retry without another global logout", async () => {
  const user = { id: "recovery-user", email: "teacher@example.invalid" };
  const saved = new MapStorage();
  let blocked = false;
  const storage = { getItem: key => saved.getItem(key),
    setItem(key, value) { if (blocked) throw new Error("blocked"); saved.setItem(key, value); },
    removeItem(key) { if (blocked) throw new Error("blocked"); saved.removeItem(key); } };
  const client = fakeClient({ user });
  client.auth.onAuthStateChange = callback => { queueMicrotask(() => callback("PASSWORD_RECOVERY", { user })); };
  let logouts = 0;
  client.auth.signOut = async () => { logouts++; blocked = true; return { error: null }; };
  const adapter = recoveryData(client, storage, true);
  await adapter.acceptInvitation();
  await adapter.establishPassword({ password: "synthetic-only" });
  assert.deepEqual(await adapter.completePasswordRecovery(), { outcome: "recovery_progress_cleanup_failed" });
  blocked = false;
  assert.deepEqual(await adapter.completePasswordRecovery(), { outcome: "signed_out" });
  assert.equal(logouts, 1);
});

function recoveryData(client, completionStorage, hasLink = false) {
  return createBrowserData({ config, createClient: () => client, storage: new MapStorage(), completionStorage,
    location: { hash: hasLink ? "#type=recovery&access_token=synthetic" : "", href: "https://example.com/login/" },
    history: { replaceState() {} } });
}

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
