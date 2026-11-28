# Warm Up asset/spec incorporation

28 November 2026; issue [#88](https://github.com/thdecn/apartmender/issues/88),
planning Bead `sludge-5l8.2`. Base: accepted main
`7f230fd3096548cc1c9b2b320ab7444d95afdbf2`.

The approved Mozart deliverables were copied byte-for-byte from the owner's
retained files. The owner selected Chopin's Prelude in E minor, Op.28 No.4
for the separate repertoire bundle. Its 26 cards were generated using the
[Artmender workflow](../scripts/artmender_cards/README.md), native LilyPond
and whole-piece fingering inference. This correction resumes the same .2
Bead. Saved checkouts remain unchanged. No app flow, catalogue entry,
backend read, timer or hosted operation is enabled.

## Retention and integrity

| Bundle | Complete cards | Retained checksums | Archive entries |
| --- | --- | --- | --- |
| [Mozart K.545 I](../artmended/mozart-k545-1-allegro/README.md) | 73, written 1–73 | 283 | 315 |
| [Chopin Prelude Op.28 No.4](../artmended/chopin-op28-no4-prelude/README.md) | 26, pickup 0 and 1–25 | 114 | 146 |

Each bundle retains original notation, reference PDF, editable cards, PNGs,
source anchors, complete-piece fingering results, provenance/licenses,
render logs and visual samples. Checksums, archive CRCs, archive contents and
all 12 runtime hashes pass. The runtime lock matches PianoPlayer 3.0.2,
Pillow 12.3.0, python-ly 0.9.10 and music21 10.5.0. Both generations used
Python 3.13.13 and LilyPond 2.26.0. Mozart was not re-engraved; only its ZIP
was repacked with the updated shared reproduction helpers.

Mozart's encoding and adaptations carry CC BY-SA 3.0. The
[Prelude source](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=468)
is a public-domain encoding by Magnus Lewis-Smith, after Peters 1879.
Its original LilyPond/PDF hashes and primary source/license pages are retained.
Its native original/prepared audit matches 257 pitched events, containing
602 notes, by staff, pitches and durations. Native source-anchor matching
also checks every parsed event. The audit's multiset comparison alone does
not establish event order; aligned measure/timing checks and reference
spot checks supplement it. The Prelude adapter documents the scoped
PianoPlayer octave-chord compatibility; hand size and motion geometry remain M.

Follow the retained [reproduction instructions](../scripts/artmender_cards/README.md)
and runtime/lock. The offline integrity command uses Python 3.11+:

```sh
python3 -B tools/validate-warm-up-assets.py
```

## Inactive public map

[measure-map.json](warm-up/mozart-k545-1-allegro/measure-map.json) selects exactly
the 23 Mozart complete measures 1–11, 13–17, 18–20 and 22–25. It binds written
measure labels, existing next-measure landing, source card path and PNG SHA256.
Public PNGs and adjacent attribution remain byte-identical to the approved
retained bundle. Both staff landings retain their first sounding onset and
preceding rests. A landing is not another complete card.

The later .4 passage model owns chooser data and chronological browsing.
Chopin remains separate repertoire and never enters the Warm Up library.

## Visual spot checks and limits

Mozart measures 1, 37 and 73 were compared with retained reference pages
1, 3 and 5. The new Prelude comparisons cover pickup 0 and measures 1, 9,
11, 12, 13, 16, 18, 23, 24 and 25 against its one-page reference: both staves,
ornaments/tuplets, Largo/stretto, pedal brackets and final cross-staff voicing.
Every Prelude card engraves on one system at 1170 × 2532 pixels, with
parenthesized native fingering suggestions and consistent next-onset landings.
Its final measure stands alone. The pickup's lower staff is correctly a rest.

Source slurs and other spanners can cross excerpt boundaries; nonfatal
warnings remain in manifests/render logs. The card-16 stretto spanner is
closed at the excerpt boundary so its label remains visible. Spot checks
are not an exhaustive editorial review or fingering certification.

Fresh checks: bundle/archive/runtime/map integrity, original/prepared Prelude
note preservation, aligned written-measure timing and generation reproducibility
pass. Regression tests exercise inference-only and packaging on disposable
copies of both bundles, proving retained bytes survive inference and native
anchor evidence resolves in each folder/archive. The offline gate rejects
missing anchor evidence. All 193 Node tests pass with one existing opt-in local-Supabase skip;
the catalogue remains 6 Pieces/157 assets. No fresh physical-device or
hosted observations are claimed.

## Remaining delivery

The [MVP](focused-practice-mvp.md), [audit](focused-practice-review.md) and
[roadmap](focused-practice-roadmap.md) retain owner decisions, both gates,
the setup exception, shared two-Bead daily cap and manual review/merge/
deployment boundaries. Accepted Student Home already has `piece-list`
from #44; later .9 reuses it and preserves comments/assignment order/count.
Keep .2 / #88 open until this PR is reviewed and incorporated. Application,
operator and fresh device acceptance remain their own children.
