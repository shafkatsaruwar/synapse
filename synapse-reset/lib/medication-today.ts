/**
 * Today's dose instances for the Medications viewing experience.
 * Respects weekly/custom cadence via isMedicationScheduledOnDate.
 * Does not invent compensatory doses or change schedules.
 */
import type { Medication, MedicationDose, MedicationLog, RecordOwner } from "@/lib/storage";
import { getMedicationDoseCount, isMedicationScheduledOnDate } from "@/lib/medication-schedule";

/** Local normalize so this module stays free of react-native (storage pulls AsyncStorage). */
function dosesFor(med: Medication): MedicationDose[] {
  if (Array.isArray(med.doses) && med.doses.length > 0) return med.doses;
  const legacyDosage = med.dosage ?? "";
  const legacyUnit = med.unit ?? "mg";
  const legacyTimeTag = med.timeTag;
  const tags = Array.isArray(legacyTimeTag)
    ? legacyTimeTag
    : typeof legacyTimeTag === "string"
      ? [legacyTimeTag]
      : ["Morning"];
  const count = Math.max(1, (med as { doses?: number }).doses ?? tags.length);
  const timeLabels =
    count <= tags.length
      ? tags.slice(0, count)
      : [...tags, ...Array.from({ length: count - tags.length }, (_, i) => `Dose ${i + 1}`)];
  return timeLabels.map((timeOfDay, i) => ({
    id: `legacy-${med.id}-${i}`,
    amount: i === 0 ? legacyDosage : "",
    unit: legacyUnit,
    timeOfDay,
  }));
}

export type DoseAttentionState = "needs_attention" | "upcoming" | "completed";

export type TodayDoseInstance = {
  key: string;
  medicationId: string;
  medicationName: string;
  doseIndex: number;
  amount: string;
  unit: string;
  timeOfDay: string;
  reminderTime: string | null;
  sortMinutes: number | null;
  taken: boolean;
  takenAt?: string;
  state: DoseAttentionState;
  entryOwner: RecordOwner;
  emoji?: string;
};

export type TodayDoseBuckets = {
  needsAttention: TodayDoseInstance[];
  upcoming: TodayDoseInstance[];
  completed: TodayDoseInstance[];
  total: number;
  takenCount: number;
};

function reminderTimeToMinutes(hhmm?: string | null): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function formatDoseAmountLabel(amount: string, unit: string): string {
  const a = amount.trim();
  const u = unit.trim();
  if (a && u) return `${a} ${u}`;
  if (a) return a;
  if (u) return u;
  return "";
}

