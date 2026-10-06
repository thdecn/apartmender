import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import { createLocalPracticeStudent } from "../test/local-supabase-fixture.js";

const siteRoot = resolve("docs");
const types = { ".html": "text/html", ".js": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png" };

async function serveSite() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const path = resolve(siteRoot, `.${pathname}`,
      pathname.endsWith("/") ? "index.html" : "");
    if (!path.startsWith(`${siteRoot}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const bytes = await readFile(path);
      response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream",
        "Cache-Control": "no-store" }).end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return { origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)) };
}

async function practicePartition(page, userId) {
  return page.evaluate((id) => new Promise((resolveQueue, reject) => {
    const opened = indexedDB.open("apartmender-practice-v1");
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const request = opened.result.transaction("students").objectStore("students").get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolveQueue(request.result ?? { open: {}, queue: {} });
    };
  }), userId);
}

async function queuedEvents(page, userId) {
  return Object.values((await practicePartition(page, userId)).queue);
}

test("Login records assigned Practice, retries, and stops an active visit on account denial",
  async ({ page }) => {
    const { userId, email, session, query } = await createLocalPracticeStudent();
    const site = await serveSite();
    try {
      const browserErrors = [];
      const rpcResponses = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("requestfailed", (request) => browserErrors.push(
        `${new URL(request.url()).host}: ${request.failure()?.errorText}`));
      page.on("response", async (response) => {
        if (response.url().includes("/rest/v1/rpc/")) {
          rpcResponses.push(`${new URL(response.url()).pathname}: ${response.status()} ${await response.text()}`);
        }
      });
      await page.setViewportSize({ width: 844, height: 390 });
      // The local Sludge stack disables email-password login. Supply only its
      // token response; Auth getUser, Assignment, generation, and ingestion
      // requests all reach the real local backend with a verified Student JWT.
      await page.route(/\/auth\/v1\/token\?grant_type=password/, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await route.fulfill({ status: 200, contentType: "application/json",
          headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(session) });
      });
      const outcomes = [];
      let lostAcknowledgement = false;
      let dropNextUpload = false;
      let accountDenied = false;
      await page.route("**/rest/v1/rpc/student_ingest_practice_session_v1", async (route) => {
        if (dropNextUpload) {
          dropNextUpload = false;
          await route.abort("failed");
          return;
        }
      if (accountDenied) {
          await route.fulfill({ status: 403, contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({ code: "42501", message: "Access denied" }) });
          return;
        }
        const upstream = await route.fetch();
        outcomes.push((await upstream.json()).outcome);
        if (outcomes.length === 1) {
          await route.abort("failed");
          lostAcknowledgement = true;
        } else {
          await route.fulfill({ response: upstream });
        }
      });

      await page.goto(`${site.origin}/login/`);
      await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill("local-test-password");
      await page.getByRole("button", { name: "Continue" }).click();
      try {
        await page.waitForURL("**/login/practice/", { timeout: 8_000 });
      } catch {
        throw new Error(`Login stayed on form: ${await page.locator("#login-error").textContent()}; ${browserErrors.join("; ")}`);
      }
      await expect(page.getByRole("heading", { name: "Student Home" })).toBeVisible();
      const piece = page.getByRole("button", { name: "Czerny Op. 821, 2" });
      try {
        await expect(piece).toBeVisible();
      } catch {
        throw new Error(`Assigned Piece missing: ${rpcResponses.join("; ")}; ${browserErrors.join("; ")}`);
      }

      await piece.click();
      await expect(page.locator("#practice-timer-value")).not.toHaveText("0:00");
      await page.getByRole("button", { name: "Back home" }).click();
      await expect(page.getByRole("heading", { name: "Student Home" })).toBeVisible();
      await expect.poll(() => lostAcknowledgement).toBe(true);
      await expect.poll(async () => (await queuedEvents(page, userId)).length).toBe(1);
      expect(query(`select count(*) from public.practice_sessions where student_id='${userId}'`))
        .toBe("1");

      await page.reload();
      await expect(piece).toBeVisible();
      await expect.poll(async () => (await queuedEvents(page, userId)).length).toBe(0);
      expect(outcomes.slice(0, 2)).toEqual(["accepted", "duplicate"]);
      expect(query(`select count(*) from public.practice_sessions where student_id='${userId}'`))
        .toBe("1");

      await piece.click();
      const good = page.getByRole("button", { name: "Good" });
      const advance = page.getByRole("button", { name: "Advance" });
      for (let card = 0; card < 8; card += 1) {
        await good.click();
        await good.click();
        await good.click();
        await advance.click();
      }
      await expect(page.getByRole("heading", { name: "Student Home" })).toBeVisible();
      await expect.poll(async () => (await queuedEvents(page, userId)).length).toBe(0);
      expect(outcomes.at(-1)).toBe("accepted");
      expect(query(`select count(*) || ':' || count(distinct event_id)
        from public.practice_sessions where student_id='${userId}'`)).toBe("2:2");
      expect(Number(query(`select app_private.calculate_current_practice_week(
        '${userId}', now())->>'totalSeconds'`))).toBeGreaterThan(0);

      // An older queued event may be denied after a new Piece has started.
      // The denial must end that running visit at once and retain its event.
      dropNextUpload = true;
      await piece.click();
      await expect(page.locator("#practice-timer-value")).not.toHaveText("0:00");
      await page.getByRole("button", { name: "Back home" }).click();
      await expect.poll(async () => (await queuedEvents(page, userId)).length).toBe(1);
      await piece.click();
      await expect(page.locator("#practice-timer-value")).not.toHaveText("0:00");
      accountDenied = true;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.locator("#practice")).toBeHidden();
      await expect(page.locator("#practice-timer-value")).toHaveText("0:00");
      await expect.poll(async () => {
        const partition = await practicePartition(page, userId);
        return [Object.keys(partition.open).length, Object.keys(partition.queue).length];
      }).toEqual([0, 2]);
      expect(query(`select count(*) from public.practice_sessions where student_id='${userId}'`))
        .toBe("2");
    } finally {
      await site.close();
    }
  });
