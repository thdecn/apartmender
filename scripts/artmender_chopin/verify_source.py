"""Compare original and prepared native note events, independently of Python parsing."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess
import sys

from artmender_cards.native_anchors import NATIVE_EXPORT


def verify(root: Path):
    source = root / "source/Chop-28-4.ly"
    preparation = root / "preparation"
    converted = subprocess.run(["convert-ly", str(source)], check=True, capture_output=True, text=True).stdout
    definitions = converted.split("scoreAll =", 1)[0]
    calls = '\n#(walk-anchor-events "upper" #{ \\playRH #})\n#(walk-anchor-events "lower" #{ \\playLH #})\n'
    result = subprocess.run(["lilypond", "-dno-print-pages", "-"], input=definitions + NATIVE_EXPORT + calls,
                            text=True, capture_output=True, timeout=90, check=True)
    (preparation / "original-native-events.stdout").write_text(result.stdout)
    (preparation / "original-native-events.stderr").write_text(result.stderr)
    originals = {}
    for line in result.stdout.splitlines():
        if line.startswith("NATIVE_ANCHOR\t"):
            _, staff, row, column, duration, pitches, *_ = line.split("\t")
            midi = tuple(sorted(map(int, pitches.split(","))))
            # Relative grace wrappers expose an unresolved callback view before
            # the resolved view at the SAME source origin. Keep the final view.
            identity = (staff, row, column)
            previous = originals.get(identity)
            if previous and (previous[1] != duration or tuple(p % 12 for p in previous[2]) != tuple(p % 12 for p in midi)):
                raise ValueError("Conflicting original source-origin callback views")
            originals[identity] = (staff, duration, midi)
    native = json.loads((preparation / "native-anchors.json").read_text())
    expected = Counter(originals.values())
    actual = Counter((event["staff"], event["native_main_duration"], tuple(event["midi_pitches"])) for event in native["events"])
    if not expected or actual != expected:
        raise ValueError(f"Native source notes changed: missing {expected - actual}; added {actual - expected}")
    report = {"result": "passed", "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "prepared_source_sha256": native["prepared_source_sha256"],
              "native_event_count": len(originals), "pitched_note_count": sum(len(item[2]) for item in originals.values()),
              "comparison": "Original and prepared native LilyPond note-event multisets: staff, MIDI pitches and native duration; source-origin deduplicated. Measure alignment, temporal order and engraving are checked separately.",
              "inference_compatibility": "PianoPlayer 3, hand M; complete-chord windows, native grace/tuplet timing; native four-note octave voicings LH17/RH24–25 use the engine's full-hand span bound with unique ordered digits instead of pairwise stretch pruning. Geometry and motion cost remain M; no editorial fingering profile."}
    (preparation / "source-note-preservation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    verify(Path(sys.argv[1]))
