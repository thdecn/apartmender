import { test, expect } from "@playwright/test";
import { serveSite } from "./site.js";
import { mockAdapter, notesResponse, response, studentId } from "./teacher-fixture.js";

const teacherId = "c1000000-0000-4000-8000-000000000001";
async function openDetail(page, origin, options = {}, mailbox = "admin+requests@example.invalid") {
  await mockAdapter(page, { userId: teacherId, loginId: teacherId, ...options });
  await page.route("**/teacher/teacher-config.js", (route) => route.fulfill({ contentType: "text/javascript",
    body: `export const administratorMailbox = ${JSON.stringify(mailbox)};` }));
  await page.goto(`${origin}/login/teacher/student/?student=${studentId}`);
}
const first = (page) => page.getByLabel("Note 1 (required)", { exact: true });
const update = (page) => page.getByRole("button", { name: "Update", exact: true });
const writes = (page) => page.evaluate(() => window.teacherTest.publications);

test("detail shows lesson, scoped metrics, frozen read-only history, raw prefilled drafts, and a mail draft", async ({ page }) => {
  const site = await serveSite();
  try {
    const data = response();
    Object.assign(data.students[0].schedule, { hasLesson: true, lessonStartDay: "wednesday", lessonStartTime: "16:30:00" });
    data.students[0].completedWeek.kind = "lesson";
    await page.setViewportSize({ width: 1440, height: 1100 });
    await openDetail(page, site.origin, { response: data });
    await expect(first(page)).toHaveValue(notesResponse().currentNotes.note1);
    await expect(page.locator("#lesson-info")).toHaveText("Lesson: Wednesday at 16:30 (Europe/Brussels)");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("#previous-period")).toContainText("America/New_York");
    await expect(page.locator("#previous-notes")).toContainText("Earlier <script>text</script>");
    await expect(page.locator("#previous-notes script")).toHaveCount(0);
    await expect(page.locator("#previous-notes textarea")).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(3);
    await first(page).fill("  New <b>free text</b> 🎹\n你好  ");
    await page.getByLabel("Note 2 (optional)").fill("");
    expect(await writes(page)).toHaveLength(0);
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(first(page)).toHaveValue("  New <b>free text</b> 🎹\n你好  ");
    expect(await writes(page)).toHaveLength(0);
    const href = new URL(await page.getByRole("link", { name: "Admin Request", exact: true }).getAttribute("href"));
    expect(decodeURIComponent(href.pathname)).toBe("admin+requests@example.invalid");
    expect(href.searchParams.get("subject")).toBe("Apartmender Admin Request");
    expect(href.searchParams.get("body")).toBe(`Teacher Auth ID: ${teacherId}\n\nRequest:\n`);
    expect(href.href).not.toContain(studentId);
    await expect(page.locator("#admin-info")).toContainText("Review and send");
    await update(page).click();
    await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    const saved = await writes(page);
    expect(saved).toHaveLength(1); expect(saved[0]).toMatchObject({ target_student_id: studentId,
      note_1: "  New <b>free text</b> 🎹\n你好  ", note_2: "", note_3: "" });
    await expect(page.locator("#previous-notes")).toContainText("Earlier <script>text</script>");
    await page.evaluate(() => { document.body.scrollTop = 0; window.scrollTo(0, 0); });
    await page.screenshot({ path: test.info().outputPath("teacher-detail.png"), fullPage: true });
    await update(page).click();
    await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    const again = await writes(page);
    expect(again[1].request_id).not.toBe(again[0].request_id);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(["unrelated-sentinel"]);
  } finally { await site.close(); }
});

