# Chopin Prelude native preparation

The selected work is Prelude in E minor, Op.28 No.4. Its Mutopia encoding
(ID 468, Magnus Lewis-Smith, after Peters 1879) is public domain. Original
LilyPond/PDF bytes and primary license pages are retained in the bundle.

Run with Artmender's environment and the retained runtime:

```sh
PYTHONPATH=artmended/runtime/artmender/src:scripts \
  ../artmender/.venv/bin/python scripts/artmender_chopin/prepare.py \
  artmended/chopin-op28-no4-prelude/source/Chop-28-4.ly \
  artmended/chopin-op28-no4-prelude/preparation
```

Preparation modernizes syntax, translates pitch spelling and normalizes
relative pitches. It labels the quarter-note pickup 0 and full measures 1–25,
for 26 cards. The two final parallel voices are split at their existing bar
checks; cross-staff chords, ornaments, native macros, Largo and the separate
stretto spanner remain. An explicit inherited eighth in bar 18 prevents the
new whole-bar parallel wrappers from changing its rhythm.

The scoped adapter preserves native markup and grace/tuplet timing, exposes
parallel voices to whole-piece inference, and retains ornaments in landing
fragments. It uses PianoPlayer 3 at hand size M. PianoPlayer's pairwise stretch
heuristics reject the encoded four-note octaves at LH17 and RH24–25; those
voicings instead use its full-hand span bound with unique, ordered fingers.
M geometry and motion cost remain in use. No editorial fingering is invented.
The source has no original finger digits. Generated suggestions remain
parenthesized native fingering objects, inferred before card extraction.

After generation, independently compare original and prepared native notes:

```sh
PYTHONPATH=artmended/runtime/artmender/src:scripts \
  ../artmender/.venv/bin/python scripts/artmender_chopin/verify_source.py \
  artmended/chopin-op28-no4-prelude
```

The audit compares native event multisets by staff, MIDI pitches and duration,
with source-origin callback views deduplicated (relative grace callbacks can
expose an unresolved view before the resolved view). It supplements aligned
measure/timing checks and visual comparisons; it does not prove musical event
order by itself. Native anchor matching also requires every parsed note event
to match its prepared native source event. Keep excerpt-spanner warnings and
compare the final cross-staff chords with the retained one-page reference.

Cards retain the source’s pedal-bracket style. Card 16 closes its stretto
text spanner at the excerpt boundary so the text engraves instead of being
discarded as an unterminated spanner; original notation remains retained.
