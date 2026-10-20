import assert from "node:assert/strict";
import {
  bucketTodayDoses,
  buildRegimenSummaries,
  buildTodayDoseInstances,
  formatDoseAmountLabel,
} from "./medication-today";
import type { Medication, MedicationLog } from "./storage";

function med(partial: Partial<Medication> & { id: string; name: string }): Medication {
  return {
    frequency: "daily",
    active: true,
    medicationType: "scheduled",
    ...partial,
  } as Medication;
}

{
  console.log("1. Multiple doses stay individually identifiable");
  const hydro = med({
    id: "h1",
    name: "Hydrocortisone",
    doses: [
      { id: "d0", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00" },
      { id: "d1", amount: "5", unit: "mg", timeOfDay: "Night", reminderTime: "21:00" },
    ],
  });
  const now = new Date("2026-10-20T10:00:00");
  const instances = buildTodayDoseInstances([hydro], [], "2026-10-20", now);
  assert.equal(instances.length, 2);
  assert.equal(instances[0].doseIndex, 0);
  assert.equal(instances[0].state, "needs_attention");
  assert.equal(instances[1].doseIndex, 1);
  assert.equal(instances[1].state, "upcoming");
  assert.equal(instances[0].key, "h1:0");
  assert.equal(instances[1].key, "h1:1");
}

{
  console.log("2. Taken log only marks that dose");
  const hydro = med({
    id: "h1",
    name: "Hydrocortisone",
    doses: [
      { id: "d0", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00" },
      { id: "d1", amount: "5", unit: "mg", timeOfDay: "Night", reminderTime: "21:00" },
    ],
  });
  const logs: MedicationLog[] = [
    { id: "l1", medicationId: "h1", doseIndex: 0, date: "2026-10-20", taken: true, recordedAt: "2026-10-20T08:05:00" },
  ];
  const now = new Date("2026-10-20T10:00:00");
  const buckets = bucketTodayDoses(buildTodayDoseInstances([hydro], logs, "2026-10-20", now));
  assert.equal(buckets.completed.length, 1);
  assert.equal(buckets.completed[0].doseIndex, 0);
  assert.equal(buckets.upcoming.length, 1);
  assert.equal(buckets.upcoming[0].doseIndex, 1);
  assert.equal(buckets.needsAttention.length, 0);
}

{
  console.log("3. Weekly med off-schedule day is omitted");
  const weekly = med({
    id: "w1",
    name: "Weekly B12",
    reminderCadence: "weekly",
    reminderWeekday: 2, // Monday (Expo weekday: Sun=1 ... Sat=7); 2026-10-20 is Tuesday → weekday 3
    doses: [{ id: "d0", amount: "1", unit: "injection", timeOfDay: "Morning", reminderTime: "09:00" }],
  });
  // 2026-10-20 is Tuesday → expo weekday 3; schedule wants Monday (2)
  const instances = buildTodayDoseInstances([weekly], [], "2026-10-20", new Date("2026-10-20T10:00:00"));
  assert.equal(instances.length, 0);
}

{
  console.log("4. Weekly med on schedule day appears");
  const weekly = med({
    id: "w1",
    name: "Weekly B12",
    reminderCadence: "weekly",
    reminderWeekday: 3, // Tuesday
    doses: [{ id: "d0", amount: "1", unit: "injection", timeOfDay: "Morning", reminderTime: "09:00" }],
  });
  const instances = buildTodayDoseInstances([weekly], [], "2026-10-20", new Date("2026-10-20T10:00:00"));
  assert.equal(instances.length, 1);
  assert.equal(instances[0].state, "needs_attention");
}

{
  console.log("5. PRN excluded from today's scheduled doses");
  const prn = med({
    id: "p1",
    name: "Ibuprofen",
    medicationType: "prn",
    doses: [{ id: "d0", amount: "200", unit: "mg", timeOfDay: "As Needed" }],
  });
  const instances = buildTodayDoseInstances([prn], [], "2026-10-20", new Date("2026-10-20T10:00:00"));
  assert.equal(instances.length, 0);
}

{
  console.log("6. Regimen summary joins dose amounts");
  const hydro = med({
    id: "h1",
    name: "Hydrocortisone",
    doses: [
      { id: "d0", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "08:00" },
      { id: "d1", amount: "5", unit: "mg", timeOfDay: "Night", reminderTime: "21:00" },
    ],
  });
  const summaries = buildRegimenSummaries([hydro], [], "2026-10-20");
  assert.equal(summaries.length, 1);
  assert.ok(summaries[0].doseSummary.includes("10 mg"));
  assert.ok(summaries[0].doseSummary.includes("5 mg"));
  assert.equal(summaries[0].expectedToday, 2);
}

{
  console.log("7. formatDoseAmountLabel");
  assert.equal(formatDoseAmountLabel("10", "mg"), "10 mg");
  assert.equal(formatDoseAmountLabel("", ""), "");
}

console.log("medication-today: all assertions passed");
