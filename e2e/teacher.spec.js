import { test, expect } from "@playwright/test";
import { serveSite } from "./site.js";

const studentId = "c1000000-0000-4000-8000-000000000003";
const secondStudent = "c1000000-0000-4000-8000-000000000004";
function response() {
  return { contractVersion: 1, outcome: "students", asOf: "2026-10-14T15:00:00.000000Z", students: [{
    studentId, name: "<img src=x onerror=alert(1)>", schedule: { hasLesson: false, studentTimeZone: "Europe/Brussels" },
    completedWeek: { kind: "calendar", startsAt: "2026-10-04T22:00:00.000000Z", endsAt: "2026-10-11T22:00:00.000000Z", studentTimeZone: "Europe/Brussels" },
    pieces: [301, 300, 0].map((totalSeconds, i) => ({ assignmentId: `c2000000-0000-4000-8000-00000000000${i + 1}`,
      slug: ["czerny-op-821-no-2", "unknown-piece", "bach-bwv-772-invention-no-1"][i], position: i + 1,
      totalSeconds, baselineWeekCount: 2, baselineTotalSeconds: i === 2 ? 0 : 601,
      baselineMeanSeconds: i === 2 ? 0 : 300.5, baselineStatus: i === 2 ? "no_baseline" : "available",
      percentageChange: i === 2 ? null : (i === 0 ? 0.166389351 : -0.166389351) })),
  }] };
}

// Exercise the real adapter/page boundary with deterministic Auth and RPC responses.
// The separate local-backend test covers real JWT role/ownership enforcement.
const adapterModule = `
  import { createBrowserData } from './browser-data.js';
  const state = window.teacherTest;
  const user = () => state.userId ? { id: state.userId, user_metadata: { role: 'Student' } } : null;
  const client = { auth: {
    onAuthStateChange(callback) { queueMicrotask(() => callback()); },
    getUser: async () => ({ data: { user: user() } }),
    getSession: async () => ({ data: { session: user() ? { user: user() } : null } }),
    signInWithPassword: async () => { state.userId = state.loginId;
      sessionStorage.setItem('teacher-test-user', state.userId); return { data: { user: user() } }; },
    updateUser: async () => { state.passwordChanged = true; return { data: { user: user() } }; },
    signOut: async () => { state.userId = null; sessionStorage.setItem('teacher-test-user', 'signed-out'); return {}; },
  }, rpc: async (name, args) => {
    state.calls.push(name);
    if (state.delay) await new Promise((done) => { state.release = done; });
    if (state.error) return { error: { code: state.error }, status: 403 };
    if (name === 'student_practice_generation_v1' && state.role === 'Student')
      return { data: { contractVersion: 1, outcome: 'generation', credentialGeneration: 1 } };
    if (state.role !== 'Teacher') return { error: { code: '42501' }, status: 403 };
    if (name === 'teacher_students_practice_v1') return { data: structuredClone(state.response) };
    if (name === 'teacher_student_practice_v1') {
      const student = state.response.students.find((s) => s.studentId === args.target_student_id);
      return student ? { data: { contractVersion: 1, outcome: 'student', asOf: state.response.asOf, student } }
        : { error: { code: '42501' }, status: 403 };
    }
    return { error: { code: '42501' }, status: 403 };
  }};
  export const browserData = createBrowserData({ config: {}, createClient: () => client,
    storage: sessionStorage, location, history });
`;

async function mockAdapter(page, options = {}) {
  await page.addInitScript(({ data, options }) => {
    window.teacherTest = { response: data, role: "Teacher", userId: "teacher-a", loginId: "teacher-a", calls: [], ...options };
    const saved = sessionStorage.getItem("teacher-test-user");
    if (saved) window.teacherTest.userId = saved === "signed-out" ? null : saved;
    localStorage.setItem("unrelated-sentinel", "keep");
  }, { data: response(), options });
  await page.route("**/login/supabase.js", (route) => route.fulfill({ contentType: "text/javascript", body: adapterModule }));
}

test("Teacher sign-in ignores metadata, lists current Pieces, formats exact delta signs, and navigates scoped detail", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page, { userId: null });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.origin}/login/`);
    await page.getByLabel("Email").fill("teacher@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("local-test-password");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
    await expect(page.getByRole("table")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("teacher-dashboard.png") });
    await expect(page.locator(".teacher-change-positive")).toHaveText("+0.2%");
    await expect(page.locator(".teacher-change-negative")).toHaveText("−0.2%");
    await expect(page.getByText("No baseline yet", { exact: true })).toBeVisible();
    await expect(page.getByText("0 min", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Czerny Op. 821, 2", { exact: true })).toBeVisible();
    await expect(page.getByText("Unavailable Piece (unknown-piece)", { exact: true })).toBeVisible();
    await expect(page.getByText(/Calendar week: 5 Oct 2026/)).toHaveCount(3);
    await expect(page.locator("#teacher-table img")).toHaveCount(0);
    await page.getByRole("link", { name: "<img src=x onerror=alert(1)>" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/student/\\?student=${studentId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("<img src=x onerror=alert(1)>");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    const stored = await page.evaluate(() => Object.entries(localStorage));
    expect(stored).toEqual([["unrelated-sentinel", "keep"]]);
    await page.getByRole("link", { name: "Logout", exact: true }).click();
    await expect(page).toHaveURL(/\/login\/$/);
  } finally { await site.close(); }
});

test("Login cannot submit before the Auth module installs its handlers", async ({ page }) => {
  const site = await serveSite();
  let release;
  const ready = new Promise((done) => { release = done; });
  try {
    await page.route("**/login/supabase.js", async (route) => {
      await ready;
      await route.fulfill({ contentType: "text/javascript", body: adapterModule });
    });
    await page.addInitScript(() => { window.teacherTest = { userId: null }; });
    await page.goto(`${site.origin}/login/`, { waitUntil: "commit" });
    await page.getByLabel("Email").fill("teacher@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("local-test-password");
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await page.getByLabel("Password", { exact: true }).press("Enter");
    expect(new URL(page.url()).search).toBe("");
    release();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  } finally { release(); await site.close(); }
});

test("invitation password flow routes an Active Teacher without creating a Student profile", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page);
    await page.goto(`${site.origin}/login/#type=invite&access_token=test-only`);
    await expect(page.getByLabel("New password")).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    await page.getByLabel("New password").fill("local-test-password");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/login\/teacher\/$/);
    await expect(page.getByRole("table")).toBeVisible();
  } finally { await site.close(); }
});

