from __future__ import annotations

import json
import re
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

from ly.document import Cursor, Document
from ly.pitch.rel2abs import rel2abs

from .models import LilyPondProfile


MEASURE_COMMENT = re.compile(r"(?m)%\s*(?:bar\s*)?(\d+)\s*$", re.IGNORECASE)
CONTEXT_PATTERN = re.compile(
    r"\\(?:clef\s+(?:\"[^\"]+\"|[A-Za-z]+)|key\s+[^\s{}]+\s+\\(?:major|minor)|"
    r"time\s+\d+\s*/\s*\d+|ottava\s+#-?\d+)"
)
RHYTHMIC_TOKEN = re.compile(
    r"(?<![A-Za-z\\])"
    r"(?P<token>"
    r"<[^<>]*>(?P<chord_duration>\d+\.*)?"
    r"|(?P<atom>(?:[a-g](?:isis|eses|iss|ess|is|es|ss|s|ih|eh)?[,']*[!?]?|[rRs]))"
    r"(?P<atom_duration>\d+\.*)?"
    r")(?![A-Za-z])"
)
PITCH_IN_CHORD = re.compile(
    r"(?<![A-Za-z\\])[a-g](?:isis|eses|iss|ess|is|es|ss|s|ih|eh)?[,']*"
)
TRANSPOSE_BLOCK = re.compile(
    r"\\transpose\s+"
    r"(?P<source>[a-g](?:isis|eses|iss|ess|is|es|ss|s)?[,']*)\s+"
    r"(?P<target>[a-g](?:isis|eses|iss|ess|is|es|ss|s)?[,']*)\s*\{"
)
LAYOUT_BREAK = re.compile(r"\\(?:noBreak|break|pageBreak)\b")


@dataclass(frozen=True)
class LilyVoice:
    source: str
    start_duration: str | None
    render_prefix: str = ""
    render_suffix: str = ""
    transpose_semitones: int = 0


@dataclass(frozen=True)
class LilyMeasure:
    label: int
    source: str
    start_duration: str | None
    context: tuple[str, ...]
    voices: tuple[LilyVoice, ...] = ()
    leading_source: str = ""


@dataclass(frozen=True)
class LilyStaff:
    variable: str
    measures: tuple[LilyMeasure, ...]


@dataclass(frozen=True)
class LilyScore:
    upper: LilyStaff
    lower: LilyStaff

    @property
    def measure_count(self) -> int:
        return len(self.upper.measures)


@dataclass(frozen=True)
class LilyCardArtifact:
    sequence: int
    measure_label: str
    landing_measure_label: str | None
    lilypond_path: Path


def _rhythmic_matches(source: str) -> list[re.Match[str]]:
    blocked_spans = [
        (match.start(), match.end())
        for pattern in (
            CONTEXT_PATTERN,
            re.compile(
                r"\\transpose\s+"
                r"[a-g](?:isis|eses|iss|ess|is|es|ss|s)?[,']*\s+"
                r"[a-g](?:isis|eses|iss|ess|is|es|ss|s)?[,']*"
            ),
            re.compile(r'"(?:\\.|[^"\\])*"'),
            re.compile(r"(?m)%.*$"),
        )
        for match in pattern.finditer(source)
    ]
    return [
        match
        for match in RHYTHMIC_TOKEN.finditer(source)
        if not any(start <= match.start() < end for start, end in blocked_spans)
    ]


