# Retained practice-card bundles

| Piece | Cards | Written measure labels | Bundle |
| --- | ---: | --- | --- |
| Mozart K.545, I. Allegro | 73 | 1–73 | [Folder](mozart-k545-1-allegro/README.md) · [ZIP](archives/mozart-k545-1-allegro.zip) |
| Chopin Prelude in E minor, Op.28 No.4 | 26 | Pickup 0, then 1–25 | [Folder](chopin-op28-no4-prelude/README.md) · [ZIP](archives/chopin-op28-no4-prelude.zip) |

Cards export from last measure to first, following Artmender's convention.
Each earlier card includes the next measure through its first sounding onset
on each staff. Warm Up will browse its selected Mozart measures chronologically.
The Chopin bundle is a separate repertoire request and does not change Warm Up.

Each bundle retains its original encoded score, reference PDF, source and
license evidence, prepared notation, editable card files, PNGs, fingering
records, manifests, visual-review samples, native render logs and checksums.
The standard PNGs are 1170 × 2532 pixels. Mozart's encoding and adaptations
carry CC BY-SA 3.0; the Prelude encoding and adaptations are public domain.
Each bundle retains its own source and license evidence.

The [generation instructions](../scripts/artmender_cards/README.md) explain
preparation, generation, validation and packaging. The exact local Artmender
runtime and dependency lock are retained under `runtime/artmender/` so future
reproduction does not depend on lost temporary helpers. Each ZIP contains the
piece bundle, runtime and reproduction scripts.

These are local deliverables. Application integration and the Student
enablement flag remain separate work described in the [design audit](../docs/focused-practice-review.md).
