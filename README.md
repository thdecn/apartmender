# Apartmender

Apartmender is a frontend to Artmender, which turns a legally reusable two-staff keyboard score into reverse-order practice cards sized for an iPhone screen.

Each written measure becomes one card. The last measure appears alone; every earlier card contains its full measure plus the first sounding onset on each staff in the next measure, retaining any rests before those onsets. Cards preserve score annotations where the source format supports them, repeat notation context, and show the original measure number.

The verified built-in catalog currently contains:

- Carl Czerny, Op. 821 No. 2: 8 measures/cards
- J. F. F. Burgmüller, L'Arabesque, Op. 100 No. 2: 33 measures/cards
- J. S. Bach, Prelude No. 1 in C major, BWV 846: 35 measures/cards
- J. S. Bach, Invention No. 8, BWV 779: 34 measures/cards
- J. S. Bach, Invention No. 1, BWV 772: 22 measures/cards

## Practice web app

A phone landscape practice UI lives in `docs/` and is published with GitHub Pages:

https://thdecn.github.io/apartmender/

## Tests

Run the JavaScript tests with Node.js:

```sh
npm test
```

The opt-in Practice integration test uses a disposable, freshly reset local
Sludge Supabase database with the `student_practice_generation_v1` migration.
It creates a local Student, verifies Assignment and generation reads, uploads
one Session, and checks that an exact retry does not add another row. Set
`SLUDGE_REPO` to that checkout; set `SUPABASE_CLI` if the CLI is not on `PATH`:

```sh
SLUDGE_REPO=/path/to/Sludge APARTMENDER_LOCAL_SUPABASE=1 \
  node --test test/local-supabase.integration.test.js
```

Reset the disposable database before rerunning it; the test performs the
Assignment cutover and stores immutable Practice locally.

For the served-browser path, install the dev dependency and headless browser,
reset the disposable Sludge database, then run:

```sh
npm ci
npx playwright install --only-shell chromium
SLUDGE_REPO=/path/to/Sludge npm run test:browser
```

The browser test drives Login, Student Home, Home finalization, recovery from
a lost upload acknowledgement, and final-card completion through local Sludge.
The local stack disables email-password login, so the test supplies only that
Auth token response; subsequent identity and Practice requests use the real
local backend.

## Sludge browser configuration

Sludge is Apartmender's V1 Supabase backend and owns the browser-facing Auth
and student-data contract consumed here.

Authenticated pages use the browser data module in `docs/login/browser-data.js`.
Page code receives normalized outcomes from that module and does not construct
Supabase requests or handle session tokens.

`docs/login/config.js` contains only the public project URL and publishable key
for each supported environment. It selects the local Sludge stack for pages
served from `http://127.0.0.1` or `http://localhost`, the hosted project for
`https://thdecn.github.io`, and fails closed on any unconfigured hostname.
Never add a secret key, legacy `service_role` key, database password, or
connection string to this repository.

For local integration, start Sludge and serve this repository's `docs/`
directory at the exact Auth redirect origin:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs
```

Then open `http://127.0.0.1:8080/login/`.

## Teacher dashboard

`sludge-nsj.4` consumes Sludge's [Teacher contract](https://github.com/thdecn/Sludge/blob/main/docs/teacher-accounts-mvp-contract.md)
and [practice metrics API v1](https://github.com/thdecn/Sludge/blob/main/docs/teacher-practice-api-v1.md).
The backend Teacher identity, Active-span, metrics, and note-history migrations must be deployed
and Piece Assignment cutover complete before releasing these browser pages.
This frontend change adds no migration and does not provision accounts.

After sign-in, restored-session validation, or invitation password setup,
Login probes the protected Teacher list RPC. Only a role denial permits a
fallback to the protected Student generation RPC. Network, contract, and cutover
failures stay on Login; Auth metadata cannot choose a workspace. Active Teachers
go to `/login/teacher/`, Active Students retain `/login/practice/`, and other
accounts remain denied. Administrator UI remains separate work. Pending Teacher
invitations can set a password, but operator activation is still required.

The desktop dashboard lists current Pieces and the last completed lesson or
calendar week, weekly average, eligible baseline count, and signed change.
The sign uses exact seconds and the baseline numerator/count before display
rounding. Unknown catalog slugs remain readable. Student links use separately
scoped detail and notes RPCs.
Teacher data is not persisted. Refresh, visibility changes, logout, errors, and
identity changes clear the previous view; a stale request cannot restore it.

Student detail (`sludge-nsj.5`) presents lesson information, the same metrics,
read-only preceding-period notes, and three current notes prefilled from the
Student-visible state. Only **Update** publishes a draft. Note 1 requires
non-whitespace text; optional notes can be cleared. Limits count 4,000 Unicode
characters per note, and accepted text is never trimmed or interpreted as markup.
History uses its saved boundaries/timezone even after a schedule edit. No earlier
period is invented when history is unavailable.

An unconfirmed Update retains its draft and retries the same UUID and payload.
A new intent gets a new UUID. After success or replay, the page rereads current
notes so an old receipt cannot overwrite a newer publication. Refresh failures
retain drafts in memory; ownership/identity/episode changes and leaving the page
discard them. No note drafts or receipts are written to browser storage.

`administratorMailbox` in `docs/login/teacher/teacher-config.js` holds the one
reviewed **public** Administrator contact address. An unset or invalid address
displays an unavailable state. **Admin
Request** opens an encoded `mailto:` draft with a subject and the authenticated
Teacher's UUID. It includes no Student details or note content. The Teacher
reviews and sends the email in their email app; Apartmender never reports delivery.

Run `npm test` and `npm run test:teacher` for unit and deterministic browser
coverage. For real local JWT/role and ownership checks, use the disposable Sludge
stack, then reset it to remove the synthetic identities and assignments. Replace
the two placeholder paths below with the absolute paths to your local checkouts:

```sh
SLUDGE_CHECKOUT="/path/to/Sludge"
APARTMENDER_CHECKOUT="/path/to/apartmender"

cd "$SLUDGE_CHECKOUT"
npm run supabase:reset
npm run supabase:lint
npm run supabase:test
cd "$APARTMENDER_CHECKOUT"
SLUDGE_REPO="$SLUDGE_CHECKOUT" \
SUPABASE_CLI="$SLUDGE_CHECKOUT/node_modules/.bin/supabase" \
npm run test:teacher:local
cd "$SLUDGE_CHECKOUT"
npm run supabase:reset
```

The local browser test substitutes only password-token acquisition because local
password login is disabled; Auth validation and protected RPCs use real local
JWTs. Real invitation delivery, browser release, and hosted checks remain the
final Teacher rollout (`sludge-nsj.6`). Never run the fixture on a hosted project.
