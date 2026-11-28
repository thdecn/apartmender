"""Prepare the Mutopia K.545 Allegro in native LilyPond written order.

Run with the Artmender virtualenv's Python. No notation conversion is used.
The original source remains immutable; every generated file stays in output_dir.
"""
from __future__ import annotations

import argparse
from fractions import Fraction
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


SOURCE_URL = "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998"
SOURCE_SHA256 = "84d0e951e6d8807d3286f31ed7878a35dfddb9850bbae9156be0f5ac0a3e2e10"
ASSEMBLY = r'''
upperWritten = {
  \keepWithTag #'first { \ptrh \strh }
  \dvrh \phrasingSlurUp
  \keepWithTag #'second \transpose c f { \ptrha }
  \ptirh \transpose d g, { \strha } \stvrh
}
lowerWritten = {
  \ptlh \stlh \dvlh
  \clef treble \transpose c f { \ptlha }
  \ptilh \clef treble \transpose c f { \stlha } \stvlh
}
'''

NATIVE_FUNCTIONS = r'''
#(use-modules (lily display-lily))
#(memoize-clef-names supported-clefs)
#(define (main-len mus) (ly:moment-main (ly:music-length mus)))
#(define (flat-music mus)
  (let ((name (ly:music-property mus 'name)))
    (cond
      ((eq? name 'UnfoldedRepeatedMusic)
       (append-map
         (lambda (_) (flat-music (ly:music-deep-copy (ly:music-property mus 'element))))
         (iota (ly:music-property mus 'repeat-count))))
      ((memq name '(RelativeOctaveMusic TransposedMusic UnrelativableMusic))
       (flat-music (ly:music-property mus 'element)))
      ((and (eq? name 'SequentialMusic) (> (main-len mus) 0))
       (append-map flat-music (ly:music-property mus 'elements)))
      (else (list mus)))))
#(define (emit-flat label mus)
   (format #t "BEGIN_~a\n" label)
   (let loop ((elements (flat-music mus)) (measure 1) (total 0))
     (if (null? elements)
       (begin
         (if (not (= total 0)) (ly:error "Partial final measure: ~a" total))
         (if (not (= measure 74)) (ly:error "Expected 73 measures; got ~a" (- measure 1))))
       (let* ((m (car elements))
              (duration (main-len m))
              (next-total (+ total duration))
              (text (music->lily-string m)))
         (if (> next-total 1) (ly:error "Element crosses bar ~a at ~a: ~a" measure total text))
         (if (string-contains text "Print method not implemented")
             (ly:error "Unserializable music: ~a" text))
         (format #t "~a\n" text)
         (if (= next-total 1)
           (begin
             (if (memv measure '(28 73)) (format #t "\\bar \":|.\"\n"))
             (format #t "% bar ~a\n" measure)
             (if (= measure 28) (format #t "\\bar \".|:\"\n"))
             (loop (cdr elements) (+ measure 1) 0))
           (loop (cdr elements) measure next-total)))))
   (format #t "END_~a\n" label))
#(define (emit-units label mus)
   (format #t "BEGIN_UNITS_~a\n" label)
   (for-each
    (lambda (m)
      (format #t "UNIT\t~a\t~a\t~a\n"
        (ly:music-property m 'name)
        (main-len m)
        (if (pair? (extract-named-music m 'NoteEvent)) 1 0))
      (display (music->lily-string m))
      (format #t "\nEND_UNIT\n"))
    (flat-music mus))
   (format #t "END_UNITS_~a\n" label))
'''

EXPORT_CALLS = r'''
#(emit-flat "UPPER" #{ \upperWritten #})
#(emit-flat "LOWER" #{ \lowerWritten #})
#(emit-units "UPPER" #{ \upperWritten #})
#(emit-units "LOWER" #{ \lowerWritten #})
'''

ROUND_TRIP = r'''
#(define (significant mus)
   (filter (lambda (m) (or (> (main-len m) 0) (eq? (ly:music-property m 'name) 'GraceMusic)))
           (flat-music mus)))
#(define (signature mus)
   (map music->lily-string (significant mus)))
#(define (check-native label original prepared)
   (let ((a (signature original)) (b (signature prepared)))
     (if (not (equal? a b))
       (begin
         (ly:message "SIGNATURE-LENGTHS ~a ~a ~a" label (length a) (length b))
         (let loop ((x a) (y b) (i 1))
           (if (and (pair? x) (pair? y))
             (if (equal? (car x) (car y)) (loop (cdr x) (cdr y) (+ i 1))
               (ly:message "FIRST-DIFFERENCE ~a ~a original=~a prepared=~a" label i (car x) (car y)))))
         (ly:error "Native round-trip mismatch in ~a" label)))
     (ly:message "ROUND-TRIP-MATCH ~a ~a significant objects" label (length a))))
#(check-native "UPPER" #{ \upperWritten #} #{ \upperMusic #})
#(check-native "LOWER" #{ \lowerWritten #} #{ \lowerMusic #})
'''


