# Retained Artmender card generation

These scripts produce local card bundles for Mozart K.545, first movement,
and Chopin's Nocturne in E-flat major, Op.9 No.2. They do not publish the
assets or implement Warm Up. The Chopin bundle is a separate repertoire
request, not an addition to the agreed Warm Up exercises.

Outputs, original scores, provenance, editable notation, card PNGs, and
validation records live under `artmended/<piece-slug>/` in this repository.
Generation code remains under `scripts/`; only renderer scratch data and
disposable inference caches use temporary storage.

## Environment

Use the sibling Artmender checkout's Python virtual environment. It provides
Artmender 0.1.0, python-ly, PianoPlayer, and Pillow. Native rendering requires
LilyPond 2.26 and its `convert-ly` utility. The reference-score previews use
Poppler's `pdftoppm`. Paths below assume the two repositories are siblings.

The exact Artmender Python runtime and dependency lock used for delivery are
also retained under `artmended/runtime/artmender/`, with content hashes in
`snapshot.json`. For reproduction independent of the sibling checkout, run
`uv sync --project artmended/runtime/artmender`, use that directory's
`.venv/bin/python`, and pass `--artmender-root artmended/runtime/artmender`
to Mozart preparation and either generation command. Set Chopin preparation's
`PYTHONPATH` to `artmended/runtime/artmender/src` in that arrangement.

## Reproduce

Run from this repository's root:

```sh
../artmender/.venv/bin/python scripts/artmender_cards/fetch_sources.py all
../artmender/.venv/bin/python scripts/artmender_k545/prepare.py --artmender-root ../artmender --output-dir artmended/mozart-k545-1-allegro/preparation --source artmended/mozart-k545-1-allegro/source/K545-1.ly
PYTHONPATH=../artmender/src ../artmender/.venv/bin/python scripts/artmender_chopin/prepare.py artmended/chopin-op9-no2-nocturne/source/chopin_nocturne_op9_n2.ly artmended/chopin-op9-no2-nocturne/preparation
../artmender/.venv/bin/python scripts/artmender_cards/generate.py mozart
../artmender/.venv/bin/python scripts/artmender_cards/generate.py chopin
```

The runner accepts `--workspace`, `--artmender-root`, and `--work-root` for
other checkout arrangements. Existing original source bytes are never
silently replaced after upstream changes. Generation rebuilds only the
known generated files in that piece's output directory.

## Native source handling

The Mozart preparation resolves its native LilyPond structure into 73 written
measures. The Chopin source has an opening pickup labelled 0 and numbered bars
1 through 34, yielding 35 cards; its unmetered cadenza remains bar 32. Neither
pipeline expands performance repeats or converts LilyPond to MusicXML.

Adapters are scoped to the loaded generator process. They preserve source
notation while handling complete-chord fingering look-ahead, native ornaments,
grace-time staff initialization, and the Chopin source's additional notation
features. Whole-piece fingering inference occurs before card extraction.
Generated first-onset suggestions use parentheses and hand size M. Source
fingering substitutions must remain source substitutions, not be interpreted
as simultaneous chord fingers.

The shared native-anchor exporter reads attached LilyPond note events rather
than treating negative layout offsets as fingering digits. Its source-hash
checks regenerate metadata after preparation changes. Chopin's two ambiguous
above-chord `4` markings in bar 12 were compared with the reference PDF and
mapped to their highest notes; that narrow interpretation is recorded in the
native-anchor metadata. Source text is retained unchanged.

## Verification and review

Generation checks aligned measure counts, reverse written order, landing
labels, image dimensions, nonempty PNGs, valid generated finger digits,
preserved source anchors, and fatal engraving errors. Each PNG is 1170 by
2532 pixels. Review the first, last, middle, and ornament-heavy cards against
the retained reference score before marking visual validation complete.
Cross-excerpt spanner warnings and unusual dense measures are recorded in
each bundle's validation notes rather than silently discarded.

After generation, retain QA views with `make_previews.py mozart` or
`make_previews.py chopin`, using the same Python environment. Once the named
measures have actually been checked, finalize and archive with:

```sh
../artmender/.venv/bin/python scripts/artmender_cards/package.py mozart --reviewed 1 15 37 40 73
../artmender/.venv/bin/python scripts/artmender_cards/package.py chopin --reviewed 0 1 13 18 21 23 24 31 32 34
```

Archives under `artmended/archives/` include the piece bundle, shared helpers,
both preparation adapters and the retained runtime. File hashes and ZIP CRCs
are checked during packaging. Chopin bar 32 keeps its complete unmetered
cadenza on one system and is very small in the phone-size PNG; packaging also
retains a scalable PDF and high-resolution PNG under `companions/`.

The original score encodings and their adapted notation/card images are
licensed CC BY-SA 3.0. Each bundle carries its own attribution and primary
source license page. Do not publish a bundle without its credit and license
records.
