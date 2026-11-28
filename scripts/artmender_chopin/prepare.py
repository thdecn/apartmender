"""Prepare the public-domain Op.28 No.4 encoding without changing its notes."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

from ly.document import Cursor, Document
from ly.pitch.rel2abs import rel2abs
from ly.pitch.translate import translate

from artmender.lilypond import _assignment_body, _matching_brace, _split_bar_checks


def whole_bar_voices(source: str) -> str:
    """Keep a mid-bar dynamics voice parallel to the complete musical bar."""
    opening = source.index("<<")
    closing = source.index(">>", opening)
    body = source[opening + 2:closing]
    first_open = body.index("{")
    first_close = _matching_brace(body, first_open)
    second_open = body.index("{", first_close + 1)
    second_close = _matching_brace(body, second_open)
    leading, trailing = source[:opening], source[closing + 2:]
    # Only bar 9 has a leading quarter; bar 16 starts with the parallel block.
    delay = "s4 " if leading.strip() else ""
    return "<< { " + leading + body[first_open + 1:first_close] + trailing + " } \\\\ { " + delay + body[second_open + 1:second_close] + " } >>"


def prepare(source: Path, destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    converted = subprocess.run(["convert-ly", str(source)], check=True, text=True, capture_output=True)
    (destination / "convert-ly.log").write_text(converted.stderr)
    document = Document(converted.stdout)
    translate(Cursor(document), "nederlands")
    rel2abs(Cursor(document), first_pitch_absolute=False)
    text = document.plaintext()
    upper = _assignment_body(text, "playRH")
    lower = _assignment_body(text, "playLH")
    upper = re.sub(r"%[^\n]*", "", upper)
    lower = re.sub(r"%[^\n]*", "", lower)
    # Final two bars are parallel in the source. Split both voices at their
    # existing bar checks; keep the cross-staff chord voice and all pitches.
    start = upper.rindex("<<")
    final = upper[start:upper.index(">>", start) + 2]
    voices = re.fullmatch(r"<<\s*\{(.*?)\}\s*\\\\\s*\{(.*?)\}\s*>>", final, re.S)
    if voices is None:
        raise ValueError("The final native cross-staff structure changed")
    upper_final = [voice.split("|") for voice in voices.groups()]
    if any(len(parts) != 2 for parts in upper_final):
        raise ValueError("Expected the written boundary between bars 24 and 25")
    measures = _split_bar_checks(upper[:start])
    if len(measures) != 24:
        raise ValueError("Expected pickup and bars 1–23")
    for index in (9, 16):
        measures[index] = whole_bar_voices(measures[index])
    measures[0] = measures[0].replace(r"\partial 4", r'\tempo "Largo" \partial 4', 1)
    # New parallel wrappers must not change the next bar's inherited eighth.
    measures[18] = measures[18].replace("d''! c''", "d''!8 c''8", 1)
    # The source's separate, silent superMarks voice carries stretto over 16–18.
    marks = [r"\set decrescendoText = \markup { \italic stretto } \set decrescendoSpanner = #'text s4 s8^\> s8 s2", r's4 s4 s4 s4', r's4 s4 s4\! s4']
    for index, marking in zip((16, 17, 18), marks):
        if index == 16:
            measures[index] = measures[index][:-2] + " \\\\ { " + marking + " } >>"
        else:
            measures[index] = "<< { " + measures[index] + " } \\\\ { s1 } \\\\ { " + marking + " } >>"
    for index in (0, 1):
        melody, chords = (parts[index] for parts in upper_final)
        chords = chords.replace('"lh"', '"lower"')
        if index == 1:
            chords = '\\change Staff = "lower" \\stemUp ' + chords
        measures.append("<< { " + melody + " } \\\\ { " + chords + " } >>")
    # rel2abs leaves a harmless grouping brace around the last two LH bars.
    start = lower.rindex("{")
    last = lower[start + 1:lower.rindex("}")]
    lower_measures = _split_bar_checks(lower[:start]) + _split_bar_checks(last)
    if len(measures) != 26 or len(lower_measures) != 26:
        raise ValueError("Expected 26 aligned written units including pickup 0")
    macro_start = text.index("barRest =")
    macro_end = re.search(r"(?m)^playRH\s*=", text).start()
    macros = text[macro_start:macro_end]
    (destination / "source-macros.ily").write_text(macros)
    prepared = '\\version "2.26.0"\n\\language "nederlands"\n' + macros
    for name, bars in (("upper", measures), ("lower", lower_measures)):
        prepared += "\n" + name + " = {\n"
        for label, bar in enumerate(bars):
            prepared += bar.strip() + f" | % bar {label}\n"
        prepared += "}\n"
    prepared += '\\score { \\new PianoStaff << \\new Staff = "upper" \\upper \\new Staff = "lower" \\lower >> \\layout { \\context { \\PianoStaff \\consists #Span_stem_engraver } } }\n'
    path = destination / "score.prepared.ly"
    path.write_text(prepared)
    profile = {"upper_variable": "upper", "lower_variable": "lower", "upper_default_clef": "treble", "lower_default_clef": "bass", "initial_context": [r"\key e \minor", r"\time 2/2"], "measure_boundaries": "comments"}
    (destination / "profile.json").write_text(json.dumps(profile, indent=2) + "\n")
    report = {"source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "expected_card_count": 26, "measure_labels": list(range(26)), "pickup": {"measure": 0, "duration": "1/4"}, "meter": "2/2", "native_changes": ["convert-ly syntax modernization", "English to Dutch pitch spelling", "relative to absolute pitches", "explicit written-measure comments including pickup 0", "whole-bar parallel dynamics lanes for bars 9 and 16", "retain Largo and separate stretto text-spanner lane", "split final two-bar voices at existing bar checks, retaining cross-staff chords"], "caveats": ["Excerpt boundaries can leave open source spanners; native render logs retained", "Final cross-staff voicing requires visual comparison with source PDF"]}
    (destination / "preparation.json").write_text(json.dumps(report, indent=2) + "\n")
    return path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(prepare(args.source, args.destination))
