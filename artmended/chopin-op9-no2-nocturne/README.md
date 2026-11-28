# Frédéric Chopin — Nocturne in E-flat major, Op.9 No.2

35 cards, in reverse written order. Each PNG is 1170 × 2532; editable LilyPond files sit beside it. Every earlier card includes the next measure through each staff's first sounding onset. The final measure stands alone.

Original encoded notation, reference PDF and source/license evidence are in `source/`. Native preparation and source-anchor audits are in `preparation/`; complete-piece fingering results are in `fingering.json`. Source fingerings are preserved; generated first-onset suggestions are parenthesized and use hand size M.

Automated checks passed for count, reverse order, landings, dimensions, nonempty images, source onset anchors, valid digits, and native engraving. Visual reference comparisons covered measures 0, 1, 13, 18, 21, 23, 24, 31, 32, 34. These are spot checks, not a note-by-note editorial review of every card.

Excerpt boundaries can leave slurs, phrasing slurs, hairpins, text spanners or beams without their other endpoint. Native render logs and warning counts are retained in `validation/` and `manifest.json`. Card terminal barlines are normalized; consult the original/prepared score for performance repeats. Nonfatal spacing warnings are retained for review; sampled dense cards still fit one grand staff.

## Cadenza readability

Measure 32 is an unusually long unmetered cadenza. Its notes remain intact on one system, making the standard phone card too small for comfortable reading. Use `companions/m32-cadenza.pdf` or the high-resolution PNG beside it for inspection. This bundle adds no app zoom or split-measure behavior.

## Reproduce

See `scripts/artmender_cards/README.md` at the archive/workspace root. The exact Artmender Python sources and dependency lock are retained under `artmended/runtime/artmender/`. Temporary rendering caches are disposable. Sources, adapters, output and provenance are retained in the archive.

See `LICENSE-AND-ATTRIBUTION.md` for the score's CC BY-SA 3.0 attribution and adaptation details.
