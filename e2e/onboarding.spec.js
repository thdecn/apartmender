import { test, expect } from "@playwright/test";
import { serveSite } from "./site.js";
import { mockAdapter } from "./teacher-fixture.js";

test("cached legacy HTML can use new modules for sign-in and confirmed password setup", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { userId: null });
    await page.route(`${site.origin}/login/`, route => route.fulfill({ contentType: "text/html", body: `
      <!doctype html><html><body><main>
      <form id="login-form"><label for="email">Email</label><input id="email" name="email" type="email" required>
      <label for="password">Password</label><input id="password" name="password" type="password" required>
      <button type="submit" disabled>Continue</button><p id="login-error"></p></form>
      <p id="invite-account" hidden></p><form id="invite-form" hidden>
      <label for="invite-password">New password</label><input id="invite-password" name="password" type="password" required>
      <button type="submit" disabled>Save password</button><p id="invite-error"></p></form>
      </main><script type="module" src="./login.js"></script></body></html>` }));
    await page.goto(`${site.origin}/login/`);
    await page.getByLabel("Email", { exact: true }).fill("teacher@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("Local-test-password");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
    await page.goto(`${site.origin}/login/#type=invite&access_token=synthetic-only`);
    await page.getByLabel("New password", { exact: true }).fill("Local-test-password");
    await page.getByLabel("Confirm new password", { exact: true }).fill("Mismatch-password");
    await page.getByRole("button", { name: "Save password", exact: true }).click();
    await expect(page.locator("#invite-error")).toContainText("do not match");
    await page.getByLabel("Confirm new password", { exact: true }).fill("Local-test-password");
    await page.getByRole("button", { name: "Save password", exact: true }).click();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
  } finally { await site.close(); }
});

test("the release entrypoint and Auth module chain bypass cached unversioned scripts", async ({ page }) => {
  const site = await serveSite();
  const staleLoads = [];
  const requested = new Set();
  try {
    for (const filename of ["login.js", "supabase.js", "browser-data.js"]) {
      await page.route(`${site.origin}/login/${filename}`, route => {
        staleLoads.push(filename);
        return route.fulfill({ contentType: "text/javascript", body: 'throw new Error("Cached legacy module loaded")' });
      });
    }
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm", route => route.fulfill({
      contentType: "text/javascript", body: `export function createClient() { return { auth: {
        onAuthStateChange(callback) { queueMicrotask(() => callback('INITIAL_SESSION', null)); },
        getUser: async () => ({data:{user:null},error:{status:401}})
      } }; }`,
    }));
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.searchParams.get("auth") === "operator-onboarding-v1") requested.add(url.pathname.split("/").pop());
    });
    await page.goto(`${site.origin}/login/`);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
    expect(staleLoads).toEqual([]);
    expect([...requested].sort()).toEqual(["browser-data.js", "login.js", "recovery-progress.js", "supabase.js"]);
  } finally { await site.close(); }
});

test("a failed CDN import preserves recovery and Reload page retries with a fresh adapter", async ({ page }) => {
  const site = await serveSite();
  let unavailable = true;
  try {
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm", route => unavailable
      ? route.abort()
      : route.fulfill({ contentType: "text/javascript", body: `export function createClient() { return { auth: {
        onAuthStateChange(callback) { queueMicrotask(() => callback('PASSWORD_RECOVERY', {user:{id:'recovery-user'}})); },
        getUser: async () => ({data:{user:{id:'recovery-user'}}})
      } }; }` }));
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    await expect(page.getByRole("button", { name: "Reload page" })).toBeVisible();
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(new URL(page.url()).hash).not.toBe("");
    unavailable = false;
    await page.getByRole("button", { name: "Reload page" }).click();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
  } finally { await site.close(); }
});

test("Practice hands recovery and invitation setup to Login without discarding their sessions", async ({ browser }) => {
  const site = await serveSite();
  try {
    for (const purpose of ["recovery", "invite"]) {
      const page = await browser.newPage();
      await mockAdapter(page, { authEvent: purpose === "recovery" ? "PASSWORD_RECOVERY" : "INITIAL_SESSION", sdkClearsFragment: true });
      await page.goto(`${site.origin}/login/practice/#type=${purpose}&access_token=synthetic-only`);
      await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
      await expect(page).toHaveURL(`${site.origin}/login/`);
      expect(await page.evaluate(() => window.teacherTest.userId)).toBe("teacher-a");
      await page.close();
    }
  } finally { await site.close(); }
});

