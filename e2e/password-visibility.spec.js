import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { serveSite } from "./site.js";
import { mockAdapter } from "./teacher-fixture.js";

test("Show password checked while Auth is loading remains effective once Login is ready", async ({ page }) => {
  const site = await serveSite();
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  try {
    await mockAdapter(page, { userId: null });
    await page.route("**/login/supabase.js*", async route => { await ready; await route.fallback(); });
    await page.goto(`${site.origin}/login/`, { waitUntil: "commit" });
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("Visibility-probe-Aa7!");
    // WebKit's animation-frame stability checks wait for the deliberately held
    // module; the native checkbox itself is already visible and interactive.
    await page.getByLabel("Show password", { exact: true }).check({ force: true });
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
    await expect(page.getByLabel("Show password", { exact: true })).toBeChecked();
    await expect(password).toHaveAttribute("type", "text");
  } finally { release(); await site.close(); }
});

test("invitation visibility follows a checkbox restored checked before initialization", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page);
    const html = (await readFile("docs/login/index.html", "utf8"))
      .replace('id="show-new-password" type="checkbox"', 'id="show-new-password" type="checkbox" checked');
    await page.route(`${site.origin}/login/`, route => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto(`${site.origin}/login/#type=invite&access_token=synthetic-only`);
    const password = page.getByLabel("New password", { exact: true });
    await password.fill("Visibility-probe-Aa7!");
    await expect(page.getByLabel("Show new password", { exact: true })).toBeChecked();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByLabel("Confirm new password", { exact: true })).toHaveAttribute("type", "text");
  } finally { await site.close(); }
});

for (const purpose of ["signin", "invite"]) {
  test(`${purpose} Show password reveals typed text and can hide it again`, async ({ page }) => {
    const site = await serveSite();
    try {
      await mockAdapter(page, purpose === "signin" ? { userId: null } : {});
      await page.goto(`${site.origin}/login/${purpose === "invite" ? "#type=invite&access_token=synthetic-only" : ""}`);
      const password = page.getByLabel(purpose === "invite" ? "New password" : "Password", { exact: true });
      const checkbox = page.getByLabel(purpose === "invite" ? "Show new password" : "Show password", { exact: true });
      await password.fill("Visibility-probe-Aa7!");
      if (purpose === "invite") await page.getByLabel("Confirm new password", { exact: true }).fill("Visibility-probe-Aa7!");
      await checkbox.check();
      await expect(password).toHaveAttribute("type", "text");
      expect(await password.evaluate(input => getComputedStyle(input).webkitTextSecurity)).toBe("none");
      if (purpose === "invite") await expect(page.getByLabel("Confirm new password", { exact: true })).toHaveAttribute("type", "text");
      await checkbox.uncheck();
      await expect(password).toHaveAttribute("type", "password");
      await expect(password).toHaveValue("Visibility-probe-Aa7!");
      await checkbox.evaluate(input => { input.checked = true; });
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      await expect(password).toHaveAttribute("type", "text");
      await checkbox.uncheck();
      await expect(password).toHaveAttribute("type", "password");
    } finally { await site.close(); }
  });
}
