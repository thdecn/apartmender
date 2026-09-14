# Supabase development boundary

Issue #10 establishes the reproducible Supabase foundation. It intentionally does not
create application tables, Row Level Security policies, accounts, or custom SMTP.

## Security boundary

Supabase gives the browser a project URL and publishable key. Those values identify the
public client and are safe to expose. Authorization still depends on authenticated user
tokens, grants, and Row Level Security added by later issues.

The database password and secret key are Operator-only credentials. A secret key bypasses
Row Level Security and must never appear in `docs/`, browser code, screenshots, logs,
issues, pull requests, or committed files. Keep all five hosted values in the ignored
root `.env`; `.env.example` contains names and blank placeholders only. Supabase CLI
authentication is kept in the CLI's native credential storage rather than this repository.

The reusable setup assistant writes values into `.env` and never into GitHub:

```sh
./scripts/setup-supabase.sh
```

No GitHub Actions workflow currently consumes Supabase values, so no GitHub repository
secret or variable is created.

## Prerequisites

- Node.js 20 or newer.
- A running Docker-compatible container runtime.
- A Supabase account with an organization that can host a Free project.

Install the pinned dependencies after a fresh checkout:

```sh
npm ci
```

The project pins the Supabase CLI in `devDependencies`; use the npm commands below rather
than a global CLI. The first local start downloads several container images and can take a
few minutes.

## Local workflow

The committed `supabase/config.toml` uses these Auth boundaries:

- Site URL: `http://localhost:4173/`
- Additional redirect URLs: `http://127.0.0.1:4173/` and
  `https://thdecn.github.io/apartmender/`
- Public signup: disabled globally and for email
- Anonymous sign-in: disabled

Start and inspect the local stack:

```sh
npm run supabase:start
npm run supabase:status
```

Create a versioned migration, rebuild from the full migration chain, and run pgTAP tests:

```sh
npm run supabase:migration:new -- descriptive_name
npm run supabase:reset
npm run supabase:test
```

Stop the local services without deleting their data:

```sh
npm run supabase:stop
```

`supabase start`, `supabase reset`, and `supabase test` act on the local stack. Do not add
`--linked` to reset or test commands: a linked reset destroys hosted data.

## Hosted project contract

The hosted project must remain on Supabase Free in the specific `eu-central-1` region,
shown in the Dashboard as Central EU (Frankfurt). Do not select the general Europe region,
because a general region does not guarantee placement in an EU member state.

Configure hosted Auth in the Dashboard with:

- Site URL: `https://thdecn.github.io/apartmender/`
- Additional redirect URLs: `http://localhost:4173/` and
  `http://127.0.0.1:4173/`
- Allow new users to sign up: off
- Allow anonymous sign-ins: off

Only existing users may sign in. Account creation remains an Operator responsibility in
later issues. Do not enable paid compute, Point-in-Time Recovery, custom domains, or any
other paid add-on without a separate human billing decision.

## Free-plan continuity

Supabase may pause a low-activity Free project. The Operator watches the Supabase account
email for pause warnings and resumes a paused project from the Dashboard when needed.
Resuming is not a backup strategy.

Free projects do not provide downloadable daily backups. Before real Student onboarding,
the Operator must establish a recurring off-site logical export and rehearse restoration
into a separate Free project. Store exports outside this repository; `backups/` and common
dump files are ignored as a final guardrail. The supported procedure is Supabase's
[CLI backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
which produces separate role, schema, and data SQL files and restores them with `psql`.
Storage objects require a separate export; a database dump contains their metadata only.

Record the first successful export and restore rehearsal as pilot-readiness evidence in
the delivery issue that owns backups. Issue #10 documents the boundary but does not create
student data or claim that a restore rehearsal has already happened.
