import { test, expect } from "@playwright/test";
import { serveSite } from "./site.js";
import { mockAdapter } from "./teacher-fixture.js";

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

test("a recovery URL with only an ordinary stored session cannot expose password setup", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { initialSessionTimeoutMs: 50 });
    await page.goto(`${site.origin}/login/#type=recovery&access_token=synthetic-only`);
    await expect(page.locator("#login-error")).toContainText("fresh link");
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(new URL(page.url()).hash).toBe("");
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
