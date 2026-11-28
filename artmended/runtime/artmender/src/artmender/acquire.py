from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

from .models import SourceRecord


MUSESCORE_CANDIDATES = (
    Path("/Applications/MuseScore 4.app/Contents/MacOS/mscore"),
    Path("/Applications/MuseScore Studio 4.app/Contents/MacOS/mscore"),
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def download_file(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "artmender/0.1 (+public-domain score retrieval)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        destination.write_bytes(response.read())
    return destination


def acquire_source(record: SourceRecord, source_dir: Path) -> tuple[Path, Path | None]:
    suffixes = {
        "lilypond": ".ly",
        "musicxml": ".musicxml",
        "mxl": ".mxl",
        "musescore": ".mscz",
        "pdf": ".pdf",
    }
    try:
        suffix = suffixes[record.format]
    except KeyError as exc:
        raise ValueError(f"Unsupported source format: {record.format}") from exc

    source_path = download_file(record.download_url, source_dir / f"source{suffix}")
    pdf_path = None
    if record.reference_pdf_url:
        pdf_path = download_file(record.reference_pdf_url, source_dir / "reference.pdf")
    return source_path, pdf_path


def copy_local_source(path: Path, source_dir: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError(path)
    destination = source_dir / f"source{path.suffix.lower()}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)
    return destination


def find_musescore() -> Path:
    configured = os.environ.get("ARTMENDER_MUSESCORE")
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.is_file():
            return candidate
        raise FileNotFoundError(f"ARTMENDER_MUSESCORE does not exist: {candidate}")

    for name in ("mscore", "musescore", "MuseScore4"):
        resolved = shutil.which(name)
        if resolved:
            return Path(resolved)
    for candidate in MUSESCORE_CANDIDATES:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "MuseScore Studio 4 was not found. Set ARTMENDER_MUSESCORE to its CLI executable."
    )


def _run_musescore_conversion(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    completed = subprocess.run(
        [str(find_musescore()), "-o", str(destination), str(source)],
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )
    if completed.returncode != 0 or not destination.exists():
        details = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"MuseScore conversion failed: {details}")


def normalize_to_musicxml(source: Path, destination: Path) -> Path:
    suffix = source.suffix.lower()
    if suffix in {".xml", ".musicxml"}:
        shutil.copy2(source, destination)
    elif suffix in {".mxl", ".mscz", ".mscx"}:
        _run_musescore_conversion(source, destination)
    elif suffix == ".ly":
        raise RuntimeError(
            "LilyPond must be processed through the native Artmender path. Automatic "
            "LilyPond-to-MusicXML conversion is intentionally disabled because it can "
            "silently alter musical content."
        )
    elif suffix == ".pdf":
        raise RuntimeError(
            "A PDF requires optical music recognition (OMR) before symbolic extraction. "
            "Find an encoded source first; otherwise run the Audiveris fallback and visually "
            "verify the resulting MusicXML."
        )
    else:
        raise ValueError(f"Unsupported score source: {source}")

    if not destination.is_file() or destination.stat().st_size == 0:
        raise RuntimeError(f"No MusicXML was produced from {source}")
    return destination
