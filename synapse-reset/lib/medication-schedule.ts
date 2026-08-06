import type { Medication } from "@/lib/storage";

export type MedicationReminderCadence = "daily" | "weekly" | "biweekly" | "custom";

type ReminderSchedule = {
  cadence: MedicationReminderCadence;
  weekday: number;
  intervalValue: number;
  intervalUnit: "days" | "weeks";
};

function jsDayToExpoWeekday(day: number): number {
  return day === 0 ? 1 : day + 1;
}

function expoWeekdayFromDateKey(dateKey: string): number {
  return jsDayToExpoWeekday(new Date(`${dateKey}T12:00:00`).getDay());
}

export function resolveReminderSchedule(med: {
  reminderCadence?: MedicationReminderCadence;
  frequency?: string;
  reminderWeekday?: number;
  reminderIntervalValue?: number;
  reminderIntervalUnit?: "days" | "weeks";
}): ReminderSchedule {
  const safeWeekday =
    med.reminderWeekday && med.reminderWeekday >= 1 && med.reminderWeekday <= 7
      ? med.reminderWeekday
      : jsDayToExpoWeekday(new Date().getDay());
  const safeIntervalValue = med.reminderIntervalValue && med.reminderIntervalValue > 0 ? med.reminderIntervalValue : 3;
  const safeIntervalUnit = med.reminderIntervalUnit ?? "days";

  if (med.reminderCadence === "biweekly") {
    return { cadence: "biweekly", weekday: safeWeekday, intervalValue: 2, intervalUnit: "weeks" };
  }
  if (med.reminderCadence === "custom") {
    return { cadence: "custom", weekday: safeWeekday, intervalValue: safeIntervalValue, intervalUnit: safeIntervalUnit };
  }
  if (med.reminderCadence === "weekly") {
    return { cadence: "weekly", weekday: safeWeekday, intervalValue: 1, intervalUnit: "weeks" };
  }
  if (med.reminderCadence === "daily") {
    return { cadence: "daily", weekday: safeWeekday, intervalValue: 1, intervalUnit: "days" };
  }

  const freq = med.frequency?.trim().toLowerCase() ?? "";
  const customWeekMatch = freq.match(/every\s+(\d+)\s+weeks?/);
  if (customWeekMatch) {
    const parsed = Math.max(1, parseInt(customWeekMatch[1], 10) || 1);
    return {
      cadence: parsed === 2 ? "biweekly" : "custom",
      weekday: safeWeekday,
      intervalValue: parsed,
      intervalUnit: "weeks",
    };
  }
  const customDayMatch = freq.match(/every\s+(\d+)\s+days?/);
  if (customDayMatch) {
    return {
      cadence: "custom",
      weekday: safeWeekday,
      intervalValue: Math.max(1, parseInt(customDayMatch[1], 10) || 1),
      intervalUnit: "days",
    };
  }
  if (freq.includes("week")) {
    return { cadence: "weekly", weekday: safeWeekday, intervalValue: 1, intervalUnit: "weeks" };
  }
  return { cadence: "daily", weekday: safeWeekday, intervalValue: 1, intervalUnit: "days" };
}

export function getMedicationDoseCount(med: Medication, options?: { sickModeHydrocortisoneMultiplier?: boolean }): number {
  if (Array.isArray(med.doses) && med.doses.length > 0) return med.doses.length;
  const base = Array.isArray(med.timeTag) ? med.timeTag.length : ((med as { doses?: number }).doses ?? 1);
  if (options?.sickModeHydrocortisoneMultiplier && med.name === "Hydrocortisone") return base * 3;
  return Math.max(1, base);
}

/**
 * Whether a scheduled medication is expected on a calendar day.
 * Weekly/biweekly/custom-week schedules match by weekday within a rolling window.
 * Custom day intervals use the nearest prior matching log (or the day itself) as anchor.
 */
export function isMedicationScheduledOnDate(
  med: Medication,
  dateKey: string,
  options?: { anchorDateKey?: string | null },
): boolean {
  if (!med.active || med.medicationType === "prn") return false;
  const schedule = resolveReminderSchedule(med);
  const weekday = expoWeekdayFromDateKey(dateKey);

  if (schedule.cadence === "daily") return true;

  if (schedule.cadence === "weekly") {
    return weekday === schedule.weekday;
  }

  if (schedule.cadence === "biweekly" || (schedule.cadence === "custom" && schedule.intervalUnit === "weeks")) {
    // In a 7-day window there is at most one matching weekday; treat that day as due.
    // Over longer ranges this still avoids the daily×7 inflation that made weekly meds look like 1/7.
    return weekday === schedule.weekday;
  }

  // custom every N days
  const interval = Math.max(1, schedule.intervalValue);
  const anchor = options?.anchorDateKey || dateKey;
  const dayMs = 24 * 60 * 60 * 1000;
  const dateTime = new Date(`${dateKey}T12:00:00`).getTime();
  const anchorTime = new Date(`${anchor}T12:00:00`).getTime();
  const diffDays = Math.round((dateTime - anchorTime) / dayMs);
  return diffDays >= 0 && diffDays % interval === 0;
}

export function countExpectedDosesInRange(
  medications: Medication[],
  dateKeys: string[],
  options?: {
    logs?: { medicationId: string; date: string; taken?: boolean }[];
    sickModeHydrocortisoneMultiplier?: boolean;
  },
): number {
  let total = 0;
  for (const med of medications) {
    if (!med.active || med.medicationType === "prn") continue;
    const doseCount = getMedicationDoseCount(med, {
      sickModeHydrocortisoneMultiplier: options?.sickModeHydrocortisoneMultiplier,
    });
    const schedule = resolveReminderSchedule(med);
    const medLogs = (options?.logs ?? []).filter((log) => log.medicationId === med.id);
    const anchorDateKey =
      schedule.cadence === "custom" && schedule.intervalUnit === "days"
        ? (medLogs.map((log) => log.date).sort()[0] ?? dateKeys[0] ?? null)
        : null;

    for (const dateKey of dateKeys) {
      if (isMedicationScheduledOnDate(med, dateKey, { anchorDateKey })) {
        total += doseCount;
      }
    }
  }
  return total;
}

export function countDistinctTakenDoses(
  logs: { medicationId: string; date: string; doseIndex?: number; taken?: boolean }[],
  medicationIds: Set<string>,
  dateFrom: string,
  dateTo: string,
): number {
  const keys = new Set<string>();
  for (const log of logs) {
    if (!log.taken) continue;
    if (!medicationIds.has(log.medicationId)) continue;
    if (log.date < dateFrom || log.date > dateTo) continue;
    const doseIndex = log.doseIndex ?? 0;
    if (doseIndex < 0) continue; // PRN sentinel
    keys.add(`${log.medicationId}|${log.date}|${doseIndex}`);
  }
  return keys.size;
}
