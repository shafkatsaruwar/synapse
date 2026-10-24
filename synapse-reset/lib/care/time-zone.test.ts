/** Run: npx tsx --test lib/care/time-zone.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import { getLocalParts, getOffsetMinutes, resolveZonedTime, isValidTimeZone } from "./time-zone";
import { computeCheckInTimes, planUpcomingCheckIns, quietHoursEndInstant } from "./checkin-schedule";

const iso = (ms: number) => new Date(ms).toISOString();
const local = (tz: string, ms: number) => {
  const p = getLocalParts(tz, ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
};

test("validates IANA identifiers", () => {
  assert.ok(isValidTimeZone("America/New_York"));
  assert.ok(isValidTimeZone("Asia/Dhaka"));
  assert.ok(!isValidTimeZone("Mars/Olympus"));
  assert.ok(!isValidTimeZone("+05:00"));
});

test("offsets follow DST (Boston)", () => {
  assert.equal(getOffsetMinutes("America/New_York", Date.UTC(2026, 0, 15, 12)), -300);
  assert.equal(getOffsetMinutes("America/New_York", Date.UTC(2026, 6, 15, 12)), -240);
});

test("spring-forward gap resolves to first real moment", () => {
  // 2026-03-08 02:30 does not exist in New York.
  const r = resolveZonedTime("America/New_York", 2026, 3, 8, 2, 30);
  assert.equal(r.kind, "gap");
  assert.equal(local("America/New_York", r.instant), "2026-03-08 03:30");
});

test("fall-back overlap returns both occurrences, first one preferred", () => {
  // 2026-11-01 01:30 happens twice in New York.
  const r = resolveZonedTime("America/New_York", 2026, 11, 1, 1, 30);
  assert.equal(r.kind, "overlap");
  if (r.kind !== "overlap") return;
  assert.equal(iso(r.instant), "2026-11-01T05:30:00.000Z");
  assert.equal(iso(r.second), "2026-11-01T06:30:00.000Z");
});

test("Boston caregiver, London recipient: 8:00 London +15m", () => {
  // January: London = UTC, Boston = UTC-5 -> 08:15 London is 03:15 Boston.
  const t = computeCheckInTimes({
    scheduleTimeZone: "Europe/London",
    scheduleDate: { year: 2026, month: 1, day: 15 },
    scheduleTime: "08:00",
    delayMinutes: 15,
    caregiverTimeZone: "America/New_York",
    quietHours: null,
  })!;
  assert.equal(iso(t.scheduleInstant), "2026-01-15T08:00:00.000Z");
  assert.equal(local("America/New_York", t.fireInstant), "2026-01-15 03:15");
  assert.equal(t.postponed, null);
});

test("quiet hours (22:00-07:00) postpone a 03:15 Boston reminder to 07:00 and say why", () => {
  const t = computeCheckInTimes({
    scheduleTimeZone: "Europe/London",
    scheduleDate: { year: 2026, month: 1, day: 15 },
    scheduleTime: "08:00",
    delayMinutes: 15,
    caregiverTimeZone: "America/New_York",
    quietHours: { start: "22:00", end: "07:00" },
  })!;
  assert.equal(local("America/New_York", t.fireInstant), "2026-01-15 07:00");
  assert.equal(t.postponed?.reason, "quiet_hours");
  assert.equal(local("America/New_York", t.postponed!.originalInstant), "2026-01-15 03:15");
});

test("quiet hours spanning midnight: evening reminder moves to next morning", () => {
  const instant = Date.UTC(2026, 0, 16, 3, 30); // 22:30 Jan 15 in Boston
  const end = quietHoursEndInstant(instant, "America/New_York", { start: "22:00", end: "07:00" })!;
  assert.equal(local("America/New_York", end), "2026-01-16 07:00");
  assert.equal(quietHoursEndInstant(Date.UTC(2026, 0, 16, 18, 0), "America/New_York", { start: "22:00", end: "07:00" }), null);
});

test("Boston vs Los Angeles stays 3h apart through DST", () => {
  const t = computeCheckInTimes({
    scheduleTimeZone: "America/Los_Angeles",
    scheduleDate: { year: 2026, month: 3, day: 9 },
    scheduleTime: "08:00",
    delayMinutes: 30,
    caregiverTimeZone: "America/New_York",
  })!;
  assert.equal(local("America/New_York", t.fireInstant), "2026-03-09 11:30");
});

test("Boston vs London differ by 4h (not 5h) when US has sprung forward but UK has not", () => {
  // US DST began 2026-03-08; UK DST begins 2026-03-29.
  const t = computeCheckInTimes({
    scheduleTimeZone: "Europe/London",
    scheduleDate: { year: 2026, month: 3, day: 10 },
    scheduleTime: "08:00",
    delayMinutes: 10,
    caregiverTimeZone: "America/New_York",
  })!;
  assert.equal(local("America/New_York", t.fireInstant), "2026-03-10 04:10");
});

test("Dhaka (no DST, UTC+6) to Boston crosses the calendar date", () => {
  const t = computeCheckInTimes({
    scheduleTimeZone: "Asia/Dhaka",
    scheduleDate: { year: 2026, month: 6, day: 1 },
    scheduleTime: "07:00",
    delayMinutes: 15,
    caregiverTimeZone: "America/New_York",
  })!;
  // 07:15 Dhaka = 01:15 UTC = 21:15 previous day in Boston (EDT).
  assert.equal(local("America/New_York", t.fireInstant), "2026-05-31 21:15");
});

test("delay crossing midnight in the schedule zone", () => {
  const t = computeCheckInTimes({
    scheduleTimeZone: "Europe/London",
    scheduleDate: { year: 2026, month: 1, day: 15 },
    scheduleTime: "23:50",
    delayMinutes: 30,
    caregiverTimeZone: "Europe/London",
  })!;
  assert.equal(local("Europe/London", t.fireInstant), "2026-01-16 00:20");
});

test("a dose time inside a DST gap still produces a real reminder", () => {
  const t = computeCheckInTimes({
    scheduleTimeZone: "America/New_York",
    scheduleDate: { year: 2026, month: 3, day: 8 },
    scheduleTime: "02:30",
    delayMinutes: 15,
    caregiverTimeZone: "America/New_York",
  })!;
  assert.equal(t.scheduleResolution, "gap");
  assert.equal(local("America/New_York", t.fireInstant), "2026-03-08 03:45");
});

test("recipient contact hours flag", () => {
  const t = computeCheckInTimes({
    scheduleTimeZone: "Europe/London",
    scheduleDate: { year: 2026, month: 1, day: 15 },
    scheduleTime: "08:00",
    delayMinutes: 15,
    caregiverTimeZone: "America/New_York",
    recipientTimeZone: "Europe/London",
    recipientContactWindow: { start: "09:00", end: "20:00" },
  })!;
  assert.equal(t.withinRecipientContactHours, false);
});

test("planner never returns past reminders, respects weekdays and limit", () => {
  const now = Date.UTC(2026, 0, 14, 12, 0);
  const plan = planUpcomingCheckIns({
    now,
    doses: [{ id: "a", label: "Morning", time: "08:00", weekdays: [1, 3] }],
    scheduleTimeZone: "Europe/London",
    delayMinutes: 15,
    caregiverTimeZone: "America/New_York",
    daysAhead: 14,
    limit: 3,
  });
  assert.equal(plan.length, 3);
  assert.ok(plan.every((p) => p.fireInstant > now));
  assert.ok(plan.every((p) => [1, 3].includes(new Date(p.scheduleInstant).getUTCDay())));
});
