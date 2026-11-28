"""Native-prefix and initial-grace adapters for the prepared Mozart K.545 source.

Call install(preparation_dir) before Artmender writes its cards. Source-specific
metadata supplies complete syntactic landing units and exact main-time lengths.
The adapter preserves generated first-onset fingering additions verbatim.
"""
from __future__ import annotations

from fractions import Fraction
import json
from pathlib import Path
import re
import sys


GENERATED_FINGER = re.compile(r'''[\^_](?:\\tweak\s+extra-offset\s+\#'\([^)]*\)\s*)?\\finger\s+"\([1-5]+\)"''')


def _canonical(source: str) -> str:
    return " ".join(GENERATED_FINGER.sub("", source).split())


def install(preparation_dir: Path | None = None, *, artmender_root: Path | None = None):
    """Install idempotent in-process adapters; return the landing callback.

    The default metadata location is relative to this Apartmender checkout.
    Supply artmender_root when Artmender is not already importable.
    """
    if artmender_root is not None:
        sys.path.insert(0, str(Path(artmender_root).resolve() / "src"))
    import artmender.lilypond as lily

    if preparation_dir is None:
        checkout = Path(__file__).resolve().parents[2]
        preparation_dir = checkout / "artmended" / "mozart-k545-1-allegro" / "preparation"
    metadata_path = Path(preparation_dir) / "landing-prefixes.json"
    plans = json.loads(Path(metadata_path).read_text(encoding="utf-8"))
    if plans["format"] != "artmender-k545-native-landings-v1":
        raise ValueError("Unsupported native landing metadata")
    by_label = {}
    for records in plans["staves"].values():
        for plan in records:
            by_label.setdefault(plan["measure"], []).append(plan)

    def matching_plan(measure):
        if len(measure.voices) != 1:
            raise ValueError("The K.545 adapter requires one prepared voice per staff")
        canonical = _canonical(measure.voices[0].source)
        candidates = [p for p in by_label[measure.label] if _canonical(p["source"]) == canonical]
        if not candidates:
            raise ValueError(f"Native landing metadata does not match prepared measure {measure.label}")
        return candidates[0]

    def native_landing(measure):
        voices = lily._measure_voices(measure)
        if len(voices) != 1:
            raise ValueError("The K.545 adapter requires one prepared voice per staff")
        source = lily._inject_initial_duration(voices[0].source, voices[0].start_duration)
        plan = matching_plan(measure)
        lines = source.splitlines()
        if len(lines) != plan["source_lines"]:
            raise ValueError(f"Prepared line boundaries changed in measure {measure.label}")
        fragment = lily._clean_fragment("\n".join(lines[:plan["prefix_lines"]]))
        return fragment, Fraction(plan["duration"])

    lily._landing_fragment_with_duration = native_landing
    base = getattr(lily._card_source, "_native_grace_context_base", lily._card_source)

    def starts_with_grace(measure):
        for unit in matching_plan(measure)["native_units"]:
            if unit["type"] == "GraceMusic":
                return True
            if Fraction(unit["duration"]) > 0:
                return False
        return False

    def staff_properties(measure):
        clefs = [c for c in measure.context if c.startswith("\\clef ")]
        clef = clefs[-1].split(maxsplit=1)[1].strip('"')
        if clef not in {"treble", "bass"}:
            raise ValueError("The K.545 grace initializer supports treble and bass clefs")
        if any(c not in {r"\key c \major", r"\time 4/4"} for c in measure.context if not c.startswith("\\clef ")):
            raise ValueError("The K.545 grace initializer supports C major and 4/4 only")
        glyph, position, middle = ("clefs.G", -2, -6) if clef == "treble" else ("clefs.F", 2, 6)
        return f'''\\with {{ clefGlyph = "{glyph}" clefPosition = #{position} middleCClefPosition = #{middle} middleCPosition = #{middle} timeSignature = #'(4 . 4) keyAlterations = #'() }}'''

    def grace_context_card(upper, lower, upper_landing, lower_landing):
        result = base(upper, lower, upper_landing, lower_landing)
        if starts_with_grace(upper) or starts_with_grace(lower):
            # A leading grace group precedes main-time-zero commands. Staff
            # defaults must therefore exist at context creation, including
            # both middle-C properties, or bass notes would be misplaced.
            for name, measure in [("upper", upper), ("lower", lower)]:
                opening = f"{name}Card = {{\n  {lily._context_block(measure)}\n"
                if opening not in result:
                    raise ValueError("Unexpected Artmender card header")
                result = result.replace(opening, f"{name}Card = {{\n", 1)
                old = f'\\new Staff = "{name}" \\{name}Card'
                new = f'\\new Staff = "{name}" {staff_properties(measure)} \\{name}Card'
                if old not in result:
                    raise ValueError("Unexpected Artmender Staff declaration")
                result = result.replace(old, new, 1)
        return result

    grace_context_card._native_grace_context_base = base
    lily._card_source = grace_context_card
    return native_landing
