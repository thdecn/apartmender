from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, replace
from fractions import Fraction
from pathlib import Path

from pianoplayer.hand import Hand
from pianoplayer.models import INote, keypos
from pianoplayer.musicxml_io import noteseq_from_part, parse_musicxml

from .lilypond import (
    PITCH_IN_CHORD,
    LilyMeasure,
    LilyScore,
    LilyStaff,
    LilyVoice,
    _duration,
    _duration_value,
    _is_pitched,
    _render_measure_voices,
    _rhythmic_matches,
)
from .models import FingeringProfile


FINGER_MARK = re.compile(r"[-_^]\s*([1-5])")
PITCH_ATOM = re.compile(
    r"^(?P<letter>[a-g])"
    r"(?P<accidental>isis|eses|iss|ess|is|es|ss|s|ih|eh)?"
    r"(?P<octaves>[,']*)[!?]?$"
)
ACCIDENTAL_SEMITONES = {
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
ACCIDENTAL_NAMES = {
    None: "",
    "is": "#",
    "iss": "##",
    "isis": "##",
    "s": "-",
    "es": "-",
    "ess": "--",
    "eses": "--",
    "ss": "--",
}
PITCH_CLASS = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}


@dataclass(frozen=True)
class FingeringRecord:
    staff: str
    hand: str
    measure: int
    midi_pitches: tuple[int, ...]
    original_fingers: tuple[int | None, ...]
    inferred_fingers: tuple[int, ...]
    printed_suggestion: str | None
    engine: str = "PianoPlayer 3"


@dataclass
class _Event:
    measure_index: int
    measure_label: int
    voice_index: int
    source_start: int
    source_end: int
    time: Fraction
    midi_pitches: tuple[int, ...]
    original_fingers: tuple[int | None, ...]
    notes: tuple[INote, ...]


@dataclass(frozen=True)
class _PendingEvent:
    measure_index: int
    measure_label: int
    voice_index: int
    source_start: int
    source_end: int
    time: Fraction
    duration: Fraction
    midi_pitches: tuple[int, ...]
    original_fingers: tuple[int | None, ...]


def lilypond_pitch_to_midi(atom: str) -> int:
    """Convert an absolute LilyPond pitch atom to a MIDI note number."""
    match = PITCH_ATOM.fullmatch(atom)
    if match is None:
        raise ValueError(f"Unsupported LilyPond pitch: {atom}")
    accidental = match.group("accidental")
    if accidental in {"ih", "eh"}:
        raise ValueError(f"Microtonal LilyPond pitch is not supported for fingering: {atom}")
    octave_marks = match.group("octaves")
    octave_shift = octave_marks.count("'") - octave_marks.count(",")
    return (
        48
        + PITCH_CLASS[match.group("letter")]
        + ACCIDENTAL_SEMITONES[accidental]
        + 12 * octave_shift
    )


def _pianoplayer_name(atom: str) -> str:
    match = PITCH_ATOM.fullmatch(atom)
    if match is None:
        raise ValueError(f"Unsupported LilyPond pitch: {atom}")
    accidental = match.group("accidental")
    if accidental in {"ih", "eh"}:
        raise ValueError(f"Microtonal LilyPond pitch is not supported for fingering: {atom}")
    return match.group("letter").upper() + ACCIDENTAL_NAMES[accidental]


def _fingering_after_token(
    source: str,
    matches: list[re.Match[str]],
    event_index: int,
) -> int | None:
    match = matches[event_index]
    end = matches[event_index + 1].start() if event_index + 1 < len(matches) else len(source)
    finger = FINGER_MARK.search(source, match.end("token"), end)
    return int(finger.group(1)) if finger else None


