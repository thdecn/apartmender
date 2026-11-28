"""Offline integrity gate for retained bundles and the inactive public Mozart map."""
import hashlib
import json
from pathlib import Path
import struct
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SLUGS = {"mozart-k545-1-allegro": list(range(1, 74)),
         "chopin-op28-no4-prelude": list(range(26))}
SELECTED = list(range(1, 12)) + list(range(13, 21)) + list(range(22, 26))


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate():
    runtime = ROOT / "artmended/runtime/artmender"
    for name, expected in read(runtime / "snapshot.json")["sha256"].items():
        require(digest(runtime / name) == expected, f"Runtime changed: {name}")
    lock = tomllib.loads((runtime / "uv.lock").read_text())
    versions = {row["name"]: row["version"] for row in lock["package"]}
    for slug, labels in SLUGS.items():
        base = ROOT / "artmended" / slug
        manifest = read(base / "manifest.json")
        cards = manifest["cards"]
        require([int(c["measure"]) for c in cards] == labels[::-1], f"Card order: {slug}")
        require(manifest["validation"]["native_engraving_fatal_errors"] == 0, slug)
        require(manifest["validation"]["source_onset_anchors_preserved"], slug)
        anchor_report = manifest["validation"]["native_source_anchors"]
        require((base / anchor_report).is_file(), f"Native anchor evidence: {slug}/{anchor_report}")
        for dependency in ("pianoplayer", "pillow", "python-ly", "music21"):
            require(versions[dependency] == manifest["validation"]["environment"][dependency],
                    f"Generator lock mismatch: {dependency}")
        checksums = read(base / "checksums.json")
        expected_files = {str(p.relative_to(base)) for p in base.rglob("*") if p.is_file()
                          and p.name != "checksums.json" and "__pycache__" not in p.parts}
        require(set(checksums) == expected_files, f"Checksum coverage: {slug}")
        for name, expected in checksums.items():
            require(digest(base / name) == expected, f"Bundle changed: {slug}/{name}")
        for i, card in enumerate(cards):
            landing = str(int(card["measure"]) + 1) if i else None
            require(card["landing_measure"] == landing, f"Landing: {card}")
            png = (base / card["png"]).read_bytes()
            require(png[:8] == b"\x89PNG\r\n\x1a\n" and
                    struct.unpack(">II", png[16:24]) == (1170, 2532), card["png"])
            notation = (base / card["notation"]).read_text()
            require(notation.count("\\new PianoStaff") == 1 and
                    notation.count("\\new Staff =") == 2, card["notation"])
        source = manifest["source"]
        require(digest(base / "source" / Path(source["download_url"]).name) == source["sha256"], slug)
        require(digest(base / "source" / source["reference_pdf"]) == source["reference_pdf_sha256"], slug)
        require(source["license"] == "Public Domain" if slug.startswith("chopin") else "ShareAlike 3.0" in source["license"], slug)
        with zipfile.ZipFile(ROOT / "artmended/archives" / f"{slug}.zip") as archive:
            require(archive.testzip() is None, f"Archive CRC: {slug}")
            archive_files = {str(p.relative_to(ROOT))
                             for folder in (base, runtime, ROOT / "scripts/artmender_cards",
                                            ROOT / "scripts/artmender_k545", ROOT / "scripts/artmender_chopin")
                             for p in folder.rglob("*") if p.is_file()
                             and not {"__pycache__", ".venv", ".git"}.intersection(p.parts) and p.suffix != ".pyc"}
            require(set(archive.namelist()) == archive_files and len(archive.namelist()) == len(archive_files), f"Archive coverage: {slug}")
            for name in archive.namelist():
                require(archive.read(name) == (ROOT / name).read_bytes(), f"Archive mismatch: {name}")
        for relative in manifest.get("companions", []):
            require((base / relative).is_file(), relative)
        if slug.startswith("chopin"):
            audit = read(base / "preparation/source-note-preservation.json")
            require(audit["result"] == "passed" and audit["source_sha256"] == source["sha256"]
                    and audit["prepared_source_sha256"] == digest(base / manifest["preparation"]["notation"]), "Prelude native source-note audit")
    public = ROOT / "docs/warm-up/mozart-k545-1-allegro"
    mapping = read(public / "measure-map.json")
    manifest = read(ROOT / "artmended/mozart-k545-1-allegro/manifest.json")
    cards = {int(c["measure"]): c for c in manifest["cards"]}
    require(mapping["formatVersion"] == 1 and mapping["piece"] == "mozart-k545-1-allegro", "Map identity")
    require([c["measure"] for c in mapping["cards"]] == SELECTED, "Selected written measures")
    require(mapping["sourceSha256"] == manifest["source"]["sha256"], "Map source")
    for row in mapping["cards"]:
        retained = cards[row["measure"]]
        require(row["landingMeasure"] == int(retained["landing_measure"]) and
                row["retainedCard"] == retained["png"], "Map landing/source card")
        require(digest(public / row["image"]) == row["sha256"] ==
                digest(ROOT / "artmended/mozart-k545-1-allegro" / retained["png"]), row["image"])
    require((public / "LICENSE-AND-ATTRIBUTION.md").read_bytes() ==
            (ROOT / "artmended/mozart-k545-1-allegro/LICENSE-AND-ATTRIBUTION.md").read_bytes(), "Public credit")
    print(json.dumps({"bundles": {s: len(m) for s, m in SLUGS.items()},
                      "selectedMozartMeasures": SELECTED, "archives": "CRC and retained bytes match",
                      "runtime": "snapshot and dependency versions match", "result": "passed"}))


if __name__ == "__main__":
    validate()
