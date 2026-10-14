import { formatMinutes } from "../practice/weekly-summary-model.js";

export function teacherRows(students, catalog) {
  const titles = new Map(catalog.map((piece) => [piece.id, piece.label]));
  return students.flatMap((student) => {
    const week = student.completedWeek;
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: week.studentTimeZone,
      day: "numeric", month: "short", year: "numeric" });
    const period = `${week.kind === "calendar" ? "Calendar week" : "Lesson week"}: ` +
      `${date.format(new Date(week.startsAt))} – ${date.format(new Date(week.endsAt))} (${week.studentTimeZone})`;
    const common = { studentId: student.studentId, name: student.name?.trim() || "Student", period };
    if (!student.pieces.length) return [{ ...common, title: "No current Pieces", minutes: "—",
      average: "—", count: "—", change: "—", tone: "neutral" }];
    return student.pieces.map((piece) => {
      const delta = changeFor(piece);
      return { ...common, title: titles.get(piece.slug) || `Unavailable Piece (${piece.slug})`,
        minutes: formatMinutes(piece.totalSeconds), count: String(piece.baselineWeekCount),
        average: piece.baselineWeekCount ? formatMinutes(piece.baselineTotalSeconds / piece.baselineWeekCount) : "—",
        ...delta };
    });
  });
}

function changeFor(piece) {
  if (piece.baselineStatus === "no_baseline") return { change: "No baseline yet", tone: "neutral" };
  // Decide sign with the exact numerator before display rounding.
  const numerator = BigInt(piece.totalSeconds) * BigInt(piece.baselineWeekCount) - BigInt(piece.baselineTotalSeconds);
  if (numerator === 0n) return { change: "0%", tone: "neutral" };
  const magnitude = Math.abs(Number(numerator) * 100 / piece.baselineTotalSeconds);
  return { change: `${numerator > 0n ? "+" : "−"}${magnitude < 0.05 ? "<0.1" : magnitude.toFixed(1)}%`,
    tone: numerator > 0n ? "positive" : "negative" };
}
