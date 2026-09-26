# Domain and backend authority

Apartmender is the V1 frontend repository. Sludge is the V1 Supabase backend
and the authority for Auth, persistence, authorization, migrations, privileged
operations, and the browser-facing backend contract. Ember remains a reference
for shared product vocabulary and the broader V1 product specification; it is
not the backend implementation authority.

## Read before exploring

- For product language and product behavior, read
  [Ember's `CONTEXT.md`](https://github.com/thdecn/Ember/blob/main/CONTEXT.md),
  the [Apartmender V1 specification](https://github.com/thdecn/Ember/blob/main/docs/specs/apartmender-v1.md),
  and relevant product ADRs.
- For browser/backend integration, read Sludge's
  [browser contract](https://github.com/thdecn/Sludge/blob/main/docs/apartmender-browser-contract.md),
  [student ownership contract](https://github.com/thdecn/Sludge/blob/main/docs/student-ownership-contract.md),
  and relevant backend ADRs.
- Read relevant local ADRs under `docs/adr/` if that directory exists.

Follow the canonical links supplied by the issue being implemented. If an
Ember document and Sludge disagree about Auth, data access, authorization, or
backend behavior, follow Sludge and surface the stale Ember statement.

## Cross-repository authority

Sludge owns the V1 Supabase backend: Auth configuration, database persistence,
authorization, browser contracts, migrations, backend functions, and
privileged operations.

Apartmender owns its framework-free static GitHub Pages implementation: General Practice, Student and Administrator browser interfaces, public Piece Catalog and assets, Practice Flow, browser persistence, authenticated timing, and offline-client behavior.

General Practice remains a public, unrecorded experience. It initializes no
Supabase operation, makes no Auth or Supabase calls, uses no Sludge capability,
neither reads nor writes private or authenticated state, and creates no
personal Practice record.

A browser bundle may contain only public Supabase client configuration.
Privileged credentials and backend implementation remain in Sludge.

Changes spanning both repositories require separate linked issues and independently deployable changes.

## Vocabulary and decisions

Use terms exactly as defined in Ember's `CONTEXT.md` for product concepts.
Use Sludge's contracts for backend and browser-integration behavior. Surface
conflicts rather than silently choosing the stale source.

Record a decision in Apartmender only when it is confined to static frontend
implementation. Product-wide vocabulary and specification decisions belong in
Ember; backend contracts and backend implementation decisions belong in
Sludge.
