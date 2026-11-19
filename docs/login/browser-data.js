import { decodeTeacherPractice } from "./teacher/teacher-practice.js";
import { decodeTeacherNotes, decodeNotePublication } from "./teacher/teacher-notes.js";
import { createRecoveryProgress } from "./recovery-progress.js?auth=operator-onboarding-v1";

const authRedirectKeys = ["type", "access_token", "refresh_token", "error", "error_code"];
const defaultStorageKey = "apartmender-auth-session";

export function createBrowserData({
  config,
  createClient,
  location,
  history,
  storage,
  completionStorage = storage,
  storageKey = defaultStorageKey,
  initialSessionTimeoutMs = 10_000,
}) {
  let pendingAuthFragment = location?.hash ?? "";
  const redirect = classifyAuthRedirect(pendingAuthFragment);
  let validatedUserId = null;
  let passwordSetupUserId = null;
  let passwordSetupPurpose = "invite";
  let recoveryOperation = null;
  let recoverySignOutConfirmed = false;
  let recoveryStorageFailed = false;
  let redirectDiscard = null;
  let authFragmentRestored = false;
  const recoveryProgress = createRecoveryProgress(completionStorage, storageKey);

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
  const initialSession = waitForInitialSession(client, initialSessionTimeoutMs, redirect, userId => {
    if (redirect !== "recovery" || !userId || recoveryOperation) return;
    recoveryOperation = recoveryProgress.start(userId);
    pendingAuthFragment = "";
    if (authFragmentRestored) {
      removeAuthFragment(location, history);
      authFragmentRestored = false;
    }
    if (!recoveryOperation) {
      recoveryStorageFailed = true;
      // The SDK may already have removed the fragment. Prevent a reload from
      // retaining an ordinary session when recovery intent cannot be saved.
      try { storage.removeItem(storageKey); } catch { /* Server-aware discard follows. */ }
      setTimeout(() => { discardRedirectSession().catch(() => {}); }, 0);
    }
  });

  return Object.freeze({
    acceptInvitation,
    establishPassword,
    resumePasswordRecovery,
    completePasswordRecovery,
    readStudent,
    readAssignments,
    readPracticeGeneration,
    readWeeklySummary,
    readTeacherStudents,
    readTeacherStudent,
    readTeacherNotes,
    publishTeacherNotes,
    resolveWorkspace,
    sessionIdentity,
    ingestPractice,
    refresh,
    signIn,
    signOut,
    validateCurrentUser,
  });

  async function acceptInvitation({ handoffToLogin = false } = {}) {
    if (redirect === "none") return { outcome: "no_invitation" };
    let preserveFragment = false;
    try {
      if (redirect === "error") return { outcome: "invite_invalid_or_expired" };
      if (redirect === "unsupported") {
        await discardRedirectSession();
        return { outcome: "invite_invalid_or_expired" };
      }

      const initial = await initialSession;
      if (initial.recoveryPending || !initial.receivedEvent) {
        preserveFragment = true;
        // The SDK can clear the URL before its recovery event is delivered.
        // Keep pending navigation/reload recoverable until durable intent exists.
        restorePendingAuthFragment();
        return { outcome: redirect === "recovery" ? "auth_link_validation_pending" : "auth_unavailable" };
      }
      if (recoveryStorageFailed) {
        await discardRedirectSession();
        return { outcome: "auth_progress_unavailable" };
      }
      if (redirect === "recovery" && initial.recoveryUserId && !recoveryOperation) {
        recoveryOperation = recoveryProgress.start(initial.recoveryUserId);
        if (!recoveryOperation) {
          await discardRedirectSession();
          return { outcome: "auth_progress_unavailable" };
        }
      }
      const result = await getAuthenticatedUser();
      if (result.outcome === "authenticated") {
        if (redirect === "recovery" && initial.recoveryUserId !== result.userId) {
          if (recoveryOperation) recoveryProgress.remove(recoveryOperation);
          recoveryOperation = null;
          await discardRedirectSession();
          return { outcome: "invite_invalid_or_expired" };
        }
        if (redirect === "recovery" && recoveryOperation?.phase !== "setup") {
          return { outcome: "password_cleanup_pending", userId: result.userId,
            passwordSaved: recoveryOperation?.phase === "cleanup" };
        }
        passwordSetupUserId = result.userId;
        passwordSetupPurpose = redirect;
        if (redirect === "invite") {
          preserveFragment = true;
          restorePendingAuthFragment();
          if (!handoffToLogin) pendingAuthFragment = "";
        }
        return { outcome: redirect === "recovery" ? "password_recovery" : "invite_accepted", userId: result.userId };
      }
      if (result.outcome === "unauthenticated" && recoveryOperation) {
        recoveryProgress.remove(recoveryOperation); recoveryOperation = null;
        await discardRedirectSession();
      }
      if (result.outcome === "auth_unavailable" && redirect === "invite") {
        preserveFragment = true;
        restorePendingAuthFragment();
      }
      return result.outcome === "auth_unavailable"
        ? { outcome: recoveryOperation ? "auth_link_validation_pending" : "auth_unavailable" }
        : { outcome: "invite_invalid_or_expired" };
    } finally {
      if (!preserveFragment) {
        pendingAuthFragment = "";
        removeAuthFragment(location, history);
      }
    }
  }

  function restorePendingAuthFragment() {
    if (location.hash || !pendingAuthFragment || typeof history?.replaceState !== "function") return;
    const pending = new URL(location.href);
    pending.hash = pendingAuthFragment;
    history.replaceState(null, "", pending.href);
    authFragmentRestored = true;
  }

  async function resumePasswordRecovery() {
    const current = await getAuthenticatedUser();
    if (current.outcome === "unauthenticated") return { outcome: "no_invitation" };
    if (current.outcome !== "authenticated") return current;
    const progress = recoveryProgress.read(current.userId)
      ?? (recoveryOperation?.userId === current.userId ? recoveryOperation : null);
    if (!progress || progress.phase === "complete") {
      if (progress) recoveryProgress.remove(progress);
      if (recoveryOperation?.userId === current.userId) recoveryOperation = null;
      return { outcome: "no_invitation" };
    }
    recoveryOperation = progress;
    recoverySignOutConfirmed = false;
    if (progress.phase !== "setup") return { outcome: "password_cleanup_pending",
      userId: current.userId, passwordSaved: progress.phase === "cleanup" };
    passwordSetupUserId = current.userId;
    passwordSetupPurpose = "recovery";
    return { outcome: "password_recovery", userId: current.userId };
  }

  async function completePasswordRecovery() {
    if (!recoveryOperation || recoveryOperation.phase === "setup") {
      return { outcome: "logout_failed" };
    }
    let cleanupIntentDurable = true;
    try {
      if (!recoverySignOutConfirmed) {
        const progress = recoveryProgress.read(recoveryOperation.userId);
        if (progress && progress.operationId !== recoveryOperation.operationId) return { outcome: "logout_failed" };
        if (progress) {
          if (progress.phase === "setup") return { outcome: "logout_failed" };
          recoveryOperation = progress;
        }
        // Local UI intent can disappear; it is not authority to veto cleanup
        // for the recovery identity already validated in this adapter.
        cleanupIntentDurable = Boolean(progress ?? recoveryProgress.restore(recoveryOperation));
        const current = await getAuthenticatedUser();
        if (current.outcome !== "authenticated") return cleanupIntentDurable ? current : recoveryCleanupFailure(false);
        if (current.userId !== recoveryOperation.userId) return { outcome: "logout_failed" };
        if (progress?.phase === "complete") await discardRedirectSession();
        else {
          const { error } = await client.auth.signOut({ scope: "global" });
          if (error) return recoveryCleanupFailure(cleanupIntentDurable);
        }
        recoverySignOutConfirmed = true;
        validatedUserId = null;
        passwordSetupUserId = null;
      }
      const latest = recoveryProgress.read(recoveryOperation.userId);
      if (latest?.operationId === recoveryOperation.operationId) recoveryOperation = latest;
      const cleared = recoveryProgress.remove(recoveryOperation)
        || recoveryProgress.move(recoveryOperation, "complete");
      const remaining = recoveryProgress.read(recoveryOperation.userId);
      if (!cleared && (!remaining || remaining.operationId === recoveryOperation.operationId)) {
        return { outcome: "recovery_progress_cleanup_failed" };
      }
      recoveryOperation = null;
      recoverySignOutConfirmed = false;
      return { outcome: "signed_out" };
    } catch { return recoveryCleanupFailure(cleanupIntentDurable || recoverySignOutConfirmed); }
  }

  async function recoveryCleanupFailure(hasDurableIntent) {
    if (hasDurableIntent) return { outcome: "logout_failed" };
    await discardRedirectSession();
    return { outcome: "auth_progress_unavailable" };
  }

  async function establishPassword({ password }) {
    const expectedUserId = passwordSetupUserId;
    if (!expectedUserId) return { outcome: "unauthenticated" };
    let passwordSaved = false;
    let writeAttempted = false;
    try {
      const current = await getAuthenticatedUser();
      if (current.outcome !== "authenticated") return current;
      if (current.userId !== expectedUserId) {
        passwordSetupUserId = null;
        validatedUserId = null;
        return { outcome: "unauthenticated" };
      }
      if (passwordSetupPurpose === "recovery") {
        const pending = recoveryProgress.move(recoveryOperation, "write_pending");
        if (!pending) {
          recoveryProgress.remove(recoveryOperation);
          await discardRedirectSession();
          return { outcome: "auth_progress_unavailable" };
        }
        recoveryOperation = pending;
      }
      writeAttempted = true;
      const { data, error } = await client.auth.updateUser({ password });
      if (error) {
        if (error.status === 429) {
          if (!await restoreRecoverySetup()) return { outcome: "auth_progress_unavailable" };
          return { outcome: "auth_rate_limited" };
        }
        if (isUnavailable(error)) return uncertainPasswordChange();
        if (!await restoreRecoverySetup()) return { outcome: "auth_progress_unavailable" };
        if (isUnauthenticated(error)) return { outcome: "unauthenticated" };
        return { outcome: "password_rejected" };
      }
      passwordSaved = true;
      passwordSetupUserId = null;
      if (passwordSetupPurpose === "invite") removeAuthFragment(location, history);
      if (passwordSetupPurpose === "recovery") {
        recoveryOperation = recoveryProgress.move(recoveryOperation, "cleanup") ?? recoveryOperation;
      }
      const userId = data?.user?.id;
      const email = data?.user?.email;
      if (userId !== expectedUserId || !email) return savedButUnverified("auth_unavailable");
      const verification = await signIn({ email, password });
      if (verification.outcome !== "authenticated" || verification.userId !== userId) {
        validatedUserId = null;
        return savedButUnverified(verification.outcome === "authenticated" ? "auth_unavailable" : verification.outcome);
      }
      validatedUserId = userId;
      return { outcome: "password_established", userId };
    } catch {
      return passwordSaved ? savedButUnverified("auth_unavailable")
        : writeAttempted ? uncertainPasswordChange()
        : { outcome: "auth_unavailable" };
    }
  }

  async function restoreRecoverySetup() {
    if (passwordSetupPurpose !== "recovery") return true;
    const setup = recoveryProgress.move(recoveryOperation, "setup");
    if (!setup) {
      recoveryProgress.remove(recoveryOperation);
      await discardRedirectSession();
      return false;
    }
    recoveryOperation = setup;
    return true;
  }

  async function savedButUnverified(reason) {
    if (passwordSetupPurpose === "invite") await discardRedirectSession();
    return { outcome: "password_saved_signin_failed", reason };
  }

  async function uncertainPasswordChange() {
    passwordSetupUserId = null;
    if (passwordSetupPurpose === "invite") {
      removeAuthFragment(location, history);
      await discardRedirectSession();
    }
    return { outcome: "password_change_uncertain" };
  }

  async function signIn({ email, password }) {
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.code === "email_provider_disabled") return { outcome: "auth_configuration_error" };
        if (error.status === 429) return { outcome: "auth_rate_limited" };
        return error.code === "invalid_credentials" || (!error.code && error.status === 400)
          ? { outcome: "invalid_credentials" } : { outcome: "auth_unavailable" };
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
    const current = await getAuthenticatedUser();
    return current.outcome === "authenticated" && pendingRecoveryProgress(current.userId)
      ? { outcome: "password_completion_required" } : current;
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
      if (userId && pendingRecoveryProgress(userId)) return { outcome: "password_completion_required" };
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
    if (pendingRecoveryProgress(validatedUserId)) return { outcome: "account_denied" };

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
    return callProtectedRpc("student_active_assignments_v1", (data) => {
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
    return callProtectedRpc("student_practice_generation_v1", (data) =>
      data?.contractVersion === 1 && data.outcome === "generation"
        && Number.isSafeInteger(data.credentialGeneration)
        && data.credentialGeneration > 0
        ? { outcome: "generation_loaded", credentialGeneration: data.credentialGeneration }
        : null);
  }

  async function readWeeklySummary() {
    return callProtectedRpc("student_weekly_summary_v1", (data) =>
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
      if (userId && pendingRecoveryProgress(userId)) return { outcome: "password_completion_required" };
      return typeof userId === "string" && userId
        ? { outcome: "authenticated", userId }
        : { outcome: "unauthenticated" };
    } catch {
      return { outcome: "auth_unavailable" };
    }
  }

  async function readTeacherStudents() {
    return callProtectedRpc("teacher_students_practice_v1", (data) => decodeTeacherPractice(data));
  }

  async function readTeacherStudent(studentId) {
    return callProtectedRpc("teacher_student_practice_v1", (data) => decodeTeacherPractice(data, studentId),
      { target_student_id: studentId });
  }

  async function resolveWorkspace() {
    // Role-protected RPCs are the authority, never Auth metadata or storage.
    const teacher = await readTeacherStudents();
    if (teacher.outcome === "teacher_practice_loaded") return { outcome: "workspace", workspace: "teacher" };
    if (teacher.outcome !== "account_denied") return teacher;
    const student = await readPracticeGeneration();
    return student.outcome === "generation_loaded"
      ? { outcome: "workspace", workspace: "student" } : student;
  }

  async function readTeacherNotes(studentId) {
    return callProtectedRpc("teacher_student_notes_v1", (data) => decodeTeacherNotes(data, studentId),
      { target_student_id: studentId });
  }

  async function publishTeacherNotes(studentId, requestId, notes) {
    return callProtectedRpc("teacher_publish_notes_v1", decodeNotePublication, {
      target_student_id: studentId, request_id: requestId,
      note_1: notes.note1, note_2: notes.note2, note_3: notes.note3,
    });
  }

  async function callProtectedRpc(name, decode, args) {
    if (!validatedUserId) {
      const auth = await getAuthenticatedUser();
      if (auth.outcome !== "authenticated") return auth;
    }
    if (pendingRecoveryProgress(validatedUserId)) return { outcome: "account_denied" };
    try {
      const { data, error, status } = await client.rpc(name, args);
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
    if (pendingRecoveryProgress(validatedUserId)) return { outcome: "account_denied" };
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

  async function signOut({ scope = "local" } = {}) {
    if (!["local", "global"].includes(scope)) return { outcome: "logout_failed" };
    try {
      const { error } = await client.auth.signOut({ scope });
      if (error) return { outcome: "logout_failed" };
      validatedUserId = null;
      passwordSetupUserId = null;
      return { outcome: "signed_out" };
    } catch {
      return { outcome: "logout_failed" };
    }
  }

  async function discardRedirectSession() {
    validatedUserId = null;
    passwordSetupUserId = null;
    pendingAuthFragment = "";
    redirectDiscard ??= (async () => {
      try {
        await initialSession;
        await client.auth.signOut({ scope: "local" });
      } catch { /* Discard local state even if server-aware sign-out fails. */ }
      finally {
        try { storage.removeItem(storageKey); } catch { /* Storage may have been revoked after setup. */ }
      }
    })();
    return redirectDiscard;
  }

  function pendingRecoveryProgress(userId) {
    const progress = recoveryProgress.read(userId)
      ?? (recoveryOperation?.userId === userId ? recoveryOperation : null);
    return progress?.phase === "complete" ? null : progress;
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
  const type = fragment.get("type");
  return type === "invite" || type === "recovery" ? type : "unsupported";
}

function removeAuthFragment(location, history) {
  if (!location?.href || typeof history?.replaceState !== "function") return;
  const clean = new URL(location.href);
  clean.hash = "";
  history.replaceState(null, "", clean.href);
}

function waitForInitialSession(client, timeoutMs, redirect, onRecovery) {
  // Keep the resolved state live: a timeout is not evidence that the SDK will
  // never finish exchanging a link. Retry can observe its eventual Auth event.
  const state = { receivedEvent: false, recoveryUserId: null, recoveryPending: redirect === "recovery" };
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(state);
    };
    const timer = setTimeout(finish, timeoutMs);
    client.auth.onAuthStateChange((event, session) => {
      state.receivedEvent = true;
      if (event === "PASSWORD_RECOVERY") {
        state.recoveryUserId = session?.user?.id ?? null;
        onRecovery(state.recoveryUserId);
        state.recoveryPending = false;
        finish();
      }
      // The SDK schedules PASSWORD_RECOVERY after initialization; INITIAL_SESSION
      // may arrive first. A stored session cannot substitute for the recovery event.
      else if (redirect !== "recovery" || event === "SIGNED_OUT") {
        state.recoveryPending = false;
        finish();
      }
    });
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
    if (["invite", "recovery"].includes(redirect)) return { outcome, retry: "reload" };
    if (redirect !== "none") removeAuthFragment(location, history);
    return { outcome };
  };
  return Object.freeze({
    acceptInvitation,
    establishPassword: failure,
    resumePasswordRecovery: failure,
    completePasswordRecovery: failure,
    readStudent: failure,
    readAssignments: failure,
    readPracticeGeneration: failure,
    readWeeklySummary: failure,
    readTeacherStudents: failure,
    readTeacherStudent: failure,
    readTeacherNotes: failure,
    publishTeacherNotes: failure,
    resolveWorkspace: failure,
    sessionIdentity: failure,
    ingestPractice: failure,
    refresh: failure,
    signIn: failure,
    signOut: failure,
    validateCurrentUser: failure,
  });
}
