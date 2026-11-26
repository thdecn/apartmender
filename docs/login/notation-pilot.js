// Private hosts only. Public rollout has its separate public-score-pilot.js switch.
// Disabling a host changes presentation on the next page load, never stored data.
export const notationPilot = Object.freeze({ student: true, teacher: true });
export const legacyFingeringNotice = 'Bach personal notation is paused. PNG cards cannot display saved fingerings. Saved changes are retained.';