def _chord_pitches_and_fingers(token: str) -> tuple[tuple[int, ...], tuple[int | None, ...]]:
    closing = token.find(">")
    chord_source = token[: closing + 1]
    matches = list(PITCH_IN_CHORD.finditer(chord_source))
    pitches = tuple(lilypond_pitch_to_midi(match.group(0)) for match in matches)
    fingers: list[int | None] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else closing
        finger = FINGER_MARK.search(chord_source, match.end(), end)
        fingers.append(int(finger.group(1)) if finger else None)
    return pitches, tuple(fingers)


def _midi_name(pitch: int) -> str:
    return ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")[
        pitch % 12
    ]


def _measure_voices(measure: LilyMeasure) -> tuple[LilyVoice, ...]:
    return measure.voices or (
        LilyVoice(source=measure.source, start_duration=measure.start_duration),
    )


def _staff_events(staff: LilyStaff) -> tuple[list[_Event], list[INote]]:
    """Build a chronological note stream while keeping concurrent LilyPond voices concurrent."""
    pending: list[_PendingEvent] = []
    measure_start = Fraction(0)

    for measure_index, measure in enumerate(staff.measures):
        voice_lengths: list[Fraction] = []
        for voice_index, voice in enumerate(_measure_voices(measure)):
            active_duration = voice.start_duration or "4"
            local_time = Fraction(0)
            matches = _rhythmic_matches(voice.source)
            for event_index, match in enumerate(matches):
                explicit_duration = _duration(match)
                if explicit_duration:
                    active_duration = explicit_duration
                duration = _duration_value(active_duration) * 4
                if _is_pitched(match):
                    token = match.group("token")
                    if token.startswith("<"):
                        pitches, original_fingers = _chord_pitches_and_fingers(token)
                    else:
                        atom = match.group("atom")
                        if atom is None:
                            raise ValueError(
                                f"Could not read LilyPond note token: {token}"
                            )
                        pitches = (lilypond_pitch_to_midi(atom),)
                        original_fingers = (
                            _fingering_after_token(voice.source, matches, event_index),
                        )
                    pitch_fingers = sorted(
                        (
                            (pitch + voice.transpose_semitones, original)
                            for pitch, original in zip(pitches, original_fingers)
                        ),
                        key=lambda item: item[0],
                    )
                    pitches = tuple(pitch for pitch, _ in pitch_fingers)
                    original_fingers = tuple(
                        original for _, original in pitch_fingers
                    )
                    pending.append(
                        _PendingEvent(
                            measure_index=measure_index,
                            measure_label=measure.label,
                            voice_index=voice_index,
                            source_start=match.start("token"),
                            source_end=match.end("token"),
                            time=measure_start + local_time,
                            duration=duration,
                            midi_pitches=pitches,
                            original_fingers=original_fingers,
                        )
                    )
                local_time += duration
            voice_lengths.append(local_time)
        measure_start += max(voice_lengths, default=Fraction(0))

    # Notes from separate voices that begin together are one physical keyboard onset.
    # PianoPlayer must see that onset as a chord so it cannot assign the same finger to
    # two simultaneous pitches.
    onset_members: dict[Fraction, list[tuple[_PendingEvent, int, int | None]]] = {}
    for event in pending:
        for pitch, original in zip(event.midi_pitches, event.original_fingers):
            onset_members.setdefault(event.time, []).append((event, pitch, original))

    notes: list[INote] = []
    notes_by_event: dict[int, list[INote]] = {id(event): [] for event in pending}
    note_id = 0
    chord_id = 0
    for onset, members in sorted(onset_members.items()):
        members.sort(key=lambda member: member[1])
        count = len(members)
        for chord_index, (event, pitch, original_finger) in enumerate(members):
            note = INote(
                name=_midi_name(pitch),
                isChord=count > 1,
                isBlack=pitch % 12 in {1, 3, 6, 8, 10},
                pitch=pitch,
                octave=pitch // 12 - 1,
                time=float(onset) - 0.05 * (count - chord_index - 1),
                duration=float(event.duration)
                + (0.05 * (count - 1) if count > 1 else 0),
                fingering=original_finger or 0,
                is_anchor=original_finger is not None,
                measure=event.measure_label,
                chordnr=chord_index if count > 1 else 0,
                NinChord=count if count > 1 else 0,
                chordID=chord_id if count > 1 else 0,
                noteID=note_id,
            )
            note.x = keypos(note)
            notes.append(note)
            notes_by_event[id(event)].append(note)
            note_id += 1
        if count > 1:
            chord_id += 1

    events = [
        _Event(
            measure_index=event.measure_index,
            measure_label=event.measure_label,
            voice_index=event.voice_index,
            source_start=event.source_start,
            source_end=event.source_end,
            time=event.time,
            midi_pitches=event.midi_pitches,
            original_fingers=event.original_fingers,
            notes=tuple(notes_by_event[id(event)]),
        )
        for event in pending
    ]
    events.sort(key=lambda event: (event.time, event.voice_index, event.source_start))
    return events, notes