def _run_native(text: str, output_dir: Path, stem: str, lilypond: str) -> subprocess.CompletedProcess:
    (output_dir / f"{stem}.ly").write_text(text, encoding="utf-8")
    result = subprocess.run(
        [lilypond, "-dno-print-pages", "-dno-point-and-click", "-"],
        input=text, text=True, capture_output=True, cwd=output_dir, timeout=90,
    )
    (output_dir / f"{stem}.stdout").write_text(result.stdout, encoding="utf-8")
    (output_dir / f"{stem}.stderr").write_text(result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"Native LilyPond {stem} failed:\n{result.stderr}")
    return result


def _between(text: str, opening: str, closing: str) -> str:
    return text.split(opening + "\n", 1)[1].split(closing, 1)[0]


def _landing_plans(native_stdout: str, score) -> dict:
    plans = {
        "format": "artmender-k545-native-landings-v1",
        "exception": (
            "A leading grace group and its principal note form one syntactic landing unit. "
            "An afterGrace expression retains its entire principal event and trailing grace group. "
            "Grace notes contribute zero main time."
        ),
        "initial_grace_context": (
            "For cards starting with grace notes, initialize clef, middle-C positioning, "
            "C-major key and 4/4 time as Staff context properties before negative grace time; "
            "remove only redundant opening music commands. Notes and fingerings stay unchanged."
        ),
        "initial_grace_context_measures": [15, 17, 23, 25, 60, 62, 70],
        "staves": {},
    }
    for label, staff in [("UPPER", score.upper), ("LOWER", score.lower)]:
        stream = _between(native_stdout, f"BEGIN_UNITS_{label}", f"END_UNITS_{label}")
        measures, units = [], []
        total = Fraction(0)
        for chunk in stream.split("UNIT\t")[1:]:
            header, rest = chunk.split("\n", 1)
            name, duration, pitched = header.split("\t")
            text = rest.split("\nEND_UNIT\n", 1)[0]
            units.append({"type": name, "duration": duration, "pitched": pitched == "1", "text": text})
            total += Fraction(duration)
            if total == 1:
                measures.append(units)
                units, total = [], Fraction(0)
            elif total > 1:
                raise ValueError("A native unit crosses a measure boundary")
        if len(measures) != 73 or total != 0 or any(Fraction(u["duration"]) for u in units):
            raise ValueError(f"Invalid native measure structure for {label}")
        records = []
        for measure, all_units in zip(staff.measures, measures):
            selected, duration = [], Fraction(0)
            for unit in all_units:
                selected.append(unit)
                duration += Fraction(unit["duration"])
                if unit["pitched"] and Fraction(unit["duration"]) > 0:
                    break
            wanted = "\n".join(u["text"] for u in selected).strip()
            start = measure.source.find(wanted)
            if start < 0:
                raise ValueError(f"Native landing prefix missing in {label} measure {measure.label}")
            prefix = measure.source[:start + len(wanted)]
            records.append({
                "measure": measure.label,
                "source": measure.source,
                "source_lines": len(measure.source.splitlines()),
                "prefix_lines": len(prefix.splitlines()),
                "duration": str(duration),
                "native_units": [{k: u[k] for k in ("type", "duration", "pitched")} for u in selected],
            })
        plans["staves"][label.lower()] = records
    return plans


