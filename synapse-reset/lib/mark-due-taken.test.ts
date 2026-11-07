import assert from "node:assert/strict";
import {
  applyMarkDuePlanToLogs,
  applyUndoMarkDueToLogs,
  buildMarkDueBatchPlan,
  doseEventId,
  listDueUntakenDoses,
  markDueUndoLabel,
} from "./mark-due-taken";
import { bucketTodayDoses, buildTodayDoseInstances, countNeedsAttentionDoses } from "./medication-today";
import type { Medication, MedicationLog } from "./storage";

function med(partial: Partial<Medication> & { id: string; name: string }): Medication {
  return {
    frequency: "daily",
    active: true,
    medicationType: "scheduled",
    ...partial,
  } as Medication;
}

function hydro(): Medication {
  return med({
    id: "h1",
    name: "Hydrocortisone",
    doses: [
      { id: "d0", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00" },
      { id: "d1", amount: "5", unit: "mg", timeOfDay: "Night", reminderTime: "21:00" },
    ],
  });
}

{
  console.log("1. Multiple doses — only due doses are eligible");
  const now = new Date("2026-10-20T10:00:00");
  const due = listDueUntakenDoses([hydro()], [], "2026-10-20", now);
  assert.equal(due.length, 1);
  assert.equal(due[0].doseIndex, 0);
  assert.equal(due[0].eventId, doseEventId("h1", 0, "2026-10-20"));
  const buckets = bucketTodayDoses(buildTodayDoseInstances([hydro()], [], "2026-10-20", now));
  assert.equal(buckets.upcoming.length, 1);
  assert.equal(buckets.upcoming[0].doseIndex, 1);
}

{
  console.log("2. Overlapping schedules across meds — both due included");
  const levo = med({
    id: "l1",
    name: "Levothyroxine",
    doses: [{ id: "d0", amount: "88", unit: "mcg", timeOfDay: "Morning", reminderTime: "07:30" }],
  });
  const now = new Date("2026-10-20T10:00:00");
  const due = listDueUntakenDoses([hydro(), levo], [], "2026-10-20", now);
  assert.equal(due.length, 2);
  assert.deepEqual(
    due.map((d) => d.key).sort(),
    ["h1:0", "l1:0"],
  );
}

{
  console.log("3. Time zones — eligibility uses local clock on provided Date");
  // Simulate "morning in US Eastern" via a Date whose local hours are 09:00.
  const localMorning = new Date(2026, 9, 20, 9, 0, 0); // month 9 = October
  const dueMorning = listDueUntakenDoses([hydro()], [], "2026-10-20", localMorning);
  assert.equal(dueMorning.length, 1);

  const localEveningBeforeNight = new Date(2026, 9, 20, 20, 59, 0);
  const dueBeforeNight = listDueUntakenDoses([hydro()], [], "2026-10-20", localEveningBeforeNight);
  assert.equal(dueBeforeNight.length, 1);
  assert.equal(dueBeforeNight[0].doseIndex, 0);

  const localAfterNight = new Date(2026, 9, 20, 21, 0, 0);
  const dueAfterNight = listDueUntakenDoses([hydro()], [], "2026-10-20", localAfterNight);
  assert.equal(dueAfterNight.length, 2);
}

{
  console.log("4. Daylight saving spring forward — still uses wall-clock minutes");
  // US DST spring forward 2026-03-08; before 08:00 local morning dose not yet due.
  const beforeDue = new Date(2026, 2, 8, 7, 59, 0);
  const afterDue = new Date(2026, 2, 8, 8, 0, 0);
  const morningOnly = med({
    id: "m1",
    name: "Morning Med",
    doses: [{ id: "d0", amount: "1", unit: "tab", timeOfDay: "Morning", reminderTime: "08:00" }],
  });
  assert.equal(listDueUntakenDoses([morningOnly], [], "2026-03-08", beforeDue).length, 0);
  assert.equal(listDueUntakenDoses([morningOnly], [], "2026-03-08", afterDue).length, 1);

  // Fall back 2026-11-01 — after 08:00 local still due once.
  const fallAfter = new Date(2026, 10, 1, 8, 30, 0);
  assert.equal(listDueUntakenDoses([morningOnly], [], "2026-11-01", fallAfter).length, 1);
}

{
  console.log("5. Excludes taken, inactive, PRN, and off-schedule weekly");
  const takenLogs: MedicationLog[] = [
    { id: "x", medicationId: "h1", doseIndex: 0, date: "2026-10-20", taken: true, recordedAt: "2026-10-20T08:05:00" },
  ];
  const inactive = med({
    id: "old",
    name: "Stopped",
    active: false,
    doses: [{ id: "d0", amount: "1", unit: "tab", timeOfDay: "Morning", reminderTime: "07:00" }],
  });
  const prn = med({
    id: "p1",
    name: "Ibuprofen",
    medicationType: "prn",
    doses: [{ id: "d0", amount: "200", unit: "mg", timeOfDay: "As Needed" }],
  });
  const weeklyOff = med({
    id: "w1",
    name: "Weekly",
    reminderCadence: "weekly",
    reminderWeekday: 2,
    doses: [{ id: "d0", amount: "1", unit: "inj", timeOfDay: "Morning", reminderTime: "09:00" }],
  });
  const now = new Date("2026-10-20T10:00:00");
  const due = listDueUntakenDoses([hydro(), inactive, prn, weeklyOff], takenLogs, "2026-10-20", now);
  assert.equal(due.length, 0);
}

{
  console.log("6. Partial batch — deselected doses stay writable=false");
  const now = new Date("2026-10-20T22:00:00");
  const candidates = listDueUntakenDoses([hydro()], [], "2026-10-20", now);
  assert.equal(candidates.length, 2);
  const plan = buildMarkDueBatchPlan({
    candidates,
    selectedKeys: ["h1:0"],
    logs: [],
    dateKey: "2026-10-20",
    reportedTakenAt: "2026-10-20T22:05:00.000Z",
  });
  assert.equal(plan.selected.length, 1);
  assert.equal(plan.writable.length, 1);
  assert.equal(plan.writable[0].key, "h1:0");
  const applied = applyMarkDuePlanToLogs([], plan);
  assert.equal(applied.newlyMarkedKeys.length, 1);
  assert.equal(applied.logs.filter((l) => l.taken).length, 1);
  const remaining = countNeedsAttentionDoses([hydro()], applied.logs, "2026-10-20", now);
  assert.equal(remaining, 1);
}

{
  console.log("7. Duplicate taps / already-taken — idempotent noop");
  const now = new Date("2026-10-20T10:00:00");
  const candidates = listDueUntakenDoses([hydro()], [], "2026-10-20", now);
  const first = buildMarkDueBatchPlan({
    candidates,
    selectedKeys: candidates.map((c) => c.key),
    logs: [],
    dateKey: "2026-10-20",
    reportedTakenAt: "2026-10-20T10:01:00.000Z",
  });
  const afterFirst = applyMarkDuePlanToLogs([], first);
  assert.equal(afterFirst.newlyMarkedKeys.length, 1);

  // Re-list after first mark — due set empty.
  const dueAgain = listDueUntakenDoses([hydro()], afterFirst.logs, "2026-10-20", now);
  assert.equal(dueAgain.length, 0);

  // Even if we force the same selected key against already-taken logs, plan is noop.
  const second = buildMarkDueBatchPlan({
    candidates,
    selectedKeys: ["h1:0"],
    logs: afterFirst.logs,
    dateKey: "2026-10-20",
    reportedTakenAt: "2026-10-20T10:02:00.000Z",
  });
  assert.equal(second.actions.every((a) => a.kind === "noop"), true);
  assert.equal(second.writable.length, 0);
  const afterSecond = applyMarkDuePlanToLogs(afterFirst.logs, second);
  assert.equal(afterSecond.newlyMarkedKeys.length, 0);
  assert.equal(afterSecond.logs.filter((l) => l.medicationId === "h1" && (l.doseIndex ?? 0) === 0).length, 1);
}

{
  console.log("8. Undo batch restores prior state");
  const now = new Date("2026-10-20T22:00:00");
  const candidates = listDueUntakenDoses([hydro()], [], "2026-10-20", now);
  const plan = buildMarkDueBatchPlan({
    candidates,
    selectedKeys: candidates.map((c) => c.key),
    logs: [],
    dateKey: "2026-10-20",
    reportedTakenAt: "2026-10-20T22:10:00.000Z",
  });
  const marked = applyMarkDuePlanToLogs([], plan);
  assert.equal(marked.newlyMarkedKeys.length, 2);
  assert.equal(countNeedsAttentionDoses([hydro()], marked.logs, "2026-10-20", now), 0);
  const undone = applyUndoMarkDueToLogs(marked.logs, "2026-10-20", marked.newlyMarkedKeys);
  assert.equal(countNeedsAttentionDoses([hydro()], undone, "2026-10-20", now), 2);
  assert.equal(markDueUndoLabel(2), "Logged 2 due doses");
}

{
  console.log("9. Reported taken time is stamped on writable rows");
  const now = new Date("2026-10-20T10:00:00");
  const candidates = listDueUntakenDoses([hydro()], [], "2026-10-20", now);
  const reportedTakenAt = "2026-10-20T14:33:00.000Z";
  const plan = buildMarkDueBatchPlan({
    candidates,
    selectedKeys: ["h1:0"],
    logs: [],
    dateKey: "2026-10-20",
    reportedTakenAt,
  });
  const applied = applyMarkDuePlanToLogs([], plan);
  assert.equal(applied.logs[0].recordedAt, reportedTakenAt);
}

console.log("mark-due-taken tests passed");