test("pending Practice recovery survives SDK fragment cleanup before the delayed event", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { authEvent: "PASSWORD_RECOVERY", authEventDelayMs: 200,
      initialSessionTimeoutMs: 20, sdkClearsFragment: true });
    await page.goto(`${site.origin}/login/practice/#type=recovery&access_token=synthetic-only`);
    await expect(page.getByRole("button", { name: "Retry verification" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('-recovery-')).length)).toBe(1);
    await page.getByRole("button", { name: "Retry verification" }).click();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${site.origin}/login/`);
    expect(await page.evaluate(() => window.teacherTest.userId)).toBe("teacher-a");
  } finally { await site.close(); }
});

test("Practice invitation setup survives a validation outage during handoff and at Login", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { validationFailures: 1, sdkClearsFragment: true });
    await page.goto(`${site.origin}/login/practice/#type=invite&access_token=synthetic-only`);
    await expect(page.getByRole("button", { name: "Retry verification" })).toBeVisible();
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(new URL(page.url()).pathname).toBe("/login/");
    expect(new URL(page.url()).hash).not.toBe("");
    await page.getByRole("button", { name: "Retry verification" }).click();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${site.origin}/login/`);
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBeUndefined();
  } finally { await site.close(); }
});

test("revoked tab storage still exposes sign-in after uncertain invitation setup", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { passwordWriteResponseLost: true, authStorageRemovalBlocked: true });
    await page.goto(`${site.origin}/login/#type=invite&access_token=synthetic-only`);
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("Local-test-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.locator("#login-form")).toBeVisible();
    await expect(page.locator("#invite-account")).toContainText("Could not confirm the password change");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  } finally { await site.close(); }
});

test("verified password setup retries workspace loading without another password write", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { error: "XX000" });
    await page.goto(`${site.origin}/login/#type=invite&access_token=synthetic-only`);
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("Local-test-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByRole("button", { name: "Retry workspace" })).toBeVisible();
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBe(1);
    await page.evaluate(() => { window.teacherTest.error = null; });
    await page.getByRole("button", { name: "Retry workspace" }).click();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
  } finally { await site.close(); }
});

test("recovery validation retries after a transient service failure", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { authEvent: "PASSWORD_RECOVERY", validationFailures: 1 });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    await expect(page.getByRole("button", { name: "Retry verification" })).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    await page.getByRole("button", { name: "Retry verification" }).click();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBeUndefined();
  } finally { await site.close(); }
});

test("unavailable recovery storage discards the session before any password write", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { authEvent: "PASSWORD_RECOVERY", recoveryStorageUnavailable: true });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    await expect(page.locator("#login-error")).toContainText("Allow site storage");
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(await page.evaluate(() => window.teacherTest.userId)).toBeNull();
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBeUndefined();
  } finally { await site.close(); }
});

test("rate-limited recovery writes retain the session and form for a successful retry", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { authEvent: "PASSWORD_RECOVERY", passwordWriteRateLimits: 1 });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("New-local-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.locator("#invite-error")).toContainText("retry Save password");
    await expect(page.locator("#invite-form")).toBeVisible();
    expect(await page.evaluate(() => window.teacherTest.signOutScopes)).toBeUndefined();
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBeUndefined();
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.locator("#invite-account")).toContainText("Password reset complete");
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBe(1);
  } finally { await site.close(); }
});

test("ordinary unavailable-Auth Student entry preserves the offline summary fallback", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { role: "Student", validationFailures: 1 });
    await page.goto(`${site.origin}/login/practice/`);
    await expect(page.locator("#weekly-summary-link")).toBeVisible();
    await expect(page).toHaveURL(`${site.origin}/login/practice/`);
  } finally { await site.close(); }
});

test("saved-but-unverified invitation cannot reuse its old session after reload", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { signInError: { status: 503 }, signOutFailures: 1 });
    await page.goto(`${site.origin}/login/#type=invite&access_token=synthetic-only`);
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("Local-test-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.locator("#invite-account")).toContainText("Your password was saved");
    await page.reload();
    await expect(page.locator("#login-form")).toBeVisible();
    await expect(page).toHaveURL(`${site.origin}/login/`);
    expect(await page.evaluate(() => window.teacherTest.userId)).toBeNull();
  } finally { await site.close(); }
});

test("pending recovery cleanup survives reload and gates direct workspace entry", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { authEvent: "PASSWORD_RECOVERY", signOutFailures: 1 });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("New-local-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByRole("button", { name: "Retry sign-out" })).toBeVisible();
    for (const path of ["/login/", "/login/teacher/", "/login/practice/", "/login/practice/weekly-summary/"]) {
      await page.goto(`${site.origin}${path}`);
      await expect(page).toHaveURL(`${site.origin}/login/`);
      await expect(page.getByRole("button", { name: "Retry sign-out" })).toBeVisible();
      expect(await page.evaluate(() => window.teacherTest.signOutScopes)).toEqual(["global"]);
      expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBeUndefined();
    }
    await page.getByRole("button", { name: "Retry sign-out" }).click();
    await expect(page.locator("#invite-account")).toContainText("Your password was saved");
    await expect(page.locator("#login-form")).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('-recovery-')))).toEqual([]);
  } finally { await site.close(); }
});

test("an uncertain invitation write offers working sign-in without another password save", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { passwordWriteResponseLost: true });
    await page.goto(`${site.origin}/login/#type=invite&access_token=synthetic-only`);
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("Local-test-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.locator("#invite-account")).toContainText("Could not confirm the password change");
    await expect(page.locator("#invite-form")).toBeHidden();
    await expect(page.locator("#login-form")).toBeVisible();
    expect(await page.evaluate(() => window.teacherTest.userId)).toBeNull();
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBe(1);
    await page.reload();
    await expect(page.locator("#login-form")).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill("teacher@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("Local-test-password");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
  } finally { await site.close(); }
});

