const authRedirectKeys = ["type", "access_token", "refresh_token", "error", "error_code"];
const defaultStorageKey = "apartmender-auth-session";

export function createBrowserData({
  config,
  createClient,
  location,
  history,
  storage,
  storageKey = defaultStorageKey,
  initialSessionTimeoutMs = 10_000,
}) {
  const redirect = classifyAuthRedirect(location?.hash ?? "");
  let validatedUserId = null;

  const failedAdapterContext = { history, location, redirect };
  if (!config) return failedAdapter("configuration_error", failedAdapterContext);
  if (typeof createClient !== "function") {
    return failedAdapter("auth_unavailable", failedAdapterContext);
  }
  if (!storage) return failedAdapter("auth_unavailable", failedAdapterContext);

  let client;
  try {
    client = createClient(config.projectUrl, config.publishableKey, {
      auth: {
        detectSessionInUrl: true,
        flowType: "implicit",
        persistSession: true,
        storage,
        storageKey,
      },
    });
  } catch {
    return failedAdapter("auth_unavailable", failedAdapterContext);
  }
  const initialSession = waitForInitialSession(client, initialSessionTimeoutMs);

  return Object.freeze({
    acceptInvitation,
    establishPassword,
    readStudent,
    readAssignments,
    readPracticeGeneration,
    readWeeklySummary,
    sessionIdentity,
    ingestPractice,
    refresh,
    signIn,
    signOut,
    validateCurrentUser,
  });

  async function acceptInvitation() {
    if (redirect === "none") return { outcome: "no_invitation" };

    try {
      if (redirect === "error") return { outcome: "invite_invalid_or_expired" };
      if (redirect === "unsupported") {
        validatedUserId = null;
        try {
          await initialSession;
          await client.auth.signOut({ scope: "local" });
        } catch {
          // Local storage is cleared below even when server-aware sign-out fails.
        } finally {
          storage.removeItem(storageKey);
        }
        return { outcome: "invite_invalid_or_expired" };
      }

      if (!(await initialSession)) return { outcome: "auth_unavailable" };
      const result = await getAuthenticatedUser();
      if (result.outcome === "authenticated") {
        return { outcome: "invite_accepted", userId: result.userId };
      }
      return result.outcome === "auth_unavailable"
        ? result
        : { outcome: "invite_invalid_or_expired" };
    } finally {
      removeAuthFragment(location, history);
    }
  }

  async function establishPassword({ password }) {
    try {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) {
        if (isUnavailable(error)) return { outcome: "auth_unavailable" };
        if (isUnauthenticated(error)) return { outcome: "unauthenticated" };
        return { outcome: "password_rejected" };
      }
      const userId = data?.user?.id ?? validatedUserId;
      if (!userId) return { outcome: "unauthenticated" };
      validatedUserId = userId;
      return { outcome: "password_established", userId };
    } catch {
      return { outcome: "auth_unavailable" };
    }
  }

  async function signIn({ email, password }) {
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        return isUnavailable(error)
          ? { outcome: "auth_unavailable" }
          : { outcome: "invalid_credentials" };
      }
      const userId = data?.user?.id;
      if (!userId) return { outcome: "auth_unavailable" };
      validatedUserId = userId;
      return { outcome: "authenticated", userId };
    } catch {
      return { outcome: "auth_unavailable" };
    }
  }

  async function validateCurrentUser() {
    return getAuthenticatedUser();
  }

  async function refresh() {
    try {
      const current = await client.auth.getSession();
      if (current.error) {
        return isUnavailable(current.error)
          ? { outcome: "auth_unavailable" }
          : { outcome: "session_expired" };
      }
      if (!current.data?.session) return { outcome: "unauthenticated" };

      const { data, error } = await client.auth.refreshSession();
      if (error) {
        validatedUserId = null;
        return isUnavailable(error)
          ? { outcome: "auth_unavailable" }
          : { outcome: "session_expired" };
      }
      const userId = data?.session?.user?.id;
      if (!userId) {
        validatedUserId = null;
        return { outcome: "session_expired" };
      }
      validatedUserId = userId;
      return { outcome: "authenticated", userId };
    } catch {
      return { outcome: "auth_unavailable" };
    }
  }

  async function readStudent() {
    if (!validatedUserId) {
      const auth = await getAuthenticatedUser();
      if (auth.outcome !== "authenticated") return auth;
    }

    try {
      const { data, error, status } = await client
        .from("students")
        .select("name,teacher_note_1,teacher_note_2,teacher_note_3,piece_1,piece_2,piece_3");
      if (status === 401) {
        validatedUserId = null;
        return { outcome: "unauthenticated" };
      }
      if (error || !Array.isArray(data)) return { outcome: "student_read_failed" };
      if (data.length === 0) return { outcome: "student_missing" };
      if (data.length > 1) return { outcome: "student_cardinality_violation" };
      const [{ name, teacher_note_1, teacher_note_2, teacher_note_3, piece_1, piece_2, piece_3 }] = data;
      return {
        outcome: "student_loaded",
        student: { name, teacher_note_1, teacher_note_2, teacher_note_3, piece_1, piece_2, piece_3 },
      };
    } catch {
      return { outcome: "student_read_failed" };
    }
  }

  async function readAssignments() {
    return readStudentRpc("student_active_assignments_v1", (data) => {
      if (data?.contractVersion !== 1 || data.outcome !== "assignments"
        || !Array.isArray(data.assignments)) return null;
      const ids = new Set();
      const assignments = [];
      for (const assignment of data.assignments) {
        if (typeof assignment.assignmentId !== "string" || ids.has(assignment.assignmentId)
          || typeof assignment.slug !== "string"
          || assignment.position !== assignments.length + 1) return null;
        ids.add(assignment.assignmentId);
        assignments.push(assignment);
      }
      return { outcome: "assignments_loaded", assignments };
    });
  }

  async function readPracticeGeneration() {
    // This protected read is an additive Sludge prerequisite. The current
    // Assignment response does not expose the server-owned generation.
    return readStudentRpc("student_practice_generation_v1", (data) =>
      data?.contractVersion === 1 && data.outcome === "generation"
        && Number.isSafeInteger(data.credentialGeneration)
        && data.credentialGeneration > 0
        ? { outcome: "generation_loaded", credentialGeneration: data.credentialGeneration }
        : null);
  }

  async function readWeeklySummary() {
    return readStudentRpc("student_weekly_summary_v1", (data) =>
      data?.contractVersion === 1 && data.outcome === "summary"
        && typeof data.asOf === "string" && typeof data.week?.studentTimeZone === "string"
        && Number.isSafeInteger(data.week?.isoWeekNumber)
        && Number.isSafeInteger(data.week?.isoWeekYear)
        && Array.isArray(data.days) && Array.isArray(data.pieces)
        && Number.isSafeInteger(data.totalSeconds)
        ? { outcome: "summary_loaded", summary: data }
        : null);
  }

  async function sessionIdentity() {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) return { outcome: isUnavailable(error) ? "auth_unavailable" : "unauthenticated" };
      const userId = data?.session?.user?.id;
      return typeof userId === "string" && userId
        ? { outcome: "authenticated", userId }
        : { outcome: "unauthenticated" };
    } catch {
      return { outcome: "auth_unavailable" };
    }
  }

  async function readStudentRpc(name, decode) {
    if (!validatedUserId) {
      const auth = await getAuthenticatedUser();
      if (auth.outcome !== "authenticated") return auth;
    }
    try {
      const { data, error, status } = await client.rpc(name);
      if (status === 401) { validatedUserId = null; return { outcome: "unauthenticated" }; }
      if (error) {
        if (error.code === "42501") return { outcome: "account_denied" };
        if (error.code === "55000") return { outcome: "practice_not_ready" };
        return { outcome: "practice_unavailable" };
      }
      return decode(data) ?? { outcome: "practice_unavailable" };
    } catch {
      return { outcome: "practice_unavailable" };
    }
  }

  async function ingestPractice(event) {
    if (!validatedUserId) return { outcome: "unauthenticated" };
    try {
      const { data, error, status } = await client.rpc(
        "student_ingest_practice_session_v1", { payload: event });
      if (error) {
        if (status === 401) return { outcome: "unauthenticated" };
        if (error.code === "42501") return { outcome: "account_denied" };
        if (error.code === "55000") return { outcome: "practice_not_ready" };
        return { outcome: "retry" };
      }
      return data?.contractVersion === 1 ? data : { outcome: "retry" };
    } catch {
      return { outcome: "retry" };
    }
  }

  async function signOut() {
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) return { outcome: "logout_failed" };
      validatedUserId = null;
      return { outcome: "signed_out" };
    } catch {
      return { outcome: "logout_failed" };
    }
  }

  async function getAuthenticatedUser() {
    try {
      const { data, error } = await client.auth.getUser();
      if (error) {
        validatedUserId = null;
        return isUnavailable(error)
          ? { outcome: "auth_unavailable" }
          : { outcome: "unauthenticated" };
      }
      const userId = data?.user?.id;
      if (!userId) {
        validatedUserId = null;
        return { outcome: "unauthenticated" };
      }
      validatedUserId = userId;
      return { outcome: "authenticated", userId };
    } catch {
      return { outcome: "auth_unavailable" };
    }
  }
}

