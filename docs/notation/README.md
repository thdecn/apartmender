# Immutable MusicXML index v1

`score-index.js` is the bounded public score-processing module for #57 /
Sludge `sludge-s16.10`, following the
[immutable score contract](https://github.com/thdecn/Sludge/blob/main/docs/score-fingering-api-v1.md).
It performs no network, Auth, Supabase, private-storage or renderer operation.
It is not connected to existing Practice routes or the Piece Catalog yet.

## Interface and identity

```js
const { index, createDocument } = await indexScore(bytes, {
  slug,
  editionId, // expected SHA-256 of exact uncompressed source bytes
  inventory, // optional full independently reviewed identity inventory
});
```

`bytes` must be a nonempty `Uint8Array`, at most 8 MiB. The module copies it
before awaiting Web Crypto, checks the expected digest before decoding/parsing,
and rejects malformed UTF-8/XML, DTDs/entities and unsupported score shapes.
Web Crypto requires the existing HTTPS application origin (or loopback for
local tests). Changing whitespace is still an edition change.

The deeply frozen `index` has `manifestVersion: 1`, `indexVersion: 1`, slug,
edition ID, source part ID and ordered measures. Measure IDs come from source
occurrence ordinals (`m000001`), including pickups and repeated printed labels.
Pitched-note IDs use ordinals among **all** direct note children, including
rests (`m000001-n000002`). Chord tones, grace notes and tie continuations each
have their own identity. Source XML IDs, pitch sorting, screen/card positions
and generated SVG IDs never assign identity. Rests are indexed separately and
are not fingering targets. Final `nextMeasureId` is null.

`createDocument()` returns a fresh detached XML clone with canonical measure
and note IDs, including IDs on rest elements to preserve ordinal gaps. Edit
only such copies. Projection/pagination must retain their canonical IDs and
look up the original index; do not re-index an extracted or edited fragment
as the source edition. Copy extraction and fingering-edit tests prove that
other copies, source bytes and the frozen index remain unchanged. Actual
projection/re-engraving remains #58/#59.

`assertScoreInventory(index, expected)` rejects missing, duplicate or foreign
targets, wrong editions/Pieces/parts, ordering/label/next-measure mismatches and
pitch/time/staff/voice mismatches. JSON object-key ordering is irrelevant.
The expected inventory must itself be bound to the trusted descriptor/hash;
the later loader/catalog task owns fetching and validating that descriptor.

## Musical context and deliberate limits

Durations/onsets are reduced rational quarter-note units, using exact BigInt
arithmetic before checked safe-integer JSON output. Chords do not advance the
cursor; backup/forward handle independent voices. Chord members may be on
different staves but must have the same voice, grace status and duration.
This bounded implementation rejects unequal-duration chords rather than
misrepresenting the broader MusicXML case. See the W3C
[chord](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/chord/)
and [backup](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/backup/)
definitions.

Each measure records starting/ending key, meter, divisions and G2/F4 clefs,
plus timed context changes. Each note records its effective key/meter/clef,
prior accidental alteration for that staff/pitch/octave, explicit accidental,
beam values, tuplet ratio, tie-start/stop flags and grace-main-note identity.
Accidental state resets at each bar. Ties require matching contiguous pitch
and voice across occurrences; grace groups require a same-onset pitched main
note in their voice. Cross-staff notes retain source voice and identity;
staff 1/right and staff 2/left remain presentation heuristics, not detected
hands. Only explicit single `L1`–`L5` / `R1`–`R5` original fingerings are
resolved; number-only, substitution, alternate or multiple annotations require
musical clarification and are rejected. The accepted Bach source has none.

The index accepts one unnamespaced `score-partwise` piano part, two staves,
1–1,024 measures, up to 4,096 source notes per measure and 65,536 pitched notes
overall. Full measures must fit their meter; explicitly implicit pickups may
be shorter. Unsupported features fail explicitly, including multiple parts,
unpitched/cue notes, transposition, nonstandard keys/meters/clefs, mid-measure
key/time/divisions changes, repeats/endings, unmatched ties and unanchored
graces. There is no generic catalogue conversion or experimental fixture
allowlist. Original notation/metadata remains in each source-derived clone.

## Fixed Bach artifact and verification

The [public index](../scores/bach-bwv-779-invention-no-8/score-index.json)
is generated from the accepted exact score, not from rendered SVGs or card
excerpts. It contains 34 ordered measures, 598 pitched notes and 11 rests,
matching the separately reviewed source inventory. Its SHA-256 is
`85f4e0bbdc778d67d316949b695dc0a3717d7d4d54c17a6ca9d09ce54ff6a057`.
The score edition stays
`sha256:2d9973db07428c5390ea4f8c2c1518f29834022db5d788682f37d8fcf3765b49`.
Later descriptor/private registry work must bind the exact index digest and
independently verify it against the source before import.

Install the existing development dependencies (`npm install`), then:

```sh
node tools/build-bach-index.mjs          # compare published bytes with regeneration
node tools/build-bach-index.mjs --write  # deliberate index regeneration for review
npx playwright test e2e/score-index.spec.js --workers=1
npm test
```

The generator uses the existing local test server and Playwright development
dependency; neither is shipped as a browser dependency. Chromium tests cover
the complete first/penultimate/final Bach occurrences, independent reparses,
source-copy isolation, extraction/page regrouping, multiple voices, repeated
labels, cross-staff chords, tie/grace grouping, explicit fingerings, exact
tuplets/gaps, timed clefs and rejected malformed/unsupported inventories.
These are automated browser checks, not physical-device or owner UI evidence.
Live routing, public/private integration and fresh device tests remain later
dependent work.
