# Complete-measure card projection

`measure-card.js` implements Apartmender #58 / Sludge `sludge-s16.11` over the
[validated immutable score index](README.md). It transforms musical XML, with
no network, Auth, Supabase, renderer, private fingering or current-route operation.
There is no fixture allowlist or CSS hiding of later pitched notes.

```js
const card = projectMeasureCard(loadedScore, 'm000033');
// loadedScore is the result of indexScore(exactBytes, trustedOptions).
const xml = new XMLSerializer().serializeToString(card.document);
```

The result contains a fresh mutable `document`, immutable edition/slug and
`projectionVersion: 1`, `currentMeasureId`, nullable `previewMeasureId`,
`currentNoteIds`, `previewNoteIds`, `previewByHand: { R, L }` and `boundaryTies`.
The metadata and its arrays are frozen. Each invocation creates its own copy;
editing it cannot change another card, the shared index or original score.
Never re-index a projected/edited copy as the immutable source edition.

## Selection and identity

Current occurrences come from the ordered manifest, including repeated printed
labels. Every current note/rest and its source notation remains complete.
At the beginning of the current excerpt, inherited divisions, key, meter and
both clefs are materialized. Existing timed changes remain in their musical
positions. Source pagination hints and measure widths are removed so they do
not force the original full-score layout onto the card.

The next occurrence contributes every non-grace pitched note at exact onset
zero that is not a tie continuation. This includes every newly attacked chord
member across **all voices**, rather than just the first event or the first
non-rest event of each hand. A hand resting initially contributes no later
entry; a tied tone does not become a new attack. Grace notes are included only
if their indexed main-note identity is eligible. Source IDs, pitches, explicit
accidentals, staff/voice, original fingerings and exact durations remain intact.

`previewByHand.R` aggregates staff 1 and `.L` aggregates staff 2, including
eligible grace IDs. This is a presentation heuristic, not automatic hand
detection. Cross-staff chords keep their explicit source staff/voice and
identity. Explicit fingering hands never change musical preview membership;
future hand-position inference would require a separate reviewed design.

If filtering removes a tied chord head, its first newly attacked retained member
becomes the chord head without changing identity or pitch. An original eighth
note still has its source type/duration; it is not lengthened to fill a bar.
Exact integer source-division padding and backups retain independent voice
timing. Empty staves use unpitched, nonprinting spacer rests with no target IDs;
no omitted pitched note survives as a hidden element. The renderer must retain
both staves (`condense: none` in the compatibility probe). Visual space compaction
and interaction belong to renderer #59.

The final source measure has `previewMeasureId: null`, empty preview lists and
only one output measure. First/penultimate/final mappings never use image names.

## Ties, grace beams and tuplets at excerpt boundaries

Current source ties are retained, including an incoming/outgoing boundary cue
when its other endpoint is outside the complete current bar. `boundaryTies`
names those current IDs separately (`incomingCurrent`, `outgoingCurrent`).
Preview tie continuations are absent; a newly attacked preview note that starts
a later tie has its out-of-excerpt tie marks removed, with its original ID in
`outgoingPreview`. The immutable index retains the complete original tie flags.
No omitted tie endpoint is replaced with a new attacked note.

One isolated main-note downbeat chord has no later beam endpoint, so its beams
are removed and its note type supplies flags. Entire eligible grace groups
retain separate source beam runs and secondary hooks; a grace beam extending
outside that selected group fails explicitly instead of inventing grouping.
Complete selected slur/tuplet pairs remain. Orphan span marks are removed;
an isolated tuplet event keeps its exact `time-modification` ratio and a closed
single-event bracket. The complete current bar's beams/tuplets are unchanged.

These rules use MusicXML's distinctions between
[musical-order attributes](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/attributes/),
[chord cursor behavior](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/chord/),
[sound/notation ties](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/tie/)
and [beam levels/hooks](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/beam/).
The existing index's supported MusicXML subset still applies. This is not a
generic converter, unfolding/repeat engine or correction to the accepted score.

## Verification

```sh
npx playwright test e2e/measure-card.spec.js e2e/score-index.spec.js --workers=1
npm test
```

23 November 2026: 16 projection checks plus 21 existing index checks passed in
Chromium. They verify all 34 Bach cards in backward order against the independent
review inventory, exact current-note XML, source/copy isolation, complete
multi-voice chords, early/late entries, rest-only previews, tied-head removal,
barline/internal ties, grace eligibility, separate beam runs/hooks, tuplets,
inherited/timed context and explicit accidentals. Existing Node checks passed
119 tests with one local-Sludge integration skipped.

A separate compatibility probe used the existing experiment's pinned Verovio
6.3.0-425dd7b assets without adding them to the product: all 34 Bach cards
imported and engraved, with all 663 expected current/preview pitched IDs and
empty import logs. Additional truncated-tuplet and tied-chord-head fixtures also
imported/engraved with exact note identities and empty logs. The public source
and index assets remain unchanged. Renderer
packaging, route integration, responsive sizing/selection and fresh physical
Safari/iPhone/iPad usability evidence remain their dependent gates.
