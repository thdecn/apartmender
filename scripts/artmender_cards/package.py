"""Package a visually reviewed card bundle, including retained reproduction code."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import zipfile
from importlib.metadata import version

from PIL import Image
from generate import PIECES


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("piece", choices=PIECES)
    parser.add_argument("--reviewed", type=int, nargs="+",
                        help="Measure labels actually compared visually with the retained reference")
    parser.add_argument("--archive-only", action="store_true", help="Repack unchanged bundle with current helpers/runtime")
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    piece = PIECES[args.piece]
    root = workspace / "artmended" / piece["slug"]
    path = root / "manifest.json"
    manifest = json.loads(path.read_text())
    cards = {int(card["measure"]): card for card in manifest["cards"]}
    assert len(cards) == len(piece["labels"])
    if not args.archive_only:
        if not args.reviewed:
            parser.error("--reviewed is required unless --archive-only is used")
        assert set(args.reviewed) <= cards.keys()
        assert {piece["labels"][0], piece["labels"][-1]} <= set(args.reviewed)
        assert any(piece["labels"][0] < label < piece["labels"][-1] for label in args.reviewed)
        assert manifest["validation"]["native_engraving_fatal_errors"] == 0
        for card in cards.values():
            with Image.open(root / card["png"]) as image:
                assert image.size == (1170, 2532)
            notation = (root / card["notation"]).read_text()
            assert notation.count('\\new PianoStaff') == 1
            assert notation.count('\\new Staff =') == 2
            assert 'system-count = 1' in notation
        native = json.loads((root / "preparation/native-anchors.json").read_text())
        assert all(not annotation["kind"].startswith("unmapped")
                   for event in native["events"] for annotation in event["source_annotations"])
        fingerings = json.loads((root / "fingering.json").read_text())["records"]
        expected_onsets = {(event["staff"], event["measure"]) for event in native["events"]}
        actual_onsets = {(event["staff"], event["measure"]) for event in fingerings}
        assert expected_onsets == actual_onsets and len(fingerings) == len(expected_onsets)
        versions = {name: version(name) for name in ("pianoplayer", "pillow", "python-ly", "music21")}
        versions.update({"python": platform.python_version(), "lilypond": subprocess.run(
            ["lilypond", "--version"], check=True, capture_output=True, text=True).stdout.splitlines()[0]})
        validation = manifest["validation"]
        validation.update({"visual_review": "spot-checks passed", "visually_reviewed_measures": sorted(args.reviewed),
                           "native_source_anchors": "preparation/native-anchor-review.json",
                           "single_system_card_sources": True, "environment": versions})
        if args.piece == "chopin":
            audit = json.loads((root / "preparation/source-note-preservation.json").read_text())
            assert audit["result"] == "passed"
            assert audit["prepared_source_sha256"] == native["prepared_source_sha256"]
            validation["source_note_preservation"] = "preparation/source-note-preservation.json"
            manifest["preparation"]["inference_compatibility"] = audit["inference_compatibility"]
        manifest["reproduction"] = {"instructions": "../../scripts/artmender_cards/README.md",
                                    "retained_runtime": "../runtime/artmender"}
        path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        notes = (
            f"# {piece['title']}\n\n"
            f"{len(cards)} cards, in reverse written order. Each PNG is 1170 × 2532; editable LilyPond files sit beside it. "
            "Every earlier card includes the next measure through each staff's first sounding onset. The final measure stands alone.\n\n"
            "Original encoded notation, reference PDF and source/license evidence are in `source/`. "
            "Native preparation and source-anchor audits are in `preparation/`; complete-piece fingering results are in `fingering.json`. "
            "Source fingerings are preserved; generated first-onset suggestions are parenthesized and use hand size M.\n\n"
            f"Automated checks passed for count, reverse order, landings, dimensions, nonempty images, source onset anchors, valid digits, and native engraving. "
            f"Visual reference comparisons covered measures {', '.join(map(str, sorted(args.reviewed)))}. "
            "These are spot checks, not a note-by-note editorial review of every card.\n\n"
            "Excerpt boundaries can leave slurs, phrasing slurs, hairpins, text spanners or beams without their other endpoint. "
            "Native render logs and warning counts are retained in `validation/` and `manifest.json`. "
            "Card terminal barlines are normalized; consult the original/prepared score for performance repeats. "
            "Nonfatal spacing warnings are retained for review; sampled dense cards still fit one grand staff.\n\n"
        )
        notes += (
            "## Reproduce\n\nSee `scripts/artmender_cards/README.md` at the archive/workspace root. "
            "The exact Artmender Python sources and dependency lock are retained under `artmended/runtime/artmender/`. "
            "Temporary rendering caches are disposable. Sources, adapters, output and provenance are retained in the archive.\n\n"
            "See `LICENSE-AND-ATTRIBUTION.md` for the score's license, attribution and adaptation details.\n"
        )
        (root / "README.md").write_text(notes)
        checksums = {str(p.relative_to(root)): digest(p) for p in sorted(root.rglob("*"))
                     if p.is_file() and p.name != "checksums.json" and "__pycache__" not in p.parts}
        (root / "checksums.json").write_text(json.dumps(checksums, indent=2) + "\n")
    checksums = json.loads((root / "checksums.json").read_text())
    paths = [p for folder in (root, workspace / "artmended/runtime/artmender", workspace / "scripts/artmender_cards",
                             workspace / "scripts/artmender_k545", workspace / "scripts/artmender_chopin")
             for p in folder.rglob("*") if p.is_file()
             and not {"__pycache__", ".venv", ".git"}.intersection(p.parts) and p.suffix != ".pyc"]
    archive = workspace / "artmended/archives" / f"{piece['slug']}.zip"
    archive.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for item in sorted(paths):
            bundle.write(item, item.relative_to(workspace))
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        assert len(bundle.namelist()) == len(paths)
        for name, expected in checksums.items():
            assert hashlib.sha256(bundle.read(str(root.relative_to(workspace) / name))).hexdigest() == expected
    print(f"Packaged {len(cards)} verified cards: {archive} ({archive.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
