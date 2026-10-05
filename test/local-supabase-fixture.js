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
  const env = Object.fromEntries(execFileSync(cli, ["status", "--output", "env"], {
    cwd: sludgeRepo, encoding: "utf8",
  }).split("\n").filter((line) => /^[A-Z_]+=/.test(line)).map((line) => {
    const equal = line.indexOf("=");
    return [line.slice(0, equal), line.slice(equal + 1).replace(/^"|"$/g, "")];
  }));
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

  // Local PostgREST can lag the host clock during container startup.
  const issuedAt = Math.floor(Date.now() / 1000) - 60;
  const expiresAt = issuedAt + 3600;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signed = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    aud: "authenticated", exp: expiresAt, iat: issuedAt,
    iss: "supabase", role: "authenticated", sub: userId,
  })}`;
  const token = `${signed}.${createHmac("sha256", env.JWT_SECRET)
    .update(signed).digest("base64url")}`;
  const session = { access_token: token, refresh_token: "local-test-only",
    token_type: "bearer", expires_in: 3600, expires_at: expiresAt,
    user: { id: userId, aud: "authenticated", role: "authenticated", email } };

  return { config, email, userId, token, session, query };
}
