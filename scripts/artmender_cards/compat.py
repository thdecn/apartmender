"""Scoped compatibility fixes used by the retained card-generation pipeline.

These helpers patch the loaded tool for this process only. They do not edit
the sibling Artmender checkout or alter source score notation.
"""


def install_complete_chord_windows():
    from pianoplayer.hand import Hand

    original = getattr(Hand.optimize_seq, "_complete_chord_base", Hand.optimize_seq)

    def optimize(self, notes, starting_finger):
        automatic = self.autodepth
        if automatic:
            if notes[0].isChord:
                depth = max(3, notes[0].NinChord - notes[0].chordnr + 1)
            else:
                depth = 9
                for candidate in (4, 5, 6, 7, 8, 9):
                    depth = candidate
                    if notes[candidate - 1].time - notes[0].time > 3.5:
                        break
            while depth < min(9, len(notes)):
                last, following = notes[depth - 1], notes[depth]
                if not (
                    last.isChord and following.isChord
                    and last.chordID == following.chordID
                ):
                    break
                depth += 1
            self.autodepth = False
            self.depth = depth
        try:
            return original(self, notes, starting_finger)
        finally:
            self.autodepth = automatic

    optimize._complete_chord_base = original
    Hand.optimize_seq = optimize


def install_rhythmic_timing(timeline):
    """Use prepared native grace/tuplet timing for the optimizer's note stream.

    Notation is untouched. Sequential grace notes receive short distinct
    look-ahead instants before their principal onset, rather than becoming
    an accidental simultaneous chord or consuming main-meter duration.
    """
    from collections import defaultdict
    from fractions import Fraction
    import artmender.fingering as fingering

    original = fingering._staff_events

    def staff_events(staff):
        events, _ = original(staff)
        positions = {}
        measure_start = Fraction(0)
        for measure_index, measure in enumerate(staff.measures):
            lengths = []
            for voice_index, voice in enumerate(fingering._measure_voices(measure)):
                entries = timeline(voice.source, voice.start_duration)
                grace_groups = defaultdict(list)
                for entry in entries:
                    if entry[3]:
                        grace_groups[entry[1]].append(entry[0].start("token"))
                for match, offset, duration, is_grace in entries:
                    onset = measure_start + offset
                    if is_grace:
                        group = grace_groups[offset]
                        onset -= Fraction(len(group) - group.index(match.start("token")), 80)
                    positions[(measure_index, voice_index, match.start("token"))] = (
                        onset * 4, duration * 4 if not is_grace else Fraction(1, 20)
                    )
                lengths.append(max((offset + duration for _, offset, duration, _ in entries), default=Fraction(0)))
            measure_start += max(lengths, default=Fraction(0))

        onset_members = defaultdict(list)
        for event in events:
            key = (event.measure_index, event.voice_index, event.source_start)
            if key not in positions:
                raise ValueError(f"No prepared timing for {staff.variable} measure {event.measure_label}")
            onset, duration = positions[key]
            event.time = onset
            for note, pitch, source_finger in zip(event.notes, event.midi_pitches, event.original_fingers):
                onset_members[onset].append((note, pitch, source_finger, duration))

        notes = []
        chord_id = 0
        for onset, members in sorted(onset_members.items()):
            members.sort(key=lambda member: member[1])
            count = len(members)
            for index, (note, _, source_finger, duration) in enumerate(members):
                note.time = float(onset) - 0.05 * (count - index - 1)
                note.duration = float(duration) + (0.05 * (count - 1) if count > 1 else 0)
                note.fingering = source_finger or 0
                note.is_anchor = source_finger is not None
                note.isChord = count > 1
                note.chordnr = index if count > 1 else 0
                note.NinChord = count if count > 1 else 0
                note.chordID = chord_id if count > 1 else 0
                note.noteID = len(notes)
                notes.append(note)
            if count > 1:
                chord_id += 1
        events.sort(key=lambda event: (event.time, event.voice_index, event.source_start))
        return events, notes

    fingering._staff_events = staff_events
