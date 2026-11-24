// Feasibility events remain relative to the decoded take, not a musical grid.
// The later adapter will use the count-in origin supplied by the demo shell.
export function noteEvents(notes, durationSeconds) {
  return notes.filter(note => Number.isInteger(note.pitchMidi) && note.pitchMidi >= 21 && note.pitchMidi <= 108
    && Number.isFinite(note.startTimeSeconds) && Number.isFinite(note.durationSeconds)
    && note.durationSeconds > 0 && Number.isFinite(note.amplitude))
    .map(note => {
      const onsetSeconds = Math.max(0, note.startTimeSeconds);
      const offsetSeconds = Math.min(durationSeconds, note.startTimeSeconds + note.durationSeconds);
      return { pitchMidi: note.pitchMidi, onsetSeconds, offsetSeconds,
        estimatedStrength: note.amplitude };
    }).filter(note => note.offsetSeconds > note.onsetSeconds)
    .sort((a, b) => a.onsetSeconds - b.onsetSeconds || a.pitchMidi - b.pitchMidi);
}
