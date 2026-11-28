from __future__ import annotations

import subprocess
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

from .acquire import find_musescore


IPHONE_SIZE = (1170, 2532)
SAFE_CONTENT_SIZE = (1050, 2260)


def _render_pages(musicxml_path: Path, raw_path: Path) -> list[Path]:
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    for stale_page in raw_path.parent.glob(f"{raw_path.stem}*.png"):
        stale_page.unlink()
    completed = subprocess.run(
        [str(find_musescore()), "-o", str(raw_path), str(musicxml_path)],
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )
    pages = sorted(raw_path.parent.glob(f"{raw_path.stem}*.png"))
    if completed.returncode != 0 or not pages:
        details = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"MuseScore PNG export failed for {musicxml_path.name}: {details}")
    return pages


def _find_lilypond() -> Path:
    configured = shutil.which("lilypond")
    if configured:
        return Path(configured)
    raise FileNotFoundError("LilyPond was not found on PATH.")


def _render_lilypond_pages(lilypond_path: Path, raw_prefix: Path) -> list[Path]:
    raw_prefix.parent.mkdir(parents=True, exist_ok=True)
    for stale_page in raw_prefix.parent.glob(f"{raw_prefix.name}*.png"):
        stale_page.unlink()
    completed = subprocess.run(
        [
            str(_find_lilypond()),
            "--png",
            "-dresolution=300",
            "-o",
            str(raw_prefix),
            str(lilypond_path),
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )
    pages = sorted(raw_prefix.parent.glob(f"{raw_prefix.name}*.png"))
    if completed.returncode != 0 or not pages:
        details = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"LilyPond PNG export failed for {lilypond_path.name}: {details}")
    return pages


def _stack_pages(pages: list[Path]) -> Image.Image:
    images = [Image.open(path).convert("RGB") for path in pages]
    width = max(image.width for image in images)
    height = sum(image.height for image in images)
    combined = Image.new("RGB", (width, height), "white")
    y = 0
    for image in images:
        combined.paste(image, ((width - image.width) // 2, y))
        y += image.height
    return combined


def _crop_white_space(image: Image.Image, padding: int = 36) -> Image.Image:
    white = Image.new("RGB", image.size, "white")
    difference = ImageChops.difference(image, white).convert("L")
    mask = difference.point(lambda value: 255 if value > 14 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise RuntimeError("MuseScore produced an empty image.")
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def render_card(musicxml_path: Path, png_path: Path, raw_dir: Path) -> Path:
    raw_path = raw_dir / f"{musicxml_path.stem}.png"
    pages = _render_pages(musicxml_path, raw_path)
    notation = _crop_white_space(_stack_pages(pages))
    fitted = ImageOps.contain(notation, SAFE_CONTENT_SIZE, method=Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", IPHONE_SIZE, "white")
    position = (
        (canvas.width - fitted.width) // 2,
        (canvas.height - fitted.height) // 2,
    )
    canvas.paste(fitted, position)
    png_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(png_path, "PNG", optimize=True)
    return png_path


def render_lilypond_card(lilypond_path: Path, png_path: Path, raw_dir: Path) -> Path:
    raw_prefix = raw_dir / lilypond_path.stem
    pages = _render_lilypond_pages(lilypond_path, raw_prefix)
    notation = _crop_white_space(_stack_pages(pages))
    fitted = ImageOps.contain(notation, SAFE_CONTENT_SIZE, method=Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", IPHONE_SIZE, "white")
    position = (
        (canvas.width - fitted.width) // 2,
        (canvas.height - fitted.height) // 2,
    )
    canvas.paste(fitted, position)
    png_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(png_path, "PNG", optimize=True)
    return png_path
