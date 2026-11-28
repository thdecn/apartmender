# Retained practice-card bundles

| Piece | Cards | Written measure labels | Bundle |
| --- | ---: | --- | --- |
| Mozart K.545, I. Allegro | 73 | 1–73 | [Folder](mozart-k545-1-allegro/README.md) · [ZIP](archives/mozart-k545-1-allegro.zip) |
| Chopin Nocturne in E-flat major, Op.9 No.2 | 35 | Pickup 0, then 1–34 | [Folder](chopin-op9-no2-nocturne/README.md) · [ZIP](archives/chopin-op9-no2-nocturne.zip) |

Cards export from last measure to first, following Artmender's convention.
Each earlier card includes the next measure through its first sounding onset
on each staff. Warm Up will browse its selected Mozart measures chronologically.
The Chopin bundle is a separate repertoire request and does not change Warm Up.

Each bundle retains its original encoded score, reference PDF, source and
license evidence, prepared notation, editable card files, PNGs, fingering
records, manifests, visual-review samples, native render logs and checksums.
The standard PNGs are 1170 × 2532 pixels. Sources and adapted score assets carry
CC BY-SA 3.0 attribution in each bundle.

Chopin bar 32 contains the full unmetered cadenza on one system. It is unusually
small in the phone PNG; a scalable PDF and high-resolution PNG are retained
under that bundle's `companions/` directory.

The [generation instructions](../scripts/artmender_cards/README.md) explain
preparation, generation, validation and packaging. The exact local Artmender
runtime and dependency lock are retained under `runtime/artmender/` so future
reproduction does not depend on lost temporary helpers. Each ZIP contains the
piece bundle, runtime and reproduction scripts.

These are local deliverables. Application integration and the Student
enablement flag remain separate work described in the [design audit](../docs/focused-practice-review.md).
