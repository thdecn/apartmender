# Public Piece Catalog v1

`pieces.json` is the single shared public catalogue for public Practice,
authenticated Student Practice and current/historical title joins. This is
the additive #23 contract. The original array and `id`, `label`, `cards` and
`version` fields remain compatible with existing PNG clients. No Piece source,
card image, Assignment, private fingering or Practice history is duplicated.
The [notation descriptor extension](notation/edition-descriptor.md), #60 /
Sludge `.13`, adds one separately versioned renderer representation without
changing the legacy PNG version or activating its routes.

## Records and complete versions

Each record retains one permanent `id` slug, current `label`, ordered PNG
`cards`, and complete `version`. Added fields:

- `catalogVersion: 1` identifies this metadata contract.
- `status: "supported" | "retired"` governs offering **new/reactivated**
  Assignments. Existing Active Assignments retain access to retired Pieces
  while their assets remain. Retirement alone does not remove public membership.
- `assetsAvailable: true | false` distinguishes available editions from
  metadata-only retired entries. Supported entries require `true`.
- Ordered `cardAssets: [{path, sha256}]` supplies a same-origin relative path
  and exact SHA-256 of each corresponding card's uncompressed bytes. Paths
  match `cards/<id>/<filename>`; arbitrary URLs and path traversal are rejected.

For PNG editions, `version` retains the existing algorithm: `sha256:` followed
by SHA-256 of compact JSON `{id,label,cards:[[filename,cardSha256],...]}` with
those fields in that order. Card ordering, metadata or byte changes therefore
change the complete-version identity. Retirement/availability and public-list
membership do not change the music/card content. Initial expansion preserves
all six previous complete-version identities and all 157 card files.

`piece-slugs.json` is the permanent-slug ledger. Add a new work with a new
never-reused slug in both files; retain every old slug and its metadata forever.
Title corrections may change historical display. Do not give another work or a
replacement notation edition an old slug. The validator checks catalogue/ledger
agreement and, with `--baseline`, refuses deletion of any baseline catalogue
identity. It cannot infer a maintainer's intent from a title change; permanence
also remains a review obligation.

## Independent General Practice Collection

`general-practice-collection.json` has `{collectionVersion:1,slugs:[...]}`.
Its order controls the public picker. It stores only catalogue slugs, never
copies Piece definitions or assets. Editing this list changes neither supported
Assignment eligibility nor the authenticated Student's assigned set. A retired
Piece may remain in General Practice if its assets are retained; an unknown,
duplicate or unavailable entry is invalid. An empty collection is valid.

The existing root public client resolves this list through `piece-catalog.js`.
It loads only public files and reports failed loads visibly without silently
offering the full catalogue. The future `/general/` route remains #24. The
authenticated home continues resolving its own durable Assignments directly
against the catalogue; it does not import the General collection. Retired
available entries still work; metadata-only entries produce the existing
unavailable-Piece state. No Auth or backend operation is added by this contract.

## Maintainer validation before merge/deployment

```sh
npm run validate:catalog -- --baseline origin/main
npm test
npx playwright test e2e/catalog.spec.js --workers=1
```

The first command verifies the collection, permanent ledger, supported/retired
states, unique ordered card declarations, per-card path/digest/bytes and complete
version. It fails for unknown/duplicate General slugs, missing/changed available
assets, inconsistent versions and removed historical identities. `npm test`
also validates the deployed catalogue; no browser login or backend is needed.
Run these checks **before** merging a change that GitHub Pages will publish.
This PR does not alter repository deployment or branch-protection settings.

For an intentional PNG content/title change only, review exact source edits,
then run `node tools/build-piece-assets.mjs --write` and inspect its digest and
version diff before validation. The validator never rewrites hashes to hide
drift. The builder rejects unsafe addresses and renderer entries rather than
silently applying the legacy PNG formula to future notation editions.

## Retirement and governed asset removal

1. Mark the Piece `retired`; keep its slug, title, card manifest, version and
   assets. Assignment management offers only supported entries for new or
   reactivated Assignments. Active retired Assignments remain usable.
2. Removing it from General Practice is a **separate** curated-list edit.
3. Before deleting assets, obtain an authorized protected backend result that
   **no Active Assignment exists** for that exact slug, and independently
   verify it is absent from the General Practice Collection. Keep the operator,
   target, time and result in restricted evidence. Either missing condition
   blocks removal. A static catalogue validator cannot prove backend state.
4. Only after those gates, set `assetsAvailable:false` and remove the files.
   Keep the retired metadata and the last complete ordered card manifest,
   digests and version for historical identity. General validation refuses
   membership, and static validation no longer expects those unavailable files.
5. A reviewed unretirement restores the same work's assets and complete version
   declarations, validates them and sets `supported`/`assetsAvailable:true`.
   Membership remains independent; do not silently recreate Assignments.

The issue's older Ember wording describes the product gate. **Sludge is now
the backend implementation authority** for the protected Active-slug check,
as specified in its [Piece Assignment contract](https://github.com/thdecn/Sludge/blob/main/docs/piece-assignment-backend-contract.md).
Do not call Ember or Sludge from public catalogue/General code, and do not put
operator credentials or private query results in public assets. See the
product [public-assets ADR](https://github.com/thdecn/Ember/blob/main/docs/adr/0004-keep-piece-assets-public.md)
and [complete-version ADR](https://github.com/thdecn/Ember/blob/main/docs/adr/0010-cache-complete-piece-versions-for-offline-practice.md).