test("password confirmation and visibility prevent saving an unintended password", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page);
    await page.goto(`${site.origin}/login/#type=invite&access_token=synthetic-only`);
    await page.getByLabel("New password", { exact: true }).fill("Local-test-password");
    await page.getByLabel("Confirm new password", { exact: true }).fill("Different-password");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.locator("#invite-error")).toContainText("do not match");
    expect(await page.evaluate(() => window.teacherTest.passwordChanged)).toBeUndefined();
    await page.getByLabel("Show new password", { exact: true }).check();
    await expect(page.locator("#invite-password")).toHaveAttribute("type", "text");
    await expect(page.locator("#invite-password-confirm")).toHaveAttribute("type", "text");
    await page.getByLabel("Confirm new password", { exact: true }).fill("Local-test-password");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
  } finally { await site.close(); }
});

test("validated recovery replaces the password, globally signs out, then requires normal sign-in", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { authEvent: "PASSWORD_RECOVERY" });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    await expect(page.locator("#invite-account")).toContainText("Reset link accepted");
    expect(new URL(page.url()).hash).toBe("");
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("New-local-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.locator("#invite-account")).toContainText("Password reset complete");
    await expect(page.locator("#login-form")).toBeVisible();
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(await page.evaluate(() => window.teacherTest.signOutScopes)).toEqual(["global"]);
    await page.getByLabel("Email", { exact: true }).fill("teacher@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("New-local-password");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
  } finally { await site.close(); }
});

test("a recovery URL waits for a late event and can retry after the initialization timeout", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { initialSessionTimeoutMs: 50 });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    await expect(page.getByRole("button", { name: "Retry verification" })).toBeVisible();
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(new URL(page.url()).hash).not.toBe("");
    await page.evaluate(() => window.teacherTest.authEventCallback("PASSWORD_RECOVERY", { user: { id: window.teacherTest.userId } }));
    await page.getByRole("button", { name: "Retry verification" }).click();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
  } finally { await site.close(); }
});

test("a late recovery event survives reload before Retry after the SDK cleans its URL", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { initialSessionTimeoutMs: 50 });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    await expect(page.getByRole("button", { name: "Retry verification" })).toBeVisible();
    await page.evaluate(() => {
      history.replaceState(null, "", location.pathname);
      window.teacherTest.authEventCallback("PASSWORD_RECOVERY", { user: { id: window.teacherTest.userId } });
    });
    await page.reload();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${site.origin}/login/`);
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBeUndefined();
  } finally { await site.close(); }
});

test("expired or rejected email links remove private error details and offer a fresh-link path", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page);
    await page.goto(`${site.origin}/login/#error=access_denied&error_code=otp_expired&error_description=private-error-text`);
    await expect(page.locator("#login-error")).toContainText("fresh link");
    await expect(page.locator("#login-error")).not.toContainText("private-error-text");
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(new URL(page.url()).hash).toBe("");
  } finally { await site.close(); }
});

test("a failed recovery sign-out can be retried without rewriting the saved password", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { authEvent: "PASSWORD_RECOVERY", signOutFailures: 1 });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("New-local-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByRole("button", { name: "Retry sign-out" })).toBeVisible();
    await page.getByRole("button", { name: "Retry sign-out" }).click();
    await expect(page.locator("#invite-account")).toContainText("Password reset complete");
    expect(await page.evaluate(() => window.teacherTest.passwordChanges)).toBe(1);
    expect(await page.evaluate(() => window.teacherTest.signOutScopes)).toEqual(["global", "global"]);
  } finally { await site.close(); }
});

test("saved-but-unverified setup is distinguished from rejecting the password", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { signInError: { status: 503 } });
    await page.goto(`${site.origin}/login/#type=invite&access_token=synthetic-only`);
    for (const label of ["New password", "Confirm new password"]) {
      await page.getByLabel(label, { exact: true }).fill("Local-test-password");
    }
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.locator("#invite-account")).toContainText("Your password was saved");
    await expect(page.locator("#login-form")).toBeVisible();
    await expect(page.locator("#invite-password")).toHaveValue("");
  } finally { await site.close(); }
});

test("configuration and throttling errors have actionable sign-in messages", async ({ browser }) => {
  const site = await serveSite();
  try {
    for (const [error, message] of [[{ status: 422, code: "email_provider_disabled" }, "not configured"],
      [{ status: 429 }, "Too many sign-in attempts"]]) {
      const page = await browser.newPage();
      await mockAdapter(page, { userId: null, signInError: error });
      await page.goto(`${site.origin}/login/`);
      await page.getByLabel("Email", { exact: true }).fill("teacher@example.invalid");
      await page.getByLabel("Password", { exact: true }).fill("Local-test-password");
      await page.getByLabel("Show password", { exact: true }).check();
      await expect(page.locator("#password")).toHaveAttribute("type", "text");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.locator("#login-error")).toContainText(message);
      await page.close();
    }
  } finally { await site.close(); }
});
