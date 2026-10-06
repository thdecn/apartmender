const dateParts = (instant, timeZone) => Object.fromEntries(
  new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));

export function formatMinutes(seconds) {
  return minuteValue(seconds).label;
}

export function formatWeekly(seconds) {
  const { minutes, label } = minuteValue(seconds);
  if (minutes === 0) return label;
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

function minuteValue(seconds) {
  const minutes = Math.floor(seconds / 60 + 0.5);
  return { minutes, label: minutes ? `${minutes} min` : seconds ? "<1 min" : "0 min" };
}

function localDate(instant, timeZone) {
  const { year, month, day } = dateParts(instant, timeZone);
  return `${year}-${month}-${day}`;
}

function boundaryNote(instant, timeZone, prefix) {
  const { hour, minute } = dateParts(instant, timeZone);
  if (hour === "00" && minute === "00") return "";
  return `${prefix} ${new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric",
    minute: "2-digit", hour12: true }).format(new Date(instant))}`;
}

export function buildWeeklySummary(summary, catalog, now = Date.now()) {
  const zone = summary.week.studentTimeZone;
  const titles = new Map(catalog.map((piece) => [piece.id, piece.label]));
  const titled = (piece) => ({ ...piece,
    title: titles.get(piece.slug) || `Unavailable Piece (${piece.slug})` });
  const current = summary.pieces.filter((piece) => piece.currentPosition !== null)
    .sort((a, b) => a.currentPosition - b.currentPosition).map(titled);
  const historical = summary.pieces.filter((piece) => piece.currentPosition === null)
    .map(titled).sort((a, b) => a.title.localeCompare(b.title) || a.slug.localeCompare(b.slug));
  const currentDate = localDate(Math.max(now, Date.parse(summary.asOf)), zone);
  const days = summary.days.map((day) => {
    const values = new Map(day.pieceSeconds.map(({ slug, seconds }) => [slug, seconds]));
    const future = day.localDate > currentDate;
    const display = (seconds) => future && seconds === 0 ? "—" : formatMinutes(seconds);
    return {
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" })
        .format(new Date(`${day.localDate}T12:00:00Z`)),
      localDate: day.localDate,
      from: boundaryNote(day.startsAt, zone, "from"),
      until: boundaryNote(day.endsAt, zone, "until"),
      future,
      current: current.map((piece) => display(values.get(piece.slug) ?? 0)),
      historical: historical.map((piece) => display(values.get(piece.slug) ?? 0)),
      total: display(day.totalSeconds),
    };
  });
  return {
    heading: `Practice for week ${summary.week.isoWeekNumber}`,
    current: current.map((piece) => ({ ...piece, total: formatWeekly(piece.totalSeconds) })),
    historical: historical.map((piece) => ({ ...piece, total: formatWeekly(piece.totalSeconds) })),
    days,
    total: formatWeekly(summary.totalSeconds),
    empty: summary.totalSeconds === 0 ? (now >= Date.parse(summary.week.endsAt)
      ? "No practice recorded for this Practice Week"
      : "No practice recorded yet this week") : "",
    lastUpdated: new Intl.DateTimeFormat("en-US", { timeZone: zone, dateStyle: "full",
      timeStyle: "short", hour12: true }).format(new Date(summary.asOf)),
  };
}
