import { test, expect } from "@playwright/test";
import { serveSite } from "./site.js";

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

let site;
let errors;
let privateRequests;

test.beforeEach(async ({ context, page }) => {
  site = await serveSite();
  errors = [];
  privateRequests = [];
  const observe = (tab) => tab.on("pageerror", (error) => errors.push(error.message));
  observe(page);
  context.on("page", observe);
  context.on("request", (request) => {
    if (/supabase|\/auth\/|\/rest\/v1|\/login\//.test(request.url())) {
      privateRequests.push(request.url());
    }
  });
  await context.route(/https:\/\/fonts\./, (route) => route.abort());
  // Control only browser capabilities, not the host or progression state.
  await context.addInitScript(() => {
    window.practiceEffects = { vibrations: [], wakeRequests: 0, releases: 0 };
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern) => {
      window.practiceEffects.vibrations.push(pattern);
      return true;
    } });
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: {
      request: async () => {
        window.practiceEffects.wakeRequests += 1;
        throw new DOMException("Battery policy denies wake lock", "NotAllowedError");
      },
    } });
  });
});

test.afterEach(async ({ context }) => {
  try {
    expect(errors).toEqual([]);
    expect(privateRequests).toEqual([]);
  } finally {
    await Promise.all(context.pages().map((page) => page.close()));
    await site.close();
  }
});

async function openPiece(page) {
  await page.getByRole("button", { name: "Czerny Op. 821, 2", exact: true }).click();
  await expect(page.locator("#practice")).toBeVisible();
}

