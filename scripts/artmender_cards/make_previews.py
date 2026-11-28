"""Retain exact manifest-selected card crops and reference-page QA images."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageChops
from generate import PIECES


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("piece", choices=PIECES)
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    piece = PIECES[args.piece]
    root = args.workspace / "artmended" / piece["slug"]
    qa = root / "validation"
    qa.mkdir(exist_ok=True)
    pages = [1, 3, 5] if args.piece == "mozart" else [1]
    measures = [1, 5, 15, 25, 37, 40, 70, 73] if args.piece == "mozart" else [0, 1, 9, 11, 12, 13, 16, 18, 23, 24, 25]
    manifest = json.loads((root / "manifest.json").read_text())
    records = {int(record["measure"]): record for record in manifest["cards"]}
    for page in pages:
        subprocess.run([
            "pdftoppm", "-f", str(page), "-l", str(page), "-scale-to", "1800", "-singlefile", "-png",
            str(root / "source" / piece["pdf"]), str(qa / f"reference-page-{page}"),
        ], check=True, capture_output=True)
    for measure in measures:
        image = Image.open(root / records[measure]["png"]).convert("RGB")
        bbox = ImageChops.difference(image, Image.new("RGB", image.size, "white")).convert("L").point(lambda p: 255 if p > 14 else 0).getbbox()
        if bbox is None:
            raise ValueError(f"Empty card {measure}")
        left, top, right, bottom = bbox
        image.crop((max(0, left - 24), max(0, top - 24), min(image.width, right + 24), min(image.height, bottom + 24))).save(qa / f"card-{measure}-preview.png")
    print("Retained reference pages and exact card previews:", measures)


if __name__ == "__main__":
    main()