function classifyAuthRedirect(hash) {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const containsAuthData = authRedirectKeys.some((key) => fragment.has(key));
  if (!containsAuthData) return "none";
  if (fragment.has("error") || fragment.has("error_code")) return "error";
  return fragment.get("type") === "invite" ? "invite" : "unsupported";
}

function removeAuthFragment(location, history) {
  if (!location?.href || typeof history?.replaceState !== "function") return;
  const clean = new URL(location.href);
  clean.hash = "";
  history.replaceState(null, "", clean.href);
}

function waitForInitialSession(client, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (receivedEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(receivedEvent);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    client.auth.onAuthStateChange(() => finish(true));
  });
}

function isUnavailable(error) {
  return (
    !Number.isFinite(error?.status) ||
    error.status === 0 ||
    error.status === 429 ||
    error.status >= 500
  );
}

function isUnauthenticated(error) {
  return error?.status === 401 || error?.status === 403;
}

function failedAdapter(outcome, { history, location, redirect }) {
  const failure = async () => ({ outcome });
  const acceptInvitation = async () => {
    if (redirect !== "none") removeAuthFragment(location, history);
    return { outcome };
  };
  return Object.freeze({
    acceptInvitation,
    establishPassword: failure,
    readStudent: failure,
    readAssignments: failure,
    readPracticeGeneration: failure,
    readWeeklySummary: failure,
    sessionIdentity: failure,
    ingestPractice: failure,
    refresh: failure,
    signIn: failure,
    signOut: failure,
    validateCurrentUser: failure,
  });
}
