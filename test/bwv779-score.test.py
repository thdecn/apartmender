"""Acceptance checks for the fixed review candidate; no runtime score parser."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('verify_bwv779', Path(__file__).parents[1] / 'tools/verify-bwv779.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class FixedScoreAcceptance(unittest.TestCase):
    def test_complete_inventory_targets_each_pitched_xml_child(self):
        xml = ET.parse(verifier.ROOT / 'score.musicxml')
        inventory = json.loads((verifier.ROOT / 'review-inventory.json').read_text())
        measures = xml.findall('./part/measure')
        self.assertEqual(len(measures), 34)
        targets = 0
        for ordinal, (measure, record) in enumerate(zip(measures, inventory['measures']), 1):
            notes = measure.findall('note')
            pitched = [(index, note) for index, note in enumerate(notes, 1) if note.find('pitch') is not None]
            self.assertEqual(len(pitched), len(record['notes']))
            self.assertEqual(len(notes), record['sourceNoteCount'])
            for (index, note), target in zip(pitched, record['notes']):
                self.assertEqual(target['noteId'], f'm{ordinal:06d}-n{index:06d}')
                self.assertEqual(target['sourceNoteOrdinal'], index)
                self.assertEqual(target['staff'], int(note.findtext('staff')))
                self.assertEqual(target['pitch'], {'step': note.findtext('pitch/step'),
                    'alter': int(note.findtext('pitch/alter')), 'octave': int(note.findtext('pitch/octave'))})
                targets += 1
        self.assertEqual(targets, 598)
        self.assertIsNone(inventory['measures'][-1]['nextMeasureId'])
        self.assertEqual([n['pitch'] for n in inventory['measures'][-1]['notes']], [
            {'step': 'A', 'alter': 0, 'octave': 3}, {'step': 'C', 'alter': 0, 'octave': 4},
            {'step': 'F', 'alter': 0, 'octave': 4}, {'step': 'F', 'alter': 0, 'octave': 2}])

    def test_default_verification_requires_exact_edition_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(verifier.ROOT / 'source', root / 'source')
            for name in ('score.musicxml', 'review-inventory.json'):
                shutil.copyfile(verifier.ROOT / name, root / name)
            provenance = json.loads((verifier.ROOT / 'provenance.json').read_text())
            provenance['sha256'] = {name: provenance['sha256'][name] for name in ('score.musicxml', 'review-inventory.json')}
            (root / 'provenance.json').write_text(json.dumps(provenance))
            with patch.object(verifier, 'ROOT', root), patch('sys.argv', ['verify-bwv779.py']):
                with contextlib.redirect_stdout(io.StringIO()):
                    verifier.main()
                # Acceptance of another digest cannot authorize this source.
                provenance['humanReview']['editionId'] = 'sha256:' + '0' * 64
                (root / 'provenance.json').write_text(json.dumps(provenance))
                with self.assertRaisesRegex(ValueError, 'Human review edition mismatch'):
                    verifier.main()
                provenance['humanReview']['editionId'] = provenance['editionId']
                (root / 'provenance.json').write_text(json.dumps(provenance))
                # Same filename/title, changed whitespace: still a different edition.
                with (root / 'score.musicxml').open('ab') as file:
                    file.write(b'\n')
                with self.assertRaisesRegex(ValueError, 'Immutable candidate mismatch'):
                    verifier.main()

    def test_prepare_never_overwrites_a_different_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(verifier.ROOT / 'source', root / 'source')
            (root / 'score.musicxml').write_bytes(b'changed source at same URL')
            with patch.object(verifier, 'ROOT', root), patch('sys.argv', ['verify-bwv779.py', '--prepare']):
                with self.assertRaisesRegex(ValueError, 'Immutable candidate mismatch'):
                    verifier.main()
            self.assertEqual((root / 'score.musicxml').read_bytes(), b'changed source at same URL')


if __name__ == '__main__':
    unittest.main()
