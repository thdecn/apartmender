from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceRecord:
    download_url: str
    source_page_url: str
    format: str
    license_name: str
    reference_pdf_url: str | None = None
    corpus: str | None = None


@dataclass(frozen=True)
class LilyPondProfile:
    upper_variable: str
    lower_variable: str
    upper_default_clef: str = "treble"
    lower_default_clef: str = "bass"
    initial_context: tuple[str, ...] = ()
    measure_boundaries: str = "comments"


@dataclass(frozen=True)
class FingeringProfile:
    name: str
    source_page_url: str
    license_name: str
    hand_distribution: str
    upper_first_onsets: tuple[tuple[int, ...], ...]
    lower_first_onsets: tuple[tuple[int, ...], ...]


@dataclass(frozen=True)
class PieceSpec:
    canonical_title: str
    slug: str
    composer: str
    catalog: str
    movement: str | None
    expected_measures: int | None
    source: SourceRecord
    lilypond_profile: LilyPondProfile | None = None
    fingering_profile: FingeringProfile | None = None