def prepare(
    artmender_root: Path,
    output_dir: Path,
    source_path: Path | None = None,
    *,
    lilypond: str = "lilypond",
) -> Path:
    """Write and validate native preparation artifacts; return the prepared .ly path."""
    artmender_root, output_dir = Path(artmender_root).resolve(), Path(output_dir).resolve()
    source_path = Path(source_path).resolve() if source_path else output_dir.parent / "source" / "K545-1.ly"
    output_dir.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(artmender_root / "src"))
    from artmender.lilypond import parse_lilypond_score
    from artmender.models import LilyPondProfile

    original_bytes = source_path.read_bytes()
    original_hash = hashlib.sha256(original_bytes).hexdigest()
    if original_hash != SOURCE_SHA256:
        raise ValueError("This preparation targets the verified Mutopia-2013/09/01-998 encoding; review a changed source before adapting it")
    definitions, separator, _ = original_bytes.decode("utf-8").partition("\\score {")
    if not separator:
        raise ValueError("Expected Mutopia K.545 score block was not found")
    exported = _run_native(definitions + ASSEMBLY + NATIVE_FUNCTIONS + EXPORT_CALLS, output_dir, "native-export", lilypond)
    upper = _between(exported.stdout, "BEGIN_UPPER", "END_UPPER")
    lower = _between(exported.stdout, "BEGIN_LOWER", "END_LOWER")
    prepared = (
        '\\version "2.26.0"\n'
        '\\header { title = "Mozart K.545 I Allegro" copyright = "CC BY-SA 3.0; Alejandro Sierra / Mutopia Project" }\n'
        '% Prepared natively from Mutopia-2013/09/01-998. Written order; volta bodies occur once.\n'
        'upperMusic = {\n\\clef treble \\key c \\major \\time 4/4\n' + upper + '\n}\n'
        'lowerMusic = {\n\\clef treble \\key c \\major \\time 4/4\n' + lower + '\n}\n'
    )
    prepared_path = output_dir / "K545-1-prepared.ly"
    prepared_path.write_text(prepared, encoding="utf-8")
    round_trip = _run_native(definitions + ASSEMBLY + NATIVE_FUNCTIONS + prepared + ROUND_TRIP, output_dir, "round-trip-check", lilypond)
    round_trip_counts = {staff.lower(): int(count) for staff, count in re.findall(r"ROUND-TRIP-MATCH (UPPER|LOWER) (\d+) significant objects", round_trip.stderr)}
    if set(round_trip_counts) != {"upper", "lower"}:
        raise ValueError("Native round-trip confirmations were incomplete")
    score = parse_lilypond_score(prepared_path, LilyPondProfile(
        upper_variable="upperMusic", lower_variable="lowerMusic",
        upper_default_clef="treble", lower_default_clef="treble",
        initial_context=(r"\key c \major", r"\time 4/4"),
    ), expected_measures=73)
    plans = _landing_plans(exported.stdout, score)
    (output_dir / "landing-prefixes.json").write_text(json.dumps(plans, indent=2) + "\n", encoding="utf-8")
    profile = {
        "prepared_source": prepared_path.name,
        "slug": "mozart-k545-1-allegro",
        "canonical_title": "W. A. Mozart — Sonata in C major K.545, I. Allegro",
        "composer": "Wolfgang Amadeus Mozart",
        "catalog": "K.545",
        "movement": "I. Allegro",
        "expected_measures": 73,
        "source_url": SOURCE_URL,
        "license": "Creative Commons Attribution-ShareAlike 3.0",
        "lilypond_profile": {
            "upper_variable": "upperMusic", "lower_variable": "lowerMusic",
            "upper_default_clef": "treble", "lower_default_clef": "treble",
            "initial_context": [r"\key c \major", r"\time 4/4"],
            "measure_boundaries": "comments",
        },
    }
    (output_dir / "profile.json").write_text(json.dumps(profile, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    _run_native(prepared + '\n\\score { \\new PianoStaff << \\new Staff \\upperMusic \\new Staff \\lowerMusic >> \\layout {} }\n', output_dir, "prepared-check", lilypond)
    if source_path.read_bytes() != original_bytes:
        raise ValueError("The immutable original source changed during preparation")
    provenance = {
        "source": os.path.relpath(source_path, output_dir),
        "source_sha256": original_hash,
        "source_url": SOURCE_URL,
        "license": "CC BY-SA 3.0",
        "attribution": "Alejandro Sierra / Mutopia Project",
        "measure_count": 73,
        "preparation": "Native LilyPond music-tree serialization; repeat-unfold patterns expanded; written volta bodies traversed once; native grace objects preserved.",
        "validation": {
            "native_written_lengths": {"upper": 73, "lower": 73},
            "native_round_trip_match": round_trip_counts,
            "artmender_parse": "73 aligned numbered measures",
            "engraving": "Prepared full score interpreted and laid out successfully by native LilyPond",
            "repeat_markers": {"end_measures": [28, 73], "start_measure": 29},
            "limits": ["Final card and fingering validation is separate; use the grace landing adapter for this preparation."],
        },
    }
    (output_dir / "preparation.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    return prepared_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artmender-root", "--workspace", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--lilypond", default="lilypond")
    args = parser.parse_args()
    print(prepare(args.artmender_root, args.output_dir, args.source, lilypond=args.lilypond))


if __name__ == "__main__":
    main()
