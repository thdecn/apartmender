"""Prepare the licensed source without converting or rewriting its musical content."""
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

from artmender.lilypond import _assignment_body


def prepare(source: Path, destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    converted = subprocess.run(["convert-ly", str(source)], check=True,
                               text=True, capture_output=True)
    (destination / "convert-ly.log").write_text(converted.stderr)
    text = converted.stdout
    # `dis` is a pitch name in Dutch; the English source used it as a macro.
    text = re.sub(r"(?m)^(\s*)dis\s*=", r"\1chopinDynamicSpacing =", text)
    text = re.sub(r"\\dis\b", r"\\chopinDynamicSpacing", text)
    text = re.sub(r"#\(set-octavation\s+(-?\d+)\)", r"\\ottava #\1", text)
    document = Document(text)
    translate(Cursor(document), "nederlands")
    rel2abs(Cursor(document), first_pitch_absolute=False)
    text = document.plaintext()
    upper = _assignment_body(text, "upper")
    lower = _assignment_body(text, "lower")

    # Split the source's unlabelled pickup from its first complete bar.
    boundary = upper.index("\\once \\override TextScript.extra-offset = #'( 0.0 . -4.8 )")
    upper = upper[:boundary] + "% bar 0\n" + upper[boundary:]
    lower = lower.replace(r"\partial 8 r8", "\\partial 8 r8 % bar 0", 1)

    # The source's final LH simultaneous block contains BOTH bars 33 and 34,
    # despite the lone trailing %33 comment. Split each absolute-pitch voice
    # at the verified 12/8 boundary and reconstruct the same two voices.
    start = lower.index("<<", lower.index("%32"))
    final = lower[start:]
    match = re.fullmatch(r"\s*<<\s*\{(.*?)\}\s*\\\\\s*\{(.*?)\}\s*>>\s*%33\s*", final, re.S)
    if match is None:
        raise ValueError("Unexpected final simultaneous block; source requires review")
    first, second = match.groups()
    first_at = first.index("\\stemNeutral")
    second_at = second.index("bes4 s8 )\\stemNeutral")
    bar33 = "<< { " + first[:first_at] + " } \\\\ { " + second[:second_at] + " } >> %33\n"
    bar34 = "<< { " + first[first_at:] + " } \\\\ { " + second[second_at:] + " } >> %34\n"
    lower = lower[:start] + bar33 + bar34

    macro_start = text.index("%%%Il gruppetto")
    macro_end = re.search(r"(?m)^\s*upper\s*=", text).start()
    macros = text[macro_start:macro_end]
    (destination / "source-macros.ily").write_text(macros)
    prepared = '\\version "2.26.0"\n\\language "nederlands"\n' + macros
    prepared += "\nupper = {\n" + upper + "\n}\nlower = {\n" + lower + "\n}\n"
    prepared += "\\score { \\new PianoStaff << \\new Staff = \"upper\" \\upper \\new Staff = \"lower\" \\lower >> \\layout {} }\n"
    path = destination / "score.prepared.ly"
    path.write_text(prepared)
    profile = {
        "upper_variable": "upper", "lower_variable": "lower",
        "upper_default_clef": "treble", "lower_default_clef": "bass",
        "initial_context": [r"\key es \major", r"\time 12/8"],
        "measure_boundaries": "comments",
    }
    (destination / "profile.json").write_text(json.dumps(profile, indent=2) + "\n")
    report = {
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "expected_card_count": 35, "measure_labels": list(range(35)),
        "pickup": {"measure": 0, "duration": "1/8", "upper": "bes'8-1", "lower": "r8"},
        "meter": "12/8", "unmetered_cadenza_measure": 32,
        "native_changes": ["convert-ly syntax modernization", "English to Dutch pitch spelling", "relative to absolute pitches", "dis macro renamed to avoid pitch collision", "set-octavation replaced by ottava", "pickup labelled 0", "final LH two-voice bars split into 33 and 34 without dropping events"],
        "first_onset_substitutions": {"upper": {"1": [5, 4], "5": [5, 4], "7": [2, 3], "15": [2, 3], "23": [2, 3]}},
        "substitution_policy": "One pitch, successive source fingers; first digit is initial anchor. Preserve complete source markup and do not treat digits as chord members or print a generated duplicate.",
        "card_layout_adapters": ["Macros retained natively", "Grace-aware and tuplet-aware first-principal landing units", "Context initialization plus silent grace-time key alignment on cards13/21", "Unmetered cadenza32 retained intact on wider520mm one-system engraving"],
        "caveats": ["Source overrides staff padding and text offsets: review card engraving", "Measure 32 cadenza is retained intact; assess one-system readability", "Card excerpt boundaries can produce open source slur/hairpin warnings"],
    }
    (destination / "preparation.json").write_text(json.dumps(report, indent=2) + "\n")
    return path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(prepare(args.source, args.destination))
