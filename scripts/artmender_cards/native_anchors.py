"""Use native LilyPond fingering post-events as source anchors.

Layout offsets are never fingerings. Native source markup remains unchanged;
single-pitch substitutions constrain the initial finger and retain the full
sequence as metadata. Install after piece-specific parsing/timing adapters.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import subprocess



NATIVE_EXPORT = r'''
#(define (join-number xs) (string-join (map number->string xs) ","))
#(define (markup-fingers x)
   (cond
     ((not (pair? x)) '())
     ((and (procedure? (car x))
           (eq? (procedure-name (car x)) 'finger-markup)
           (pair? (cdr x)) (string? (cadr x)))
      (list (cadr x)))
     (else (append (markup-fingers (car x)) (markup-fingers (cdr x))))))
#(define (has-column x)
   (and (pair? x)
        (or (and (procedure? (car x))
                 (memq (procedure-name (car x)) '(column-markup center-column-markup)))
            (has-column (car x)) (has-column (cdr x)))))
#(define (finger-digits note)
   (filter-map
    (lambda (a)
      (and (eq? (ly:music-property a 'name) 'FingeringEvent)
           (ly:music-property a 'digit)))
    (ly:music-property note 'articulations)))
#(define (text-events xs)
   (filter (lambda (a) (eq? (ly:music-property a 'name) 'TextScriptEvent)) xs))
#(define (finger-text xs)
   (append-map (lambda (a) (markup-fingers (ly:music-property a 'text))) (text-events xs)))
#(define (emit-anchor-event staff mus notes shared)
   (let* ((origin (ly:input-file-line-char-column (ly:music-property (car notes) 'origin)))
          (pitches (map (lambda (n) (+ 60 (ly:pitch-semitones (ly:music-property n 'pitch)))) notes)))
     (format #t "NATIVE_ANCHOR\t~a\t~a\t~a\t~a\t~a\t~a\t~a\t~a\t~a\n"
       staff (list-ref origin 1) (list-ref origin 2)
       (ly:moment-main (ly:music-length mus))
       (join-number pitches)
       (string-join (map (lambda (n) (join-number (finger-digits n))) notes) "/")
       (string-join (map (lambda (n) (string-join (finger-text (ly:music-property n 'articulations)) ",")) notes) "/")
       (string-join (finger-text shared) ",")
       (if (any (lambda (a) (has-column (ly:music-property a 'text))) (text-events shared)) 1 0))))
#(define (walk-anchor-events staff mus)
   (if (ly:music? mus)
     (let* ((name (ly:music-property mus 'name))
            (elements (ly:music-property mus 'elements))
            (notes (filter (lambda (n) (eq? (ly:music-property n 'name) 'NoteEvent)) elements)))
       (cond
         ((and (eq? name 'EventChord) (pair? notes))
          (emit-anchor-event staff mus notes
             (append (filter (lambda (n) (not (eq? (ly:music-property n 'name) 'NoteEvent))) elements)
                     (ly:music-property mus 'articulations))))
         ((eq? name 'NoteEvent) (emit-anchor-event staff mus (list mus) '()))
         (else
           (let ((element (ly:music-property mus 'element)))
             ;; Wrapper elements-callbacks can expose the same child through
             ;; both properties; traversing both duplicates grace notes.
             (if (ly:music? element)
               (walk-anchor-events staff element)
               (for-each (lambda (m) (walk-anchor-events staff m)) elements))))))))
'''


def _source_path(preparation_dir: Path, profile: dict) -> Path:
    if "prepared_source" in profile:
        return preparation_dir / profile["prepared_source"]
    for name in ("score.prepared.ly", "K545-1-prepared.ly"):
        candidate = preparation_dir / name
        if candidate.exists():
            return candidate
    raise FileNotFoundError("No prepared LilyPond source was found")


def _body_range(text: str, variable: str) -> tuple[int, int]:
    from artmender.lilypond import _matching_brace

    match = re.search(rf"(?m)^\s*{re.escape(variable)}\s*=", text)
    if match is None:
        raise ValueError(f"Missing native staff variable {variable}")
    opening = text.index("{", match.end())
    return opening + 1, _matching_brace(text, opening)


def _split_digits(field: str) -> list[str]:
    return [part for part in field.split(",") if part]


def _assign_source_fingers(record: dict) -> None:
    """Interpret attached native finger markup without reading layout numbers."""
    count = len(record["midi_pitches"])
    originals = [None] * count
    annotations = []
    for index, (digits, strings) in enumerate(zip(record["inline_digits"], record["note_finger_strings"])):
        if digits:
            if any(digit not in range(1, 6) for digit in digits):
                raise ValueError("Native source contains an invalid fingering digit")
            originals[index] = digits[0]
        for value in strings:
            if not re.fullmatch(r"[1-5]+", value):
                annotations.append({"kind": "unmapped_finger_markup", "note": index, "text": value})
                continue
            if len(value) > 2:
                # The source's chromatic-turn figure is 12121. Its run is not
                # a held-note substitution and must not anchor the main note.
                annotations.append({"kind": "ornament_fingering", "note": index, "sequence": [int(x) for x in value]})
                continue
            initial = int(value[0])
            if originals[index] is not None and originals[index] != initial:
                raise ValueError("Native inline and markup source fingers disagree")
            originals[index] = initial
            annotations.append({"kind": "substitution" if len(value) == 2 else "source_finger_markup", "note": index, "sequence": [int(x) for x in value]})

    shared = record["shared_finger_strings"]
    missing = [index for index, finger in enumerate(originals) if finger is None]
    if shared and all(re.fullmatch(r"[1-5]", value) for value in shared):
        if len(shared) == 1 and len(missing) == 1:
            originals[missing[0]] = int(shared[0])
            annotations.append({"kind": "source_chord_finger_markup", "note": missing[0], "sequence": [int(shared[0])], "mapping": "only unassigned chord member"})
        elif record["shared_column"] and len(shared) == count and len(missing) == count:
            # A native vertical column displays chord finger digits from top
            # to bottom. Match that explicit order to descending pitches.
            descending = sorted(range(count), key=lambda index: record["midi_pitches"][index], reverse=True)
            for index, value in zip(descending, shared):
                originals[index] = int(value)
            annotations.append({"kind": "source_chord_finger_column", "sequence": [int(x) for x in shared], "mapping": "top-to-bottom column to descending pitches"})
        else:
            annotations.append({"kind": "unmapped_chord_finger_markup", "strings": shared})
    elif shared:
        annotations.append({"kind": "unmapped_chord_finger_markup", "strings": shared})
    ordered = sorted(range(count), key=lambda index: record["midi_pitches"][index])
    record["source_order_midi_pitches"] = list(record["midi_pitches"])
    record["source_order_original_fingers"] = list(originals)
    record["original_fingers"] = [originals[index] for index in ordered]
    record["midi_pitches"] = [record["midi_pitches"][index] for index in ordered]
    record["source_annotations"] = annotations


def export(preparation_dir: Path, *, lilypond: str = "lilypond") -> Path:
    """Export source-origin semantic anchors; never rewrite notation."""
    preparation_dir = Path(preparation_dir).resolve()
    profile = json.loads((preparation_dir / "profile.json").read_text(encoding="utf-8"))
    source_path = _source_path(preparation_dir, profile)
    text = source_path.read_text(encoding="utf-8")
    native_profile = profile.get("lilypond_profile", profile)
    variables = {"upper": native_profile["upper_variable"], "lower": native_profile["lower_variable"]}
    definitions = text.split("\\score", 1)[0]
    calls = "\n".join(f'#(walk-anchor-events "{staff}" #{{ \\{variable} #}})' for staff, variable in variables.items())
    result = subprocess.run([lilypond, "-dno-print-pages", "-dno-point-and-click", "-"], input=definitions + NATIVE_EXPORT + calls, capture_output=True, text=True, cwd=preparation_dir, timeout=90)
    (preparation_dir / "native-anchors.stdout").write_text(result.stdout, encoding="utf-8")
    (preparation_dir / "native-anchors.stderr").write_text(result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError("Native source-anchor extraction failed:\n" + result.stderr)

    lines = text.splitlines(keepends=True)
    offsets = []
    total = 0
    for line in lines:
        offsets.append(total)
        total += len(line)
    boundaries = {}
    for staff, variable in variables.items():
        start, end = _body_range(text, variable)
        markers = list(re.finditer(r"(?m)%\s*(?:bar\s*)?(\d+)\s*$", text[start:end]))
        boundaries[staff] = [(start + m.start(), int(m[1])) for m in markers]
    records = []
    for line in result.stdout.splitlines():
        if not line.startswith("NATIVE_ANCHOR\t"):
            continue
        _, staff, row, column, duration, pitches, digits, note_strings, shared, shared_column = line.split("\t")
        origin_offset = offsets[int(row) - 1] + int(column)
        measure = next((label for end, label in boundaries[staff] if origin_offset < end), None)
        if measure is None:
            raise ValueError("A native note has no numbered measure origin")
        record = {
            "staff": staff, "measure": measure,
            "source_origin": {"line": int(row), "character": int(column), "offset": origin_offset},
            "native_main_duration": duration,
            "midi_pitches": [int(pitch) for pitch in pitches.split(",")],
            "inline_digits": [[int(x) for x in part.split(",") if x] for part in digits.split("/")],
            "note_finger_strings": [_split_digits(part) for part in note_strings.split("/")],
            "shared_finger_strings": _split_digits(shared),
            "shared_column": shared_column == "1",
        }
        if len(record["inline_digits"]) != len(record["midi_pitches"]) or len(record["note_finger_strings"]) != len(record["midi_pitches"]):
            raise ValueError("Native chord anchor shape mismatch")
        _assign_source_fingers(record)
        records.append(record)
    # LilyPond's grace-wrapper element callbacks can expose copied views of
    # one source event. These prepared files spell out every written note,
    # so source-origin identity distinguishes a note from such callback views.
    unique = {}
    duplicates = 0
    for record in records:
        identity = (record["staff"], record["source_origin"]["offset"], tuple(record["midi_pitches"]))
        if identity in unique:
            previous = unique[identity]
            if previous != record:
                raise ValueError("Native callback views disagree on a source event")
            duplicates += 1
        else:
            unique[identity] = record
    records = sorted(unique.values(), key=lambda record: (record["staff"], record["measure"], record["source_origin"]["offset"]))
    report = {
        "format": "artmender-native-source-anchors-v1",
        "prepared_source": source_path.name,
        "prepared_source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "duplicate_callback_views_removed": duplicates,
        "policy": {
            "inline": "Only attached native FingeringEvent.digit values are inline anchors; layout numbers are excluded.",
            "markup": "Single digits and two-digit substitutions on one note constrain the initial finger; full sequences and source markup remain unchanged.",
            "ornaments": "Longer finger runs are retained as ornament metadata rather than relabeled as held-note anchors.",
            "chords": "Single supplementary digits map only to one unassigned member; explicit vertical columns map top-to-bottom to descending pitches; unresolved markup remains explicit metadata.",
            "indexing": "Inline/markup details and source_annotations.note refer to source chord order; midi_pitches/original_fingers are sorted together for engine comparison. Source-order arrays are retained explicitly.",
        },
        "events": records,
    }
    path = preparation_dir / "native-anchors.json"
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return path


def install(preparation_dir: Path):
    """Replace regex source anchors after current piece-specific event timing."""
    import artmender.fingering as fingering

    preparation_dir = Path(preparation_dir).resolve()
    path = preparation_dir / "native-anchors.json"
    if not path.exists():
        export(preparation_dir)
    data = json.loads(path.read_text(encoding="utf-8"))
    source = preparation_dir / data["prepared_source"]
    if hashlib.sha256(source.read_bytes()).hexdigest() != data["prepared_source_sha256"]:
        data = json.loads(export(preparation_dir).read_text(encoding="utf-8"))
    native = defaultdict(list)
    for record in data["events"]:
        native[(record["staff"], record["measure"])].append(record)

    base = getattr(fingering._staff_events, "_native_source_anchors_base", fingering._staff_events)
    chord_parser = getattr(fingering._chord_pitches_and_fingers, "_native_source_anchors_base", fingering._chord_pitches_and_fingers)

    def no_regex_note_fingers(source, matches, event_index):
        return None

    def no_regex_chord_fingers(token):
        pitches, _ = chord_parser(token)
        return pitches, (None,) * len(pitches)

    no_regex_chord_fingers._native_source_anchors_base = chord_parser
    fingering._fingering_after_token = no_regex_note_fingers
    fingering._chord_pitches_and_fingers = no_regex_chord_fingers

    def source_events(staff):
        events, notes = base(staff)
        variable = staff.variable.lower()
        side = "upper" if variable.startswith("upper") else "lower" if variable.startswith("lower") else None
        if side is None:
            raise ValueError(f"Cannot identify native staff {staff.variable}")
        by_measure = defaultdict(list)
        for event in events:
            by_measure[event.measure_label].append(event)
        matched = []
        for measure in staff.measures:
            engine = sorted(by_measure[measure.label], key=lambda event: (event.voice_index, event.source_start))
            originals = native[(side, measure.label)]
            if len(engine) != len(originals):
                raise ValueError(f"Native/engine event count mismatch in {side} measure {measure.label}: {len(originals)} native, {len(engine)} engine")
            for ordinal, (event, original) in enumerate(zip(engine, originals)):
                if tuple(event.midi_pitches) != tuple(original["midi_pitches"]):
                    raise ValueError(f"Native/engine pitch mismatch in {side} measure {measure.label}, lexical event {ordinal}: {original['midi_pitches']} native, {event.midi_pitches} engine")
                fingers = tuple(original["original_fingers"])
                event.original_fingers = fingers
                for note, finger in zip(event.notes, fingers):
                    note.fingering = finger or 0
                    note.is_anchor = finger is not None
                matched.append({"measure": measure.label, "ordinal": ordinal, "pitches": list(event.midi_pitches), "source_fingers": list(fingers)})
        validation_path = preparation_dir / "native-anchor-validation.json"
        validation = json.loads(validation_path.read_text()) if validation_path.exists() else {"format": "artmender-native-anchor-validation-v1", "staves": {}}
        validation["prepared_source_sha256"] = data["prepared_source_sha256"]
        validation["staves"][side] = {"matched_events": len(matched), "matched_notes": len(notes), "events": matched}
        validation_path.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
        return events, notes

    source_events._native_source_anchors_base = base
    fingering._staff_events = source_events
    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("preparation_dir", type=Path)
    args = parser.parse_args()
    print(export(args.preparation_dir))
