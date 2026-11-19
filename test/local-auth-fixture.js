import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

// Only real localhost Auth is allowed. Admin credentials stay inside Node.
// Supported generate_link creates real invite/recovery links without sending
// email, keeping repeatable regression runs independent of delivery quotas.
export async function createLocalOnboardingTeacher(redirectTo) {
  const repo = process.env.SLUDGE_REPO;
  assert.ok(repo, "Set SLUDGE_REPO to the local Sludge checkout");
  const cli = process.env.SUPABASE_CLI ?? "supabase";
  const env = JSON.parse(execFileSync(cli, ["status", "-o", "json"], {
    cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }));
  assert.equal(env.API_URL, "http://127.0.0.1:54331");
  assert.equal(new URL(env.DB_URL).hostname, "127.0.0.1");
  assert.equal(new URL(env.DB_URL).port, "54332");
  assert.equal(redirectTo, "http://127.0.0.1:8080/login/");
  const query = (sql) => {
    try {
      return execFileSync("psql", [env.DB_URL, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
        encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch { throw new Error("Local database fixture query failed; credential-bearing command omitted"); }
  };
  assert.equal(query("select complete from public.piece_assignment_cutover where singleton"), "t",
    "Complete the disposable local Assignment cutover before this test");
  const headers = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json" };
  async function admin(path, body, method = "POST") {
    const response = await fetch(`${env.API_URL}/auth/v1/${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    assert.ok(response.ok, `Local Auth operation returned ${response.status}`);
    return response.json();
  }
  const email = `onboarding-${randomUUID()}@example.invalid`;
  const linkPath = `admin/generate_link?redirect_to=${encodeURIComponent(redirectTo)}`;
  const invited = await admin(linkPath, { type: "invite", email });
  assert.match(invited.id, /^[0-9a-f-]{36}$/);
  assert.ok(invited.action_link?.startsWith(`${env.API_URL}/auth/v1/verify`));
  const teacherId = invited.id;
  let studentId;
  async function cleanup() {
    const ids = [teacherId, studentId].filter(Boolean);
    const values = ids.map(id => `'${id}'`).join(",");
    query(`begin; select set_config('sludge.student_erasure','on',true);
      delete from app_private.account_access where auth_user_id in (${values});
      delete from public.students where id in (${values});
      delete from app_private.teachers where id in (${values}); commit;`);
    for (const id of ids) await admin(`admin/users/${id}`, undefined, "DELETE");
  }
  try {
    const studentEmail = `onboarding-student-${randomUUID()}@example.invalid`;
    const student = await admin("admin/users", { email: studentEmail, email_confirm: true });
    assert.match(student.id, /^[0-9a-f-]{36}$/); studentId = student.id;
    query(`begin;
      insert into app_private.teachers(id,display_name) values ('${teacherId}','Local Onboarding Teacher');
      insert into app_private.account_access(auth_user_id,application_role,account_state)
        values ('${teacherId}','Teacher','Required Password Change');
      insert into public.students(id,email,name,teacher_id)
        values ('${studentId}','${studentEmail}','Local Onboarding Student','${teacherId}');
      update app_private.account_access set account_state='Active' where auth_user_id='${studentId}'; commit;`);
  } catch (error) { await cleanup(); throw error; }
  return { email, teacherId, studentId, invitationLink: invited.action_link,
    password: `Local-${randomUUID()}-Aa7!`, replacementPassword: `Replaced-${randomUUID()}-Aa7!`,
    async recoveryLink() {
      const recovery = await admin(linkPath, { type: "recovery", email });
      assert.equal(recovery.id, teacherId);
      assert.ok(recovery.action_link?.startsWith(`${env.API_URL}/auth/v1/verify`));
      return recovery.action_link;
    },
    activate() {
      assert.equal(query(`update app_private.account_access set account_state='Active'
        where auth_user_id='${teacherId}' and application_role='Teacher'
          and account_state='Required Password Change' returning account_state`), "Active\nUPDATE 1");
    },
    async passwordStatus(password) {
      const response = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: env.PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      return { status: response.status, code: body.error_code || body.code };
    }, cleanup };
}
