export const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const instant = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function decodeTeacherPractice(data, studentId) {
  if (data?.contractVersion !== 1 || !instant(data.asOf)) return null;
  const students = studentId === undefined ? data.students : [data.student];
  if (data.outcome !== (studentId === undefined ? "students" : "student") || !Array.isArray(students)) return null;
  const ids = new Set();
  for (const student of students) {
    if (!validStudent(student) || ids.has(student.studentId) ||
      (studentId !== undefined && student.studentId !== studentId)) return null;
    ids.add(student.studentId);
  }
  return { outcome: "teacher_practice_loaded", asOf: data.asOf, students };
}

function validStudent(student) {
  if (!isUuid(student?.studentId) || !(student.name === null || typeof student.name === "string") ||
    typeof student.schedule?.hasLesson !== "boolean" || !Array.isArray(student.pieces)) return false;
  if (student.schedule.hasLesson && (!["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].includes(student.schedule.lessonStartDay) ||
    typeof student.schedule.lessonStartTime !== "string" || !/^\d{2}:\d{2}:\d{2}/.test(student.schedule.lessonStartTime))) return false;
  const week = student.completedWeek;
  if (!instant(week?.startsAt) || !instant(week.endsAt) || Date.parse(week.startsAt) >= Date.parse(week.endsAt) ||
    week.kind !== (student.schedule.hasLesson ? "lesson" : "calendar") ||
    typeof week.studentTimeZone !== "string" || !week.studentTimeZone ||
    week.studentTimeZone !== student.schedule.studentTimeZone) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: week.studentTimeZone }); } catch { return false; }
  const assignments = new Set();
  return student.pieces.every((piece, index) => {
    if (!isUuid(piece?.assignmentId) || assignments.has(piece.assignmentId) ||
      typeof piece.slug !== "string" || !piece.slug || piece.position !== index + 1 ||
      !integer(piece.totalSeconds) || !integer(piece.baselineTotalSeconds) || !integer(piece.baselineWeekCount)) return false;
    assignments.add(piece.assignmentId);
    return piece.baselineStatus === "no_baseline"
      ? piece.baselineTotalSeconds === 0 && piece.percentageChange === null
      : piece.baselineStatus === "available" && piece.baselineTotalSeconds > 0 &&
        piece.baselineWeekCount > 0 && Number.isFinite(piece.percentageChange);
  });
}
