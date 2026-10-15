import { test, expect } from "@playwright/test";
import { createLocalTeacherFixture } from "../test/local-supabase-fixture.js";
import { serveSite } from "./site.js";

test("real local Teacher JWT scopes dashboard/detail, role routing, activation, and Student isolation", async ({ browser }) => {
  const fixture = await createLocalTeacherFixture();
  const site = await serveSite();
  const { TeacherA: a, TeacherB: b, Administrator: admin, OtherStudent: other } = fixture.identities;
  const seeded = await fetch(`${fixture.config.projectUrl}/rest/v1/rpc/teacher_publish_notes_v1`, {
    method: "POST", headers: { apikey: fixture.config.publishableKey,
      Authorization: `Bearer ${a.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_student_id: fixture.userId,
      request_id: "d5000000-0000-4000-8000-000000000001",
      note_1: "  Current Student-visible note  ", note_2: "Optional two", note_3: null }),
  });
  expect(seeded.status).toBe(200);
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
    await expect(page.getByLabel("Note 1 (required)")).toHaveValue("  Current Student-visible note  ");
    await expect(page.locator("#previous-period")).toHaveText("No completed note period yet.");
    const homePage = await signIn(fixture.session);
    await expect(homePage).toHaveURL(/\/login\/practice\/$/);
    await expect(homePage.locator("#comments-list")).toContainText("Current Student-visible note");
    const attempts = [];
    let loseAcknowledgement = true;
    await page.route("**/rest/v1/rpc/teacher_publish_notes_v1", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts.push(route.request().postDataJSON());
      const response = await route.fetch();
      if (loseAcknowledgement) { loseAcknowledgement = false; await route.abort("failed"); }
      else await route.fulfill({ response });
    });
    await page.getByLabel("Note 1 (required)").fill("Local published <b>text</b> 你好");
    expect(fixture.query(`select teacher_note_1 from public.students where id='${fixture.userId}'`)).toBe("Current Student-visible note");
    await expect(homePage.locator("#comments-list")).not.toContainText("Local published");
    await page.getByRole("button", { name: "Update", exact: true }).click();
    await expect(page.locator("#note-status")).toContainText("Could not confirm");
    await expect(page.getByLabel("Note 1 (required)")).toHaveValue("Local published <b>text</b> 你好");
    await page.getByRole("button", { name: "Update", exact: true }).click();
    await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
    expect(fixture.query(`select count(*) from app_private.student_note_publications where request_id='${attempts[0].request_id}'`)).toBe("1");
    await homePage.reload();
    await expect(homePage.locator("#comments-list")).toContainText("Local published <b>text</b> 你好");
    await expect(homePage.locator("#comments-list b")).toHaveCount(0);
    await page.getByLabel("Note 2 (optional)").fill("");
    await page.getByLabel("Note 3 (optional)").fill("");
    await page.getByRole("button", { name: "Update", exact: true }).click();
    await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    expect(attempts[2].request_id).not.toBe(attempts[0].request_id);
    await homePage.reload();
    await expect(homePage.locator("#comments-list")).not.toContainText("Optional two");
    await page.getByLabel("Note 1 (required)").fill("Old Teacher private unsaved draft");
    fixture.query(`update public.students set teacher_id='${b.id}' where id='${fixture.userId}'`);
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.locator("#teacher-status")).toContainText("unavailable");
    await expect(page.locator("#teacher-content")).toBeHidden();
    expect(await page.getByLabel("Note 1 (required)").inputValue()).toBe("");
    await homePage.reload(); await expect(homePage.locator("#comments-section")).toBeHidden();
    const newTeacherPage = await signIn(b.session);
    await expect(newTeacherPage).toHaveURL(/\/login\/teacher\/$/);
    await newTeacherPage.getByRole("link", { name: "Integration Student", exact: true }).click();
    await expect(newTeacherPage.getByLabel("Note 1 (required)")).toHaveValue("");
    await expect(newTeacherPage.locator("#previous-period")).toHaveText("No completed note period yet.");
    await newTeacherPage.close(); await homePage.close();
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
