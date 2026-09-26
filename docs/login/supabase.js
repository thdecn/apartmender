export const supabaseUrl = "https://jxhxerchsxonsgmqsatd.supabase.co";
export const supabasePublishableKey = "sb_publishable_EpjtZdFoQ2x4KPLyTLRS-A_2J_vQ5Gv";

const sessionKey = "apartmender-session";

export function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey) ?? "null");
    if (!session?.accessToken) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
}

export function adoptInviteFromUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  if (!accessToken) {
    const description = hash.get("error_description");
    return description ? { error: description } : null;
  }
  const session = {
    accessToken,
    refreshToken: hash.get("refresh_token"),
    mustSetPassword: hash.get("type") === "invite",
  };
  saveSession(session);
  const clean = new URL(window.location.href);
  clean.hash = "";
  window.history.replaceState(null, "", clean.href);
  return { session };
}

export async function signIn(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, invalid: body.error_code === "invalid_credentials" };
  }
  return {
    ok: true,
    session: {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      mustSetPassword: false,
    },
  };
}

export async function updatePassword(session, password) {
  const response = await authorized(session, (token) =>
    fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    }),
  );
  if (response.status === 401) return { ok: false, signedOut: true };
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false, message: body.msg || body.message || "" };
  }
  saveSession({ ...readSession(), mustSetPassword: false });
  return { ok: true };
}

export async function loadOwnStudent(session) {
  const response = await authorized(session, (token) =>
    fetch(`${supabaseUrl}/rest/v1/students?select=name,piece_1,teacher_note_1&limit=1`, {
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }),
  );
  if (response.status === 401) return { status: "signed_out" };
  if (!response.ok) return { status: "error" };
  const rows = await response.json();
  return { status: "ok", student: rows[0] ?? null };
}

async function authorized(session, send) {
  let response = await send(session.accessToken);
  if (response.status !== 401 || !session.refreshToken) return response;
  const refreshed = await refreshSession(session.refreshToken);
  if (!refreshed) return response;
  const next = { ...readSession(), ...refreshed };
  saveSession(next);
  session.accessToken = next.accessToken;
  session.refreshToken = next.refreshToken;
  return send(next.accessToken);
}

async function refreshSession(refreshToken) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  if (!body.access_token) return null;
  return { accessToken: body.access_token, refreshToken: body.refresh_token ?? refreshToken };
}
