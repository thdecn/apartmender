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
