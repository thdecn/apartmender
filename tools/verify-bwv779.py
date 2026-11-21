"""Reproduce/check ONLY the fixed BWV 779 candidate; not a LilyPond converter."""
import argparse
from collections import Counter
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / 'docs/scores/bach-bwv-779-invention-no-8'
SLUG = 'bach-bwv-779-invention-no-8'
SOURCE_SHA = 'ddc634821a618e9a5e9ffcefbd96005bd02bd1f12573e2fefc4e6e6653d83ebe'
MIDI_SHA = '07238719180171f76283756405ee43a0319226e869283bf29affb9e4c360e6f8'
NORMALIZED_SHA = 'fc5021cc4b76e36e420cd153335ce2609844d0aac7448df9e49f7356026e7477'
PITCH = re.compile(r"([a-g])(is|es|s)?([',]*)([!?]?)$")
TYPES = {'2.': (12, 'half', True), '4': (4, 'quarter', False),
         '8': (2, 'eighth', False), '16': (1, '16th', False)}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message='Fixed BWV 779 validation failed'):
    if not condition:
        raise ValueError(message)


def add(parent, name, text=None, **attributes):
    child = ET.SubElement(parent, name, attributes)
    if text is not None:
        child.text = str(text)
    return child


def rational(ticks):
    value = Fraction(ticks, 4)
    return {'numerator': value.numerator, 'denominator': value.denominator}


def pitch(token):
    match = PITCH.fullmatch(token)
    if not match:
        raise ValueError(f'Unexpected fixed-source pitch: {token}')
    step, accidental, marks, forced = match.groups()
    require(accidental != 's' or step in ('a', 'e'))
    return step.upper(), {'is': 1, 'es': -1, 's': -1, None: 0}[accidental], 3 + marks.count("'") - marks.count(','), bool(forced)


