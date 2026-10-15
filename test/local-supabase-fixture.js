import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

import { readPublicSupabaseConfig } from "../docs/login/config.js";

// Creates one test Student on a freshly reset, disposable local Sludge stack.
// All privileged setup stays in Node; only the public key and Student JWT
// enter the browser test.
export async function createLocalPracticeStudent() {
  const sludgeRepo = process.env.SLUDGE_REPO;
  assert.ok(sludgeRepo, "Set SLUDGE_REPO to the Sludge checkout with the generation migration");
  const cli = process.env.SUPABASE_CLI ?? "supabase";
  const env = localEnvironment(sludgeRepo, cli);
  assert.equal(new URL(env.DB_URL).hostname, "127.0.0.1");
  assert.equal(new URL(env.DB_URL).port, "54332");
  const config = readPublicSupabaseConfig({ protocol: "http:", hostname: "127.0.0.1" });
  assert.equal(config.projectUrl, env.API_URL);
  assert.equal(config.publishableKey, env.PUBLISHABLE_KEY);

  const query = (sql) => execFileSync("psql", [env.DB_URL, "-X", "-At", "-v",
    "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim();
  assert.equal(query("select complete from public.piece_assignment_cutover where singleton"),
    "f", "Reset the disposable local database before this test");

  const email = `practice-${randomUUID()}@example.invalid`;
  const created = await fetch(`${env.API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: `Local-${randomUUID()}!`, email_confirm: true }),
  });
  assert.equal(created.status, 200);
  const { id: userId } = await created.json();
  assert.match(userId, /^[0-9a-f-]{36}$/);
  query(`insert into public.students (id,email,name,piece_1) values
    ('${userId}','${email}','Integration Student','czerny-op-821-no-2');
    update app_private.account_access set account_state='Active'
    where auth_user_id='${userId}';
    select public.backfill_piece_assignments_v1(array['czerny-op-821-no-2'],
      public.piece_assignment_source_fingerprint_v1());`);

  const session = localSession(userId, email, env);
  const token = session.access_token;

  return { config, email, userId, token, session, query };
}

function localEnvironment(sludgeRepo, cli = "supabase") {
  return Object.fromEntries(execFileSync(cli, ["status", "--output", "env"], {
    cwd: sludgeRepo, encoding: "utf8",
  }).split("\n").filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
    const equal = line.indexOf("=");
    return [line.slice(0, equal), line.slice(equal + 1).replace(/^"|"$/g, "")];
  }));
}

function localSession(userId, email, env) {
  // Local PostgREST containers can lag the host clock after a database reset.
  // This disposable test token spans that skew without changing client timing.
  const currentSecond = Math.floor(Date.now() / 1000);
  const issuedAt = currentSecond - 24 * 3600;
  const expiresAt = currentSecond + 24 * 3600;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signed = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    aud: "authenticated", exp: expiresAt, iat: issuedAt,
    iss: "supabase", role: "authenticated", sub: userId,
  })}`;
  const token = `${signed}.${createHmac("sha256", env.JWT_SECRET)
    .update(signed).digest("base64url")}`;
  return { access_token: token, refresh_token: "local-test-only",
    token_type: "bearer", expires_in: 3600, expires_at: expiresAt,
    user: { id: userId, aud: "authenticated", role: "authenticated", email } };
}

export async function createLocalTeacherFixture() {
  const student = await createLocalPracticeStudent();
  const env = localEnvironment(process.env.SLUDGE_REPO, process.env.SUPABASE_CLI);
  const identities = {};
  for (const label of ["TeacherA", "TeacherB", "Administrator", "EmptyStudent", "OtherStudent"]) {
    const email = `teacher-check-${randomUUID()}@example.invalid`;
    const response = await fetch(`${env.API_URL}/auth/v1/admin/users`, {
      method: "POST", headers: { apikey: env.SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: `Local-${randomUUID()}!`, email_confirm: true }),
    });
    assert.equal(response.status, 200);
    const { id } = await response.json();
    assert.match(id, /^[0-9a-f-]{36}$/);
    identities[label] = { id, email, session: localSession(id, email, env) };
  }
  const { TeacherA: a, TeacherB: b, Administrator: admin, EmptyStudent: empty, OtherStudent: other } = identities;
  student.query(`
    insert into app_private.teachers(id,display_name) values ('${a.id}','Local Teacher A'),('${b.id}','Local Teacher B');
    insert into app_private.account_access(auth_user_id,application_role,account_state) values
      ('${a.id}','Teacher','Active'),('${b.id}','Teacher','Active'),('${admin.id}','Administrator','Active');
    update public.students set teacher_id='${a.id}' where id='${student.userId}';
    insert into public.students(id,email,name,teacher_id) values
      ('${empty.id}','${empty.email}','No Pieces Student','${a.id}'),
      ('${other.id}','${other.email}','Other Teacher Student','${b.id}');
    update app_private.account_access set account_state='Active' where auth_user_id in ('${empty.id}','${other.id}');
  `);
  return { ...student, identities };
}
