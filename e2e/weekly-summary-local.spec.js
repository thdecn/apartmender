import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { createLocalPracticeStudent } from "../test/local-supabase-fixture.js";

const siteRoot = resolve("docs");

async function serveSite() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const path = resolve(siteRoot, `.${pathname}`,
      pathname.endsWith("/") ? "index.html" : "");
    if (!path.startsWith(`${siteRoot}${sep}`)) return response.writeHead(403).end();
    try {
      const bytes = await readFile(path);
      response.writeHead(200, { "Content-Type": {
        ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
        ".json": "application/json" }[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-store" }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done) => server.close(done)) };
}

test("Student summary reads local Sludge, retains a failed-refresh snapshot, and updates after an accepted upload",
  async ({ page }) => {
    test.setTimeout(60_000);
    const { userId, email, session, query } = await createLocalPracticeStudent();
    const site = await serveSite();
    try {
      const rpcResponses = [];
      page.on("response", async (response) => {
        if (response.url().includes("/rest/v1/rpc/")) {
          rpcResponses.push(`${new URL(response.url()).pathname}: ${response.status()} ${await response.text()}`);
        }
      });
      await page.route(/\/auth\/v1\/token\?grant_type=password/, (route) =>
        route.fulfill({ status: 200, contentType: "application/json",
          headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(session) }));
      await page.goto(`${site.origin}/login/`);
      await page.evaluate(async () => { await import("/login/login.js"); });
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill("local-test-password");
      await page.getByRole("button", { name: "Continue" }).click();
      try { await expect(page.getByRole("link", { name: "Weekly Summary" })).toBeVisible(); }
      catch { throw new Error(`Home summary link missing: ${rpcResponses.join("; ")}`); }
      let failRead = true;
      await page.route("**/rest/v1/rpc/student_weekly_summary_v1", async (route) => {
        if (failRead) await route.abort("failed");
        else await route.continue();
      });
      await page.getByRole("link", { name: "Weekly Summary" }).click();
      await expect(page.locator("#summary-status")).toHaveText(
        "Could not load your summary. Please reconnect.");
      await page.context().setOffline(true);
      await expect(page.locator("#summary-status")).toHaveText("Connect to view your Weekly Summary.");
      await page.context().setOffline(false);
      failRead = false;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.getByRole("heading", { name: /Practice for week/ })).toBeVisible();
      await expect(page.locator("#current-table tbody tr")).toHaveCount(7);
      await expect(page.locator("#empty-week")).toHaveText("No practice recorded yet this week");
      await expect(page.locator("#last-updated")).toContainText("Last updated");

      failRead = true;
      await page.reload();
      await expect(page.getByRole("heading", { name: /Practice for week/ })).toBeVisible();
      await expect(page.locator("#summary-status")).toHaveText(
        "Could not refresh. Showing your saved summary.");
      await page.context().setOffline(true);
      await expect(page.locator("#summary-status")).toHaveText("Offline. Showing your saved summary.");
      await page.context().setOffline(false);
      await expect(page.locator("#summary-status")).toHaveText(
        "Could not refresh. Showing your saved summary.");

      const eventId = await page.evaluate(async (id) => {
        const { browserData } = await import("/login/supabase.js");
        const { createSessionJournal } = await import("/login/practice/session-journal.js");
        const assignments = await browserData.readAssignments();
        const generation = await browserData.readPracticeGeneration();
        const ended = new Date();
        const started = new Date(ended.getTime() - 65_000);
        const eventId = crypto.randomUUID();
        const event = { eventVersion: 1, eventId,
          assignmentId: assignments.assignments[0].assignmentId,
          clientStartedAt: started.toISOString(), clientEndedAt: ended.toISOString(),
          durationSeconds: 60, credentialGeneration: generation.credentialGeneration };
        await createSessionJournal(indexedDB).change(id, (partition) => {
          partition.queue[eventId] = { event, pieceVersion: "test", state: "pending" };
        });
        return eventId;
      }, userId);
      failRead = false;
      let failUpload = true;
      await page.route("**/rest/v1/rpc/student_ingest_practice_session_v1", async (route) => {
        if (failUpload) await route.abort("failed");
        else await route.continue();
      });
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.locator("#upload-status")).toHaveText("Not synced—retry");
      await expect(page.getByRole("button", { name: "Retry sync" })).toBeVisible();
      expect(query(`select count(*) from public.practice_sessions where event_id='${eventId}'`))
        .toBe("0");
      failUpload = false;
      await page.getByRole("button", { name: "Retry sync" }).click();
      await expect.poll(() => query(`select count(*) from public.practice_sessions where event_id='${eventId}'`))
        .toBe("1");
      await expect(page.locator("#current-table tfoot")).toContainText("1 min");
      await expect(page.locator("#empty-week")).toBeEmpty();

      const savedSummary = await page.evaluate((id) =>
        localStorage.getItem(`apartmender-weekly-summary-v1:${id}`), userId);
      const localSession = await page.evaluate(() =>
        sessionStorage.getItem("apartmender-auth-session"));
      const otherTab = await page.context().newPage();
      try {
        await otherTab.addInitScript((saved) =>
          sessionStorage.setItem("apartmender-auth-session", saved), localSession);
        let otherTabReads = 0;
        otherTab.on("response", (response) => {
          if (response.url().includes("/rest/v1/rpc/student_weekly_summary_v1")
            && response.ok()) otherTabReads += 1;
        });
        await otherTab.goto(`${site.origin}/login/practice/weekly-summary/`);
        await expect(otherTab.getByRole("heading", { name: /Practice for week/ })).toBeVisible();
        await expect.poll(() => otherTabReads).toBeGreaterThan(0);
        const beforeDeletion = otherTabReads;
        await page.evaluate((id) =>
          localStorage.removeItem(`apartmender-weekly-summary-v1:${id}`), userId);
        await expect.poll(() => otherTabReads).toBeGreaterThan(beforeDeletion);
        await expect(otherTab.getByRole("heading", { name: /Practice for week/ })).toBeVisible();
        await expect(otherTab.locator("#summary-status")).not.toContainText("cannot view");
      } finally { await otherTab.close(); }

      // Reading the summary while a second tab is recording must not recover
      // that tab's live Open marker. The summary waits for its Web Lock.
      const practiceTab = await page.context().newPage();
      try {
        await practiceTab.addInitScript((saved) =>
          sessionStorage.setItem("apartmender-auth-session", saved), localSession);
        await practiceTab.goto(`${site.origin}/login/practice/`);
        await practiceTab.getByRole("button", { name: "Czerny Op. 821, 2" }).click();
        await expect(practiceTab.locator("#practice-timer-value")).not.toHaveText("0:00");
        await page.reload();
        await expect.poll(() => page.evaluate(async (id) => {
          const { pending } = await navigator.locks.query();
          return pending.some((lock) => lock.name === `apartmender-practice:${id}`);
        }, userId)).toBe(true);
        expect(await page.evaluate(async (id) => {
          const { createSessionJournal } = await import("/login/practice/session-journal.js");
          return Object.keys((await createSessionJournal(indexedDB).read(id)).open).length;
        }, userId)).toBe(1);
        await expect(practiceTab.locator("#practice")).toBeVisible();
        await practiceTab.getByRole("button", { name: "Back home" }).click();
      } finally { await practiceTab.close(); }

      query(`update app_private.account_access set account_state='Disabled' where auth_user_id='${userId}'`);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.locator("#summary-status")).toContainText("cannot view");
      await expect(page.locator("#summary-content")).toBeHidden();
      expect(await page.evaluate((id) => localStorage.getItem(`apartmender-weekly-summary-v1:${id}`), userId))
        .toBeNull();
      await page.evaluate(({ id, saved }) =>
        localStorage.setItem(`apartmender-weekly-summary-v1:${id}`, saved),
      { id: userId, saved: savedSummary });
      await page.goto(`${site.origin}/login/practice/`);
      await expect(page.getByRole("link", { name: "Weekly Summary" })).toBeHidden();
      await expect.poll(() => page.evaluate((id) =>
        localStorage.getItem(`apartmender-weekly-summary-v1:${id}`), userId)).toBeNull();
    } finally { await site.close(); }
  });
