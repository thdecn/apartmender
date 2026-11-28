from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from .acquire import (
    acquire_source,
    copy_local_source,
    normalize_to_musicxml,
    sha256_file,
)
from .cards import load_keyboard_score, write_cards
from .catalog import resolve_known_piece
from .fingering import (
    suggest_first_onset_fingerings,
    suggest_musicxml_first_onset_fingerings,
    write_fingering_json,
)
from .lilypond import (
    normalize_lilypond,
    parse_lilypond_score,
    write_lilypond_cards,
    write_score_json,
)
from .models import LilyPondProfile, PieceSpec, SourceRecord
from .render import IPHONE_SIZE, render_card, render_lilypond_card


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create reverse-order piano practice cards from a legally usable score."
    )
    parser.add_argument("piece", help="Piece name, catalog number, and movement/exercise number.")
    parser.add_argument(
        "--source",
        type=Path,
        help="Use a local MusicXML, MXL, MuseScore, LilyPond, or PDF source.",
    )
    parser.add_argument(
        "--license",
        dest="license_name",
        help="License or public-domain statement for a user-supplied source.",
    )
    parser.add_argument("--source-url", help="Provenance URL for a user-supplied local source.")
    parser.add_argument("--expected-measures", type=int)
    parser.add_argument("--upper-variable", help="Upper-staff variable in a LilyPond source.")
    parser.add_argument("--lower-variable", help="Lower-staff variable in a LilyPond source.")
    parser.add_argument("--upper-clef", default="treble")
    parser.add_argument("--lower-clef", default="bass")
    parser.add_argument("--initial-key", help="LilyPond key such as 'c major' or 'f minor'.")
    parser.add_argument("--time-signature", help="Initial time signature such as '4/4'.")
    parser.add_argument("--slug", help="Output folder name for a user-supplied source.")
    parser.add_argument("--output-root", type=Path, default=Path("artmended"))
    parser.add_argument("--tmp-root", type=Path, default=Path("tmp"))
    parser.add_argument(
        "--fingerings",
        choices=("none", "suggest", "both"),
        default="suggest",
        help=(
            "Add parenthesized first-onset fingering suggestions, omit them, or render "
            "original and suggested comparison sets (default: suggest)."
        ),
    )
    parser.add_argument(
        "--hand-size",
        choices=("XXS", "XS", "S", "M", "L", "XL", "XXL"),
        default="M",
        help="PianoPlayer hand-size model used for generated suggestions (default: M).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reuse a non-empty Artmender output folder, overwriting generated files.",
    )
    return parser


def _slugify(value: str) -> str:
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "score"


def _custom_spec(args: argparse.Namespace) -> PieceSpec:
    if not args.source:
        return resolve_known_piece(args.piece)
    if not args.license_name:
        raise ValueError("--license is required with --source so provenance remains explicit.")
    source_format = {
        ".ly": "lilypond",
        ".xml": "musicxml",
        ".musicxml": "musicxml",
        ".mxl": "mxl",
        ".mscz": "musescore",
        ".mscx": "musescore",
        ".pdf": "pdf",
    }.get(args.source.suffix.lower())
    if not source_format:
        raise ValueError(f"Unsupported local source: {args.source}")
    lilypond_profile = None
    if source_format == "lilypond":
        if not args.upper_variable or not args.lower_variable:
            raise ValueError(
                "A custom LilyPond source requires --upper-variable and --lower-variable."
            )
        initial_context: list[str] = []
        if args.initial_key:
            key_parts = args.initial_key.split()
            if len(key_parts) != 2 or key_parts[1] not in {"major", "minor"}:
                raise ValueError("--initial-key must look like 'c major' or 'f minor'.")
            initial_context.append(rf"\key {key_parts[0]} \{key_parts[1]}")
        if args.time_signature:
            initial_context.append(rf"\time {args.time_signature}")
        lilypond_profile = LilyPondProfile(
            upper_variable=args.upper_variable,
            lower_variable=args.lower_variable,
            upper_default_clef=args.upper_clef,
            lower_default_clef=args.lower_clef,
            initial_context=tuple(initial_context),
        )
    return PieceSpec(
        canonical_title=args.piece,
        slug=args.slug or _slugify(args.piece),
        composer="Unknown",
        catalog=args.piece,
        movement=None,
        expected_measures=args.expected_measures,
        source=SourceRecord(
            download_url=str(args.source.resolve()),
            source_page_url=args.source_url or "local-file",
            format=source_format,
            license_name=args.license_name,
            corpus="User-supplied",
        ),
        lilypond_profile=lilypond_profile,
    )


