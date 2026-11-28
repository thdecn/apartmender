"""Retain the original licensed Mutopia sources, without replacing changed files."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

from generate import PIECES


def retain(path: Path, content: bytes):
    if path.exists() and path.read_bytes() != content:
        raise ValueError(f"Source changed; review before replacing retained file: {path}")
    path.write_bytes(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("piece", choices=[*PIECES, "all"])
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    for name in PIECES if args.piece == "all" else [args.piece]:
        piece = PIECES[name]
        folder = args.workspace / "artmended" / piece["slug"] / "source"
        folder.mkdir(parents=True, exist_ok=True)
        page = urlopen(piece["source_page"], timeout=30).read()
        if b"Attribution-ShareAlike 3.0" not in page:
            raise ValueError("Primary source page no longer confirms the expected license")
        retain(folder / "mutopia-source-page.html", page)
        records = []
        for filename in [piece["source"], piece["pdf"]]:
            url = piece["download_base"] + filename
            data = urlopen(url, timeout=30).read()
            retain(folder / filename, data)
            records.append({"file": filename, "url": url, "sha256": hashlib.sha256(data).hexdigest()})
        report = {
            "source_page": piece["source_page"], "source_page_file": "mutopia-source-page.html",
            "license": "Creative Commons Attribution-ShareAlike 3.0",
            "license_url": "https://creativecommons.org/licenses/by-sa/3.0/",
            "attribution": piece["attribution"],
            "retrieved_at": datetime.now(timezone.utc).isoformat(), "files": records,
        }
        (folder / "acquisition.json").write_text(json.dumps(report, indent=2) + "\n")
        print(f"Retained source and primary license page for {piece['title']}", flush=True)


if __name__ == "__main__":
    main()
