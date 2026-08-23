# Apartmender v1 product specification

Status: accepted planning baseline for implementation.

## Destination

Evolve Apartmender from a public static practice frontend into an invite-only practice service for Teachers and Students while retaining GitHub Pages for the frontend. Deliver the work as independently reviewable changes. Autonomous work may proceed through draft pull requests; a person remains responsible for pull-request readiness, merging, and billing decisions.

## Product boundary

Apartmender owns the practice experience and the Teacher/Student service described here. Artmender continues to generate catalog content and is not part of this product change.

The first release includes:

- invite-only Teacher and Student accounts;
- manually Assigned pieces from the existing catalog;
- current Practice-cycle Pointers and per-piece Practice totals;
- a Teacher view for managing Pointers and consulting totals;
- Lesson-driven Practice-cycle rollover; and
- a locally persisted Normal/Hard practice-mode preference.

The first release does not include:

- public registration;
- Teacher-created accounts;
- self-service account recovery;
- multiple active Teachers for one Student;
- in-app catalog or piece administration;
- resuming a Practice session after a page reload;
- surveillance or anti-cheating scores; or
- Artmender interface changes.

## People and access

### Operator

The Operator administers Apartmender outside the ordinary Teacher and Student interface. In v1, the Operator:

- creates, enables, disables, and recovers accounts;
- assigns existing catalog pieces to Students based on Teacher requests;
- establishes the active Teacher–Student relationship; and
- holds the privileged backend credentials.

The Operator does not share an account or credentials with a Teacher or Student. Privileged credentials must never be present in the GitHub Pages frontend.

### Teacher

A Teacher has one or more Students. A Teacher can:

- see only Students for whom they are the active Teacher;
- consult each Student's current Practice totals by Assigned piece;
- create, edit, order, and remove the current Practice cycle's Pointers; and
- record a Lesson, ending the current Practice cycle and starting the next one.

### Student

A Student has exactly one active Teacher. A Student can:

- see only their own Assigned pieces;
- see zero to three current Pointers above their pieces;
- see their current Practice total for each Assigned piece; and
- practise a piece in Normal or Hard mode.

## Invite-only onboarding and login

Every Teacher and Student supplies a unique, working email address during onboarding.

1. The Operator creates the account with the correct protected role and a strong temporary password.
2. Public signup remains disabled.
3. The Operator privately hands the user their email login and temporary password.
4. On first login, the user chooses a new password.
5. The authenticated Profile determines whether the Teacher or Student interface is shown; the user never selects their own role.
6. The browser persists and refreshes the authenticated session so sign-in is rare.
7. The Operator handles recovery in v1 without retrieving or storing the old plaintext password.

An enabled state provides reversible access control. Disabling an account must immediately deny ordinary data access even if a previously issued access token has not yet expired. Historical learning data is retained until a separate deletion or retention decision applies.

## Assigned pieces

The Operator manually assigns pieces from Apartmender's existing catalog to each Student based on their Teacher's request. Catalog authoring and uploads remain outside this interface.

An assignment is historical: removing a piece from the current roster must not corrupt earlier Practice cycles or Practice totals.

## Practice cycles, Lessons, and Pointers

A Practice cycle is the interval over which Pointers and Practice totals are grouped.

- A Student's first Practice cycle begins during onboarding.
- Recording a Lesson atomically closes the current Practice cycle and begins a new one.
- The new cycle begins with no Pointers and zero current-cycle Practice totals.
- Historical cycles and their data are retained, although v1 only needs to display the current cycle.

A Practice cycle has zero to three ordered Pointers. Each Pointer:

- contains one sentence describing what to focus on;
- is limited to 240 characters; and
- is editable only by the Student's active Teacher.

## Practice time

The existing foreground-visible Practice timer is the source of Practice time.

- Visible active time is accumulated into the current Practice cycle's total for the active Assigned piece.
- Partial Practice sessions count.
- Time while the page is hidden does not count.
- Retried network writes must not double-count time.
- Students and their active Teacher see the same aggregate.

Practice time is trusted coaching information, not verified evidence. V1 does not attempt surveillance, cheating detection, background audio recording, or performance scoring.

## Practice modes

The home page has a Normal/Hard toggle at the bottom. The choice persists in the browser. A new browser defaults to Normal mode.

### Normal mode

A Practice session progresses through Practice cards from the end of the piece to the beginning. The session ends after every Practice card has been completed.

### Hard mode

At the start of a Practice session, Apartmender creates a fixed random permutation of all Practice cards.

- Every Practice card appears exactly once in progression.
- There are no duplicates or omissions.
- Advance moves from the current random target to the next random target after the existing Good threshold is met.
- Arrows and swipes browse in musical/bar order rather than random progression order.
- The Student may browse freely; Good and Mistake are disabled while browsing away from the current random target.
- Resume returns to the current random target.
- The random target needs no separate visual treatment.
- Reloading the page may discard the active Practice session in v1.

## Architecture and security boundary

- GitHub Pages continues to host the static HTML, CSS, JavaScript, manifest, catalog, and Practice-card assets.
- Supabase Auth manages accounts and persistent sessions.
- Supabase Postgres stores application data and calculates aggregates.
- The browser accesses data through the Supabase Data API using a publishable key and the signed-in user's token.
- Row Level Security and least-privilege grants enforce Student ownership, active Teacher relationships, protected roles, and enabled-account state.
- Only trusted Operator tooling may use the Supabase secret key that bypasses Row Level Security.
- Every protected operation requires positive and negative authorization tests for anonymous users, the owning Student, the active Teacher, and an unrelated Teacher.

The initial hosted environment uses the Supabase Free plan in a specific EU region. A human billing decision is required before any paid upgrade. Free-plan pausing and the lack of automatic backups make independent export/restore procedures part of pilot readiness.

Before real Student onboarding, the Operator must settle the applicable privacy notice, retention/deletion policy, controller responsibilities, and any requirements arising from the Students' ages and jurisdictions.

## Deferred research

Possible future practice-integrity experiments include Web MIDI, local-only sound analysis, and analysis of existing Good, Mistake, and Advance activity. These are research topics only and must not silently become surveillance or a cheating score.

## Delivery contract

Implementation is divided into dependency-ordered GitHub issues and reviewable draft pull requests.

- The minimal JavaScript test foundation precedes Hard mode.
- The Practice-mode lane can proceed without the backend.
- The account/data lane begins once the Supabase project and local Operator credentials are available.
- When one lane is waiting for review or setup, independent work in the other lane may continue.
- Each pull request includes acceptance evidence and identifies deferred work.
- Autonomous work stops at pull-request readiness, merge decisions, and billing decisions.

