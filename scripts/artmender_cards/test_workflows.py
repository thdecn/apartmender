"""Regression checks using disposable copies of the retained card bundles.

Run with the Artmender Python environment; no retained asset is regenerated.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "artmended/runtime/artmender"
PIECES = {"mozart": ("mozart-k545-1-allegro", [1, 37, 73]),
          "chopin": ("chopin-op28-no4-prelude", [0, 13, 25])}


def snapshot(folder):
    return {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in folder.rglob("*") if p.is_file() and "__pycache__" not in p.parts}


def fixture(workspace, slug):
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc")
    shutil.copytree(ROOT / "artmended" / slug, workspace / "artmended" / slug, ignore=ignore)
    for name in ("artmender_cards", "artmender_k545", "artmender_chopin"):
        shutil.copytree(ROOT / "scripts" / name, workspace / "scripts" / name, ignore=ignore)
    shutil.copytree(RUNTIME, workspace / "artmended/runtime/artmender", ignore=ignore)


class RetainedWorkflowTests(unittest.TestCase):
    def run_tool(self, workspace, script, *args):
        result = subprocess.run(
            [sys.executable, "-B", str(workspace / "scripts/artmender_cards" / script),
             *map(str, args), "--workspace", str(workspace)],
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
            text=True, capture_output=True, timeout=180,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def test_inference_only_preserves_retained_bundles(self):
        for piece, (slug, _) in PIECES.items():
            with self.subTest(piece=piece), tempfile.TemporaryDirectory(prefix="artmender-infer-test-") as temp:
                workspace = Path(temp) / "workspace"
                fixture(workspace, slug)
                bundle = workspace / "artmended" / slug
                before = snapshot(bundle)
                result = self.run_tool(workspace, "generate.py", piece, "--infer-only",
                                       "--artmender-root", workspace / "artmended/runtime/artmender",
                                       "--work-root", Path(temp) / "scratch")
                self.assertIn("Whole-movement fingering inference passed", result.stdout)
                after = snapshot(bundle)
                changed = sorted(name for name in before.keys() | after.keys()
                                 if before.get(name) != after.get(name))
                self.assertEqual(len(changed), 0, f"Retained files changed: {changed[:10]}")

    def test_packaging_emits_resolvable_anchor_evidence(self):
        for piece, (slug, reviewed) in PIECES.items():
            with self.subTest(piece=piece), tempfile.TemporaryDirectory(prefix="artmender-package-test-") as temp:
                workspace = Path(temp)
                fixture(workspace, slug)
                self.run_tool(workspace, "package.py", piece, "--reviewed", *reviewed)
                bundle = workspace / "artmended" / slug
                manifest = json.loads((bundle / "manifest.json").read_text())
                report = manifest["validation"]["native_source_anchors"]
                self.assertTrue((bundle / report).is_file(), f"Missing evidence: {slug}/{report}")
                with zipfile.ZipFile(workspace / "artmended/archives" / f"{slug}.zip") as archive:
                    self.assertEqual(archive.read(f"artmended/{slug}/{report}"), (bundle / report).read_bytes())

    def test_integrity_gate_rejects_missing_anchor_evidence(self):
        spec = importlib.util.spec_from_file_location("asset_gate", ROOT / "tools/validate-warm-up-assets.py")
        gate = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gate)
        original = gate.read

        def missing_evidence(path):
            data = original(path)
            if path.name == "manifest.json":
                data["validation"]["native_source_anchors"] = "preparation/missing-evidence.json"
            return data

        with patch.object(gate, "read", missing_evidence):
            with self.assertRaisesRegex(ValueError, "Native anchor evidence"):
                gate.validate()


if __name__ == "__main__":
    unittest.main()
