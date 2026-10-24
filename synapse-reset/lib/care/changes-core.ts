/**
 * Pure logic for change proposals (edit access). No storage, no native modules.
 * A proposal is only ever a request: it is validated here, shown to the owner, and applied only
 * for the changes the owner accepts.
 */
import type { AppointmentChangeFields, ChangeSet, ConfirmationChangeFields, MedicationChangeFields, ProposedChange } from "./types";

export const MAX_CHANGES = 40;

const str = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function realDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !DATE.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : v;
}

function medFields(raw: unknown): MedicationChangeFields {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: MedicationChangeFields = {};
  const name = str(r.name, 80);
  if (name) out.name = name;
  const amount = str(r.amount, 20);
  if (amount) out.amount = amount;
  const unit = str(r.unit, 20);
  if (unit) out.unit = unit;
  if (Array.isArray(r.times)) out.times = r.times.filter((t): t is string => typeof t === "string" && HHMM.test(t)).slice(0, 12);
  if (Array.isArray(r.weekdays)) out.weekdays = r.weekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 7);
  return out;
}

function apptFields(raw: unknown): AppointmentChangeFields {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: AppointmentChangeFields = {};
  const date = realDate(r.date);
  if (date) out.date = date;
  if (typeof r.time === "string" && HHMM.test(r.time)) out.time = r.time;
  const doctor = str(r.doctorName, 80);
  if (doctor) out.doctorName = doctor;
  const location = str(r.location, 120);
  if (location) out.location = location;
  return out;
}

function confirmFields(raw: unknown): ConfirmationChangeFields {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ConfirmationChangeFields = {};
  const key = str(r.medicationKey, 64);
  if (key) out.medicationKey = key;
  const name = str(r.medicationName, 80);
  if (name) out.medicationName = name;
  const date = realDate(r.date);
  if (date) out.date = date;
  if (Number.isInteger(r.doseIndex) && (r.doseIndex as number) >= 0 && (r.doseIndex as number) < 24) out.doseIndex = r.doseIndex as number;
  return out;
}

/** Re-validates a decrypted change set. Anything unknown or malformed is dropped, never trusted. */
export function sanitizeChangeSet(raw: unknown): ChangeSet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.schema !== 1 || r.kind !== "changes" || !Array.isArray(r.changes)) return null;
  const seen = new Set<string>();
  const changes: ProposedChange[] = [];
  for (const item of r.changes.slice(0, MAX_CHANGES)) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const id = str(c.id, 64);
    if (!id || seen.has(id)) continue;
    const key = str(c.key, 64);
    if (c.category === "med_schedule") {
      if (c.op === "add") {
        const after = medFields(c.after);
        if (!after.name || !after.times?.length) continue;
        changes.push({ id, category: "med_schedule", op: "add", after });
      } else if (c.op === "update" && key) {
        const after = medFields(c.after);
        if (Object.keys(after).length === 0) continue;
        changes.push({ id, category: "med_schedule", op: "update", key, before: medFields(c.before), after });
      } else if (c.op === "stop" && key) {
        changes.push({ id, category: "med_schedule", op: "stop", key, before: medFields(c.before) });
      } else continue;
    } else if (c.category === "upcoming_appointments") {
      if (c.op === "add") {
        const after = apptFields(c.after);
        if (!after.date) continue;
        changes.push({ id, category: "upcoming_appointments", op: "add", after });
      } else if (c.op === "update" && key) {
        const after = apptFields(c.after);
        if (Object.keys(after).length === 0) continue;
        changes.push({ id, category: "upcoming_appointments", op: "update", key, before: apptFields(c.before), after });
      } else if (c.op === "cancel" && key) {
        changes.push({ id, category: "upcoming_appointments", op: "cancel", key, before: apptFields(c.before) });
      } else continue;
    } else if (c.category === "med_confirmations" && c.op === "confirm") {
      const after = confirmFields(c.after);
      if (!after.medicationKey || !after.date) continue;
      changes.push({ id, category: "med_confirmations", op: "confirm", after });
    } else continue;
    seen.add(id);
  }
  return {
    schema: 1,
    kind: "changes",
    senderName: str(r.senderName, 60) ?? "Someone",
    senderTimeZone: str(r.senderTimeZone, 64) ?? "UTC",
    baseExportedAt: str(r.baseExportedAt, 40),
    changes,
  };
}

export function timeOfDayFor(hhmm: string): string {
  const hour = Number(hhmm.split(":")[0]);
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}

/** Plain-language one-liner, used in previews and the local edit history. */
export function describeChange(c: ProposedChange): string {
  const times = (t?: string[]) => (t && t.length ? t.join(", ") : "");
  switch (c.category) {
    case "med_schedule":
      if (c.op === "add") return `Add ${c.after.name}${c.after.amount ? ` ${c.after.amount} ${c.after.unit ?? ""}`.trimEnd() : ""} at ${times(c.after.times)}`;
      if (c.op === "stop") return `Stop ${c.before.name ?? "a medication"}`;
      return `Change ${c.before.name ?? "a medication"}`;
    case "upcoming_appointments":
      if (c.op === "add") return `Add appointment on ${c.after.date}${c.after.time ? ` at ${c.after.time}` : ""}${c.after.doctorName ? ` with ${c.after.doctorName}` : ""}`;
      if (c.op === "cancel") return `Cancel appointment on ${c.before.date ?? "a day"}`;
      return `Change appointment on ${c.before.date ?? "a day"}`;
    case "med_confirmations":
      return `Mark ${c.after.medicationName ?? "a dose"} as taken on ${c.after.date}`;
  }
}

/** Field-by-field before/after lines for an update. */
export function describeFieldChanges(before: Record<string, unknown>, after: Record<string, unknown>): { field: string; from: string; to: string }[] {
  const label: Record<string, string> = { name: "Name", amount: "Amount", unit: "Unit", times: "Times", weekdays: "Days", date: "Date", time: "Time", doctorName: "Doctor", location: "Place" };
  const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v === undefined || v === "" ? "not set" : String(v));
  return Object.keys(after).map((k) => ({ field: label[k] ?? k, from: show(before[k]), to: show(after[k]) }));
}

/** Fields the proposer believed were current but that no longer match the owner's record. */
export function conflictingFields(before: Record<string, unknown>, current: Record<string, unknown>): string[] {
  return Object.keys(before).filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(current[k] ?? null));
}