def _annotate_staff(
    staff: LilyStaff,
    *,
    staff_name: str,
    side: str,
    hand_size: str,
    onset_fingerings: tuple[tuple[int, ...], ...] | None = None,
    profile_name: str | None = None,
) -> tuple[LilyStaff, list[FingeringRecord]]:
    events, notes = _staff_events(staff)
    if len(notes) < 2:
        raise ValueError(f"Not enough notes in {staff_name} staff for fingering inference.")

    _run_optimizer(notes, side=side, hand_size=hand_size, staff_name=staff_name)

    first_events: dict[int, list[_Event]] = {}
    for event in events:
        existing = first_events.get(event.measure_index)
        if existing is None or event.time < existing[0].time:
            first_events[event.measure_index] = [event]
        elif event.time == existing[0].time:
            existing.append(event)

    replacements: dict[tuple[int, int], list[tuple[int, str]]] = {}
    records: list[FingeringRecord] = []
    for measure_index, onset_events in first_events.items():
        members = sorted(
            (
                (note, pitch, original, event)
                for event in onset_events
                for note, pitch, original in zip(
                    event.notes, event.midi_pitches, event.original_fingers
                )
            ),
            key=lambda member: member[1],
        )
        inferred = tuple(int(note.fingering) for note, _, _, _ in members)
        originals = tuple(original for _, _, original, _ in members)
        if onset_fingerings is not None:
            if measure_index >= len(onset_fingerings):
                raise ValueError(
                    f"Fingering profile has no {staff_name} entry for measure "
                    f"{onset_events[0].measure_label}."
                )
            editorial = onset_fingerings[measure_index]
            if len(editorial) != len(members):
                raise ValueError(
                    f"Fingering profile gives {len(editorial)} {staff_name} fingers "
                    f"for measure {onset_events[0].measure_label}, but its first onset "
                    f"has {len(members)} pitch(es)."
                )
            if any(not 1 <= finger <= 5 for finger in editorial):
                raise ValueError("Fingering profiles may contain only digits 1-5.")
            for original, editorial_finger in zip(originals, editorial):
                if original is not None and original != editorial_finger:
                    raise ValueError(
                        f"Fingering profile conflicts with an original source fingering "
                        f"in {staff_name} measure {onset_events[0].measure_label}."
                    )
            inferred = tuple(
                original if original is not None else editorial_finger
                for original, editorial_finger in zip(originals, editorial)
            )
        generated = tuple(
            finger
            for finger, original in zip(inferred, originals)
            if original is None
        )
        printed = f"({''.join(str(finger) for finger in generated)})" if generated else None
        if printed:
            if staff_name == "lower":
                # A lower fermata already occupies the space directly beneath its
                # note. Keep the fingering below, but nudge it right to avoid a
                # collision (notably the final octave in BWV 846).
                tweak = (
                    r"\tweak extra-offset #'(2.5 . 0) "
                    if r"\fermata" in staff.measures[measure_index].source
                    else ""
                )
                fingering = rf'_{tweak}\finger "{printed}"'
            else:
                fingering = rf'^\finger "{printed}"'
            # Put one grouped suggestion on the highest note of a multi-voice onset.
            target = max(onset_events, key=lambda event: max(event.midi_pitches))
            replacements.setdefault((measure_index, target.voice_index), []).append(
                (target.source_end, fingering)
            )
        records.append(
            FingeringRecord(
                staff=staff_name,
                hand=side,
                measure=onset_events[0].measure_label,
                midi_pitches=tuple(pitch for _, pitch, _, _ in members),
                original_fingers=originals,
                inferred_fingers=inferred,
                printed_suggestion=printed,
                engine=profile_name or "PianoPlayer 3",
            )
        )

    annotated_measures: list[LilyMeasure] = []
    for measure_index, measure in enumerate(staff.measures):
        voices: list[LilyVoice] = []
        for voice_index, voice in enumerate(_measure_voices(measure)):
            source = voice.source
            for offset, markup in sorted(
                replacements.get((measure_index, voice_index), []), reverse=True
            ):
                source = source[:offset] + markup + source[offset:]
            voices.append(replace(voice, source=source))
        voice_tuple = tuple(voices)
        annotated_measures.append(
            replace(
                measure,
                voices=voice_tuple,
                source=_render_measure_voices(
                    voice_tuple, leading_source=measure.leading_source
                ),
            )
        )
    return replace(staff, measures=tuple(annotated_measures)), records


