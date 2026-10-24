/** Pure helpers for sharing (no storage, no native modules) so they can be unit-tested in Node. */
import { formatInZone } from "./time-zone";
import type { SharedPayload, SharingCategory } from "./types";

export type ImportDiff = { category: SharingCategory; label: string; added: number; updated: number; unchanged: number; removed: number };

export function describePayload(p: SharedPayload): { category: SharingCategory; label: string; count: number }[] {
  const rows: { category: SharingCategory; label: string; count: number }[] = [];
  if (p.med_schedule) rows.push({ category: "med_schedule", label: "Medication schedule", count: p.med_schedule.length });
  if (p.upcoming_appointments) rows.push({ category: "upcoming_appointments", label: "Upcoming appointments", count: p.upcoming_appointments.length });
  if (p.med_confirmations) rows.push({ category: "med_confirmations", label: "Medication confirmations (7 days)", count: p.med_confirmations.length });
  if (p.selected_records) rows.push({ category: "selected_records", label: "Selected health records", count: p.selected_records.length });
  if (p.emergency_info) rows.push({ category: "emergency_info", label: "Emergency information", count: [p.emergency_info.allergies, p.emergency_info.notes].filter(Boolean).length });
  return rows;
}


const REASONS: Record<string, string> = {
  malformed: "This doesn't look like a Synapse sharing file.",
  unsupported_version: "This file was made by a newer version of Synapse. Update the app and try again.",
  wrong_recipient: "This file was made for someone else.",
  unknown_sender: "This file is from someone you haven't connected with.",
  bad_signature: "This file failed its safety check and may have been changed.",
  decrypt_failed: "This file couldn't be opened. It may be damaged or changed.",
  replayed: "You've already imported this file.",
  not_connected: "You need a verified connection with this person first.",
  invalid_payload: "This file's contents weren't in the expected format.",
};

export function importFailureMessage(reason: string): string {
  return REASONS[reason] ?? "This file couldn't be imported.";
}

const str = (v: unknown, max = 200): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const arr = <T,>(v: unknown, map: (x: Record<string, unknown>) => T | null, cap: number): T[] =>
  Array.isArray(v) ? v.slice(0, cap).map((x) => (x && typeof x === "object" ? map(x as Record<string, unknown>) : null)).filter((x): x is T => x !== null) : [];

/** Defensive re-validation: whatever the file says, only these known fields survive. */
export function sanitizePayload(raw: unknown): SharedPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.schema !== 1) return null;
  const out: SharedPayload = { schema: 1, senderName: str(r.senderName, 60) ?? "Someone", senderTimeZone: str(r.senderTimeZone, 64) ?? "UTC" };
  if (r.med_schedule !== undefined)
    out.med_schedule = arr(r.med_schedule, (m) => {
      const key = str(m.key, 64);
      const name = str(m.name, 80);
      if (!key || !name) return null;
      return {
        key,
        name,
        dose: str(m.dose, 60),
        times: Array.isArray(m.times) ? m.times.filter((t): t is string => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t)).slice(0, 12) : [],
        weekdays: Array.isArray(m.weekdays) ? m.weekdays.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6).slice(0, 7) : [],
      };
    }, 100);
  if (r.upcoming_appointments !== undefined)
    out.upcoming_appointments = arr(r.upcoming_appointments, (a) => {
      const key = str(a.key, 64);
      const date = str(a.date, 10);
      if (!key || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { key, date, time: str(a.time, 8), doctorName: str(a.doctorName, 80), location: str(a.location, 120) };
    }, 100);
  if (r.med_confirmations !== undefined)
    out.med_confirmations = arr(r.med_confirmations, (c) => {
      const key = str(c.key, 64);
      const date = str(c.date, 10);
      if (!key || !date) return null;
      return {
        key,
        medicationName: str(c.medicationName, 80) ?? "Medication",
        date,
        doseIndex: Number.isInteger(c.doseIndex) ? (c.doseIndex as number) : 0,
        taken: c.taken === true,
        recordedAt: str(c.recordedAt, 40),
        enteredBy: c.enteredBy === "caregiver" ? "caregiver" : "self",
      };
    }, 400);
  if (r.selected_records !== undefined)
    out.selected_records = arr(r.selected_records, (i) => {
      const key = str(i.key, 80);
      const label = str(i.label, 120);
      if (!key || !label || (i.kind !== "allergy" && i.kind !== "condition")) return null;
      return { key, kind: i.kind, label };
    }, 100);
  if (r.emergency_info && typeof r.emergency_info === "object") {
    const e = r.emergency_info as Record<string, unknown>;
    out.emergency_info = { allergies: str(e.allergies, 500), notes: str(e.notes, 800) };
  }
  return out;
}

export const CATEGORY_LABEL: Record<SharingCategory, string> = {
  med_schedule: "Medication schedule",
  upcoming_appointments: "Upcoming appointments",
  med_confirmations: "Medication confirmations",
  selected_records: "Selected health records",
  emergency_info: "Emergency information",
};

export function diffKeys(existing: { key: string }[] | undefined, incoming: { key: string }[]): Pick<ImportDiff, "added" | "updated" | "unchanged" | "removed"> {
  const before = new Map((existing ?? []).map((i) => [i.key, JSON.stringify(i)]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const item of incoming) {
    const prev = before.get(item.key);
    if (prev === undefined) added += 1;
    else if (prev === JSON.stringify(item)) unchanged += 1;
    else updated += 1;
    before.delete(item.key);
  }
  return { added, updated, unchanged, removed: before.size };
}


// ---------- freshness ----------

/** "Last shared update: Yesterday at 6:42 PM". Never implies the data is live. */
export function freshnessLabel(iso: string | undefined, now = new Date(), timeZone?: string): string {
  if (!iso) return "Nothing shared yet";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "Nothing shared yet";
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dayKey = (d: Date) => formatInZone(d.getTime(), tz, { year: "numeric", month: "numeric", day: "numeric" });
  const time = formatInZone(t.getTime(), tz, { hour: "numeric", minute: "2-digit" });
  if (dayKey(t) === dayKey(now)) return `Last shared update: Today at ${time}`;
  if (dayKey(t) === dayKey(new Date(now.getTime() - 86_400_000))) return `Last shared update: Yesterday at ${time}`;
  return `Last shared update: ${formatInZone(t.getTime(), tz, { month: "short", day: "numeric" })} at ${time}`;
}