def normalize_lilypond(source: Path, destination: Path) -> Path:
    """Resolve relative pitches while retaining LilyPond as the authoritative notation."""
    document = Document(source.read_text(encoding="utf-8"))
    rel2abs(Cursor(document), first_pitch_absolute=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(document.plaintext(), encoding="utf-8")
    return destination


def _assignment_body(text: str, variable: str) -> str:
    assignment = re.search(rf"(?m)^\s*{re.escape(variable)}\s*=", text)
    if assignment is None:
        raise ValueError(f"LilyPond variable not found: {variable}")
    opening = text.find("{", assignment.end())
    if opening < 0:
        raise ValueError(f"No music block found for LilyPond variable: {variable}")

    depth = 0
    in_string = False
    escaped = False
    for index in range(opening, len(text)):
        character = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return text[opening + 1 : index]
    raise ValueError(f"Unclosed LilyPond music block: {variable}")


def _duration(match: re.Match[str]) -> str | None:
    return match.group("chord_duration") or match.group("atom_duration")


def _matching_brace(text: str, opening: int) -> int:
    depth = 0
    in_string = False
    in_comment = False
    escaped = False
    for index in range(opening, len(text)):
        character = text[index]
        if in_comment:
            if character == "\n":
                in_comment = False
            continue
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == "%":
            in_comment = True
        elif character == '"':
            in_string = True
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return index
    raise ValueError("Unclosed LilyPond brace block")


def _split_bar_checks(source: str) -> list[str]:
    """Split literal LilyPond bar checks while ignoring strings and comments."""
    chunks: list[str] = []
    start = 0
    in_string = False
    in_comment = False
    escaped = False
    for index, character in enumerate(source):
        if in_comment:
            if character == "\n":
                in_comment = False
            continue
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == "%":
            in_comment = True
        elif character == '"':
            in_string = True
        elif character == "|":
            chunk = LAYOUT_BREAK.sub("", source[start:index]).strip()
            if _rhythmic_matches(chunk):
                chunks.append(chunk)
            start = index + 1
    tail = LAYOUT_BREAK.sub("", source[start:]).strip()
    if _rhythmic_matches(tail):
        chunks.append(tail)
    return chunks


def _pitch_semitones(atom: str) -> int:
    match = re.fullmatch(
        r"(?P<letter>[a-g])"
        r"(?P<accidental>isis|eses|iss|ess|is|es|ss|s)?"
        r"(?P<octaves>[,']*)",
        atom,
    )
    if match is None:
        raise ValueError(f"Unsupported LilyPond transpose pitch: {atom}")
    pitch_class = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}
    accidental = {
        None: 0,
        "is": 1,
        "iss": 2,
        "isis": 2,
        "s": -1,
        "es": -1,
        "ess": -2,
        "eses": -2,
        "ss": -2,
    }
    octaves = match.group("octaves")
    return (
        pitch_class[match.group("letter")]
        + accidental[match.group("accidental")]
        + 12 * (octaves.count("'") - octaves.count(","))
    )


@dataclass(frozen=True)
class _VoiceLane:
    source: str
    render_prefix: str = ""
    render_suffix: str = ""
    transpose_semitones: int = 0


def _simultaneous_voice_bodies(body: str) -> tuple[str, list[str]] | None:
    simultaneous = body.find("<<")
    if simultaneous < 0:
        return None
    closing = body.find(">>", simultaneous + 2)
    if closing < 0:
        raise ValueError("Unclosed LilyPond simultaneous-music block")
    content = body[simultaneous + 2 : closing]
    voices: list[str] = []
    cursor = 0
    while True:
        opening = content.find("{", cursor)
        if opening < 0:
            break
        end = _matching_brace(content, opening)
        voices.append(content[opening + 1 : end])
        cursor = end + 1
    if len(voices) < 2:
        raise ValueError("A simultaneous-music block must contain at least two voices")
    return body[:simultaneous].strip(), voices


def _staff_voice_lanes(body: str) -> tuple[str, list[_VoiceLane]]:
    simultaneous = _simultaneous_voice_bodies(body)
    if simultaneous is not None:
        leading_source, voices = simultaneous
        return leading_source, [_VoiceLane(source=voice) for voice in voices]

    transpose = TRANSPOSE_BLOCK.search(body)
    if transpose is not None:
        opening = transpose.end() - 1
        closing = _matching_brace(body, opening)
        delta = _pitch_semitones(transpose.group("target")) - _pitch_semitones(
            transpose.group("source")
        )
        prefix = transpose.group(0)
        return (
            body[: transpose.start()].strip(),
            [
                _VoiceLane(
                    source=body[opening + 1 : closing],
                    render_prefix=prefix,
                    render_suffix="}",
                    transpose_semitones=delta,
                )
            ],
        )
    return "", [_VoiceLane(source=body)]