def _prepare_output(path: Path, force: bool) -> None:
    if path.exists() and any(path.iterdir()) and not force:
        raise FileExistsError(
            f"Output folder is not empty: {path}. Re-run with --force after reviewing it."
        )
    path.mkdir(parents=True, exist_ok=True)


def _clear_previous_generated_files(output_dir: Path) -> None:
    for name in (
        "fingering.json",
        "manifest.json",
        "score.json",
        "score.fingered.musicxml",
        "score.musicxml",
        "score.normalized.ly",
    ):
        (output_dir / name).unlink(missing_ok=True)
    cards_dir = output_dir / "cards"
    if cards_dir.is_dir():
        for suffix in ("*.ly", "*.musicxml", "*.png"):
            for path in cards_dir.rglob(suffix):
                path.unlink()


def _render_lilypond_set(
    score,
    cards_dir: Path,
    raw_dir: Path,
    output_dir: Path,
) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for artifact in write_lilypond_cards(score, cards_dir):
        png_path = artifact.lilypond_path.with_suffix(".png")
        render_lilypond_card(artifact.lilypond_path, png_path, raw_dir)
        records.append(
            {
                "sequence": artifact.sequence,
                "measure": artifact.measure_label,
                "landing_measure": artifact.landing_measure_label,
                "notation": str(artifact.lilypond_path.relative_to(output_dir)),
                "format": "lilypond",
                "png": str(png_path.relative_to(output_dir)),
            }
        )
    return records


def _render_musicxml_set(
    score,
    cards_dir: Path,
    raw_dir: Path,
    output_dir: Path,
) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for artifact in write_cards(score, cards_dir):
        png_path = artifact.musicxml_path.with_suffix(".png")
        render_card(artifact.musicxml_path, png_path, raw_dir)
        records.append(
            {
                "sequence": artifact.sequence,
                "measure": artifact.measure_label,
                "landing_measure": artifact.landing_measure_label,
                "notation": str(artifact.musicxml_path.relative_to(output_dir)),
                "format": "musicxml",
                "png": str(png_path.relative_to(output_dir)),
            }
        )
    return records


