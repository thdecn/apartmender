"""Scoped native adapters; no source notes are replaced or converted to MusicXML."""
from __future__ import annotations

from dataclasses import replace
from fractions import Fraction
from pathlib import Path
import re


def fix_measure24_slur(source: str) -> str:
    """Keep source inside-slur fingerings without LilyPond's callback cycle.

    LilyPond 2.26 recursively calculates the second m24 Slur.control-points
    through Fingering positioning when the source's `did` macro selects
    avoid-slur=inside. Native positions/direction overrides do not break it.
    These are the native solver's curve points, captured for this exact
    150mm card with that span temporarily using outside avoidance. Freezing
    only the curve keeps the source `did` and every fingering/slur unchanged.
    """
    target = r"\did a'-1 ("
    if source.count(target) != 1:
        raise ValueError("The reviewed m24 slur source changed; re-check its curve")
    control_points = "'((0.5780665769885971 . 1.538888888888889) (2.599080601478846 . 3.554836415017885) (15.171548463022596 . 5.750497018210478) (17.75622404348792 . 4.538888888888889))"
    return source.replace(target, r"\did \once \override Slur.control-points = #" + control_points + " a'-1 (", 1)


def fix_card_layout(source: str, measure_label: int) -> str:
    """Card-only corrections for offsets and continuations from the full page."""
    if measure_label in {0, 1}:
        source = source.replace("TextScript.extra-offset = #'( 0.0 . -4.8 )",
                                "TextScript.extra-offset = #'( 0.0 . 0.0 )")
    if measure_label == 34:
        source = source.replace("TextScript.extra-offset = #'( 0.0 . -2.0 )",
                                "TextScript.extra-offset = #'( 0.0 . 0.0 )")
    if measure_label == 23:
        # The one-note m24 landing has no second note for these continuations.
        # Retain its onset, finger, articulation, dynamic and hairpin.
        orphan = r" ([ \dif]"
        if source.count(orphan) != 1:
            raise ValueError("Reviewed m24 singleton landing syntax changed")
        source = source.replace(orphan, "", 1)
    if measure_label == 31:
        # The next bar is an unmetered cadenza. Its first LH note alone has
        # no second beam/slur endpoint; retain the pitch, pedal and fingering,
        # and remove only these continuation graphics and the next-note offset.
        source, count = re.subn(
            r"(\\ped)\s*\[\s*\\\(\\once \\override TextScript.extra-offset = #'\( -0.4 . -5.5 \)\]",
            r"\1", source)
        if count != 1:
            raise ValueError("Reviewed m32 singleton landing syntax changed")
        # Close unmetered time only after BOTH staff landing fragments and
        # their silent alignment padding, so their final barlines coincide.
        source = source.replace(r"\cadenzaOff", "")
        source = source.replace('\n  \\bar "|."', '\n  \\cadenzaOff \\bar "|."')
        # Full-page dash spacing spans the whole cadenza, absent on this
        # one-onset landing. Keep the complete words in a compact reminder.
        source = source.replace("senza        –          –        tempo", "senza tempo")
        source = source.replace("paper-width = 150\\mm", "paper-width = 160\\mm")
    return source


