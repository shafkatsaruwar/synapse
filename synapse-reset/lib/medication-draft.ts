/**
 * Guided Add/Edit Medication draft model and pure helpers.
 * Separates prescribed schedule (time-of-day + cadence) from notification preferences.
 */
import type { Medication, MedicationDose, MedicationType, RecordOwner } from "@/lib/storage";

/** Local copy so draft helpers stay free of react-native (testable via tsx). */
const DEFAULT_REMINDER_TIMES: Record<string, { hour: number; minute: number }> = {
  Morning: { hour: 8, minute: 0 },
  Afternoon: { hour: 14, minute: 0 },
  Evening: { hour: 18, minute: 0 },
  Night: { hour: 21, minute: 0 },
  "As Needed": { hour: 9, minute: 0 },
};

export type MedicationReminderCadence = "daily" | "weekly" | "biweekly" | "custom";

export type GuidedDoseDraft = {
  id: string;
  amount: string;
  unit: string;
  timeOfDay: string;
  /** Clock time for notifications only — independent of prescribed time-of-day. */
  reminderTime: string;
  optionalNotes: string;
};

export type AddMedicationDraft = {
  name: string;
  imageUri: string;
  entryOwner: RecordOwner;
  medicationType: MedicationType | null;
  doses: GuidedDoseDraft[];
  route: string;
  reminderCadence: MedicationReminderCadence;
  reminderWeekday: number;
  reminderIntervalValue: string;
  reminderIntervalUnit: "days" | "weeks";
  /** Explicit user choice. Default true for new drafts; preserved from existing meds. */
  remindersEnabled: boolean;
  source?: Medication["source"];
};

export type GuidedStepId = "identity" | "how" | "when" | "review" | "success";

export const GUIDED_DOSE_UNITS = [
  "mg",
  "g",
  "mcg",
  "mL",
  "tablet",
  "tablets",
  "capsule",
  "capsules",
  "drop",
  "drops",
  "puff",
  "puffs",
  "unit",
  "units",
  "patch",
  "spray",
] as const;

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Sun" },
  { value: 2, label: "Mon" },
  { value: 3, label: "Tue" },
  { value: 4, label: "Wed" },
  { value: 5, label: "Thu" },
  { value: 6, label: "Fri" },
  { value: 7, label: "Sat" },
] as const;

export function jsDayToExpoWeekday(day: number): number {
  return day === 0 ? 1 : day + 1;
}

