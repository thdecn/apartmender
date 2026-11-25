// Capture trims PCM to the count-in endpoint before inference, so event seconds
// retain that origin and initial silence. Musical-grid construction comes later.
export function noteEvents(notes, durationSeconds) {
  return normalizeNoteEvents(notes.filter(note => Number.isFinite(note.durationSeconds) && note.durationSeconds > 0)
    .map(note => ({ pitchMidi: note.pitchMidi, onsetSeconds: note.startTimeSeconds,
      offsetSeconds: note.startTimeSeconds + note.durationSeconds, estimatedStrength: note.amplitude })), durationSeconds);
}

export function normalizeNoteEvents(notes, durationSeconds) {
  if (!Array.isArray(notes) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('Invalid note-event input.');
  return notes.filter(note => note && Number.isInteger(note.pitchMidi) && note.pitchMidi >= 21 && note.pitchMidi <= 108
    && Number.isFinite(note.onsetSeconds) && Number.isFinite(note.offsetSeconds)
    && note.offsetSeconds > note.onsetSeconds
    && (note.estimatedStrength === undefined || Number.isFinite(note.estimatedStrength)))
    .map(note => ({ pitchMidi: note.pitchMidi, onsetSeconds: Math.max(0, note.onsetSeconds),
      offsetSeconds: Math.min(durationSeconds, note.offsetSeconds),
      ...(note.estimatedStrength === undefined ? {} : { estimatedStrength: note.estimatedStrength }) }))
    .filter(note => note.offsetSeconds > note.onsetSeconds)
    .sort((a, b) => a.onsetSeconds - b.onsetSeconds || a.pitchMidi - b.pitchMidi);
}
