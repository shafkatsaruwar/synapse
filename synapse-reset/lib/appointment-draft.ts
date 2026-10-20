/**
 * Guided Add Appointment draft helpers.
 * Explicit date/time confirmation — never invent a silent 09:00 default for new manual creates.
 */
import type {
  Appointment,
  AppointmentSource,
  Doctor,
  RecordOwner,
  RepeatUnit,
} from "@/lib/storage";

export type AppointmentGuidedStepId = "who" | "when" | "where" | "review" | "success";

export type AppointmentRepeatOption = "none" | "week" | "2weeks" | "month" | "custom";

export type AddAppointmentDraft = {
  /** Free-text name when no linked doctor. */
  doctorName: string;
  /** Linked doctor id when selected from directory. */
  doctorId?: string;
  specialty: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm — only valid for save when timeConfirmed. */
  time: string;
  /** User explicitly picked or confirmed the time. */
  timeConfirmed: boolean;
  endTime: string;
  endTimeConfirmed: boolean;
  location: string;
  /** Snapshot of doctor default location when doctor was selected (for display). */
  doctorDefaultLocation: string;
  arrivalInstructions: string;
  notes: string;
  entryOwner: RecordOwner;
  repeatOption: AppointmentRepeatOption;
  customInterval: string;
  customUnit: RepeatUnit;
  source?: AppointmentSource;
};

export const APPOINTMENT_REPEAT_OPTIONS: {
  value: AppointmentRepeatOption;
  label: string;
  interval?: number;
  unit?: RepeatUnit;
}[] = [
  { value: "none", label: "Does not repeat" },
  { value: "week", label: "Every week", interval: 1, unit: "week" },
  { value: "2weeks", label: "Every 2 weeks", interval: 2, unit: "week" },
  { value: "month", label: "Every month", interval: 1, unit: "month" },
  { value: "custom", label: "Custom" },
];