test("Unicode blank and overlength notes do not publish; optional slots can be cleared", async ({ page }) => {
  const site = await serveSite();
  try {
    await openDetail(page, site.origin);
    await expect(first(page)).toBeVisible();
    await first(page).fill("\u0085\u00a0\u2003\ufeff"); await update(page).click();
    await expect(page.locator("#note-status")).toContainText("non-whitespace");
    await first(page).fill("Valid"); await page.getByLabel("Note 3 (optional)").fill("🎹".repeat(4001));
    await update(page).click(); await expect(page.locator("#note-status")).toContainText("4,000");
    expect(await writes(page)).toHaveLength(0);
    await first(page).fill("🎹".repeat(4000));
    await page.getByLabel("Note 2 (optional)").fill(""); await page.getByLabel("Note 3 (optional)").fill("");
    await update(page).click(); await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    expect((await writes(page))[0].note_1).toHaveLength(8000);
  } finally { await site.close(); }
});

test("an unconfirmed publication retries its exact key/payload and rereads newer saved notes", async ({ page }) => {
  const site = await serveSite();
  try {
    await openDetail(page, site.origin, { dropAcknowledgement: true });
    await first(page).fill("Lost acknowledgement draft"); await update(page).click();
    await expect(page.locator("#note-status")).toContainText("Could not confirm");
    await expect(first(page)).toHaveValue("Lost acknowledgement draft");
    await page.evaluate(() => { window.teacherTest.noteData.currentNotes.note1 = "Newer saved by another tab"; });
    await update(page).click(); await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    const attempts = await writes(page);
    expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
    expect(await page.evaluate(() => Object.keys(window.teacherTest.receipts).length)).toBe(1);
    await expect(first(page)).toHaveValue("Newer saved by another tab");
  } finally { await site.close(); }
});

test("saved-but-unreadable, validation, and conflict outcomes retain the draft and allow recovery", async ({ page }) => {
  const site = await serveSite();
  try {
    await openDetail(page, site.origin);
    await first(page).fill("Retained draft");
    for (const outcome of ["invalid_notes", "idempotency_conflict"]) {
      await page.evaluate((value) => { window.teacherTest.publishOutcome = value; }, outcome);
      await update(page).click(); await expect(page.locator("#note-status")).toContainText(outcome === "invalid_notes" ? "rejected" : "conflicted");
      await expect(first(page)).toHaveValue("Retained draft");
    }
    await page.evaluate(() => { window.teacherTest.publishOutcome = null; window.teacherTest.noteReadUnavailable = true; });
    await update(page).click(); await expect(page.locator("#note-status")).toContainText("Notes saved, but");
    await expect(first(page)).toHaveValue("Retained draft");
    await page.evaluate(() => { window.teacherTest.noteReadUnavailable = false; });
    await update(page).click(); await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    const attempts = await writes(page);
    expect(attempts[0].request_id).not.toBe(attempts[1].request_id);
    expect(attempts[1].request_id).not.toBe(attempts[2].request_id);
    expect(attempts[2]).toEqual(attempts[3]);
  } finally { await site.close(); }
});

