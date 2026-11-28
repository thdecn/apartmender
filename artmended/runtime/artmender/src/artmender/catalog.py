from __future__ import annotations

import re

from .models import FingeringProfile, LilyPondProfile, PieceSpec, SourceRecord


CZERNY_821_1 = PieceSpec(
    canonical_title="Carl Czerny — Op. 821, No. 1",
    slug="czerny-op-821-no-1",
    composer="Carl Czerny",
    catalog="Op. 821",
    movement="No. 1",
    expected_measures=8,
    source=SourceRecord(
        download_url=(
            "https://www.mutopiaproject.org/ftp/CzernyC/Op_821/"
            "Czerny_Op_821_No_001/Czerny_Op_821_No_001.ly"
        ),
        source_page_url=(
            "https://www.mutopiaproject.org/ftp/CzernyC/Op_821/"
            "Czerny_Op_821_No_001/"
        ),
        reference_pdf_url=(
            "https://www.mutopiaproject.org/ftp/CzernyC/Op_821/"
            "Czerny_Op_821_No_001/Czerny_Op_821_No_001-a4.pdf"
        ),
        format="lilypond",
        license_name="Public Domain (Mutopia Project edition)",
        corpus="Mutopia Project",
    ),
    lilypond_profile=LilyPondProfile(
        upper_variable="upperStaff",
        lower_variable="lowerStaff",
        upper_default_clef="treble",
        lower_default_clef="bass",
        initial_context=(r"\key c \major", r"\time 4/4"),
    ),
)


CZERNY_821_2 = PieceSpec(
    canonical_title="Carl Czerny — Op. 821, No. 2",
    slug="czerny-op-821-no-2",
    composer="Carl Czerny",
    catalog="Op. 821",
    movement="No. 2",
    expected_measures=8,
    source=SourceRecord(
        download_url=(
            "https://www.mutopiaproject.org/ftp/CzernyC/Op_821/"
            "Czerny_Op_821_No_002/Czerny_Op_821_No_002.ly"
        ),
        source_page_url="https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2061",
        reference_pdf_url=(
            "https://www.mutopiaproject.org/ftp/CzernyC/Op_821/"
            "Czerny_Op_821_No_002/Czerny_Op_821_No_002-a4.pdf"
        ),
        format="lilypond",
        license_name="Public Domain (Mutopia Project edition)",
        corpus="Mutopia Project",
    ),
    lilypond_profile=LilyPondProfile(
        upper_variable="upperStaff",
        lower_variable="lowerStaff",
        upper_default_clef="treble",
        lower_default_clef="bass",
        initial_context=(r"\key c \major", r"\time 3/4"),
    ),
)


BWV_846_FINGERING_PROFILE = FingeringProfile(
    name=(
        "Wikiversity whole-piece synthesis of DeBenedetti and Choudhry "
        "fingerings, including its measure-17 modification"
    ),
    source_page_url=(
        "https://en.wikiversity.org/wiki/"
        "Piano/Prelude_in_C_by_Johann_Sebastian_Bach"
    ),
    license_name="CC BY-SA (Wikiversity page terms)",
    hand_distribution=(
        "Upper staff/right hand and lower staff/left hand throughout; the left hand "
        "holds the two lower harmony notes while the right hand plays the three-note "
        "figure, with the written division retained in measures 33-35."
    ),
    upper_first_onsets=(
        *((1,) for _ in range(19)),
        (2,),
        *((1,) for _ in range(14)),
        (1, 2, 5),
    ),
    lower_first_onsets=(
        (2,), (2,), (3,), (2,), (2,), (2,), (3,), (2,), (3,),
        (5,), (3,), (3,), (4,), (4,), (4,), (3,), (3,), (5,),
        (3,), (3,), (5,), (4,), (4,), (5,), (5,), (5,), (5,),
        (5,), (5,), (5,), (5,), (5,), (5,), (5,), (5, 1),
    ),
)


BACH_BWV_846 = PieceSpec(
    canonical_title="J. S. Bach — Prelude No. 1 in C major, BWV 846",
    slug="bach-bwv-846-prelude-1",
    composer="Johann Sebastian Bach",
    catalog="BWV 846",
    movement="The Well-Tempered Clavier I — Prelude No. 1 in C major",
    expected_measures=35,
    source=SourceRecord(
        download_url=(
            "https://www.mutopiaproject.org/ftp/BachJS/BWV846/"
            "wtk1-prelude1/wtk1-prelude1.ly"
        ),
        source_page_url="https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5",
        reference_pdf_url=(
            "https://www.mutopiaproject.org/ftp/BachJS/BWV846/"
            "wtk1-prelude1/wtk1-prelude1-a4.pdf"
        ),
        format="lilypond",
        license_name="Public Domain (Mutopia Project edition)",
        corpus="Mutopia Project",
    ),
    lilypond_profile=LilyPondProfile(
        upper_variable="right",
        lower_variable="left",
        upper_default_clef="treble",
        lower_default_clef="bass",
        initial_context=(r"\key c \major", r"\time 4/4"),
        measure_boundaries="barlines",
    ),
    fingering_profile=BWV_846_FINGERING_PROFILE,
)


