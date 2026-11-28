"""Generate retained score bundles using a sibling Artmender environment.

Run with that checkout's .venv/bin/python. Sources and preparation metadata
must already exist in artmended/<slug>/{source,preparation}. Renderer scratch
files may be temporary; every input, adapter and deliverable is durable.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import importlib
import json
import pickle
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path


PIECES = {
    "mozart": {
        "slug": "mozart-k545-1-allegro",
        "title": "Wolfgang Amadeus Mozart — Piano Sonata in C major, K.545 — I. Allegro",
        "composer": "Wolfgang Amadeus Mozart", "catalog": "K.545", "movement": "I. Allegro",
        "source": "K545-1.ly", "pdf": "K545-1-a4.pdf",
        "source_page": "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998",
        "download_base": "https://www.mutopiaproject.org/ftp/MozartWA/KV545/K545-1/",
        "attribution": "Alejandro Sierra, Mutopia-2013/09/01-998, copyright 2013",
        "adapter": "artmender_k545.grace_landing",
        "labels": list(range(1, 74)),
    },
    "chopin": {
        "slug": "chopin-op9-no2-nocturne",
        "title": "Frédéric Chopin — Nocturne in E-flat major, Op.9 No.2",
        "composer": "Frédéric Chopin", "catalog": "Op.9 No.2", "movement": None,
        "source": "chopin_nocturne_op9_n2.ly", "pdf": "chopin_nocturne_op9_n2-a4.pdf",
        "source_page": "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590",
        "download_base": "https://www.mutopiaproject.org/ftp/ChopinFF/O9/chopin_nocturne_op9_n2/",
        "attribution": "Renato Biolcati Rinaldi, Mutopia-2014/12/18-1590, copyright 2014; after G. Schirmer, New York, 1881",
        "adapter": "artmender_chopin.adapters",
        "labels": list(range(0, 35)),
    },
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("piece", choices=PIECES)
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--artmender-root", type=Path)
    parser.add_argument("--work-root", type=Path, default=Path(tempfile.gettempdir()) / "apartmender-card-render")
    parser.add_argument("--infer-only", action="store_true")
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    artmender_root = (args.artmender_root or workspace.parent / "artmender").resolve()
    sys.path.insert(0, str(artmender_root / "src"))
    sys.path.insert(0, str(workspace / "scripts"))
    from PIL import Image, ImageChops
    from artmender import cli, render
    from artmender.acquire import sha256_file
    from artmender.lilypond import write_lilypond_cards
    from artmender.models import LilyPondProfile, PieceSpec, SourceRecord
    from artmender_cards.compat import install_complete_chord_windows, install_rhythmic_timing

    piece = PIECES[args.piece]
    output = workspace / "artmended" / piece["slug"]
    preparation = output / "preparation"
    profile_data = json.loads((preparation / "profile.json").read_text())
    profile_fields = profile_data.get("profile", profile_data.get("lilypond_profile", profile_data))
    profile_names = set(LilyPondProfile.__dataclass_fields__)
    profile = LilyPondProfile(**{key: value for key, value in profile_fields.items() if key in profile_names})
    prepared_name = profile_data.get("prepared_source") or profile_data.get("prepared_file")
    if prepared_name:
        prepared = preparation / prepared_name
    else:
        candidates = list(preparation.glob("*-prepared.ly")) + list(preparation.glob("*.prepared.ly"))
        if len(candidates) != 1:
            raise ValueError("Preparation must identify its prepared notation file")
        prepared = candidates[0]
    spec = PieceSpec(
        canonical_title=piece["title"], slug=piece["slug"], composer=piece["composer"],
        catalog=piece["catalog"], movement=piece["movement"], expected_measures=len(piece["labels"]),
        source=SourceRecord(
            download_url=piece["download_base"] + piece["source"],
            source_page_url=piece["source_page"], reference_pdf_url=piece["download_base"] + piece["pdf"],
            format="lilypond", license_name="Creative Commons Attribution-ShareAlike 3.0 Unported",
            corpus="Mutopia Project",
        ), lilypond_profile=profile,
    )
    install_complete_chord_windows()
    adapter = importlib.import_module(piece["adapter"])
    adapter_helpers = adapter.install(preparation)
    from artmender_cards.native_anchors import install as install_native_anchors
    if args.piece == "chopin":
        install_rhythmic_timing(adapter_helpers["events"])
    install_native_anchors(preparation)
    work = args.work_root.resolve() / piece["slug"]
    work.mkdir(parents=True, exist_ok=True)
    original_infer = cli.suggest_first_onset_fingerings
    fingerprint_paths = [prepared, preparation / "profile.json", Path(__file__),
                         Path(__file__).with_name("compat.py"), Path(adapter.__file__),
                         *sorted((artmender_root / "src/artmender").glob("*.py"))]
    fingerprint_paths.append(Path(__file__).with_name("native_anchors.py"))
    fingerprint_paths.append(preparation / "native-anchors.json")
    fingerprint = hashlib.sha256("".join(sha256_file(path) for path in fingerprint_paths).encode()).hexdigest()

    def cached_infer(score, **kwargs):
        cache = work / "fingerings.pickle"
        if cache.exists():
            saved = pickle.loads(cache.read_bytes())
            if saved["fingerprint"] == fingerprint:
                print("Using whole-movement fingering cache", flush=True)
                return saved["result"]
        result = original_infer(score, **kwargs)
        cache.write_bytes(pickle.dumps({"fingerprint": fingerprint, "result": result}))
        print("Whole-movement fingering inference passed", flush=True)
        return result

    def render_pages(source, prefix):
        prefix.parent.mkdir(parents=True, exist_ok=True)
        for stale in prefix.parent.glob(prefix.name + "*.png"):
            stale.unlink()
        result = subprocess.run(
            [str(render._find_lilypond()), "--png", "-dresolution=300", "-o", str(prefix), str(source)],
            capture_output=True, text=True, timeout=180,
        )
        prefix.with_suffix(".log").write_text(result.stdout + result.stderr)
        pages = sorted(prefix.parent.glob(prefix.name + "*.png"))
        if result.returncode or not pages:
            raise RuntimeError(f"Engraving failed for {source.name}: {result.stderr[-2500:]}")
        if len(pages) != 1:
            raise RuntimeError(f"Card must engrave on one page: {source.name}")
        return pages

    def render_set(score, cards_dir, raw_dir, output_dir):
        if args.infer_only:
            raise SystemExit(0)
        artifacts = list(write_lilypond_cards(score, cards_dir))

        def one(artifact):
            png = artifact.lilypond_path.with_suffix(".png")
            render.render_lilypond_card(artifact.lilypond_path, png, raw_dir)
            return {"sequence": artifact.sequence, "measure": artifact.measure_label,
                    "landing_measure": artifact.landing_measure_label,
                    "notation": str(artifact.lilypond_path.relative_to(output_dir)),
                    "format": "lilypond", "png": str(png.relative_to(output_dir))}

        records = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(one, artifact) for artifact in artifacts]
            for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
                records.append(future.result())
                if count == 1 or count % 10 == 0 or count == len(artifacts):
                    print(f"Rendered {count}/{len(artifacts)} cards", flush=True)
        return sorted(records, key=lambda record: record["sequence"])

    cli._custom_spec = lambda _: spec
    cli.suggest_first_onset_fingerings = cached_infer
    cli._render_lilypond_set = render_set
    render._render_lilypond_pages = render_pages
    cli_args = cli._parser().parse_args([
        piece["title"], "--source", str(prepared), "--license", spec.source.license_name,
        "--source-url", piece["source_page"], "--output-root", str(output.parent),
        "--tmp-root", str(args.work_root.resolve()), "--force",
    ])
    actual_output = cli.run(cli_args)
    assert actual_output == output
    manifest_file = output / "manifest.json"
    manifest = json.loads(manifest_file.read_text())
    manifest["source"].update({
        "sha256": sha256_file(output / "source" / piece["source"]),
        "reference_pdf": piece["pdf"], "reference_pdf_sha256": sha256_file(output / "source" / piece["pdf"]),
        "attribution": piece["attribution"], "license_url": "https://creativecommons.org/licenses/by-sa/3.0/",
    })
    manifest["preparation"] = {
        "notation": str(prepared.relative_to(output)), "sha256": sha256_file(prepared),
        "adapter": str(Path(adapter.__file__).relative_to(workspace)),
        "runner": str(Path(__file__).relative_to(workspace)),
        "compatibility": "Complete-chord look-ahead windows; native score preparation and ornament-aware card handling.",
        "reference_pdf": "source/" + piece["pdf"],
    }
    cards = manifest["cards"]
    assert len(cards) == len(piece["labels"])
    assert [int(card["measure"]) for card in cards] == list(reversed(piece["labels"]))
    assert cards[0]["landing_measure"] is None
    assert [int(card["landing_measure"]) for card in cards[1:]] == list(reversed(piece["labels"][1:]))
    assert len(list((output / "cards").glob("*.png"))) == len(cards)
    for card in cards:
        with Image.open(output / card["png"]) as png:
            assert png.size == (1170, 2532), card
            assert ImageChops.difference(png.convert("RGB"), Image.new("RGB", png.size, "white")).getbbox(), card
    records = json.loads((output / "fingering.json").read_text())["records"]
    for record in records:
        assert all(1 <= finger <= 5 for finger in record["inferred_fingers"]), record
        assert all(original is None or original == inferred for original, inferred in zip(record["original_fingers"], record["inferred_fingers"])), record
        suggestion = record["printed_suggestion"]
        assert suggestion is None or re.fullmatch(r"\([1-5]+\)", suggestion), record
    warnings = Counter()
    logs_dir = output / "validation" / "render-logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    for log in (work / "raw-render").glob("*.log"):
        for line in log.read_text().splitlines():
            if "warning:" in line:
                warnings[line.split("warning:", 1)[1].strip()] += 1
            elif "error:" in line and "Fontconfig" not in line:
                raise AssertionError(line)
        shutil.copyfile(log, logs_dir / log.name)
    manifest["validation"] = {
        "card_count": len(cards), "dimensions": [1170, 2532], "nonempty_images": True,
        "ordered_measure_labels": list(reversed(piece["labels"])),
        "sounding_staff_onsets": len(records), "valid_finger_digits": True,
        "source_onset_anchors_preserved": True, "native_engraving_fatal_errors": 0,
        "warnings": dict(warnings), "visual_review": "pending",
    }
    manifest_file.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    (output / "LICENSE-AND-ATTRIBUTION.md").write_text(
        f"# {piece['title']}\n\nComposition by {piece['composer']}, in the public domain.\n\n"
        f"Encoding and engraving: {piece['attribution']}.\n\nSource: {piece['source_page']}\n\n"
        "Adapted notation and card images: Creative Commons Attribution-ShareAlike 3.0 Unported.\n"
        "https://creativecommons.org/licenses/by-sa/3.0/\n\n"
        "Changes: native preparation with explicit written-measure boundaries; reverse-order practice cards "
        "with next-measure landing context; parenthesized first-onset fingering suggestions inferred in "
        "whole-piece context for hand size M. Source annotations remain in the editable notation.\n"
    )
    print(f"Validated {len(cards)} cards: {output}", flush=True)


if __name__ == "__main__":
    main()