export function defaultReminderTimeFor(timeOfDay: string): string {
  const t = DEFAULT_REMINDER_TIMES[timeOfDay] ?? DEFAULT_REMINDER_TIMES.Morning;
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

export function formatReminderTimeDisplay(hhmm: string): string {
  const [h, m] = (hhmm || "08:00").split(":").map((n) => parseInt(n, 10) || 0);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatMedicationFrequencyLabel(
  cadence: MedicationReminderCadence,
  weekday: number,
  intervalValue: number,
  intervalUnit: "days" | "weeks",
): string {
  if (cadence === "biweekly") {
    const weekdayLabel = WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label ?? "Sun";
    return `Every 2 weeks on ${weekdayLabel}`;
  }
  if (cadence === "custom") {
    if (intervalUnit === "weeks") {
      const weekdayLabel = WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label ?? "Sun";
      return `Every ${intervalValue} ${intervalValue === 1 ? "week" : "weeks"} on ${weekdayLabel}`;
    }
    return `Every ${intervalValue} ${intervalValue === 1 ? "day" : "days"}`;
  }
  if (cadence === "weekly") {
    const weekdayLabel = WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label ?? "Sun";
    return `Every week on ${weekdayLabel}`;
  }
  return "Every day";
}

export function inferMedicationCadence(med: {
  reminderCadence?: MedicationReminderCadence;
  frequency?: string;
  reminderWeekday?: number;
  reminderIntervalValue?: number;
  reminderIntervalUnit?: "days" | "weeks";
}) {
  const safeWeekday =
    med.reminderWeekday && med.reminderWeekday >= 1 && med.reminderWeekday <= 7
      ? med.reminderWeekday
      : jsDayToExpoWeekday(new Date().getDay());
  const safeIntervalValue = med.reminderIntervalValue && med.reminderIntervalValue > 0 ? med.reminderIntervalValue : 3;
  const safeIntervalUnit = med.reminderIntervalUnit ?? "days";

  if (med.reminderCadence === "biweekly") {
    return { cadence: "biweekly" as const, weekday: safeWeekday, intervalValue: 2, intervalUnit: "weeks" as const };
  }
  if (med.reminderCadence === "custom") {
    return {
      cadence: "custom" as const,
      weekday: safeWeekday,
      intervalValue: safeIntervalValue,
      intervalUnit: safeIntervalUnit,
    };
  }
  if (med.reminderCadence === "weekly") {
    return { cadence: "weekly" as const, weekday: safeWeekday, intervalValue: 1, intervalUnit: "weeks" as const };
  }
  if (med.reminderCadence === "daily") {
    return { cadence: "daily" as const, weekday: safeWeekday, intervalValue: 1, intervalUnit: "days" as const };
  }
  const freq = med.frequency?.trim().toLowerCase() ?? "";
  const customWeekMatch = freq.match(/every\s+(\d+)\s+weeks?/);
  if (customWeekMatch) {
    const parsed = Math.max(1, parseInt(customWeekMatch[1], 10) || 1);
    return {
      cadence: parsed === 2 ? ("biweekly" as const) : ("custom" as const),
      weekday: safeWeekday,
      intervalValue: parsed,
      intervalUnit: "weeks" as const,
    };
  }
  const customDayMatch = freq.match(/every\s+(\d+)\s+days?/);
  if (customDayMatch) {
    return {
      cadence: "custom" as const,
      weekday: safeWeekday,
      intervalValue: Math.max(1, parseInt(customDayMatch[1], 10) || 1),
      intervalUnit: "days" as const,
    };
  }
  if (freq.includes("week")) {
    return { cadence: "weekly" as const, weekday: safeWeekday, intervalValue: 1, intervalUnit: "weeks" as const };
  }
  return { cadence: "daily" as const, weekday: safeWeekday, intervalValue: 1, intervalUnit: "days" as const };
}

/** Legacy meds without the field keep current notification behavior (enabled). */
export function resolveRemindersEnabled(med: Pick<Medication, "remindersEnabled"> | null | undefined): boolean {
  return med?.remindersEnabled !== false;
}

export function createEmptyDose(partial?: Partial<GuidedDoseDraft>): GuidedDoseDraft {
  const timeOfDay = partial?.timeOfDay ?? "Morning";
  return {
    id: partial?.id ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    amount: partial?.amount ?? "",
    unit: partial?.unit ?? "mg",
    timeOfDay,
    reminderTime: partial?.reminderTime ?? defaultReminderTimeFor(timeOfDay),
    optionalNotes: partial?.optionalNotes ?? "",
  };
}

export function createEmptyDraft(owner: RecordOwner = "self"): AddMedicationDraft {
  return {
    name: "",
    imageUri: "",
    entryOwner: owner,
    medicationType: null,
    doses: [createEmptyDose()],
    route: "",
    reminderCadence: "daily",
    reminderWeekday: jsDayToExpoWeekday(new Date().getDay()),
    reminderIntervalValue: "3",
    reminderIntervalUnit: "days",
    remindersEnabled: true,
    source: "manual",
  };
}

export function draftFromMedication(med: Medication): AddMedicationDraft {
  const doses =
    Array.isArray(med.doses) && med.doses.length > 0
      ? med.doses.map((d) =>
          createEmptyDose({
            id: d.id,
            amount: d.amount,
            unit: d.unit,
            timeOfDay: d.timeOfDay || (med.medicationType === "prn" ? "As Needed" : "Morning"),
            reminderTime: d.reminderTime ?? defaultReminderTimeFor(d.timeOfDay || "Morning"),
            optionalNotes: d.optionalNotes ?? "",
          }),
        )
      : [
          createEmptyDose({
            amount: med.dosage ?? "",
            unit: med.unit ?? "mg",
            timeOfDay: med.medicationType === "prn" ? "As Needed" : "Morning",
          }),
        ];
  const cadence = inferMedicationCadence(med);
  return {
    name: med.name ?? "",
    imageUri: med.imageUri ?? "",
    entryOwner: med.entryOwner ?? "self",
    medicationType: med.medicationType ?? "scheduled",
    doses,
    route: med.route ?? "",
    reminderCadence: cadence.cadence,
    reminderWeekday: cadence.weekday,
    reminderIntervalValue: String(cadence.intervalValue),
    reminderIntervalUnit: cadence.intervalUnit,
    remindersEnabled: resolveRemindersEnabled(med),
    source: med.source ?? "manual",
  };
}

export function draftFromScan(fields: {
  name: string;
  dosage?: string;
  unit?: string;
  entryOwner?: RecordOwner;
}): AddMedicationDraft {
  const draft = createEmptyDraft(fields.entryOwner ?? "self");
  draft.name = fields.name.trim();
  draft.source = "scan";
  draft.medicationType = "scheduled";
  draft.doses = [
    createEmptyDose({
      amount: (fields.dosage ?? "").trim(),
      unit: (fields.unit ?? "mg").trim() || "mg",
      timeOfDay: "Morning",
    }),
  ];
  // Scanned values are unverified — do not auto-enable reminders as confirmed times.
  draft.remindersEnabled = false;
  return draft;
}

export function canContinueIdentity(draft: AddMedicationDraft): boolean {
  return draft.name.trim().length > 0;
}

export function canContinueHow(draft: AddMedicationDraft): boolean {
  if (!draft.medicationType) return false;
  const doses = draft.doses.filter((d) => d.amount.trim().length > 0 && d.unit.trim().length > 0);
  if (doses.length === 0) return false;
  if (draft.medicationType === "scheduled") {
    return doses.every((d) => d.timeOfDay.trim().length > 0);
  }
  return true;
}

export function canContinueWhen(draft: AddMedicationDraft): boolean {
  if (draft.medicationType !== "scheduled") return true;
  if (draft.reminderCadence === "custom") {
    const n = parseInt(draft.reminderIntervalValue, 10);
    if (!draft.reminderIntervalValue.trim() || Number.isNaN(n) || n < 1) return false;
  }
  if (draft.remindersEnabled) {
    const doses = draft.doses.filter((d) => d.amount.trim().length > 0);
    return doses.every((d) => d.reminderTime.trim().length > 0);
  }
  return true;
}

export function canSaveDraft(draft: AddMedicationDraft): boolean {
  return canContinueIdentity(draft) && canContinueHow(draft) && canContinueWhen(draft);
}

export type BuildMedicationOptions = {
  /** Existing medication when editing — advanced fields are preserved. */
  existing?: Medication | null;
  /** Whether to keep active flag from existing (default true). */
  preserveActive?: boolean;
};

/**
 * Builds a medication payload from the guided draft.
 * Does not invent reminder times when reminders are disabled.
 * Preserves advanced fields (inventory, stress dose, doctor, pharmacy) from existing.
 */
export function buildMedicationPayload(
  draft: AddMedicationDraft,
  options: BuildMedicationOptions = {},
): Omit<Medication, "id"> {
  const existing = options.existing ?? null;
  const isPrn = draft.medicationType === "prn";
  const parsedIntervalValue = Math.max(1, parseInt(draft.reminderIntervalValue, 10) || 1);
  const frequency = isPrn
    ? "As Needed"
    : formatMedicationFrequencyLabel(
        draft.reminderCadence,
        draft.reminderWeekday,
        parsedIntervalValue,
        draft.reminderIntervalUnit,
      );

  const doses: MedicationDose[] = draft.doses
    .filter((d) => d.amount.trim().length > 0)
    .map((d) => {
      const timeOfDay = isPrn ? "As Needed" : d.timeOfDay;
      const reminderTime =
        !isPrn && draft.remindersEnabled ? d.reminderTime.trim() || undefined : undefined;
      return {
        id: d.id || `dose-${Date.now()}`,
        amount: d.amount.trim(),
        unit: d.unit.trim() || "mg",
        timeOfDay,
        reminderTime,
        optionalNotes: d.optionalNotes.trim() || undefined,
      };
    });

  const guided: Omit<Medication, "id"> = {
    name: draft.name.trim(),
    imageUri: draft.imageUri.trim() || undefined,
    medicationType: draft.medicationType ?? "scheduled",
    frequency,
    route: isPrn ? existing?.route : draft.route.trim() || existing?.route || undefined,
    emoji: existing?.emoji ?? "",
    doctorId: existing?.doctorId,
    pharmacyId: isPrn ? undefined : existing?.pharmacyId,
    pharmacyName: isPrn ? undefined : existing?.pharmacyName,
    pharmacyPhone: isPrn ? undefined : existing?.pharmacyPhone,
    pharmacyAddress: isPrn ? undefined : existing?.pharmacyAddress,
    pharmacyHospital: isPrn ? undefined : existing?.pharmacyHospital,
    reminderCadence: isPrn ? undefined : draft.reminderCadence,
    reminderWeekday: isPrn
      ? undefined
      : draft.reminderCadence === "weekly" ||
          draft.reminderCadence === "biweekly" ||
          (draft.reminderCadence === "custom" && draft.reminderIntervalUnit === "weeks")
        ? draft.reminderWeekday
        : undefined,
    reminderIntervalValue: isPrn
      ? undefined
      : draft.reminderCadence === "custom"
        ? parsedIntervalValue
        : draft.reminderCadence === "biweekly"
          ? 2
          : undefined,
    reminderIntervalUnit: isPrn
      ? undefined
      : draft.reminderCadence === "custom"
        ? draft.reminderIntervalUnit
        : draft.reminderCadence === "biweekly"
          ? "weeks"
          : undefined,
    remindersEnabled: isPrn ? false : draft.remindersEnabled,
    doses,
    active: options.preserveActive === false ? true : (existing?.active ?? true),
    entryOwner: draft.entryOwner,
    source: draft.source ?? existing?.source ?? "manual",
    // Preserve advanced / safety-critical fields
    inventoryUnit: isPrn ? undefined : existing?.inventoryUnit,
    currentSupplyAmount: isPrn ? undefined : existing?.currentSupplyAmount,
    amountPerRefill: isPrn ? undefined : existing?.amountPerRefill,
    refillsRemaining: isPrn ? undefined : existing?.refillsRemaining,
    supplyPerDose: isPrn ? undefined : existing?.supplyPerDose,
    lowSupplyThreshold: isPrn ? undefined : existing?.lowSupplyThreshold,
    concentrationMgPerMl: isPrn ? undefined : existing?.concentrationMgPerMl,
    totalPills: isPrn ? undefined : existing?.totalPills,
    pillsRemaining: isPrn ? undefined : existing?.pillsRemaining,
    refillUnit: isPrn ? undefined : existing?.refillUnit,
    hasStressDose: isPrn ? false : existing?.hasStressDose,
    stressDoseAmount: isPrn ? undefined : existing?.stressDoseAmount,
    stressDoseFrequency: isPrn ? undefined : existing?.stressDoseFrequency,
    stressDoseDurationDays: isPrn ? undefined : existing?.stressDoseDurationDays,
    stressDoseInstructions: isPrn ? undefined : existing?.stressDoseInstructions,
  };

  return guided;
}

export function timeTagsForSettings(ramadanMode: boolean): string[] {
  const base = ["Morning", "Afternoon", "Night"];
  if (ramadanMode) return [...base, "Before Fajr", "After Iftar"];
  return base;
}

export function nextGuidedStep(current: GuidedStepId, medicationType: MedicationType | null): GuidedStepId | null {
  if (current === "identity") return "how";
  if (current === "how") return medicationType === "prn" ? "review" : "when";
  if (current === "when") return "review";
  if (current === "review") return "success";
  return null;
}

export function previousGuidedStep(current: GuidedStepId, medicationType: MedicationType | null): GuidedStepId | null {
  if (current === "how") return "identity";
  if (current === "when") return "how";
  if (current === "review") return medicationType === "prn" ? "how" : "when";
  if (current === "success") return "review";
  return null;
}

export function guidedProgress(step: GuidedStepId, medicationType: MedicationType | null): { index: number; total: number } {
  const scheduled: GuidedStepId[] = ["identity", "how", "when", "review"];
  const prn: GuidedStepId[] = ["identity", "how", "review"];
  const steps = medicationType === "prn" ? prn : scheduled;
  const idx = steps.indexOf(step === "success" ? "review" : step);
  return { index: Math.max(0, idx), total: steps.length };
}