async function expectCard(page, index) {
  await expect(page.locator("#card-meta")).toHaveText(`m. ${8 - index} · ${index + 1} / 8`);
  await expect(page.locator("#card-image")).toHaveAttribute("src",
    new RegExp(`/cards/czerny-op-821-no-2/0${index + 1}-m${8 - index}[.-]`));
  await expect.poll(() => page.locator("#card-image").evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
}

async function threeGoods(page) {
  for (let count = 0; count < 3; count += 1) await page.getByRole("button", { name: "Good", exact: true }).click();
}

async function controlledVisit(page) {
  await page.clock.install({ time: new Date("2026-11-25T08:00:00Z") });
  await page.goto(site.origin + "/");
  await page.clock.pauseAt(new Date("2026-11-25T08:01:00Z"));
  await openPiece(page);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:00");
}

async function visibility(page, state) {
  // Deliver the browser lifecycle boundary without invoking an app-private API.
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

test("public Normal visit preserves streaks, browsing, Resume, all cards and completion when wake lock is denied", async ({ page }) => {
  await page.goto(site.origin + "/");
  await expect(page.locator(".piece-btn")).toHaveCount(6);
  await expect(page.getByLabel("Normal", { exact: true })).toBeChecked();
  await openPiece(page);
  await expectCard(page, 0);
  await expect(page.getByRole("button", { name: "Advance", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next playable measure" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Previous playable measure" })).toBeDisabled();

  await page.getByRole("button", { name: "Good", exact: true }).click();
  await expect(page.locator("#counter")).toHaveText("1");
  await page.getByRole("button", { name: "Mistake", exact: true }).click();
  await expect(page.locator("#counter")).toHaveText("0");

  for (let index = 0; index < 8; index += 1) {
    await expectCard(page, index);
    await expect(page.locator("#counter")).toHaveText("0");
    if (index === 1) {
      await page.getByRole("button", { name: "Previous playable measure" }).click();
      await expectCard(page, 0);
      await expect(page.locator("#counter")).toHaveText("3");
      await expect(page.getByRole("button", { name: "Good", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Mistake", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await expectCard(page, 1);
      await expect(page.locator("#counter")).toHaveText("0");
    }
    await threeGoods(page);
    await expect(page.getByRole("button", { name: "Advance", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Advance", exact: true }).click();
  }
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#practice")).toBeHidden();
  await expect(page.locator("#card-image")).not.toHaveAttribute("src");
  await expect(page.locator("#practice-timer-value")).toHaveText("0:00");
  expect(page.url()).toBe(site.origin + "/");
  const effects = await page.evaluate(() => window.practiceEffects);
  expect(effects.wakeRequests).toBe(1);
  expect(effects.vibrations).toEqual(expect.arrayContaining([12, 24, 8, [40, 30, 40]]));
  await openPiece(page);
  await expectCard(page, 0);
  await expect(page.locator("#counter")).toHaveText("0");
});

test("public Hard mode visits every card once and can browse the whole Piece without changing the random target", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto(site.origin + "/");
  await page.locator('label[for="practice-mode-hard"]').click();
  await openPiece(page);
  await expectCard(page, 1);
  await page.getByRole("button", { name: "Previous playable measure" }).click();
  await expectCard(page, 0);
  await expect(page.getByRole("button", { name: "Good", exact: true })).toBeDisabled();
  for (let index = 1; index < 8; index += 1) {
    await page.getByRole("button", { name: "Next playable measure" }).click();
    await expectCard(page, index);
  }
  await expect(page.getByRole("button", { name: "Next playable measure" })).toBeDisabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  for (const index of [1, 2, 3, 4, 5, 6, 7, 0]) {
    await expectCard(page, index);
    await expect(page.locator("#counter")).toHaveText("0");
    await threeGoods(page);
    await page.getByRole("button", { name: "Advance", exact: true }).click();
  }
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.getByLabel("Hard", { exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByLabel("Hard", { exact: true })).toBeChecked();
  await expect(page.locator("#practice")).toBeHidden();
});

test("public timing accumulates only visible time and Home discards it", async ({ page }) => {
  await controlledVisit(page);
  await page.clock.runFor(5000);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:05");
  await visibility(page, "hidden");
  await page.clock.runFor(20000);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:05");
  await visibility(page, "visible");
  await page.clock.runFor(3000);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:08");
  await page.getByRole("button", { name: "Back home" }).click();
  await page.clock.runFor(10000);
  await openPiece(page);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:00");
  await page.clock.runFor(2000);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:02");
});

test("public portrait retains the overlay without adopting Student portrait-paused timing", async ({ page }) => {
  await controlledVisit(page);
  await page.clock.runFor(2000);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#rotate-hint")).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:07");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#rotate-hint")).toBeHidden();
  await expectCard(page, 0);
});

test("completion discards elapsed time and the next visit starts fresh", async ({ page }) => {
  await controlledVisit(page);
  await page.clock.runFor(65000);
  await expect(page.locator("#practice-timer-value")).toHaveText("1:05");
  for (let index = 0; index < 8; index += 1) {
    await threeGoods(page);
    await page.getByRole("button", { name: "Advance", exact: true }).click();
  }
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#practice-timer-value")).toHaveText("0:00");
  await page.clock.runFor(12000);
  await openPiece(page);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:00");
});

test("reload and tab closure never recover public progression or elapsed time", async ({ page, context }) => {
  await controlledVisit(page);
  await threeGoods(page);
  await page.getByRole("button", { name: "Advance", exact: true }).click();
  await expectCard(page, 1);
  await page.clock.runFor(9000);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:09");
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#practice")).toBeHidden();
  await openPiece(page);
  await expectCard(page, 0);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:00");
  await page.clock.runFor(4000);
  await expect(page.locator("#practice-timer-value")).toHaveText("0:04");
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(site.origin + "/");
  await expect(reopened.locator("#home")).toBeVisible();
  await openPiece(reopened);
  await expectCard(reopened, 0);
  await expect(reopened.locator("#practice-timer-value")).toHaveText("0:00");
});

test("a granted wake lock is released on Home and a fresh visit acquires another", async ({ page }) => {
  await page.goto(site.origin + "/");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: {
      request: async () => {
        window.practiceEffects.wakeRequests += 1;
        const sentinel = new EventTarget();
        sentinel.release = async () => {
          window.practiceEffects.releases += 1;
          sentinel.dispatchEvent(new Event("release"));
        };
        return sentinel;
      },
    } });
  });
  await openPiece(page);
  await page.getByRole("button", { name: "Back home" }).click();
  await expect.poll(() => page.evaluate(() => window.practiceEffects.releases)).toBe(1);
  await openPiece(page);
  await expect.poll(() => page.evaluate(() => window.practiceEffects.wakeRequests)).toBe(2);
});