BACH_BWV_779 = PieceSpec(
    canonical_title="J. S. Bach — Invention No. 8, BWV 779",
    slug="bach-bwv-779-invention-no-8",
    composer="Johann Sebastian Bach",
    catalog="BWV 779",
    movement="Invention No. 8",
    expected_measures=34,
    source=SourceRecord(
        download_url=(
            "https://www.mutopiaproject.org/ftp/BachJS/BWV779/"
            "bach-invention-08/bach-invention-08.ly"
        ),
        source_page_url="https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=61",
        reference_pdf_url=(
            "https://www.mutopiaproject.org/ftp/BachJS/BWV779/"
            "bach-invention-08/bach-invention-08-a4.pdf"
        ),
        format="lilypond",
        license_name="Public Domain (Mutopia Project edition)",
        corpus="Mutopia Project",
    ),
    lilypond_profile=LilyPondProfile(
        upper_variable="voiceone",
        lower_variable="voicetwo",
        upper_default_clef="treble",
        lower_default_clef="bass",
        initial_context=(r"\key f \major", r"\time 3/4"),
    ),
)


BACH_BWV_772 = PieceSpec(
    canonical_title="J. S. Bach — Invention No. 1, BWV 772",
    slug="bach-bwv-772-invention-no-1",
    composer="Johann Sebastian Bach",
    catalog="BWV 772",
    movement="Invention No. 1",
    expected_measures=22,
    source=SourceRecord(
        download_url=(
            "https://www.mutopiaproject.org/ftp/BachJS/BWV772/"
            "bach-invention-01/bach-invention-01.ly"
        ),
        source_page_url="https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=40",
        reference_pdf_url=(
            "https://www.mutopiaproject.org/ftp/BachJS/BWV772/"
            "bach-invention-01/bach-invention-01-a4.pdf"
        ),
        format="lilypond",
        license_name="Creative Commons Attribution-ShareAlike 3.0",
        corpus="Mutopia Project",
    ),
    lilypond_profile=LilyPondProfile(
        upper_variable="voiceone",
        lower_variable="voicetwo",
        upper_default_clef="treble",
        lower_default_clef="bass",
        initial_context=(r"\key c \major", r"\time 4/4"),
    ),
)


def _normalize_query(query: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", query.lower()).strip()


def resolve_known_piece(query: str) -> PieceSpec:
    normalized = _normalize_query(query)

    if "czerny" in normalized and re.search(r"\b821\b", normalized):
        exercise_match = re.search(
            r"\b(?:no|nr|number|exercise)\s*0*(\d+)\b", normalized
        )
        if exercise_match is None:
            raise ValueError(
                "Czerny Op. 821 contains 160 exercises; include an exercise number, "
                "for example 'Czerny Op. 821 No. 1'."
            )
        exercise = int(exercise_match.group(1))
        if exercise == 1:
            return CZERNY_821_1
        if exercise == 2:
            return CZERNY_821_2
        raise LookupError(
            f"Czerny Op. 821 No. {exercise} is not yet in the verified built-in catalog."
        )

    if re.search(r"\bbwv\s*846\b", normalized):
        return BACH_BWV_846

    if "bach" in normalized:
        if (
            re.search(r"\b(?:wtc|well tempered)\b", normalized)
            and re.search(r"\bprelude\b", normalized)
            and re.search(r"\b(?:no\s*)?0*1\b", normalized)
        ):
            return BACH_BWV_846
        if re.search(r"\bbwv\s*772\b", normalized) or (
            re.search(r"\b(?:invention|inv)\b", normalized)
            and re.search(r"\b(?:no\s*)?0*1\b", normalized)
        ):
            return BACH_BWV_772
        if re.search(r"\bbwv\s*779\b", normalized) or (
            re.search(r"\b(?:invention|inv)\b", normalized)
            and re.search(r"\b(?:no\s*)?0*8\b", normalized)
        ):
            return BACH_BWV_779

    raise LookupError(
        "This piece is not in the built-in verified catalog. Supply an openly licensed "
        "MusicXML, MXL, MuseScore, or LilyPond source with --source, or use the "
        "$artmender source-search workflow to find and verify one first."
    )