def _render_voice(voice: LilyVoice, source: str | None = None) -> str:
    music = voice.source if source is None else source
    return f"{voice.render_prefix}{music}{voice.render_suffix}".strip()


def _render_measure_voices(
    voices: tuple[LilyVoice, ...], *, leading_source: str = ""
) -> str:
    if len(voices) == 1:
        music = _render_voice(voices[0])
    else:
        rendered = [f"{{ {_render_voice(voice)} }}" for voice in voices]
        music = "<< " + r" \\ ".join(rendered) + " >>"
    return " ".join(part for part in (leading_source.strip(), music) if part).strip()


def _parse_measures(
    body: str,
    variable: str,
    default_clef: str,
    initial_context: tuple[str, ...],
) -> LilyStaff:
    markers = list(MEASURE_COMMENT.finditer(body))
    if not markers:
        raise ValueError(
            f"{variable} has no numbered measure comments. Add comments such as '% bar 1'."
        )

    measures: list[LilyMeasure] = []
    previous_end = 0
    inherited_duration: str | None = "4"
    active_context: dict[str, str] = {
        "clef": f'\\clef "{default_clef}"',
    }
    for command in initial_context:
        context_name = command.lstrip("\\").split(maxsplit=1)[0]
        active_context[context_name] = command

    for marker in markers:
        chunk = body[previous_end : marker.start()].strip()
        label = int(marker.group(1))
        context_at_start = tuple(active_context.values())
        start_duration = inherited_duration
        for context_match in CONTEXT_PATTERN.finditer(chunk):
            command = context_match.group(0)
            context_name = command.lstrip("\\").split(maxsplit=1)[0]
            active_context[context_name] = command
        for rhythmic_match in _rhythmic_matches(chunk):
            explicit_duration = _duration(rhythmic_match)
            if explicit_duration:
                inherited_duration = explicit_duration
        measures.append(
            LilyMeasure(
                label=label,
                source=chunk,
                start_duration=start_duration,
                context=context_at_start,
                voices=(LilyVoice(source=chunk, start_duration=start_duration),),
            )
        )
        previous_end = marker.end()

    labels = [measure.label for measure in measures]
    if labels != list(range(labels[0], labels[0] + len(labels))):
        raise ValueError(f"Non-consecutive measure labels in {variable}: {labels}")
    return LilyStaff(variable=variable, measures=tuple(measures))


def _parse_barline_measures(
    body: str,
    variable: str,
    default_clef: str,
    initial_context: tuple[str, ...],
) -> LilyStaff:
    leading_source, lanes = _staff_voice_lanes(body)
    lane_measures = [_split_bar_checks(lane.source) for lane in lanes]
    counts = [len(measures) for measures in lane_measures]
    if not counts or counts[0] == 0:
        raise ValueError(f"{variable} contains no barline-delimited measures")
    if len(set(counts)) != 1:
        raise ValueError(
            f"Parallel voices in {variable} have different measure counts: {counts}"
        )

    inherited_durations: list[str | None] = ["4"] * len(lanes)
    active_context: dict[str, str] = {"clef": f'\\clef "{default_clef}"'}
    for command in initial_context:
        context_name = command.lstrip("\\").split(maxsplit=1)[0]
        active_context[context_name] = command

    measures: list[LilyMeasure] = []
    for index in range(counts[0]):
        context_at_start = tuple(active_context.values())
        voices: list[LilyVoice] = []
        for voice_index, lane in enumerate(lanes):
            source = lane_measures[voice_index][index]
            start_duration = inherited_durations[voice_index]
            voices.append(
                LilyVoice(
                    source=source,
                    start_duration=start_duration,
                    render_prefix=lane.render_prefix,
                    render_suffix=lane.render_suffix,
                    transpose_semitones=lane.transpose_semitones,
                )
            )
            for rhythmic_match in _rhythmic_matches(source):
                explicit_duration = _duration(rhythmic_match)
                if explicit_duration:
                    inherited_durations[voice_index] = explicit_duration

        measure_leading = leading_source if index == 0 else ""
        voice_tuple = tuple(voices)
        rendered_source = _render_measure_voices(
            voice_tuple, leading_source=measure_leading
        )
        for context_match in CONTEXT_PATTERN.finditer(rendered_source):
            command = context_match.group(0)
            context_name = command.lstrip("\\").split(maxsplit=1)[0]
            active_context[context_name] = command
        measures.append(
            LilyMeasure(
                label=index + 1,
                source=rendered_source,
                start_duration=voices[0].start_duration,
                context=context_at_start,
                voices=voice_tuple,
                leading_source=measure_leading,
            )
        )
    return LilyStaff(variable=variable, measures=tuple(measures))