test("refresh preserves an unsaved draft through an outage, but a new assignment episode clears it", async ({ page }) => {
  const site = await serveSite();
  try {
    await openDetail(page, site.origin);
    await first(page).fill("Private old-episode draft");
    await page.evaluate(() => { window.teacherTest.noteReadUnavailable = true; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.locator("#teacher-status")).toContainText("Could not load");
    await expect(page.locator("#teacher-content")).toBeHidden();
    await page.evaluate(() => { window.teacherTest.noteReadUnavailable = false; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(first(page)).toHaveValue("Private old-episode draft");
    await page.evaluate(() => {
      Object.assign(window.teacherTest.noteData, { episodeId: "c3000000-0000-4000-8000-000000000002",
        currentNotes: { note1: null, note2: null, note3: null }, precedingPeriod: null });
    });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(first(page)).toHaveValue("");
    await expect(page.locator("#note-status")).toContainText("assignment changed");
    await expect(page.locator("#previous-period")).toHaveText("No completed note period yet.");
    await expect(page.locator("#previous-notes")).toBeEmpty();
  } finally { await site.close(); }
});

test("ownership loss during Update clears notes and late responses cannot restore them", async ({ page }) => {
  const site = await serveSite();
  try {
    await openDetail(page, site.origin, { holdPublish: true });
    await first(page).fill("Private pending draft"); await update(page).click();
    await expect.poll(() => page.evaluate(() => typeof window.teacherTest.releasePublish)).toBe("function");
    await expect(update(page)).toBeDisabled();
    await page.evaluate(() => { window.teacherTest.notesDenied = true; window.teacherTest.releasePublish(); });
    await expect(page.locator("#teacher-status")).toContainText("unavailable");
    await expect(page.locator("#teacher-content")).toBeHidden();
    expect(await first(page).inputValue()).toBe("");
    await expect(page.locator("#previous-notes")).toBeEmpty();
    await expect(page.locator("#teacher-table")).toBeEmpty();
  } finally { await site.close(); }
});

test("unconfigured or unsafe mailboxes have no mailto action and initial notes denial shows no private view", async ({ page }) => {
  const site = await serveSite();
  try {
    await openDetail(page, site.origin, {}, "");
    await expect(first(page)).toBeVisible();
    await expect(page.locator("#lesson-info")).toContainText("Calendar weeks begin Monday");
    await expect(page.locator("#admin-request")).toBeHidden();
    await expect(page.locator("#admin-info")).toHaveText("Admin contact is unavailable.");
    await page.evaluate(() => { window.teacherTest.notesDenied = true; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.locator("#teacher-status")).toContainText("Could not load");
    await expect(page.locator("#teacher-content")).toBeHidden();
    expect(await first(page).inputValue()).toBe("");
    await expect(page.locator("#previous-notes")).toBeEmpty();
  } finally { await site.close(); }
});

test("an uncertain session hides private data without discarding the draft or pending receipt", async ({ page }) => {
  const site = await serveSite();
  try {
    await openDetail(page, site.origin, { holdPublish: true });
    await first(page).fill("Retained during session outage"); await update(page).click();
    await expect.poll(() => page.evaluate(() => typeof window.teacherTest.releasePublish)).toBe("function");
    await page.evaluate(() => { window.teacherTest.sessionUnavailable = true; window.teacherTest.releasePublish(); });
    await expect(page.locator("#teacher-status")).toContainText("Could not verify");
    await expect(page.locator("#teacher-content")).toBeHidden();
    await page.evaluate(() => { window.teacherTest.sessionUnavailable = false; window.teacherTest.holdPublish = false; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(first(page)).toHaveValue("Retained during session outage");
    await update(page).click(); await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    const attempts = await writes(page); expect(attempts[0]).toEqual(attempts[1]);
  } finally { await site.close(); }
});

test("a Refresh snapshot captured before publication cannot overwrite the successful reread", async ({ page }) => {
  const site = await serveSite();
  let releaseCatalog;
  const heldCatalog = new Promise((done) => { releaseCatalog = done; });
  let captured = false;
  try {
    await openDetail(page, site.origin, { holdPublish: true });
    await expect(first(page)).toBeVisible();
    await page.route("**/pieces.json", async (route) => {
      if (!captured) { captured = true; await heldCatalog; }
      await route.continue();
    });
    await first(page).fill("Newest saved notes"); await update(page).click();
    await expect.poll(() => page.evaluate(() => typeof window.teacherTest.releasePublish)).toBe("function");
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect.poll(() => captured).toBe(true);
    await page.evaluate(() => { window.teacherTest.holdPublish = false; window.teacherTest.releasePublish(); });
    await expect(page.locator("#note-status")).toHaveText("Notes updated.");
    expect(await first(page).inputValue()).toBe("Newest saved notes");
    releaseCatalog();
    await expect(first(page)).toBeVisible();
    await expect(first(page)).toHaveValue("Newest saved notes");
    expect(await page.evaluate(() => window.teacherTest.noteData.currentNotes.note1)).toBe("Newest saved notes");
  } finally { releaseCatalog(); await site.close(); }
});
