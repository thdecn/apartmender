# Chopin native preparation

Run using Artmender's Python environment with its source on `PYTHONPATH`:

```sh
PYTHONPATH=../artmender/src:scripts \
  ../artmender/.venv/bin/python -m artmender_chopin.prepare \
  artmended/chopin-op9-no2-nocturne/source/chopin_nocturne_op9_n2.ly \
  artmended/chopin-op9-no2-nocturne/preparation
```

The source is kept immutable. Preparation modernizes LilyPond syntax and pitch spelling, normalizes relative pitches, labels the 1/8 pickup as measure 0, and splits the source's combined final lower-staff block at its existing bar boundary. There are 35 cards: pickup 0 and written measures 1–34, with unmetered cadenza 32 retained intact.

Before running Artmender, call `artmender_chopin.adapters.install(preparation_dir)` in the same Python process. The adapter retains native source macros, excludes markup from rhythmic matching, preserves grace groups and tuplet wrappers in landings, exposes simultaneous voices to the engine, and retains octave context. Source substitution fingerings are documented in `preparation.json`; a sequence such as `54` belongs to one pitch and must not be interpreted as a chord fingering.

For cards beginning with grace notes, the adapter initializes both Staff clef-position properties and the 12/8 timing context. It emits the actual E-flat-major key event inside the existing leading grace group and a matching invisible grace skip in the other staff. This avoids incorrect bass pitch positions and duplicate signatures before the main beat; the skip adds no sounding note and is used only in the card engraving.

Measure 32 uses a wider native engraving page to retain its complete cadenza on a single system. Its rendered readability needs explicit review; the notes must never be silently omitted or presented as invented written measures.

Specific card-only layout repairs retain the authoritative prepared score unchanged:

- Cards 0/1 remove the full-page negative offset that placed substitution `54` inside the staff. Other substitution marks were visually checked and retain their source placement.
- Cards beginning with grace notes initialize LilyPond 2.26's rational `measureLength` and `timeSignature` properties, avoiding an ignored legacy moment value.
- Card 23 removes the singleton beam/slur continuation from its one-note bar-24 landing; its pitch, source fingering, articulation and dynamics remain.
- Card 24 keeps the source's native inside-slur fingering policy and freezes only the second slur's Bézier curve, using control points extracted from LilyPond's native solver, to avoid a LilyPond 2.26 circular positioning callback.
- Card 31 closes the cadenza after both landing fragments and their alignment skips, removes a singleton beam/phrasing-slur continuation without removing its note or annotations, and compacts the full-page dash-spaced `senza tempo` words for the one-onset reminder.
- Card 34 removes a stale negative offset from the `ppp` markup so it clears the lower-staff chord.