def parse_lilypond_score(
    path: Path,
    profile: LilyPondProfile,
    expected_measures: int | None = None,
) -> LilyScore:
    text = path.read_text(encoding="utf-8")
    if profile.measure_boundaries not in {"comments", "barlines"}:
        raise ValueError(
            "LilyPond measure_boundaries must be 'comments' or 'barlines'."
        )
    parser = (
        _parse_barline_measures
        if profile.measure_boundaries == "barlines"
        else _parse_measures
    )
    upper = parser(
        _assignment_body(text, profile.upper_variable),
        profile.upper_variable,
        profile.upper_default_clef,
        profile.initial_context,
    )
    lower = parser(
        _assignment_body(text, profile.lower_variable),
        profile.lower_variable,
        profile.lower_default_clef,
        profile.initial_context,
    )
    upper_labels = [measure.label for measure in upper.measures]
    lower_labels = [measure.label for measure in lower.measures]
    if upper_labels != lower_labels:
        raise ValueError(
            "The upper and lower LilyPond staves do not have aligned measure labels: "
            f"{upper_labels} vs {lower_labels}"
        )
    if expected_measures is not None and len(upper_labels) != expected_measures:
        raise ValueError(
            f"Expected {expected_measures} measures, but the LilyPond source contains "
            f"{len(upper_labels)}."
        )
    return LilyScore(upper=upper, lower=lower)


