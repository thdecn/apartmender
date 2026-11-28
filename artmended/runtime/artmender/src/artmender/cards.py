from __future__ import annotations

import copy
from dataclasses import dataclass
from pathlib import Path

from music21 import (
    chord,
    clef,
    expressions,
    instrument,
    key,
    layout,
    metadata,
    meter,
    note,
    stream,
)


@dataclass(frozen=True)
class CardArtifact:
    sequence: int
    measure_label: str
    landing_measure_label: str | None
    musicxml_path: Path


def load_keyboard_score(path: Path, expected_measures: int | None = None):
    from music21 import converter

    score = converter.parse(path)
    parts = list(score.parts)
    if len(parts) != 2:
        raise ValueError(
            f"Expected exactly two aligned keyboard staves after import; found {len(parts)}."
        )

    measure_counts = [len(part.getElementsByClass(stream.Measure)) for part in parts]
    if len(set(measure_counts)) != 1:
        raise ValueError(f"The two staves have different measure counts: {measure_counts}")
    if expected_measures is not None and measure_counts[0] != expected_measures:
        raise ValueError(
            f"Expected {expected_measures} measures, but the encoding contains {measure_counts[0]}."
        )
    return score


def _measure_label(measure: stream.Measure) -> str:
    suffix = getattr(measure, "numberSuffix", None) or ""
    return f"{measure.number}{suffix}"


def _remove_layout_breaks(measure: stream.Measure) -> None:
    for layout_type in (layout.SystemLayout, layout.PageLayout, layout.StaffLayout):
        for element in list(measure.getElementsByClass(layout_type)):
            measure.remove(element)


def _ensure_start_context(original: stream.Measure, extracted: stream.Measure) -> None:
    for context_type in (clef.Clef, key.KeySignature, meter.TimeSignature):
        existing = extracted.getElementsByClass(context_type)
        if any(abs(float(element.offset)) < 1e-9 for element in existing):
            continue
        context = original.getContextByClass(context_type)
        if context is not None:
            extracted.insert(0, copy.deepcopy(context))


def _event_offset(event, measure: stream.Measure) -> float:
    return float(event.getOffsetInHierarchy(measure))


def _trim_to_first_sounding_onset(measure: stream.Measure) -> float | None:
    pitched_events = [
        event
        for event in measure.recurse().getElementsByClass((note.Note, chord.Chord))
        if float(event.quarterLength) > 0
    ]
    if not pitched_events:
        return None

    first_onset = min(_event_offset(event, measure) for event in pitched_events)
    for event in list(measure.recurse().notesAndRests):
        if _event_offset(event, measure) > first_onset + 1e-9 and event.activeSite is not None:
            event.activeSite.remove(event)
    return first_onset


def _add_measure_number(measure: stream.Measure, label: str) -> None:
    marker = expressions.TextExpression(f"m. {label}")
    marker.placement = "above"
    marker.style.fontSize = 12
    marker.style.fontWeight = "bold"
    measure.insert(0, marker)


def _new_part_like(original_part, staff_number: int) -> stream.PartStaff:
    part = stream.PartStaff(id=f"artmender-staff-{staff_number}")
    part.partName = "Piano"
    part.partAbbreviation = "Pno."
    existing_instrument = original_part.getInstrument(returnDefault=False)
    part.insert(0, copy.deepcopy(existing_instrument) if existing_instrument else instrument.Piano())
    return part


def build_card(score, measure_index: int):
    source_parts = list(score.parts)
    source_measures = [list(part.getElementsByClass(stream.Measure)) for part in source_parts]
    current_label = _measure_label(source_measures[0][measure_index])
    has_landing = measure_index + 1 < len(source_measures[0])
    landing_label = (
        _measure_label(source_measures[0][measure_index + 1]) if has_landing else None
    )

    card = stream.Score(id=f"artmender-card-{current_label}")
    # Without explicit blank metadata, music21 writes "Music21 Fragment" and
    # "Music21" as visible title/composer credits.  MuseScore then includes
    # those credits in the exported page and the actual notation is scaled down
    # dramatically when fitted to an iPhone card.
    card.metadata = metadata.Metadata()
    card.metadata.title = ""
    card.metadata.composer = ""
    card_parts: list[stream.PartStaff] = []
    for staff_number, (source_part, measures) in enumerate(
        zip(source_parts, source_measures), start=1
    ):
        part = _new_part_like(source_part, staff_number)
        current = copy.deepcopy(measures[measure_index])
        _remove_layout_breaks(current)
        _ensure_start_context(measures[measure_index], current)
        if staff_number == 1:
            _add_measure_number(current, current_label)
        part.append(current)

        if has_landing:
            landing = copy.deepcopy(measures[measure_index + 1])
            _remove_layout_breaks(landing)
            _trim_to_first_sounding_onset(landing)
            part.append(landing)

        card.insert(0, part)
        card_parts.append(part)

    group = layout.StaffGroup(
        *card_parts,
        name="Piano",
        abbreviation="Pno.",
        symbol="brace",
        barTogether=True,
    )
    card.insert(0, group)
    return card, current_label, landing_label


def write_cards(score, cards_dir: Path) -> list[CardArtifact]:
    cards_dir.mkdir(parents=True, exist_ok=True)
    measure_count = len(score.parts[0].getElementsByClass(stream.Measure))
    artifacts: list[CardArtifact] = []

    for sequence, measure_index in enumerate(range(measure_count - 1, -1, -1), start=1):
        card, current_label, landing_label = build_card(score, measure_index)
        if landing_label is None:
            stem = f"{sequence:02d}-m{current_label}"
        else:
            stem = f"{sequence:02d}-m{current_label}-plus-m{landing_label}-onsets"
        musicxml_path = cards_dir / f"{stem}.musicxml"
        card.write("musicxml", fp=musicxml_path)
        artifacts.append(
            CardArtifact(
                sequence=sequence,
                measure_label=current_label,
                landing_measure_label=landing_label,
                musicxml_path=musicxml_path,
            )
        )
    return artifacts