def _run_optimizer(
    notes: list[INote],
    *,
    side: str,
    hand_size: str,
    staff_name: str,
) -> None:
    # PianoPlayer solves nine-note windows and pads a short final window by repeating
    # its last note. Repeating a chord member retains its chord identity and can make
    # that synthetic window impossible. Neutral, non-chord tail notes keep every real
    # score event in a complete window without changing the score itself.
    last = notes[-1]
    optimizer_notes = list(notes)
    for index in range(9):
        tail = INote(
            name=last.name,
            isBlack=last.isBlack,
            pitch=last.pitch,
            octave=last.octave,
            x=last.x,
            time=last.time + last.duration + (index * 4),
            duration=4,
            measure=last.measure + 1,
            noteID=len(notes) + index,
        )
        optimizer_notes.append(tail)

    hand = Hand(optimizer_notes, side=side, size=hand_size)
    hand.verbose = False
    hand.generate()
    invalid = [note for note in notes if not 1 <= int(note.fingering) <= 5]
    if invalid:
        locations = ", ".join(f"m.{note.measure}/MIDI {note.pitch}" for note in invalid)
        raise ValueError(f"Fingering optimizer produced invalid fingers in {staff_name}: {locations}")


def suggest_first_onset_fingerings(
    score: LilyScore,
    *,
    hand_size: str = "M",
    profile: FingeringProfile | None = None,
) -> tuple[LilyScore, list[FingeringRecord]]:
    """Infer both staves over the whole piece, then label each measure's first onset."""
    if hand_size not in {"XXS", "XS", "S", "M", "L", "XL", "XXL"}:
        raise ValueError(f"Unsupported hand size: {hand_size}")
    if profile and (
        len(profile.upper_first_onsets) != score.measure_count
        or len(profile.lower_first_onsets) != score.measure_count
    ):
        raise ValueError(
            f"Fingering profile has {len(profile.upper_first_onsets)} upper and "
            f"{len(profile.lower_first_onsets)} lower entries for a "
            f"{score.measure_count}-measure score."
        )
    upper, upper_records = _annotate_staff(
        score.upper,
        staff_name="upper",
        side="right",
        hand_size=hand_size,
        onset_fingerings=profile.upper_first_onsets if profile else None,
        profile_name=profile.name if profile else None,
    )
    lower, lower_records = _annotate_staff(
        score.lower,
        staff_name="lower",
        side="left",
        hand_size=hand_size,
        onset_fingerings=profile.lower_first_onsets if profile else None,
        profile_name=profile.name if profile else None,
    )
    return LilyScore(upper=upper, lower=lower), upper_records + lower_records


