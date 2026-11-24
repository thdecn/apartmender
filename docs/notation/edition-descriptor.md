# Fixed Bach notation descriptor v1

This is #60 / Sludge `sludge-s16.13`, extending the merged
[Piece Catalog](../piece-catalog.md). One shared public catalogue entry keeps
the permanent Bach slug, current title and Assignment/history lookup. It adds
an optional `notation` representation while retaining all legacy PNG fields.
The descriptor is public data; no private overrides or Student copies belong
in it. Publication alone does not activate a Practice/Teacher route.

## Representation and edition identities

The catalogue's existing `version`, ordered string `cards` and `cardAssets`
continue to describe the complete **PNG** representation. Existing cached
image clients can consume those fields unchanged. Their six slugs, titles,
card orders, complete-version values and 157 asset bytes remain identical.

Bach additionally declares:

```json
{
  "notation": {
    "editionId": "sha256:<exact accepted MusicXML digest>",
    "manifestSha256": "<exact accepted complete note-index digest>",
    "version": "sha256:<exact descriptor-file digest>",
    "descriptor": { "url": "notation/editions/bach-bwv-779-invention-no-8.v1.json", "sha256": "<descriptor digest>" }
  }
}
```

The notation complete-version identity hashes the exact descriptor bytes.
The descriptor transitively binds the accepted uncompressed MusicXML, complete
index, source provenance, Verovio 6.3.0 manifest and every listed renderer
JS/WASM/font/notice/source file, plus the index/projector/renderer/preview/
validator JavaScript and stylesheet. WASM and the actual font data remain
embedded in the pinned runtime; the vendor manifest identifies their exact
versions and hashes. No runtime or source files are copied here.

`editionId` is a different identity: it addresses immutable source notes and
the backend's registered fingering scope. The complete notation version may
change for an explicitly reviewed compatible renderer/settings update without
changing source-note identity. Source or index replacement under the initial
Bach identity is rejected. Future editions need a newly reviewed permanent
Piece slug, separate registration/descriptor support and no automatic transfer
of Assignments, Practice history or private overrides. The v1 verifier is
deliberately bounded to the accepted 34-measure/598-pitched-note pilot pair.

The descriptor follows Sludge's
[public edition contract](https://github.com/thdecn/Sludge/blob/main/docs/score-fingering-api-v1.md):
descriptor/index/projection versions 1, `downbeat-attacks`, exact score/index
hashes and same-origin paths. It also declares the current engraving options
from the same frozen object actually passed to Verovio, rather than maintaining
an independent settings copy. `cards` gives canonical measure/card identities
in reverse Practice order: `m000034` has no preview; `m000001` previews
`m000002`. Notes keep the complete index's individual IDs and rest ordinal gaps.

## Validation and deliberate regeneration

```sh
node tools/build-notation-descriptor.mjs --write
npm run validate:catalog -- --baseline origin/main
node tools/build-bach-index.mjs
npm test
npx playwright test e2e/notation-descriptor.spec.js e2e/catalog.spec.js e2e/score-renderer.spec.js --workers=1
```

The explicit builder refuses any changed accepted source/index, computes
dependency hashes, validates the prospective descriptor and updates only the
descriptor and notation pointer. It never repins replacement music to this
Piece. The PNG builder remains separate and updates legacy image declarations,
leaving notation metadata intact. Validation itself never rewrites hashes.

Catalogue validation verifies the descriptor digest/version and all dependency
bytes; it rejects missing/changed assets, manifest identity/version mismatches,
unsupported extraction/settings, duplicate/invalid note identities, and wrong
card order/preview identities. The baseline check additionally prevents removing
or changing an incorporated source/index binding under its existing slug.
The independent source-index generator checks the accepted XML against its
reviewed inventory; browser tests also reparse the source and compare the whole
served index. Maintainers must run these checks before merge/deployment.

## Consumer and offline-cache contract

Future public and private hosts resolve **the same** `piece.notation` pointer.
They verify its descriptor bytes first, then every required dependency against
those declared hashes and validate the model before adopting it. Never combine
a newly fetched source with a cached index or runtime from another descriptor.
`verifyNotationDescriptor` is the shared pure schema/membership check; it does
not fetch or execute resources and does not replace byte verification.

For #38 complete-version caching, keep representation-specific entries:
`piece.version` identifies PNG assets; `piece.notation.version` identifies the
complete notation dependency set. Cache notation source/index, required runtime
and authored modules/CSS together under that exact version; preserve public
license/source links. The manifest marks its two runtime imports separately
from downloadable source archives and notices. Commit a complete verified
replacement atomically and adopt it only on the next Piece opening. An Open
Practice Session stays on the representation/version it opened; adding this
descriptor must not rewrite queued events or swap notation mid-Session.

This ticket defines/verifies that content contract. It does **not** implement
#38 preloading/eviction, an executable versioned-module loader, offline fingering
queues, or a production pilot switch. #61/#63/#64/#65 own actual host loading,
including ensuring executed module bytes match the verified complete set;
unverified bare-URL module caches are not a substitute. Missing or mismatched
notation must fail visibly rather than imply a personalized PNG fallback.
Fresh platform evidence and release authorization remain #66 / `.19` and `.8`.