test("wrong roles, pending/disabled accounts, missing sessions, and unavailable reads expose no Teacher data", async ({ browser }) => {
  const site = await serveSite();
  try {
    for (const options of [{ role: "Student" }, { role: "Administrator" },
      { error: "42501" }, { userId: null }, { error: "55000" }, { error: "XX000" }]) {
      const page = await browser.newPage();
      await mockAdapter(page, options);
      await page.goto(`${site.origin}/login/teacher/`);
      await expect(page.locator("#teacher-status")).not.toHaveText("Loading assigned Students…");
      await expect(page.locator("#teacher-content")).toBeHidden();
      await expect(page.locator("#teacher-table")).toBeEmpty();
      await page.close();
    }
    const page = await browser.newPage();
    await mockAdapter(page, { role: "Administrator" });
    await page.goto(`${site.origin}/login/`);
    await expect(page.locator("#login-error")).toContainText("no active workspace");
    await expect(page).toHaveURL(/\/login\/$/);
    await page.close();
  } finally { await site.close(); }
});

test("empty lists, zero Pieces, neutral deltas, and guessed Students have explicit safe states", async ({ page }) => {
  const site = await serveSite();
  try {
    const data = response();
    data.students[0].pieces[0].totalSeconds = 300;
    data.students[0].pieces[0].baselineTotalSeconds = 600;
    data.students[0].pieces[0].percentageChange = 0;
    data.students[0].schedule.hasLesson = true;
    data.students[0].completedWeek.kind = "lesson";
    await mockAdapter(page, { response: data });
    await page.goto(`${site.origin}/login/teacher/`);
    await expect(page.getByText("0%", { exact: true })).toHaveClass("teacher-change-neutral");
    await expect(page.getByText(/Lesson week: 5 Oct 2026/)).toHaveCount(3);
    await page.evaluate(() => { window.teacherTest.response.students[0].pieces = []; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByText("No current Pieces", { exact: true })).toBeVisible();
    await page.evaluate(() => { window.teacherTest.response.students = []; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.locator("#teacher-status")).toHaveText("No assigned Students.");
    await expect(page.locator("#teacher-table")).toBeEmpty();
    await page.goto(`${site.origin}/login/teacher/student/?student=${secondStudent}`);
    await expect(page.locator("#teacher-status")).toContainText("unavailable");
    await expect(page.locator("#teacher-table")).toBeEmpty();
  } finally { await site.close(); }
});

test("refresh denial and identity changes clear prior data and late responses cannot restore it", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page);
    await page.goto(`${site.origin}/login/teacher/`);
    await expect(page.getByRole("table")).toBeVisible();
    await page.evaluate(() => { window.teacherTest.error = "42501"; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.locator("#teacher-status")).toContainText("unavailable");
    await expect(page.locator("#teacher-table")).toBeEmpty();
    await page.evaluate(() => { window.teacherTest.error = null; window.teacherTest.delay = true; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect.poll(() => page.evaluate(() => typeof window.teacherTest.release)).toBe("function");
    await page.evaluate(() => { window.teacherTest.userId = "teacher-b"; window.teacherTest.release(); });
    await expect(page.locator("#teacher-status")).toContainText("Sign in again");
    await expect(page.locator("#teacher-table")).toBeEmpty();
  } finally { await site.close(); }
});

test("logout clears Teacher content while a refresh is still in flight", async ({ page }) => {
  const site = await serveSite();
  try {
    await mockAdapter(page);
    await page.goto(`${site.origin}/login/teacher/`);
    await expect(page.getByRole("table")).toBeVisible();
    await page.evaluate(() => { window.teacherTest.delay = true; });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect.poll(() => page.evaluate(() => typeof window.teacherTest.release)).toBe("function");
    await page.getByRole("link", { name: "Logout", exact: true }).click();
    await expect(page).toHaveURL(/\/login\/$/);
    await expect(page.getByRole("table")).toHaveCount(0);
    await page.goto(`${site.origin}/login/teacher/`);
    await expect(page.locator("#teacher-status")).toContainText("Sign in again");
    await expect(page.locator("#teacher-table")).toBeEmpty();
  } finally { await site.close(); }
});