def _insert_musicxml_suggestion(
    note_element: ET.Element,
    text: str,
    *,
    placement: str,
) -> None:
    notations = note_element.find("notations")
    if notations is None:
        notations = ET.SubElement(note_element, "notations")
    technical = notations.find("technical")
    if technical is None:
        technical = ET.SubElement(notations, "technical")
    fingering = ET.SubElement(technical, "fingering", {"placement": placement})
    fingering.text = text


def suggest_musicxml_first_onset_fingerings(
    source: Path,
    destination: Path,
    *,
    hand_size: str = "M",
) -> list[FingeringRecord]:
    """Annotate first sounding onsets in a two-part MusicXML score."""
    if hand_size not in {"XXS", "XS", "S", "M", "L", "XL", "XXL"}:
        raise ValueError(f"Unsupported hand size: {hand_size}")
    score = parse_musicxml(str(source))
    if len(score.parts) != 2:
        raise ValueError(
            f"MusicXML fingering inference expects two keyboard parts; found {len(score.parts)}."
        )

    records: list[FingeringRecord] = []
    for part, staff_name, side in zip(
        score.parts,
        ("upper", "lower"),
        ("right", "left"),
    ):
        notes = noteseq_from_part(part)
        if len(notes) < 2:
            raise ValueError(f"Not enough notes in {staff_name} staff for fingering inference.")
        original_by_note_id = {
            id(note): int(note.fingering) if note.is_anchor else None for note in notes
        }
        _run_optimizer(notes, side=side, hand_size=hand_size, staff_name=staff_name)

        notes_by_event: dict[int, list[INote]] = {}
        for note in notes:
            notes_by_event.setdefault(id(note.note21), []).append(note)

        seen_measures: set[int] = set()
        for event in part.events:
            event_notes = notes_by_event.get(id(event))
            if not event_notes or event.measure in seen_measures:
                continue
            seen_measures.add(event.measure)
            originals = tuple(original_by_note_id[id(note)] for note in event_notes)
            inferred = tuple(int(note.fingering) for note in event_notes)
            generated = tuple(
                finger for finger, original in zip(inferred, originals) if original is None
            )
            printed = (
                f"({''.join(str(finger) for finger in generated)})" if generated else None
            )
            if printed:
                _insert_musicxml_suggestion(
                    event.notes[0],
                    printed,
                    placement="below" if staff_name == "lower" else "above",
                )
            records.append(
                FingeringRecord(
                    staff=staff_name,
                    hand=side,
                    measure=event.measure,
                    midi_pitches=tuple(int(pitch.midi) for pitch in event.pitches),
                    original_fingers=originals,
                    inferred_fingers=inferred,
                    printed_suggestion=printed,
                )
            )

    destination.parent.mkdir(parents=True, exist_ok=True)
    score.write(str(destination))
    return records


def write_fingering_json(
    records: list[FingeringRecord],
    destination: Path,
    *,
    hand_size: str,
    profile: FingeringProfile | None = None,
) -> Path:
    destination.write_text(
        json.dumps(
            {
                "format": "artmender-first-onset-fingerings-v1",
                "engine": profile.name if profile else "PianoPlayer 3",
                "scope": (
                    "whole-piece editorial profile applied to upper/right and lower/left "
                    "staff onsets; PianoPlayer validates a complete chronological note "
                    "stream"
                    if profile
                    else "whole piece, independently optimized upper and lower staves"
                ),
                "hand_size": hand_size,
                "generated_notation": "parenthesized; chord digits grouped",
                "engraving_style": (
                    "native fingering object and font; upper staff above, lower staff below"
                ),
                "editorial_profile": (
                    {
                        "name": profile.name,
                        "source_page_url": profile.source_page_url,
                        "license": profile.license_name,
                        "hand_distribution": profile.hand_distribution,
                    }
                    if profile
                    else None
                ),
                "records": [asdict(record) for record in records],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    return destination