export function formatReminderClock(hhmm: string | null, timeOfDay: string): string {
  if (!hhmm) return timeOfDay || "Scheduled";
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function isDoseTakenInLogs(logs: MedicationLog[], medicationId: string, doseIndex: number): MedicationLog | undefined {
  return logs.find((l) => l.medicationId === medicationId && (l.doseIndex ?? 0) === doseIndex && l.taken);
}

/**
 * Build individually identifiable dose instances for a calendar day.
 * Off-schedule weekly/custom meds are omitted (not shown as due).
 */
export function buildTodayDoseInstances(
  medications: Medication[],
  logsForDate: MedicationLog[],
  dateKey: string,
  now: Date = new Date(),
): TodayDoseInstance[] {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const instances: TodayDoseInstance[] = [];

  for (const med of medications) {
    // Match badge / storage semantics: only an explicit false means inactive.
    if (med.active === false) continue;
    if ((med.medicationType ?? "scheduled") === "prn") continue;
    if (!isMedicationScheduledOnDate(med, dateKey)) continue;

    const doses = dosesFor(med);
    const doseCount = getMedicationDoseCount({ ...med, doses });

    for (let doseIndex = 0; doseIndex < doseCount; doseIndex++) {
      const dose = doses[doseIndex];
      const reminderTime = dose?.reminderTime?.trim() || null;
      const sortMinutes = reminderTimeToMinutes(reminderTime);
      const log = isDoseTakenInLogs(logsForDate, med.id, doseIndex);
      const taken = Boolean(log?.taken);

      let state: DoseAttentionState;
      if (taken) {
        state = "completed";
      } else if (sortMinutes == null || currentMinutes >= sortMinutes) {
        // Align with existing screen semantics: missing reminderTime counts as due.
        state = "needs_attention";
      } else {
        state = "upcoming";
      }

      instances.push({
        key: `${med.id}:${doseIndex}`,
        medicationId: med.id,
        medicationName: med.name?.trim() || "Medication",
        doseIndex,
        amount: dose?.amount?.trim() ?? "",
        unit: dose?.unit?.trim() ?? "",
        timeOfDay: dose?.timeOfDay?.trim() || `Dose ${doseIndex + 1}`,
        reminderTime,
        sortMinutes,
        taken,
        takenAt: log?.recordedAt,
        state,
        entryOwner: med.entryOwner ?? "self",
        emoji: med.emoji,
      });
    }
  }

  const rank = (d: TodayDoseInstance) => d.sortMinutes ?? (d.state === "needs_attention" ? -1 : 24 * 60 + 1);
  instances.sort((a, b) => {
    if (a.state !== b.state) {
      const order = { needs_attention: 0, upcoming: 1, completed: 2 } as const;
      return order[a.state] - order[b.state];
    }
    const byTime = rank(a) - rank(b);
    if (byTime !== 0) return byTime;
    return a.medicationName.localeCompare(b.medicationName) || a.doseIndex - b.doseIndex;
  });

  return instances;
}

export function bucketTodayDoses(instances: TodayDoseInstance[]): TodayDoseBuckets {
  const needsAttention = instances.filter((d) => d.state === "needs_attention");
  const upcoming = instances.filter((d) => d.state === "upcoming");
  const completed = instances.filter((d) => d.state === "completed");
  return {
    needsAttention,
    upcoming,
    completed,
    total: instances.length,
    takenCount: completed.length,
  };
}

/** Pending due/overdue untaken doses — shared by Today's Doses UI and nav badges. */
export function countNeedsAttentionDoses(
  medications: Medication[],
  logsForDate: MedicationLog[],
  dateKey: string,
  now: Date = new Date(),
): number {
  return bucketTodayDoses(buildTodayDoseInstances(medications, logsForDate, dateKey, now)).needsAttention.length;
}

export type DashboardUpNext =
  | {
      kind: "dose";
      medicationName: string;
      /** e.g. "10 mg • Night" */
      subtitle: string;
      timeOfDay: string;
      dueMinutes: number | null;
      owner: RecordOwner;
      state: DoseAttentionState;
      lines: string[];
    }
  | { kind: "done" }
  | { kind: "none" };

/**
 * Home “UP NEXT” — only doses scheduled for `dateKey`.
 * Off-schedule weekly/custom meds (e.g. Sogroya not today) never win.
 * When every scheduled dose is taken → `{ kind: "done" }` (“All done for today”).
 */
export function getDashboardUpNext(
  medications: Medication[],
  logsForDate: MedicationLog[],
  dateKey: string,
  now: Date = new Date(),
): DashboardUpNext {
  const buckets = bucketTodayDoses(buildTodayDoseInstances(medications, logsForDate, dateKey, now));
  if (buckets.total === 0) return { kind: "none" };
  if (buckets.needsAttention.length === 0 && buckets.upcoming.length === 0) return { kind: "done" };

  const next = buckets.needsAttention[0] ?? buckets.upcoming[0];
  const amount = formatDoseAmountLabel(next.amount, next.unit);
  const subtitle = [amount, next.timeOfDay].filter(Boolean).join(" • ") || formatReminderClock(next.reminderTime, next.timeOfDay);
  const line = amount && next.timeOfDay
    ? `${amount} — ${next.timeOfDay}`
    : amount || next.timeOfDay || "Scheduled dose";

  return {
    kind: "dose",
    medicationName: next.medicationName,
    subtitle,
    timeOfDay: next.timeOfDay,
    dueMinutes: next.sortMinutes,
    owner: next.entryOwner,
    state: next.state,
    lines: [line],
  };
}

export type RegimenSummary = {
  medication: Medication;
  doseSummary: string;
  isPrn: boolean;
  takenToday: number;
  expectedToday: number;
  scheduledToday: boolean;
};

export function buildRegimenSummaries(
  medications: Medication[],
  logsForDate: MedicationLog[],
  dateKey: string,
): RegimenSummary[] {
  return medications
    .filter((m) => m.active)
    .map((med) => {
      const isPrn = (med.medicationType ?? "scheduled") === "prn";
      const doses = dosesFor(med);
      const doseSummary = isPrn
        ? formatDoseAmountLabel(doses[0]?.amount ?? "", doses[0]?.unit ?? "") || "As needed"
        : doses
            .map((d) => {
              const amt = formatDoseAmountLabel(d.amount ?? "", d.unit ?? "");
              const when = d.timeOfDay?.trim() || "";
              if (amt && when) return `${amt} ${when.toLowerCase()}`;
              return amt || when;
            })
            .filter(Boolean)
            .join(" · ") || "Scheduled";

      const scheduledToday = isPrn ? false : isMedicationScheduledOnDate(med, dateKey);
      const expectedToday = scheduledToday ? getMedicationDoseCount({ ...med, doses }) : 0;
      let takenToday = 0;
      if (isPrn) {
        takenToday = logsForDate.filter((l) => l.medicationId === med.id && (l.doseIndex ?? -1) === -1 && l.taken).length;
      } else if (scheduledToday) {
        for (let i = 0; i < expectedToday; i++) {
          if (isDoseTakenInLogs(logsForDate, med.id, i)) takenToday++;
        }
      }

      return {
        medication: med,
        doseSummary,
        isPrn,
        takenToday,
        expectedToday,
        scheduledToday,
      };
    })
    .sort((a, b) => {
      if (a.isPrn !== b.isPrn) return a.isPrn ? 1 : -1;
      return a.medication.name.localeCompare(b.medication.name);
    });
}
