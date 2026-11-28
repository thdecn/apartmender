# Artmender

Artmender turns a legally reusable two-staff keyboard score into reverse-order practice cards sized for an iPhone screen. By default it also suggests a fingering for the first sounding onset of each staff in every measure.

Each written measure becomes one card. The last measure appears alone; every earlier card contains its full measure plus the first sounding onset on each staff in the next measure, retaining any rests before those onsets. Cards preserve score annotations where the source format supports them, repeat notation context, and show the original measure number.

## Setup

Install [uv](https://docs.astral.sh/uv/), LilyPond, and MuseScore Studio 4, then run:

```bash
uv sync
```

LilyPond sources render directly with LilyPond. Native MusicXML, MXL, and MuseScore sources use MuseScore. PDF-only sources need OMR and visual correction before Artmender can safely process them.

## Usage

```bash
.venv/bin/artmender "Czerny Op. 821 No. 1"
.venv/bin/artmender "Bach Inv No 8"
.venv/bin/artmender "Czerny Op. 821 No. 2" --fingerings both
```

Fingering inference runs over the complete upper and lower staves before the cards are cut, using PianoPlayer's medium-hand model by default. A verified catalog entry may instead supply a legally reusable whole-piece editorial fingering profile; Artmender records that profile's provenance and hand distribution in `fingering.json`. Existing score fingerings are preserved as anchors. Generated digits use the notation format's native fingering style, are parenthesized, appear above the upper staff and below the lower staff, and a generated chord fingering is grouped, for example `(135)`. Use `--fingerings none`, `--fingerings suggest`, or `--fingerings both`; the last option renders parallel `cards/original/` and `cards/fingered/` sets for comparison. `--hand-size` accepts `XXS` through `XXL`.

Generic suggestions are an ergonomic computational starting point. Catalogued editorial profiles are stronger evidence but remain suggestions: review passages involving unusual redistribution between staves, hand crossings, ornaments, repeated-note technique, or intentional pedagogical patterns.

The verified built-in catalog currently contains:

- Carl Czerny, Op. 821 No. 1: 8 measures/cards
- Carl Czerny, Op. 821 No. 2: 8 measures/cards
- J. S. Bach, Invention No. 1, BWV 772: 22 measures/cards
- J. S. Bach, Invention No. 8, BWV 779: 34 measures/cards

Use an explicitly licensed local score for another piece:

```bash
.venv/bin/artmender "Composer — Work" \
  --source /absolute/path/to/score.musicxml \
  --license "CC0-1.0" \
  --source-url "https://example.org/source" \
  --expected-measures 24
```

Run `.venv/bin/artmender --help` for custom LilyPond staff-variable options.

## Output

Outputs are written under `artmended/<piece-slug>/`:

```text
source/                 original encoding and optional reference PDF
score.normalized.ly     normalized LilyPond, when LilyPond is authoritative
score.musicxml          normalized MusicXML, for MusicXML/MuseScore input
score.json              measure/event representation for LilyPond input
cards/                  editable notation cards and 1170×2532 PNGs
fingering.json          inference inputs/results and source-anchor audit trail
manifest.json           provenance, licensing, card policy, and file index
```

The repository-local Codex skill is at `.agents/skills/artmender/` and responds to `$artmender` or `/artmender` requests.

## Practice web app

A phone landscape practice UI lives in `docs/` and is published with GitHub Pages:

https://thdecn.github.io/artmender/

Serve locally with:

```bash
python3 -m http.server 8765 --directory docs
```

Refresh cropped card assets from `artmended/` with:

```bash
.venv/bin/python scripts/sync_web_cards.py
```

## Tests

```bash
.venv/bin/pytest -q
```