def midi_notes(data):
    """Independent source MIDI evidence: exact staff/pitch/onset/duration tuples."""
    require(data[:8] == b'MThd\x00\x00\x00\x06')
    form, tracks, division = struct.unpack('>HHH', data[8:14])
    require((form, tracks, division) == (1, 3, 384))
    result, offset = [], 14
    for track in range(tracks):
        require(data[offset:offset + 4] == b'MTrk')
        length = int.from_bytes(data[offset + 4:offset + 8], 'big')
        chunk = data[offset + 8:offset + 8 + length]
        offset += 8 + length
        pos, tick, running, active = 0, 0, None, {}

        def variable():
            nonlocal pos
            value = 0
            while True:
                byte = chunk[pos]; pos += 1
                value = (value << 7) | (byte & 127)
                if byte < 128:
                    return value

        while pos < len(chunk):
            tick += variable()
            status = chunk[pos]
            if status >= 128:
                pos += 1
            else:
                require(running is not None)
                status = running
            if status == 255:
                pos += 1
                size = variable(); pos += size
                running = None
                continue
            require(128 <= status < 240)
            running = status
            kind, channel = status >> 4, status & 15
            size = 1 if kind in (12, 13) else 2
            values = chunk[pos:pos + size]; pos += size
            if kind not in (8, 9):
                continue
            key = (channel, values[0])
            if kind == 9 and values[1]:
                require(key not in active)
                active[key] = tick
            else:
                start = active.pop(key)
                require(start % 96 == 0 and (tick - start) % 96 == 0)
                result.append((track, values[0], start // 96, (tick - start) // 96))
        require(not active)
    require(offset == len(data))
    return Counter(result)


def build(normalized, raw_source):
    require(normalized['format'] == 'artmender-lilypond-measures-v1')
    require(normalized['measure_count'] == 34)
    source_lines = {}
    voice = None
    for line_number, line in enumerate(raw_source.splitlines(), 1):
        if line.startswith('voiceone ='):
            voice = 1
        if line.startswith('voicetwo ='):
            voice = 2
        match = re.search(r'%\s*bar\s+(\d+)', line)
        if voice and match:
            source_lines[voice, int(match[1])] = line_number
    require(len(source_lines) == 68)
    xml = ET.Element('score-partwise', version='4.0')
    add(add(xml, 'work'), 'work-title', 'Invention No. 8 in F major, BWV 779')
    identity = add(xml, 'identification')
    add(identity, 'creator', 'Johann Sebastian Bach', type='composer')
    add(identity, 'rights', 'Public domain; Mutopia-2008/06/15-61, typeset by Allen Garvin')
    add(add(identity, 'encoding'), 'software', 'Apartmender fixed BWV 779 preparation; human review pending')
    add(add(add(xml, 'part-list'), 'score-part', id='P1'), 'part-name', 'Piano')
    part = add(xml, 'part', id='P1')
    measures, expected_midi, all_notes = [], Counter(), 0
    for ordinal in range(1, 35):
        measure_id = f'm{ordinal:06d}'
        measure = add(part, 'measure', number=str(ordinal))
        if ordinal == 1:
            attributes = add(measure, 'attributes')
            add(attributes, 'divisions', 4)
            add(add(attributes, 'key'), 'fifths', -1)
            time = add(attributes, 'time'); add(time, 'beats', 3); add(time, 'beat-type', 4)
            add(attributes, 'staves', 2)
            for number, sign, line in ((1, 'G', 2), (2, 'F', 4)):
                clef = add(attributes, 'clef', number=str(number))
                add(clef, 'sign', sign); add(clef, 'line', line)
        notes, note_ordinal = [], 0
        for staff, key in ((1, 'upper_staff'), (2, 'lower_staff')):
            if staff == 2:
                add(add(measure, 'backup'), 'duration', 12)
            source = normalized[key]['measures'][ordinal - 1]
            require(source['number'] == ordinal)
            text, events = source['lilypond'], source['events']
            duration, onset, beam_open, accidental_state = source['inherited_duration'], 0, False, {}
            groups, group = [], []
            for index, event in enumerate(events):
                token = event['token']
                require(text[event['source_start']:event['source_end']] == token)
                duration = event['explicit_duration'] or duration
                ticks, note_type, dotted = TYPES[duration]
                suffix = text[event['source_end']:events[index + 1]['source_start'] if index + 1 < len(events) else len(text)]
                if '[' in suffix:
                    require(not beam_open)
                    beam_open = True
                group.append((event, ticks, note_type, dotted, onset))
                onset += ticks
                if ']' in suffix or not beam_open:
                    groups.append((group, beam_open)); group = []
                    if ']' in suffix:
                        require(beam_open)
                        beam_open = False
            require(onset == 12 and not group and not beam_open)
            event_index = 0
            for group, beamed in groups:
                for index, (event, ticks, note_type, dotted, onset) in enumerate(group):
                    event_index += 1
                    rest = event['kind'] == 'rest'
                    require(event['kind'] in ('rest', 'note', 'chord'))
                    token = re.sub(r'\d+\.?$', '', event['token'])
                    pitches = [] if rest else [pitch(p) for p in token.strip('<>').split()]
                    require(rest or len(pitches) == (3 if event['kind'] == 'chord' else 1))
                    for chord_index, value in enumerate(pitches or [None]):
                        note = add(measure, 'note'); note_ordinal += 1; all_notes += 1
                        if chord_index:
                            add(note, 'chord')
                        if rest:
                            add(note, 'rest')
                        else:
                            step, alter, octave, forced = value
                            element = add(note, 'pitch')
                            add(element, 'step', step); add(element, 'alter', alter); add(element, 'octave', octave)
                        add(note, 'duration', ticks); add(note, 'voice', staff); add(note, 'type', note_type)
                        if dotted:
                            add(note, 'dot')
                        if not rest:
                            default = -1 if step == 'B' else 0
                            if forced or accidental_state.get((step, octave), default) != alter:
                                add(note, 'accidental', {-1: 'flat', 0: 'natural', 1: 'sharp'}[alter])
                            accidental_state[step, octave] = alter
                        add(note, 'staff', staff)
                        if beamed and not rest and not chord_index:
                            for level in range(1, (2 if ticks == 1 else 1) + 1):
                                before = index > 0 and group[index - 1][1] <= (1 if level == 2 else 2)
                                after = index + 1 < len(group) and group[index + 1][1] <= (1 if level == 2 else 2)
                                beam = 'continue' if before and after else 'end' if before else 'begin' if after else 'backward hook' if index else 'forward hook'
                                add(note, 'beam', beam, number=str(level))
                        if not rest:
                            midi_pitch = (octave + 1) * 12 + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[step] + alter
                            expected_midi[staff, midi_pitch, (ordinal - 1) * 12 + onset, ticks] += 1
                            notes.append({'noteId': f'{measure_id}-n{note_ordinal:06d}', 'sourceNoteOrdinal': note_ordinal,
                                'sourceXPath': f'/score-partwise/part[@id="P1"]/measure[{ordinal}]/note[{note_ordinal}]',
                                'staff': staff, 'voice': str(staff), 'pitch': {'step': step, 'alter': alter, 'octave': octave},
                                'onset': rational(onset), 'duration': rational(ticks), 'originalFingering': None,
                                'sourceLine': source_lines[staff, ordinal], 'sourceEventOrdinal': event_index,
                                'normalizedSource': {'staffKey': key, 'measureIndex': ordinal - 1, 'eventIndex': event_index - 1,
                                    'start': event['source_start'], 'end': event['source_end']}})
            if staff == 2 and ordinal in (4, 7):
                clef = add(add(measure, 'attributes'), 'clef', number='2')
                add(clef, 'sign', 'G' if ordinal == 4 else 'F'); add(clef, 'line', 2 if ordinal == 4 else 4)
        if ordinal == 34:
            add(add(measure, 'barline', location='right'), 'bar-style', 'light-heavy')
        measures.append({'measureId': measure_id, 'sourceOrdinal': ordinal, 'sourceLabel': str(ordinal),
            'sourceNoteCount': note_ordinal, 'nextMeasureId': f'm{ordinal + 1:06d}' if ordinal < 34 else None, 'notes': notes})
    require(all_notes == 609 and sum(len(m['notes']) for m in measures) == 598)
    ET.indent(xml, space='  ')
    return ET.tostring(xml, encoding='utf-8', xml_declaration=True) + b'\n', measures, expected_midi


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare', action='store_true', help='Create missing candidate files; never overwrite different bytes')
    arguments = parser.parse_args()
    raw = (ROOT / 'source/bach-invention-08.ly').read_bytes()
    midi = (ROOT / 'source/bach-invention-08.mid').read_bytes()
    require(digest(raw) == SOURCE_SHA and digest(midi) == MIDI_SHA, 'Source digest mismatch')
    normalized_bytes = (ROOT / 'source/score.normalized.json').read_bytes()
    require(digest(normalized_bytes) == NORMALIZED_SHA, 'Normalized source digest mismatch')
    score, measures, expected = build(json.loads(normalized_bytes), raw.decode())
    actual = midi_notes(midi)
    require(actual == expected, f'MIDI mismatch: missing {expected - actual}; unexpected {actual - expected}')
    edition = 'sha256:' + digest(score)
    inventory = {'format': 'bwv779-review-inventory-v1', 'status': 'human-review-pending', 'slug': SLUG,
        'editionId': edition, 'partId': 'P1', 'measureCount': 34, 'sourceNoteCount': 609, 'pitchedNoteCount': 598,
        'sourcePositions': {'sourceLine': 'one-based line in source/bach-invention-08.ly',
            'normalizedSource': 'zero-based indices and half-open character offsets in source/score.normalized.json',
            'sourceXPath': 'direct MusicXML document position, including rest/chord-note ordinals'}, 'measures': measures}
    files = {'score.musicxml': score, 'review-inventory.json': (json.dumps(inventory, indent=2) + '\n').encode()}
    for path, content in files.items():
        target = ROOT / path
        if arguments.prepare and not target.exists():
            target.write_bytes(content)
        require(target.read_bytes() == content, f'Immutable candidate mismatch: {path}')
    provenance_path = ROOT / 'provenance.json'
    if provenance_path.exists() or not arguments.prepare:
        provenance = json.loads(provenance_path.read_text())
        require(provenance['editionId'] == edition, 'Provenance edition mismatch')
        for path, expected_sha in provenance['sha256'].items():
            require(digest((ROOT / path).read_bytes()) == expected_sha, f'Provenance digest mismatch: {path}')
    print(json.dumps({'editionId': edition, 'inventorySha256': digest(files['review-inventory.json']),
        'normalizedInputSha256': digest(normalized_bytes), 'measureCount': 34, 'pitchedNotes': 598,
        'midiPitchOnsetDurationMatches': sum(actual.values()), 'humanReview': 'pending'}, indent=2))


if __name__ == '__main__':
    main()