def run(args: argparse.Namespace) -> Path:
    spec = _custom_spec(args)
    output_dir = args.output_root.resolve() / spec.slug
    working_dir = args.tmp_root.resolve() / spec.slug
    _prepare_output(output_dir, args.force)
    if args.force:
        _clear_previous_generated_files(output_dir)
    working_dir.mkdir(parents=True, exist_ok=True)

    source_dir = output_dir / "source"
    source_dir.mkdir(parents=True, exist_ok=True)
    if args.source:
        source_path = copy_local_source(args.source.resolve(), source_dir)
        reference_pdf = None
    else:
        source_path, reference_pdf = acquire_source(spec.source, source_dir)

    cards_dir = output_dir / "cards"
    raw_dir = working_dir / "raw-render"
    card_records: list[dict[str, object]] = []
    card_sets: dict[str, list[dict[str, object]]] = {}
    measure_count = 0
    if source_path.suffix.lower() == ".ly":
        if spec.lilypond_profile is None:
            raise ValueError("This LilyPond source has no staff-variable profile.")
        normalized_path = output_dir / "score.normalized.ly"
        normalize_lilypond(source_path, normalized_path)
        score = parse_lilypond_score(
            normalized_path,
            spec.lilypond_profile,
            expected_measures=spec.expected_measures,
        )
        measure_count = score.measure_count
        write_score_json(score, output_dir / "score.json")
        fingered_score = None
        if args.fingerings in {"suggest", "both"}:
            fingered_score, fingering_records = suggest_first_onset_fingerings(
                score,
                hand_size=args.hand_size,
                profile=spec.fingering_profile,
            )
            write_fingering_json(
                fingering_records,
                output_dir / "fingering.json",
                hand_size=args.hand_size,
                profile=spec.fingering_profile,
            )

        if args.fingerings == "both":
            card_sets["original"] = _render_lilypond_set(
                score,
                cards_dir / "original",
                raw_dir / "original",
                output_dir,
            )
            card_sets["fingered"] = _render_lilypond_set(
                fingered_score,
                cards_dir / "fingered",
                raw_dir / "fingered",
                output_dir,
            )
            card_records = card_sets["fingered"]
        elif args.fingerings == "suggest":
            card_records = _render_lilypond_set(
                fingered_score,
                cards_dir,
                raw_dir,
                output_dir,
            )
            card_sets["fingered"] = card_records
        else:
            card_records = _render_lilypond_set(score, cards_dir, raw_dir, output_dir)
            card_sets["original"] = card_records
    else:
        normalized_path = output_dir / "score.musicxml"
        normalize_to_musicxml(source_path, normalized_path)
        original_score = load_keyboard_score(
            normalized_path,
            expected_measures=spec.expected_measures,
        )
        measure_count = len(original_score.parts[0].getElementsByClass("Measure"))
        fingered_score = None
        if args.fingerings in {"suggest", "both"}:
            fingered_path = output_dir / "score.fingered.musicxml"
            fingering_records = suggest_musicxml_first_onset_fingerings(
                normalized_path,
                fingered_path,
                hand_size=args.hand_size,
            )
            write_fingering_json(
                fingering_records,
                output_dir / "fingering.json",
                hand_size=args.hand_size,
            )
            fingered_score = load_keyboard_score(
                fingered_path,
                expected_measures=spec.expected_measures,
            )

        if args.fingerings == "both":
            card_sets["original"] = _render_musicxml_set(
                original_score,
                cards_dir / "original",
                raw_dir / "original",
                output_dir,
            )
            card_sets["fingered"] = _render_musicxml_set(
                fingered_score,
                cards_dir / "fingered",
                raw_dir / "fingered",
                output_dir,
            )
            card_records = card_sets["fingered"]
        elif args.fingerings == "suggest":
            card_records = _render_musicxml_set(
                fingered_score,
                cards_dir,
                raw_dir,
                output_dir,
            )
            card_sets["fingered"] = card_records
        else:
            card_records = _render_musicxml_set(
                original_score,
                cards_dir,
                raw_dir,
                output_dir,
            )
            card_sets["original"] = card_records

    manifest = {
        "piece": {
            "title": spec.canonical_title,
            "composer": spec.composer,
            "catalog": spec.catalog,
            "movement": spec.movement,
            "measure_count": measure_count,
        },
        "source": {
            "corpus": spec.source.corpus,
            "source_page_url": spec.source.source_page_url,
            "download_url": spec.source.download_url,
            "format": spec.source.format,
            "license": spec.source.license_name,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "sha256": sha256_file(source_path),
            "reference_pdf": reference_pdf.name if reference_pdf else None,
        },
        "card_policy": {
            "order": "last measure to first measure",
            "landing": "first sounding onset on each staff, with preceding rests",
            "staff_semantics": "upper and lower staff",
            "repeated_context": ["clef", "key signature", "time signature"],
            "original_measure_number": True,
            "image_size_px": list(IPHONE_SIZE),
            "first_onset_fingering": {
                "mode": args.fingerings,
                "engine": (
                    spec.fingering_profile.name
                    if args.fingerings != "none" and spec.fingering_profile
                    else "PianoPlayer 3"
                    if args.fingerings != "none"
                    else None
                ),
                "hand_size": args.hand_size if args.fingerings != "none" else None,
                "generated_style": (
                    "native fingering style; upper above and lower below; "
                    "parenthesized and grouped by chord"
                ),
                "existing_fingerings": "preserved as optimizer anchors",
                "inference_context": "whole piece, one staff per hand",
                "editorial_profile": (
                    {
                        "source_page_url": spec.fingering_profile.source_page_url,
                        "license": spec.fingering_profile.license_name,
                        "hand_distribution": spec.fingering_profile.hand_distribution,
                    }
                    if args.fingerings != "none" and spec.fingering_profile
                    else None
                ),
            },
        },
        "cards": card_records,
        "card_sets": card_sets,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output_dir


def main() -> None:
    parser = _parser()
    args = parser.parse_args()
    try:
        output_dir = run(args)
    except Exception as exc:
        print(f"artmender: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    print(output_dir)


if __name__ == "__main__":
    main()
