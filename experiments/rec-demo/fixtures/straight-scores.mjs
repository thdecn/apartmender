export function takeFromTicks(events, { beats = 4, bpm = 120, durationTicks = 32 } = {}) {
  const secondsPerTick = 60 / bpm / 4;
  return { schemaVersion: 1, timeUnit: 'seconds', timeOrigin: 'count-in-end',
    meter: { beats, beatType: 4 }, tempoBPM: bpm, durationSeconds: durationTicks * secondsPerTick,
    notes: events.map(([pitchMidi, start, end]) => ({ pitchMidi,
      onsetSeconds: start * secondsPerTick, offsetSeconds: end * secondsPerTick })) };
}

export const straightExamples = [
  { name: 'independent piano voices', take: takeFromTicks([
    [48, 0, 8], [50, 8, 12], [53, 16, 24],
    [60, 2, 6], [64, 2, 6], [67, 2, 4],
    [72, 4, 5], [74, 5, 6], [72, 6, 7],
    [61, 8, 10], [60, 10, 12], [69, 14, 18], [61, 18, 20],
  ]) },
  { name: '3/4 dotted and crossing-bar chord', take: takeFromTicks([
    [45, 0, 12], [60, 0, 6], [64, 0, 6], [65, 8, 15], [69, 8, 15],
  ], { beats: 3, bpm: 93, durationTicks: 17 }) },
  { name: '2/4 repeated notes and conflicting accidentals', take: takeFromTicks([
    [59, 1, 2], [60, 0, 1], [60, 1, 2], [60, 2, 3], [60, 3, 4],
    [60, 4, 6], [61, 4, 6], [60, 6, 8], [61, 8, 10],
  ], { beats: 2, durationTicks: 11 }) },
  { name: 'silent take', take: takeFromTicks([], { beats: 3, durationTicks: 13 }) },
];
