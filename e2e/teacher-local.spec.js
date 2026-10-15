import { test, expect } from "@playwright/test";
import { createLocalTeacherFixture } from "../test/local-supabase-fixture.js";
import { serveSite } from "./site.js";

test("real local Teacher JWT scopes dashboard/detail, role routing, activation, and Student isolation", async ({ browser }) => {
  const fixture = await createLocalTeacherFixture();
  const site = await serveSite();
  const { TeacherA: a, TeacherB: b, Administrator: admin, OtherStudent: other } = fixture.identities;
  async function signIn(session) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route(/\/auth\/v1\/token\?grant_type=password/, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(session) });
    });
    await page.goto(`${site.origin}/login/`);
    await page.getByLabel("Email").fill(session.user.email);
    await page.getByLabel("Password", { exact: true }).fill("local-test-password");
    await page.getByRole("button", { name: "Continue" }).click();
    return page;
  }
  try {
    const page = await signIn(a.session);
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("link", { name: "Integration Student", exact: true })).toBeVisible();
    await expect(page.getByText("No current Pieces", { exact: true })).toBeVisible();
    await expect(page.getByText("Other Teacher Student", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No baseline yet", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Integration Student", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Integration Student");
    await expect(page.getByRole("table")).toBeVisible();
    await page.goto(`${site.origin}/login/teacher/student/?student=${other.id}`);
    await expect(page.locator("#teacher-status")).toContainText("unavailable");
    await expect(page.locator("#teacher-table")).toBeEmpty();
    for (const state of ["Disabled", "Required Password Change"]) {
      fixture.query(`update app_private.account_access set account_state='${state}' where auth_user_id='${a.id}'`);
      await page.goto(`${site.origin}/login/teacher/`);
      await expect(page.locator("#teacher-status")).toContainText("unavailable");
      await expect(page.locator("#teacher-table")).toBeEmpty();
    }
    expect(fixture.query(`select count(*) from public.students where id in ('${a.id}','${b.id}')`)).toBe("0");
    await page.close();
    const adminPage = await signIn(admin.session);
    await expect(adminPage.locator("#login-error")).toContainText("no active workspace");
    await expect(adminPage).toHaveURL(/\/login\/$/);
    await adminPage.goto(`${site.origin}/login/teacher/`);
    await expect(adminPage.locator("#teacher-status")).toContainText("unavailable");
    await expect(adminPage.locator("#teacher-table")).toBeEmpty();
    await adminPage.close();
    const studentPage = await signIn(fixture.session);
    await expect(studentPage).toHaveURL(/\/login\/practice\/$/);
    await expect(studentPage.getByRole("heading", { name: "Student Home" })).toBeVisible();
    await studentPage.goto(`${site.origin}/login/teacher/`);
    await expect(studentPage.locator("#teacher-status")).toContainText("unavailable");
    await expect(studentPage.locator("#teacher-table")).toBeEmpty();
    await studentPage.close();
  } finally { await site.close(); }
});