def install(preparation_dir: Path, *, artmender_root=None):
    import artmender.lilypond as lily
    import artmender.cli as cli
    import artmender.fingering as fingering

    base_parse = lily.parse_lilypond_score
    base_card = lily._card_source
    base_matches = lily._rhythmic_matches
    macros = (preparation_dir / "source-macros.ily").read_text()

    def markup_spans(source):
        spans = []
        for match in re.finditer(r"\\markup\s*\{", source):
            opening = source.index("{", match.start())
            spans.append((match.start(), lily._matching_brace(source, opening) + 1))
        return spans

    def matches(source):
        spans = markup_spans(source)
        # Without this, the engine's chord regex can mistake a chord-free
        # `<< { voice } \\\\ { voice } >>` block for one enormous chord.
        scanned = source.replace("<<", "  ").replace(">>", "  ")
        return [m for m in base_matches(scanned)
                if not any(start <= m.start() < end for start, end in spans)
                and source[max(0, m.start() - 2):m.start()] != "##"]

    def grace_spans(source):
        spans = []
        for match in re.finditer(r"\\(?:grace|acciaccatura|appoggiatura)\b\s*", source):
            start = match.end()
            if source[start:start + 1] == "{":
                end = lily._matching_brace(source, start) + 1
            else:
                upcoming = next((m for m in matches(source) if m.start() >= start), None)
                if upcoming is None:
                    raise ValueError("Grace command has no music")
                end = upcoming.end()
            spans.append((match.start(), end))
        return spans

    def events(source, inherited="4"):
        grace = grace_spans(source)
        ratios = []
        for match in re.finditer(r"\\(times|tuplet)\s+(\d+)/(\d+)\s*\{", source):
            factor = Fraction(int(match[2]), int(match[3]))
            if match[1] == "tuplet":
                factor = 1 / factor
            ratios.append((match.end() - 1, lily._matching_brace(source, match.end() - 1),
                           factor))
        duration = inherited or "4"
        offset = Fraction(0)
        result = []
        for match in matches(source):
            duration = lily._duration(match) or duration
            length = lily._duration_value(duration)
            for start, end, factor in ratios:
                if start < match.start() < end:
                    length *= factor
            is_grace = any(start <= match.start() < end for start, end in grace)
            result.append((match, offset, Fraction(0) if is_grace else length, is_grace))
            if not is_grace:
                offset += length
        return result

    def parse(path, profile, expected_measures=None):
        score = base_parse(path, profile, expected_measures)
        staves = []
        for staff in (score.upper, score.lower):
            prepared = []
            for measure in staff.measures:
                leading, lanes = lily._staff_voice_lanes(measure.source)
                voices = tuple(lily.LilyVoice(source=lane.source, start_duration=measure.start_duration,
                                             render_prefix=lane.render_prefix, render_suffix=lane.render_suffix,
                                             transpose_semitones=lane.transpose_semitones) for lane in lanes)
                if matches(leading):
                    # m31 has sequential music before its final two-voice beat.
                    # Put it in lane 1; lane 2 waits with exact eighth skips.
                    # Keeping it merely as `leading_source` would hide its
                    # first onset from full-piece fingering inference.
                    duration = sum((e[2] for e in events(leading, measure.start_duration)), Fraction(0))
                    if duration * 8 != int(duration * 8):
                        raise ValueError("Unexpected non-eighth prefix before parallel voices")
                    wait = " ".join(["s8"] * int(duration * 8))
                    voices = tuple(replace(v, source=((leading if i == 0 else wait) + "\n" + v.source))
                                   for i, v in enumerate(voices))
                    leading = ""
                # Both final lower-staff voices begin with explicit durations.
                # A short voice ends naturally; add no musical notes to fill it.
                prepared.append(replace(measure, voices=voices, leading_source=leading))
            staves.append(replace(staff, measures=tuple(prepared)))
        return lily.LilyScore(upper=staves[0], lower=staves[1])

    def fragment_with_duration(measure):
        voices = lily._measure_voices(measure)
        sources = [lily._inject_initial_duration(v.source, v.start_duration) for v in voices]
        timelines = [events(source, v.start_duration) for source, v in zip(sources, voices)]
        principal = [(event, offset, duration) for timeline in timelines
                     for event, offset, duration, grace in timeline
                     if not grace and lily._is_pitched(event)]
        if not principal:
            # Pickup LH is a rest; retain it rather than inventing an onset.
            return lily._render_voice_fragments(voices, sources, leading_source=measure.leading_source), max(
                (sum((e[2] for e in timeline), Fraction(0)) for timeline in timelines), default=Fraction(0))
        onset = min(offset for _, offset, _ in principal)
        fragments, lengths = [], []
        for source, timeline in zip(sources, timelines):
            selected = [entry for entry in timeline if not entry[3] and entry[1] <= onset]
            if not selected:
                fragments.append("")
                lengths.append(Fraction(0))
                continue
            last = selected[-1][0]
            following = next((entry for entry in timeline if entry[0].start() > last.start() and not entry[3]), None)
            end = following[0].start() if following else len(source)
            # Do not retain an ornament that belongs to the following principal.
            for start, stop in grace_spans(source):
                if last.end() <= start < end:
                    end = start
            prefix = source[:end]
            prefix = re.sub(r'\\bar\s+"[^"]*"', '', prefix)
            prefix = lily._balance_brackets(prefix)
            # Retain leading grace/tuplet constructs as complete native syntax.
            # Braces inside markup and Scheme are already balanced source text.
            missing = prefix.count("{") - prefix.count("}")
            prefix += " }" * max(0, missing)
            if r"\cadenzaOn" in prefix and r"\cadenzaOff" not in prefix:
                prefix += r" \cadenzaOff"
            fragments.append(prefix)
            lengths.append(max((offset + duration for _, offset, duration, grace in selected), default=Fraction(0)))
        target = max(lengths, default=Fraction(0))
        fragments = [lily._pad_fragment(fragment, length, target) for fragment, length in zip(fragments, lengths)]
        return lily._render_voice_fragments(voices, fragments, leading_source=measure.leading_source), target

    def card(upper, lower, upper_landing, lower_landing):
        text = base_card(upper, lower, upper_landing, lower_landing)
        text = text.replace('#(set-global-staff-size 25)', '#(set-global-staff-size 25)\n\\language "nederlands"\n' + macros, 1)
        def leading_grace(measure):
            for voice in lily._measure_voices(measure):
                timeline = events(voice.source, voice.start_duration)
                first = next((entry for entry in timeline if lily._is_pitched(entry[0])), None)
                if first is not None and first[3] and first[1] == 0:
                    return True
            return False
        if leading_grace(upper) or leading_grace(lower):
            # Grace events precede main-time-zero context commands. Initialize
            # both staves at construction, so the lower grace-time context is
            # already bass-clef/E-flat/12/8 rather than the implicit defaults.
            grace_lengths = []
            for measure in (upper, lower):
                if leading_grace(measure):
                    source = lily._measure_voices(measure)[0].source
                    start, end = grace_spans(source)[0]
                    grace_lengths.append(lily._fragment_duration(source[start:end]))
            grace_length = max(grace_lengths)
            for name, measure in (("upper", upper), ("lower", lower)):
                clef = next(c for c in measure.context if c.startswith("\\clef ")).split(maxsplit=1)[1].strip('"')
                glyph, position, middle = (("clefs.G", -2, -6) if clef == "treble" else ("clefs.F", 2, 6))
                properties = f'''\\with {{ clefGlyph = "{glyph}" clefPosition = #{position} middleCClefPosition = #{middle} middleCPosition = #{middle} timeSignature = #'(12 . 8) keyAlterations = #'((2 . -1/2) (3 . 0) (4 . 0) (5 . -1/2) (6 . -1/2) (0 . 0) (1 . 0)) }}'''
                opening = f"{name}Card = {{\n  {lily._context_block(measure)}\n"
                if opening not in text:
                    raise ValueError("Unexpected Artmender context header")
                text = text.replace(opening, f"{name}Card = {{\n", 1)
                # A KeyChangeEvent is required to engrave the initial flats;
                # a property-only keyAlterations initializer is insufficient.
                # Put it at the existing grace onset. The other staff receives
                # only an invisible, same-duration grace skip (no added notes).
                body_start = text.index(f"{name}Card = {{")
                body_end = text.index("\n  \\bar", body_start)
                body = text[body_start:body_end]
                if leading_grace(measure):
                    body, count = re.subn(r"(\\(?:grace|acciaccatura|appoggiatura)\s*\{)",
                                          r"\1 \\key es \\major ", body, count=1)
                    if count != 1:
                        raise ValueError("Expected a braced leading grace unit")
                else:
                    skip = f"s1*{grace_length.numerator}/{grace_length.denominator}"
                    body = body.replace(f"{name}Card = {{\n", f"{name}Card = {{\n  \\grace {{ \\key es \\major {skip} }}\n", 1)
                text = text[:body_start] + body + text[body_end:]
                text = text.replace(f'\\new Staff = "{name}" \\{name}Card',
                                    f'\\new Staff = "{name}" {properties} \\{name}Card', 1)
            text = text.replace("\\layout {\n    ragged-right", "\\layout {\n    \\context { \\Score measureLength = #3/2 timeSignature = #'(12 . 8) }\n    ragged-right", 1)
        # Source octave display starts within m30 and continues through m31 and
        # part of m32. Artmender context tracking supplies it from native ottava.
        # Keep the very long written cadenza intact on its one system: expand
        # engraving width rather than dropping notes or inventing subdivisions.
        if upper.label == 32:
            text = text.replace("paper-width = 150\\mm", "paper-width = 520\\mm")
        if upper.label == 24:
            text = fix_measure24_slur(text)
        text = fix_card_layout(text, upper.label)
        return text

    lily._rhythmic_matches = matches
    fingering._rhythmic_matches = matches
    lily.parse_lilypond_score = parse
    cli.parse_lilypond_score = parse
    lily._landing_fragment_with_duration = fragment_with_duration
    lily._card_source = card
    return {"events": events, "matches": matches, "parse": parse}
