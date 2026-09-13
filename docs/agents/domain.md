# Domain documentation

Apartmender is a single-context frontend repository. It intentionally links to, rather than duplicates, the shared Apartmender V1 domain documentation in Ember.

## Read before exploring

- Read [Ember's canonical `CONTEXT.md`](https://github.com/thdecn/Ember/blob/main/CONTEXT.md).
- Read the [Apartmender V1 specification](https://github.com/thdecn/Ember/blob/main/docs/specs/apartmender-v1.md).
- Read the [relevant system-wide ADRs in Ember](https://github.com/thdecn/Ember/tree/main/docs/adr).
- Read relevant local ADRs under `docs/adr/` if that directory exists.

Follow the canonical links supplied by the issue being implemented.

## Cross-repository authority

Ember owns the shared vocabulary, V1 specification, system-wide ADRs, persistence, authorization, backend contracts, migrations, and privileged operations.

Apartmender owns its framework-free static GitHub Pages implementation: General Practice, Student and Administrator browser interfaces, public Piece Catalog and assets, Practice Flow, browser persistence, authenticated timing, and offline-client behavior.

General Practice remains a public, unrecorded experience. It initializes no Supabase operation, makes no Auth or Supabase calls, uses no Ember capability, neither reads nor writes private or authenticated state, and creates no personal Practice record.

A browser bundle may contain only public Supabase client configuration. Privileged credentials and backend implementation remain in Ember.

Changes spanning both repositories require separate linked issues and independently deployable changes.

## Vocabulary and decisions

Use terms exactly as defined in Ember's `CONTEXT.md`. Surface conflicts with an existing ADR rather than silently overriding it.

Record a future decision in Apartmender only when it is confined to static frontend implementation and does not alter a shared contract or backend behavior. Shared decisions belong in Ember.
