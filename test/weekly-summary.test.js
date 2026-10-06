import test from "node:test";
import assert from "node:assert/strict";
import { buildWeeklySummary, formatMinutes, formatWeekly } from
  "../docs/login/practice/weekly-summary-model.js";
import { summarySnapshot } from "../docs/login/practice/weekly-summary-cache.js";

const catalog = [{ id: "z", label: "Zither" }, { id: "a", label: "Arabesque" },
  { id: "h2", label: "Bach" }, { id: "h1", label: "Bach" }];

function fixture({ partial = false, total = 0, asOf = "2026-10-08T12:00:00Z" } = {}) {
  const dates = Array.from({ length: partial ? 8 : 7 }, (_, index) =>
    new Date(Date.UTC(2026, 9, 5 + index)).toISOString().slice(0, 10));
  const days = dates.map((localDate, index) => ({ localDate,
    startsAt: `${localDate}T${partial && index === 0 ? "14:00" : "00:00"}:00Z`,
    endsAt: `${new Date(Date.parse(`${localDate}T00:00:00Z`) + 86400000)
      .toISOString().slice(0, 10)}T00:00:00Z`,
    totalSeconds: index === 0 ? total : 0,
    pieceSeconds: [
      { slug: "z", seconds: index === 0 ? total : 0 },
      { slug: "a", seconds: 0 }, { slug: "h1", seconds: 0 },
      { slug: "h2", seconds: 0 }, { slug: "missing", seconds: 0 },
    ],
  }));
  if (partial) days.at(-1).endsAt = `${dates.at(-1)}T14:00:00Z`;
  return { contractVersion: 1, outcome: "summary", asOf,
    week: { startsAt: days[0].startsAt, endsAt: days.at(-1).endsAt,
      startLocalDate: dates[0], isoWeekNumber: 41, isoWeekYear: 2026,
      studentTimeZone: "UTC" },
    pieces: [{ slug: "a", currentPosition: 2, totalSeconds: 0 },
      { slug: "z", currentPosition: 1, totalSeconds: total },
      { slug: "h2", currentPosition: null, totalSeconds: 0 },
      { slug: "missing", currentPosition: null, totalSeconds: 0 },
      { slug: "h1", currentPosition: null, totalSeconds: 0 }],
    days, totalSeconds: total };
}

test("independent rounding preserves zero, positive subminute, and hours", () => {
  assert.deepEqual([formatMinutes(0), formatMinutes(29), formatMinutes(30),
    formatMinutes(89), formatWeekly(29), formatWeekly(4499)],
  ["0 min", "<1 min", "1 min", "1 min", "<1 min", "1 h 15 min"]);
});

test("seven full weekdays and eight partial weekdays retain chronological labels", () => {
  const full = buildWeeklySummary(fixture(), catalog, Date.parse("2026-10-08T12:00:00Z"));
  assert.equal(full.heading, "Practice for week 41");
  assert.equal(full.days.length, 7);
  assert.deepEqual(full.days.map((day) => day.weekday),
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
  assert.ok(full.days.every((day) => !day.from && !day.until));
  const partial = buildWeeklySummary(fixture({ partial: true }), catalog,
    Date.parse("2026-10-08T12:00:00Z"));
  assert.equal(partial.days.length, 8);
  assert.equal(partial.days[0].from, "from 2:00 PM");
  assert.equal(partial.days.at(-1).until, "until 2:00 PM");
  assert.equal(partial.days.at(-1).weekday, "Monday");
});

test("current positions, historical title order, unavailable slug, future and empty states", () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  const view = buildWeeklySummary(fixture({ total: 29 }), catalog, now);
  assert.deepEqual(view.current.map((piece) => piece.slug), ["z", "a"]);
  assert.deepEqual(view.historical.map((piece) => piece.slug), ["h1", "h2", "missing"]);
  assert.equal(view.historical.at(-1).title, "Unavailable Piece (missing)");
  assert.equal(view.days[0].current[0], "<1 min");
  assert.equal(view.days[4].total, "—");
  assert.equal(view.days[0].total, "<1 min");
  assert.equal(view.total, "<1 min");
  const empty = buildWeeklySummary(fixture(), catalog, Date.parse("2026-10-08T12:00:00Z"));
  assert.equal(empty.empty, "No practice recorded yet this week");
  assert.equal(empty.days[0].total, "0 min");
  assert.equal(buildWeeklySummary(fixture(), catalog, Date.parse("2026-10-20T00:00:00Z")).empty,
    "No practice recorded for this Practice Week");
  const futureValue = fixture({ total: 0 });
  futureValue.days[5].totalSeconds = 35;
  futureValue.days[5].pieceSeconds[0].seconds = 35;
  assert.equal(buildWeeklySummary(futureValue, catalog, now).days[5].total, "1 min");
  const independent = fixture({ total: 58 });
  independent.days[0].pieceSeconds[0].seconds = 29;
  independent.days[0].pieceSeconds[1].seconds = 29;
  independent.pieces[0].totalSeconds = 29;
  independent.pieces[1].totalSeconds = 29;
  const rounded = buildWeeklySummary(independent, catalog, now);
  assert.deepEqual(rounded.days[0].current, ["<1 min", "<1 min"]);
  assert.equal(rounded.days[0].total, "1 min");
  const historic = fixture({ total: 60 });
  historic.days[0].pieceSeconds[0].seconds = 0;
  historic.days[0].pieceSeconds[2].seconds = 60;
  historic.pieces[1].totalSeconds = 0;
  historic.pieces[4].totalSeconds = 60;
  assert.equal(buildWeeklySummary(historic, catalog, now).days[0].historical[0], "1 min");
  assert.equal(buildWeeklySummary(fixture(), catalog, Date.parse("2026-10-20T00:00:00Z"))
    .days[5].total, "0 min");
});

test("last updated uses the saved Student timezone and snapshots isolate Auth UUIDs", () => {
  const summary = fixture();
  summary.week.studentTimeZone = "Europe/Brussels";
  assert.match(buildWeeklySummary(summary, catalog).lastUpdated, /2:00 PM/);
  const map = new Map();
  const storage = { getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
  summarySnapshot(storage, "student-a", summary);
  assert.equal(summarySnapshot(storage, "student-b"), null);
  assert.deepEqual(summarySnapshot(storage, "student-a"), summary);
  summarySnapshot(storage, "student-a", null);
  assert.equal(summarySnapshot(storage, "student-a"), null);
});
