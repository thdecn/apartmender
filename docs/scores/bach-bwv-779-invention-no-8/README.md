# BWV 779 fixed-edition candidate

**Human musical review is pending. Do not enable this candidate in the Piece
Catalog, register it for private fingerings, close #56 / `sludge-s16.9`, or
claim a verified production edition yet.**

This is one complete 34-measure score, prepared from the full Mutopia edition
of Bach's Invention No. 8. It is not assembled from experimental MusicXML
excerpts. The existing Piece slug remains `bach-bwv-779-invention-no-8`.

## Source and redistribution

The [Mutopia edition page](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=61)
identifies Bach-Gesellschaft as the source, Allen Garvin as the typesetter,
reference **Mutopia-2008/06/15-61**, and the contribution as **Public Domain**.
The retained [original LilyPond](source/bach-invention-08.ly) carries the same
dedication and attribution. Mutopia's [license explanation](https://www.mutopiaproject.org/legal.html)
permits redistribution and modification of public-domain contributions;
this particular edition is not described as CC-BY-SA or CC0. The attribution
is retained for provenance. Mutopia makes no musical-correctness warranty.

Both original files were retrieved from Mutopia on 21 November 2026. Exact
URLs, input/output hashes and preparation history are in
[provenance.json](provenance.json). The source header says LilyPond 2.11.46;
the edition page and MIDI identify the rendering version as 2.11.49.

## Candidate identity and inventory

- [Exact uncompressed MusicXML](score.musicxml), SHA-256
  `2d9973db07428c5390ea4f8c2c1518f29834022db5d788682f37d8fcf3765b49`.
- Candidate edition ID is `sha256:` plus that digest, over file bytes before
  parsing, ID injection or fingering edits.
- [Review inventory](review-inventory.json): 34 ordered full 3/4 measures,
  609 direct MusicXML note elements, including 11 rests and **598 pitched
  notes**. Rest elements consume source ordinals; final chord tones each
  receive their own note ID. Final measure `m000034` has no next measure.
- Every pitched entry links to its MusicXML XPath, original LilyPond line,
  source event ordinal and character span in the retained complete normalized
  intermediate. That intermediate came from the complete source fixture in
  the notation experiment, not an excerpt. It remains an input to review.
- This is a review inventory, **not** the production parser/index manifest
  required by #57 / `sludge-s16.10`. That work must independently reproduce
  these identities from the exact accepted XML and preserve musical context.

The fixed-source preparation preserves two staves/voices, F-major context,
3/4, the lower-staff clef changes after bars 4 and 7, explicit beam groups,
accidental spelling/forced accidentals, and the final barline. There is no
pickup, repeat, ending, tie, grace note, tuplet or original fingering encoded
in the retained source. Human review must confirm those observations rather
than infer absent annotations from the renderer or MIDI alone. The last bar
is RH A3/C4/F4 and LH F2, followed by two quarter rests on each staff.

## Reproduce the automated checks

From the repository root, with Python 3 and no third-party Python packages:

```sh
python3 tools/verify-bwv779.py
python3 test/bwv779-score.test.py
npm test
```

The bounded preparation/check tool accepts only these fixed, hash-pinned
BWV 779 inputs. It deterministically rebuilds the candidate and inventory in
memory, requires exact byte equality, and independently parses the original
MIDI to compare **all 598 staff/pitch/onset/duration tuples**. It refuses to
overwrite changed bytes, including with `--prepare`; no generic LilyPond
conversion, network request, browser parser or runtime renderer is introduced.
It also checks the provenance file's edition and listed asset digests.

Tests additionally check every pitched XML child against its inventory target,
independent final chord members, changed bytes under the same path, and refusal
to overwrite a different candidate. `npm test` passed 119 tests; its one
local-Sludge integration test was skipped and is not claimed as a pass.

Pinned Verovio **6.3.0-425dd7b** imported the exact XML with an empty log and
retained 34 measures / 598 notes in MEI. Its two static review pages contain
517 and 81 noteheads respectively. [Render check](review/render-check.json).
Both pages were rasterized and visually inspected for legibility, clipping,
staff grouping and the final bar. This agent inspection is not human musical
sign-off or physical-device testing. SVGs are review artifacts, not a shipped
browser renderer; #59 owns that implementation.

## Human musical review

Compare the **entire** candidate with the
[Mutopia reference PDF](https://www.mutopiaproject.org/ftp/BachJS/BWV779/bach-invention-08/bach-invention-08-a4.pdf)
and retained original source. The static candidate pages are
[page 1](review/page-1.svg) and [page 2](review/page-2.svg).

Record reviewer/date, the exact candidate digest, observations and any
corrections in this section or the linked PR. Check all 34 bars for pitches,
rhythms, voice/staff allocation, key/time/clef context, accidental spelling,
beam groups, ties/grace/tuplets, original fingerings, measure ordering and
the final chord/rests/barline. **Reviewer/date: pending. Corrections: not yet
assessed.** MIDI equality does not prove those engraving/annotation details.

Corrections before acceptance require a deliberately revised candidate,
inventory, digest, previews and renewed review. Once accepted/registered,
never replace these bytes under the same edition identity. Later replacement
uses a new Piece identity/slug under the published Sludge contract; never
silently transfer Assignments, Practice history or personal fingerings.
