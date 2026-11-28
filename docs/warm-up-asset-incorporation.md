# Warm Up asset/spec incorporation

28 November 2026; issue [#88](https://github.com/thdecn/apartmender/issues/88),
planning Bead `sludge-5l8.2`. Base: accepted main
`7f230fd3096548cc1c9b2b320ab7444d95afdbf2`.

The already generated `sludge-bv7` deliverables were copied byte-for-byte from
the owner's retained local files into this isolated worktree. Generation is
not repeated or counted as new unfinished work. The original saved checkout
and unrelated edits remain unchanged. This PR enables no application flow,
catalogue entry, backend read, timer or hosted operation.

## Retention and integrity

| Bundle | Complete cards | Retained checksums | Archive entries |
| --- | --- | --- | --- |
| [Mozart K.545 I](../artmended/mozart-k545-1-allegro/README.md) | 73, written 1–73 | 283 | 313 |
| [Chopin Op.9 No.2](../artmended/chopin-op9-no2-nocturne/README.md) | 35, pickup 0 and 1–34 | 181 | 211 |

The source encodings, reference PDFs, editable card notation, PNGs, native
source anchors, whole-piece first-onset fingering records, provenance/licenses,
render logs and visual samples are retained. Every recorded checksum and both
archive CRCs pass; every archived byte matches its retained workspace file.
All 12 runtime snapshot hashes match. `uv.lock` versions match each bundle's
recorded generator inputs: PianoPlayer 3.0.2, Pillow 12.3.0, python-ly 0.9.10,
music21 10.5.0. Original generation used Python 3.13.13 and LilyPond 2.26.0;
this incorporation does not claim a new engraving run.

Sources/adaptations carry CC BY-SA 3.0 and original attribution. No source
edition or retained output was silently replaced. Follow the retained
[reproduction instructions](../scripts/artmender_cards/README.md); prefer the
saved runtime/lock over an arbitrary sibling checkout. The offline integrity
command uses Python 3.11+:

```sh
python3 -B tools/validate-warm-up-assets.py
```

## Inactive public map

[measure-map.json](warm-up/mozart-k545-1-allegro/measure-map.json) selects exactly
the 23 Mozart complete measures 1–11, 13–17, 18–20 and 22–25. It binds written
measure labels, existing next-measure landing, source card path and PNG SHA256.
Copied public PNGs match the retained bytes. The existing first sounding onset
per staff, with preceding rests, remains intact; the landing is not another
complete card. Original attribution is also adjacent to the public images.

The later `.4` passage model owns chooser data and chronological browsing.
Chopin remains separate repertoire and never enters the Warm Up library.

## Visual spot checks and limits

Fresh inspection compared retained card previews with retained reference-score
pages: Mozart measures 1, 37 and 73 against reference pages 1, 3 and 5; Chopin
pickup 0, measures 18 and 34 against reference pages 1, 2 and 3. Both staves,
the sampled note/rest patterns and terminal/landing behavior match. Original
source slurs can cross excerpt boundaries; this does not establish a new
note-by-note editorial review or certification of every fingering suggestion.
The earlier broader sampled visual-review records remain in each manifest.

Chopin 32 was also inspected against reference page 3: the full unmetered
cadenza remains one system. Its standard phone-size PNG is too small for
comfortable reading; the scalable PDF and high-resolution PNG companions are
retained. No new subdivisions, omitted cadenza notes or app zoom are introduced.
Existing nonfatal excerpt-spanner/spacing warnings remain in the manifests
and render logs, not relabeled as fatal errors or silently discarded.

Fresh checks: bundle/archive/runtime/map integrity passes; 193 Node tests pass
with one existing opt-in local-Supabase skip; existing catalogue baseline
passes for 6 Pieces/157 assets. No physical-device, hosted or complete musical
review is claimed by these incorporation checks.

## Remaining delivery

The [MVP](focused-practice-mvp.md), [audit](focused-practice-review.md) and
[roadmap](focused-practice-roadmap.md) retain owner decisions, both closed gates,
the setup exception, one shared two-Bead daily cap and manual review/merge/
deployment boundaries. Current accepted Student Home already has `piece-list`
from #44; later `.9` reuses it and preserves comments/assignment order/count.
Keep `.2` / #88 open until this focused PR is reviewed and incorporated. Other
application, operator and fresh device acceptance remain their own children.