def write_score_json(score: LilyScore, destination: Path) -> Path:
    def event_payload(measure: LilyMeasure) -> list[dict[str, object]]:
        events: list[dict[str, object]] = []
        voices = measure.voices or (
            LilyVoice(measure.source, measure.start_duration),
        )
        for voice_index, voice in enumerate(voices, 1):
            for match in _rhythmic_matches(voice.source):
                token = match.group("token")
                atom = match.group("atom")
                events.append(
                    {
                        "voice": voice_index,
                        "token": token,
                        "kind": (
                            "chord"
                            if token.startswith("<")
                            else "rest"
                            if atom and atom.lower() == "r"
                            else "skip"
                            if atom and atom.lower() == "s"
                            else "note"
                        ),
                        "pitched": _is_pitched(match),
                        "explicit_duration": _duration(match),
                        "source_start": match.start(),
                        "source_end": match.end(),
                        "transpose_semitones": voice.transpose_semitones,
                    }
                )
        return events

    def staff_payload(staff: LilyStaff) -> dict[str, object]:
        return {
            "variable": staff.variable,
            "measures": [
                {
                    "number": measure.label,
                    "lilypond": measure.source,
                    "inherited_duration": measure.start_duration,
                    "context_at_start": list(measure.context),
                    "events": event_payload(measure),
                }
                for measure in staff.measures
            ],
        }

    destination.write_text(
        json.dumps(
            {
                "format": "artmender-lilypond-measures-v1",
                "measure_count": score.measure_count,
                "upper_staff": staff_payload(score.upper),
                "lower_staff": staff_payload(score.lower),
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    return destination


def _inject_initial_duration(source: str, inherited_duration: str | None) -> str:
    matches = _rhythmic_matches(source)
    first = matches[0] if matches else None
    if first is None or _duration(first) or inherited_duration is None:
        return source
    token = first.group("token")
    replacement = token + inherited_duration
    return source[: first.start("token")] + replacement + source[first.end("token") :]


def _is_pitched(match: re.Match[str]) -> bool:
    token = match.group("token")
    if token.startswith("<"):
        return bool(PITCH_IN_CHORD.search(token))
    atom = match.group("atom")
    return atom is not None and atom.lower() not in {"r", "s"}


def _balance_brackets(source: str) -> str:
    depth = 0
    result: list[str] = []
    for character in source:
        if character == "[":
            depth += 1
            result.append(character)
        elif character == "]":
            if depth:
                depth -= 1
                result.append(character)
        else:
            result.append(character)
    balanced = "".join(result).rstrip()
    balanced = re.sub(r"(?:\\[()]|[~(])+\s*$", "", balanced).rstrip()
    balanced += "]" * depth
    return balanced.replace("[]", "")


def _duration_value(duration: str) -> Fraction:
    denominator_match = re.match(r"(\d+)", duration)
    if denominator_match is None:
        raise ValueError(f"Unsupported LilyPond duration: {duration}")
    value = Fraction(1, int(denominator_match.group(1)))
    addition = value
    for _ in range(duration.count(".")):
        addition /= 2
        value += addition
    return value


def _fragment_duration(source: str, initial_duration: str = "4") -> Fraction:
    active_duration = initial_duration
    total = Fraction(0)
    for event in _rhythmic_matches(source):
        if _duration(event):
            active_duration = _duration(event) or active_duration
        total += _duration_value(active_duration)
    return total


def _pad_fragment(source: str, current: Fraction, target: Fraction) -> str:
    difference = target - current
    if difference <= 0:
        return source
    return f"{source} s1*{difference.numerator}/{difference.denominator}"


def _measure_voices(measure: LilyMeasure) -> tuple[LilyVoice, ...]:
    return measure.voices or (
        LilyVoice(source=measure.source, start_duration=measure.start_duration),
    )


def _render_voice_fragments(
    voices: tuple[LilyVoice, ...],
    fragments: list[str],
    *,
    leading_source: str = "",
) -> str:
    rendered = [
        _render_voice(voice, fragment) for voice, fragment in zip(voices, fragments)
    ]
    if len(rendered) == 1:
        music = rendered[0]
    else:
        music = "<< " + r" \\ ".join(f"{{ {voice} }}" for voice in rendered) + " >>"
    return " ".join(part for part in (leading_source.strip(), music) if part).strip()


def _measure_music(measure: LilyMeasure) -> str:
    voices = _measure_voices(measure)
    fragments = [
        _inject_initial_duration(voice.source, voice.start_duration) for voice in voices
    ]
    return _render_voice_fragments(
        voices,
        fragments,
        leading_source=measure.leading_source,
    )


def _voice_timeline(source: str) -> list[tuple[re.Match[str], Fraction, Fraction]]:
    active_duration = "4"
    offset = Fraction(0)
    timeline: list[tuple[re.Match[str], Fraction, Fraction]] = []
    for event in _rhythmic_matches(source):
        active_duration = _duration(event) or active_duration
        duration = _duration_value(active_duration)
        timeline.append((event, offset, duration))
        offset += duration
    return timeline


def _clean_fragment(source: str) -> str:
    fragment = re.sub(r"\\bar\s+\"[^\"]+\"", "", source)
    fragment = fragment.replace("|", " ")
    return _balance_brackets(fragment)


def _landing_fragment_with_duration(measure: LilyMeasure) -> tuple[str, Fraction]:
    voices = _measure_voices(measure)
    sources = [
        _inject_initial_duration(voice.source, voice.start_duration) for voice in voices
    ]
    timelines = [_voice_timeline(source) for source in sources]
    pitched_onsets = [
        offset
        for timeline in timelines
        for event, offset, _ in timeline
        if _is_pitched(event)
    ]
    if not pitched_onsets:
        rendered = _render_voice_fragments(
            voices,
            sources,
            leading_source=measure.leading_source,
        )
        return rendered, max(
            (_fragment_duration(source) for source in sources),
            default=Fraction(0),
        )

    first_onset = min(pitched_onsets)
    fragments: list[str] = []
    durations: list[Fraction] = []
    for source, timeline in zip(sources, timelines):
        first_later = next(
            (event for event, offset, _ in timeline if offset > first_onset),
            None,
        )
        end = first_later.start() if first_later is not None else len(source)
        fragment = _clean_fragment(source[:end])
        fragments.append(fragment)
        durations.append(_fragment_duration(fragment))
    rendered = _render_voice_fragments(
        voices,
        fragments,
        leading_source=measure.leading_source,
    )
    return rendered, max(durations, default=Fraction(0))


def landing_fragment(measure: LilyMeasure) -> str:
    fragment, _ = _landing_fragment_with_duration(measure)
    return fragment


def _context_block(measure: LilyMeasure) -> str:
    return "\n  ".join(measure.context)


def _card_source(
    upper: LilyMeasure,
    lower: LilyMeasure,
    upper_landing: LilyMeasure | None,
    lower_landing: LilyMeasure | None,
) -> str:
    upper_music = _measure_music(upper)
    lower_music = _measure_music(lower)
    if upper_landing is not None and lower_landing is not None:
        upper_fragment, upper_duration = _landing_fragment_with_duration(upper_landing)
        lower_fragment, lower_duration = _landing_fragment_with_duration(lower_landing)
        landing_duration = max(upper_duration, lower_duration)
        upper_music += "\n  " + _pad_fragment(
            upper_fragment, upper_duration, landing_duration
        )
        lower_music += "\n  " + _pad_fragment(
            lower_fragment, lower_duration, landing_duration
        )
    upper_music = re.sub(r"\\bar\s+\"[^\"]+\"", "", upper_music)
    lower_music = re.sub(r"\\bar\s+\"[^\"]+\"", "", lower_music)

    return f'''\\version "2.26.0"
#(set-global-staff-size 25)

\\paper {{
  indent = 0\\mm
  top-margin = 4\\mm
  bottom-margin = 4\\mm
  left-margin = 4\\mm
  right-margin = 4\\mm
  paper-width = 150\\mm
  paper-height = 75\\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}}

upperCard = {{
  {_context_block(upper)}
  \\mark \\markup {{ \\box \\bold "m. {upper.label}" }}
  {upper_music}
  \\bar "|."
}}

lowerCard = {{
  {_context_block(lower)}
  {lower_music}
  \\bar "|."
}}

\\score {{
  \\new PianoStaff <<
    \\set PianoStaff.connectArpeggios = ##t
    \\new Staff = "upper" \\upperCard
    \\new Staff = "lower" \\lowerCard
  >>
  \\layout {{
    ragged-right = ##f
    system-count = 1
  }}
}}
'''


def write_lilypond_cards(score: LilyScore, cards_dir: Path) -> list[LilyCardArtifact]:
    cards_dir.mkdir(parents=True, exist_ok=True)
    artifacts: list[LilyCardArtifact] = []
    for sequence, index in enumerate(range(score.measure_count - 1, -1, -1), start=1):
        upper = score.upper.measures[index]
        lower = score.lower.measures[index]
        has_landing = index + 1 < score.measure_count
        upper_landing = score.upper.measures[index + 1] if has_landing else None
        lower_landing = score.lower.measures[index + 1] if has_landing else None
        landing_label = str(upper_landing.label) if upper_landing else None
        stem = f"{sequence:02d}-m{upper.label}"
        if landing_label:
            stem += f"-plus-m{landing_label}-onsets"
        path = cards_dir / f"{stem}.ly"
        path.write_text(
            _card_source(upper, lower, upper_landing, lower_landing),
            encoding="utf-8",
        )
        artifacts.append(
            LilyCardArtifact(
                sequence=sequence,
                measure_label=str(upper.label),
                landing_measure_label=landing_label,
                lilypond_path=path,
            )
        )
    return artifacts
