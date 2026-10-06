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
      let uploadsOffline = false;
      let assignmentsOffline = false;
      await page.route("**/rest/v1/rpc/student_active_assignments_v1", async (route) => {
        if (assignmentsOffline && route.request().method() === "POST") {
          await route.abort("failed");
        } else {
          await route.continue();
        }
      });
      await page.route("**/rest/v1/rpc/student_ingest_practice_session_v1", async (route) => {
        if (uploadsOffline) {
          await route.abort("failed");
          return;
        }
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

      // A second tab shares IndexedDB but must leave the first tab's live
      // marker alone. Its own Practice start waits until the first ends.
      await piece.click();
      await expect(page.locator("#practice-timer-value")).not.toHaveText("0:00");
      const sessionEntries = await page.evaluate(() => Object.entries(sessionStorage));
      const peer = await page.context().newPage();
      await peer.addInitScript((entries) => {
        for (const [key, value] of entries) sessionStorage.setItem(key, value);
      }, sessionEntries);
      await peer.goto(`${site.origin}/login/practice/`);
      await expect(peer.getByRole("heading", { name: "Student Home" })).toBeVisible();
      await expect(peer.getByRole("button", { name: "Czerny Op. 821, 2" })).toBeVisible();
      expect(Object.keys((await practicePartition(peer, userId)).open)).toHaveLength(1);
      await peer.getByRole("button", { name: "Czerny Op. 821, 2" }).click();
      await expect(peer.locator("#practice")).toBeHidden();
      await expect(peer.locator("#piece-status")).toContainText("another tab");
      await peer.close();
      await page.bringToFront();
      await page.getByRole("button", { name: "Back home" }).click();
      await expect.poll(async () => (await queuedEvents(page, userId)).length).toBe(0);
      expect(query(`select count(*) from public.practice_sessions where student_id='${userId}'`))
        .toBe("3");

      // A storage-restricted tab can still send a memory-only visit when its
      // backend checks succeed, even if browser locks are also unavailable.
      const restricted = await page.context().newPage();
      await restricted.setViewportSize({ width: 844, height: 390 });
      await restricted.addInitScript((entries) => {
        for (const [key, value] of entries) sessionStorage.setItem(key, value);
        Object.defineProperty(window, "indexedDB", { value: undefined });
        Object.defineProperty(navigator, "locks", { value: undefined });
      }, sessionEntries);
      await restricted.goto(`${site.origin}/login/practice/`);
      expect(await restricted.evaluate(() => [Boolean(window.indexedDB), Boolean(navigator.locks)]))
        .toEqual([false, false]);
      const restrictedPiece = restricted.getByRole("button", { name: "Czerny Op. 821, 2" });
      await expect(restrictedPiece).toBeVisible();
      await restrictedPiece.click();
      await expect(restricted.locator("#practice")).toBeVisible();
      await expect(restricted.locator("#practice-timer-value")).not.toHaveText("0:00");
      await restricted.getByRole("button", { name: "Back home" }).click();
      await expect.poll(() => query(`select count(*) from public.practice_sessions
        where student_id='${userId}'`)).toBe("4");
      await restricted.close();

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
        .toBe("4");
      // An offline reload can fail to load Home while prior events remain
      // queued. Connectivity returning must retry without a manual reload.
      accountDenied = false;
      uploadsOffline = true;
      assignmentsOffline = true;
      await page.reload();
      await expect(page.locator("#name-display")).toContainText("reconnect later");
      expect((await queuedEvents(page, userId)).length).toBe(2);
      uploadsOffline = false;
      assignmentsOffline = false;
      await page.evaluate(() => setTimeout(() => window.dispatchEvent(new Event("online")), 0));
      await expect(piece).toBeVisible();
      await expect.poll(async () => (await queuedEvents(page, userId)).length).toBe(0);
      expect(query(`select count(*) from public.practice_sessions where student_id='${userId}'`))
        .toBe("6");

      // A peer tab may retry an old event while this tab owns a new visit.
      // Its account denial must reach the timer owner immediately.
      dropNextUpload = true;
      await piece.click();
      await expect(page.locator("#practice-timer-value")).not.toHaveText("0:00");
      await page.getByRole("button", { name: "Back home" }).click();
      await expect.poll(async () => (await queuedEvents(page, userId)).length).toBe(1);
      await piece.click();
      await expect(page.locator("#practice-timer-value")).not.toHaveText("0:00");
      accountDenied = true;
      const peerSession = await page.evaluate(() => Object.entries(sessionStorage));
      const denialPeer = await page.context().newPage();
      await denialPeer.addInitScript((entries) => {
        for (const [key, value] of entries) sessionStorage.setItem(key, value);
      }, peerSession);
      await denialPeer.route("**/rest/v1/rpc/student_ingest_practice_session_v1", async (route) => {
        await route.fulfill({ status: 403, contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ code: "42501", message: "Access denied" }) });
      });
      await denialPeer.goto(`${site.origin}/login/practice/`);
      await expect(page.locator("#practice")).toBeHidden();
      await expect.poll(async () => {
        const partition = await practicePartition(page, userId);
        return [Object.keys(partition.open).length, Object.keys(partition.queue).length];
      }).toEqual([0, 2]);
      await denialPeer.close();
      accountDenied = false;
      await page.bringToFront();
      await page.reload();
      await expect(piece).toBeVisible();
      await expect.poll(async () => (await queuedEvents(page, userId)).length).toBe(0);
      expect(query(`select count(*) from public.practice_sessions where student_id='${userId}'`))
        .toBe("8");

      // If the owning tab closes while Practice is open, the waiting tab
      // recovers its last checkpoint after the browser releases the lock.
      await piece.click();
      await expect(page.locator("#practice-timer-value")).not.toHaveText("0:00");
      const laterSession = await page.evaluate(() => Object.entries(sessionStorage));
      const survivor = await page.context().newPage();
      await survivor.addInitScript((entries) => {
        for (const [key, value] of entries) sessionStorage.setItem(key, value);
      }, laterSession);
      await survivor.goto(`${site.origin}/login/practice/`);
      await expect(survivor.getByRole("button", { name: "Czerny Op. 821, 2" })).toBeVisible();
      expect(Object.keys((await practicePartition(survivor, userId)).open)).toHaveLength(1);
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      await expect.poll(async () => Object.values((await practicePartition(survivor, userId)).open)
        .map((marker) => marker.pausedAt !== null && marker.elapsedMs >= 1_000))
        .toEqual([true]);
      await page.close();
      await expect.poll(() => query(`select count(*) from public.practice_sessions
        where student_id='${userId}'`)).toBe("9");
      expect(Object.keys((await practicePartition(survivor, userId)).open)).toHaveLength(0);
      await survivor.close();

    } finally {
      await site.close();
    }
  });