export function todayLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateStringToLocalDate(value: string): Date {
  const fallback = new Date();
  fallback.setHours(12, 0, 0, 0);
  if (!value) return fallback;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function localDateToDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function timeStringToDate(value: string): Date {
  const [h, m] = (value || "09:00").split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export function dateToTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatTime12h(hhmm: string): string {
  const [h, m] = (hhmm || "00:00").split(":").map((n) => parseInt(n, 10) || 0);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatReadableDate(dateStr: string): string {
  const d = dateStringToLocalDate(dateStr);
  try {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function createEmptyAppointmentDraft(owner: RecordOwner = "self"): AddAppointmentDraft {
  return {
    doctorName: "",
    doctorId: undefined,
    specialty: "",
    date: todayLocalDateString(),
    time: "",
    timeConfirmed: false,
    endTime: "",
    endTimeConfirmed: false,
    location: "",
    doctorDefaultLocation: "",
    arrivalInstructions: "",
    notes: "",
    entryOwner: owner,
    repeatOption: "none",
    customInterval: "1",
    customUnit: "week",
    source: "manual",
  };
}

export function draftFromAppointment(apt: Appointment, doctors: Doctor[] = []): AddAppointmentDraft {
  const linked = apt.doctor_id ? doctors.find((d) => d.id === apt.doctor_id) : undefined;
  const doctorDefaultLocation = linked?.hospital?.trim() || linked?.address?.trim() || "";
  return {
    doctorName: apt.doctorName ?? "",
    doctorId: apt.doctor_id,
    specialty: apt.specialty ?? linked?.specialty ?? "",
    date: apt.date || todayLocalDateString(),
    time: apt.time || "",
    timeConfirmed: !!apt.time?.trim(),
    endTime: apt.endTime || "",
    endTimeConfirmed: !!apt.endTime?.trim(),
    location: apt.location || "",
    doctorDefaultLocation,
    arrivalInstructions: apt.arrivalInstructions || "",
    notes: apt.notes || "",
    entryOwner: apt.entryOwner ?? "self",
    repeatOption: "none",
    customInterval: "1",
    customUnit: "week",
    source: apt.source ?? "manual",
  };
}

export function draftFromImport(fields: {
  doctorName: string;
  specialty?: string;
  date?: string;
  time?: string;
  location?: string;
  notes?: string;
  entryOwner?: RecordOwner;
  source?: AppointmentSource;
  doctorId?: string;
}): AddAppointmentDraft {
  const draft = createEmptyAppointmentDraft(fields.entryOwner ?? "self");
  draft.doctorName = fields.doctorName.trim();
  draft.doctorId = fields.doctorId;
  draft.specialty = fields.specialty?.trim() ?? "";
  if (fields.date?.trim()) draft.date = fields.date.trim();
  if (fields.time?.trim()) {
    draft.time = fields.time.trim();
    draft.timeConfirmed = true;
  }
  draft.location = fields.location?.trim() ?? "";
  draft.notes = fields.notes?.trim() ?? "";
  draft.source = fields.source ?? "import";
  return draft;
}

export function applyDoctorToDraft(draft: AddAppointmentDraft, doctor: Doctor): AddAppointmentDraft {
  const defaultLocation = doctor.hospital?.trim() || doctor.address?.trim() || "";
  return {
    ...draft,
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: doctor.specialty?.trim() || draft.specialty,
    doctorDefaultLocation: defaultLocation,
    // Prefill location only when user hasn't set a custom one yet.
    location: draft.location.trim() ? draft.location : defaultLocation,
  };
}

/** Clear linked doctor but keep typed name. Does not create a Doctor record. */
export function clearLinkedDoctor(draft: AddAppointmentDraft, keepName?: string): AddAppointmentDraft {
  return {
    ...draft,
    doctorId: undefined,
    doctorName: keepName ?? draft.doctorName,
    specialty: draft.doctorId ? "" : draft.specialty,
    doctorDefaultLocation: "",
  };
}

export function canContinueWho(draft: AddAppointmentDraft): boolean {
  return draft.doctorName.trim().length > 0;
}

export function canContinueWhen(draft: AddAppointmentDraft): boolean {
  if (!draft.date.trim()) return false;
  if (!draft.timeConfirmed || !draft.time.trim()) return false;
  if (draft.endTimeConfirmed && draft.endTime.trim()) {
    if (draft.endTime <= draft.time) return false;
  }
  if (draft.repeatOption === "custom") {
    const n = parseInt(draft.customInterval, 10);
    if (!draft.customInterval.trim() || Number.isNaN(n) || n < 1) return false;
  }
  return true;
}

export function canContinueWhere(_draft: AddAppointmentDraft): boolean {
  return true; // location is optional / skippable
}

export function canSaveAppointmentDraft(draft: AddAppointmentDraft): boolean {
  return canContinueWho(draft) && canContinueWhen(draft);
}

export function formatRecurrenceLabel(draft: AddAppointmentDraft): string | null {
  if (draft.repeatOption === "none") return null;
  const opt = APPOINTMENT_REPEAT_OPTIONS.find((o) => o.value === draft.repeatOption);
  if (!opt) return null;
  if (draft.repeatOption === "custom") {
    const n = Math.max(1, parseInt(draft.customInterval, 10) || 1);
    return `Every ${n} ${draft.customUnit}${n === 1 ? "" : "s"}`;
  }
  return opt.label;
}

function defaultRepeatEndDate(startDate: string): string {
  const end = new Date(`${startDate}T12:00:00`);
  end.setMonth(end.getMonth() + 6);
  return localDateToDateString(end);
}

export type BuildAppointmentOptions = {
  existing?: Appointment | null;
};

/**
 * Builds appointment payload. Requires confirmed time.
 * Does not invent 09:00. Does not auto-create doctor records.
 * Appointment location is independent of the doctor's saved address.
 */
export function buildAppointmentPayload(
  draft: AddAppointmentDraft,
  options: BuildAppointmentOptions = {},
): Omit<Appointment, "id"> {
  if (!canSaveAppointmentDraft(draft)) {
    throw new Error("Appointment draft is incomplete");
  }
  const existing = options.existing ?? null;
  const base: Omit<Appointment, "id"> = {
    doctor_id: draft.doctorId,
    doctorName: draft.doctorName.trim(),
    specialty: draft.specialty.trim(),
    date: draft.date.trim(),
    time: draft.time.trim(),
    endTime: draft.endTimeConfirmed && draft.endTime.trim() ? draft.endTime.trim() : undefined,
    location: draft.location.trim(),
    notes: draft.notes.trim(),
    arrivalInstructions: draft.arrivalInstructions.trim() || undefined,
    entryOwner: draft.entryOwner,
    source: draft.source ?? existing?.source ?? "manual",
    status: existing?.status,
    monthlyReviewOccurred: existing?.monthlyReviewOccurred,
    monthlyReviewOccurredAt: existing?.monthlyReviewOccurredAt,
    parent_recurring_id: existing?.parent_recurring_id,
  };

  // Only set recurrence on create (not when editing a single occurrence via this builder).
  if (!existing) {
    const opt = APPOINTMENT_REPEAT_OPTIONS.find((o) => o.value === draft.repeatOption);
    if (opt && opt.value !== "none" && opt.value !== "custom" && opt.interval != null && opt.unit) {
      base.is_recurring = true;
      base.repeat_interval = opt.interval;
      base.repeat_unit = opt.unit;
      base.repeat_end_date = defaultRepeatEndDate(draft.date);
    } else if (draft.repeatOption === "custom") {
      const n = Math.max(1, parseInt(draft.customInterval, 10) || 1);
      base.is_recurring = true;
      base.repeat_interval = n;
      base.repeat_unit = draft.customUnit;
      base.repeat_end_date = defaultRepeatEndDate(draft.date);
    }
  } else {
    base.is_recurring = existing.is_recurring;
    base.repeat_interval = existing.repeat_interval;
    base.repeat_unit = existing.repeat_unit;
    base.repeat_end_date = existing.repeat_end_date;
  }

  return base;
}

export function nextAppointmentStep(current: AppointmentGuidedStepId): AppointmentGuidedStepId | null {
  if (current === "who") return "when";
  if (current === "when") return "where";
  if (current === "where") return "review";
  if (current === "review") return "success";
  return null;
}

export function previousAppointmentStep(current: AppointmentGuidedStepId): AppointmentGuidedStepId | null {
  if (current === "when") return "who";
  if (current === "where") return "when";
  if (current === "review") return "where";
  if (current === "success") return "review";
  return null;
}

export function appointmentGuidedProgress(step: AppointmentGuidedStepId): { index: number; total: number } {
  const steps: AppointmentGuidedStepId[] = ["who", "when", "where", "review"];
  const idx = steps.indexOf(step === "success" ? "review" : step);
  return { index: Math.max(0, idx), total: steps.length };
}
