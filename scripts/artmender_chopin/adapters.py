"""Scoped native adapters; no source notes are replaced or converted to MusicXML."""
from __future__ import annotations

from dataclasses import replace
from fractions import Fraction
from pathlib import Path
import re


def install(preparation_dir: Path, *, artmender_root=None):
    import artmender.lilypond as lily
    import artmender.cli as cli
    import artmender.fingering as fingering

    from pianoplayer.hand import Hand

    base_skip = Hand.skip

    def skip(self, fa, fb, na, nb, hf, lr, level):
        rejected = base_skip(self, fa, fb, na, nb, hf, lr, level)
        # PianoPlayer's pairwise stretch heuristics reject the source's four-
        # note octaves at LH17 and RH24–25 even for size M. For those native
        # voicings use its full-hand span bound instead. Keep unique ordered
        # fingers and M geometry/motion cost; infer every digit in full context.
        reviewed = ((lr == "left" and na.measure == 17)
                    or (lr == "right" and na.measure in (24, 25)))
        if (rejected and reviewed and na.isChord and nb.isChord
                and na.chordID == nb.chordID and na.NinChord == nb.NinChord == 4):
            members = [n for n in self.noteseq if n.isChord and n.chordID == na.chordID]
            ordered = fa > fb if lr == "left" else fa < fb
            if (len(members) == 4 and ordered
                    and max(n.pitch for n in members) - min(n.pitch for n in members) == 12
                    and max(n.x for n in members) - min(n.x for n in members) <= self.max_span_cm):
                return False
        return rejected

    Hand.skip = skip
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
                    # Include any sequential prefix in full-piece inference.
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
                # Prepared parallel lanes retain their explicit native durations.
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
            prefix = re.sub(r"[-_^]\s*$", "", prefix)
            # Retain leading grace/tuplet constructs as complete native syntax.
            # Braces inside markup and Scheme are already balanced source text.
            missing = prefix.count("{") - prefix.count("}")
            prefix += " }" * max(0, missing)
            fragments.append(prefix)
            lengths.append(max((offset + duration for _, offset, duration, grace in selected), default=Fraction(0)))
        target = max(lengths, default=Fraction(0))
        fragments = [lily._pad_fragment(fragment, length, target) for fragment, length in zip(fragments, lengths)]
        return lily._render_voice_fragments(voices, fragments, leading_source=measure.leading_source), target

    def card(upper, lower, upper_landing, lower_landing):
        text = base_card(upper, lower, upper_landing, lower_landing)
        text = text.replace('#(set-global-staff-size 25)', '#(set-global-staff-size 25)\n\\language "nederlands"\n' + macros, 1)
        text = text.replace("\\layout {", "\\layout {\n    \\context { \\PianoStaff \\consists #Span_stem_engraver }", 1)
        text = text.replace("lowerCard = {", "lowerCard = {\n  \\set Staff.pedalSustainStyle = #'bracket", 1)
        if upper.label == 16:
            # Close the source text spanner at this excerpt's boundary so
            # LilyPond renders its stretto label instead of discarding it.
            text = text.replace(r"s4 s8^\> s8 s2 }", r"s4 s8^\> s8 s2\! }", 1)
        return text

    lily._rhythmic_matches = matches
    fingering._rhythmic_matches = matches
    lily.parse_lilypond_score = parse
    cli.parse_lilypond_score = parse
    lily._landing_fragment_with_duration = fragment_with_duration
    lily._card_source = card
    return {"events": events, "matches": matches, "parse": parse}
