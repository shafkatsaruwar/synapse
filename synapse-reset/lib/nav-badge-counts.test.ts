import assert from "node:assert/strict";
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

{
  console.log("badge parity: all taken morning+evening → 0 needs attention / badge");
  const hydro = med({
    id: "h1",
    name: "Hydrocortisone",
    doses: [
      { id: "d0", amount: "10", unit: "mg", timeOfDay: "Morning", reminderTime: "11:00" },
      { id: "d1", amount: "5", unit: "mg", timeOfDay: "Night", reminderTime: "23:00" },
    ],
  });
  const levo = med({
    id: "l1",
    name: "Levothyroxine",
    doses: [{ id: "d0", amount: "200", unit: "mcg", timeOfDay: "Morning", reminderTime: "11:00" }],
  });
  const sim = med({
    id: "s1",
    name: "Simethicone",
    doses: [{ id: "d0", amount: "125", unit: "mg", timeOfDay: "Morning", reminderTime: "11:00" }],
  });
  const logs: MedicationLog[] = [
    { id: "a", medicationId: "h1", doseIndex: 0, date: "2026-10-22", taken: true },
    { id: "b", medicationId: "l1", doseIndex: 0, date: "2026-10-22", taken: true },
    { id: "c", medicationId: "s1", doseIndex: 0, date: "2026-10-22", taken: true },
    { id: "d", medicationId: "h1", doseIndex: 1, date: "2026-10-22", taken: true },
  ];
  const now = new Date("2026-10-22T11:03:00");
  const buckets = bucketTodayDoses(buildTodayDoseInstances([hydro, levo, sim], logs, "2026-10-22", now));
  assert.equal(buckets.needsAttention.length, 0);
  assert.equal(buckets.takenCount, 4);
  assert.equal(countNeedsAttentionDoses([hydro, levo, sim], logs, "2026-10-22", now), 0);
}

{
  console.log("badge parity: weekly med off today does not inflate badge");
  const daily = med({
    id: "d1",
    name: "Daily",
    doses: [{ id: "x", amount: "1", unit: "tab", timeOfDay: "Morning", reminderTime: "08:00" }],
  });
  const weekly = med({
    id: "w1",
    name: "Weekly B12",
    reminderCadence: "weekly",
    reminderWeekday: 2,
    doses: [{ id: "x", amount: "1", unit: "injection", timeOfDay: "Morning", reminderTime: "08:00" }],
  });
  const now = new Date("2026-10-22T11:03:00");
  assert.equal(countNeedsAttentionDoses([daily, weekly], [], "2026-10-22", now), 1);
}

{
  console.log("badge parity: due untaken still counts; taken clears");
  const meds = [
    med({
      id: "m1",
      name: "Med",
      doses: [{ id: "d0", amount: "1", unit: "tab", timeOfDay: "Morning", reminderTime: "10:00" }],
    }),
  ];
  const now = new Date("2026-10-22T11:03:00");
  assert.equal(countNeedsAttentionDoses(meds, [], "2026-10-22", now), 1);
  assert.equal(
    countNeedsAttentionDoses(
      meds,
      [{ id: "t", medicationId: "m1", doseIndex: 0, date: "2026-10-22", taken: true }],
      "2026-10-22",
      now,
    ),
    0,
  );
}

console.log("nav-badge-counts tests passed");
