import { test, expect } from "@playwright/test";
import { createLocalOnboardingTeacher } from "../test/local-auth-fixture.js";
import { serveSite } from "./site.js";

test("real local invitation, password verification, operator activation and recovery preserve Teacher access", async ({ browser }) => {
  test.setTimeout(60_000);
  const site = await serveSite({ port: 8080 });
  let fixture;
  let context;
  try {
    fixture = await createLocalOnboardingTeacher(`${site.origin}/login/`);
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    async function openAuthLink(link) {
      // Never include a credential-bearing link in an error or test output.
      try { await page.goto(link); } catch { throw new Error("Local Auth link navigation failed"); }
      await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
      expect(new URL(page.url()).hash).toBe("");
    }
    async function savePassword(password) {
      await page.getByLabel("New password", { exact: true }).fill(password);
      await page.getByLabel("Confirm new password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Save password", exact: true }).click();
    }
    async function signIn(password) {
      await page.getByLabel("Email", { exact: true }).fill(fixture.email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    }
    await openAuthLink(fixture.invitationLink);
    await savePassword(fixture.password);
    await expect(page.locator("#invite-error")).toContainText("Password saved and verified");
    await expect(page.locator("#invite-error")).toContainText("no active workspace");
    fixture.activate();
    await page.reload();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
    await expect(page.getByRole("link", { name: "Local Onboarding Student", exact: true })).toBeVisible();
    await page.locator("#teacher-logout").click();
    await expect(page).toHaveURL(`${site.origin}/login/`);
    await signIn(fixture.password);
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
    await page.locator("#teacher-logout").click();
    await expect(page).toHaveURL(`${site.origin}/login/`);
    const recoveryLink = await fixture.recoveryLink();
    await openAuthLink(recoveryLink);
    await expect(page.locator("#invite-account")).toContainText("Reset link accepted");
    await savePassword(fixture.replacementPassword);
    await expect(page.locator("#invite-account")).toContainText("Password reset complete");
    await expect(page.locator("#login-form")).toBeVisible();
    await signIn(fixture.password);
    await expect(page.locator("#login-error")).toHaveText("Email or password is incorrect.");
    await signIn(fixture.replacementPassword);
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
    await expect(page.getByRole("link", { name: "Local Onboarding Student", exact: true })).toBeVisible();
    expect(await fixture.passwordStatus(fixture.password)).toEqual({ status: 400, code: "invalid_credentials" });
    await page.locator("#teacher-logout").click();
    await expect(page).toHaveURL(`${site.origin}/login/`);
    try { await page.goto(recoveryLink); } catch { throw new Error("Reused local link navigation failed"); }
    await expect(page.locator("#login-error")).toContainText("fresh link");
    await expect(page.locator("#invite-form")).toBeHidden();
    expect(new URL(page.url()).hash).toBe("");
  } finally {
    await context?.close();
    await fixture?.cleanup();
    await site.close();
  }
});
