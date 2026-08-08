import * as Linking from "expo-linking";
import {
  appointmentStorage,
  medicationLogStorage,
  medicationStorage,
  normalizeMedication,
  type Appointment,
  type Medication,
  type MedicationDose,
  type MedicationLog,
} from "@/lib/storage";
import { isMedicationScheduledOnDate } from "@/lib/medication-schedule";
import { getToday } from "@/lib/date-utils";

/** LifeOS calendar event shape (source Synapse). */
export type LifeOSCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  source: "Synapse";
  color: string;
  notes?: string;
  location?: string;
};

export type LifeOSDayPlanPayload = {
  v: 1;
  exportedAt: string;
  windowDays: number;
  events: LifeOSCalendarEvent[];
};

const MED_COLOR = "#4b8bdc";
const APPT_COLOR = "#e48b6b";
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_DOSE_TIMES: Record<string, string> = {
  Morning: "08:00",
  Afternoon: "14:00",
  Evening: "18:00",
  Night: "21:00",
  "As Needed": "09:00",
};

const LIFEOS_IMPORT_SCHEME = "lifeos://import/synapse";
/** Keep deep-link payloads under common URL practical limits. */
const MAX_DEEP_LINK_CHARS = 5500;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function addDaysKey(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateKeysInWindow(startKey: string, days: number) {
  return Array.from({ length: days }, (_, i) => addDaysKey(startKey, i));
}

function formatLocalDateTime(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseLocalDateTime(date: string, time = "09:00") {
  const parsed = new Date(`${date}T${time || "09:00"}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDoseTime(dose: MedicationDose) {
  return (
    dose.reminderTime ||
    DEFAULT_DOSE_TIMES[dose.timeOfDay] ||
    (/^\d{1,2}:\d{2}$/.test(dose.timeOfDay) ? dose.timeOfDay : "09:00")
  );
}

function getDoseLabel(dose: MedicationDose) {
  const amount = [dose.amount, dose.unit].filter(Boolean).join(" ").trim();
  return amount ? `${amount} · ${dose.timeOfDay}` : dose.timeOfDay;
}

function appointmentTitle(appointment: Appointment) {
  return appointment.doctorName || appointment.specialty || "Appointment";
}

function utf8ToBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  const btoaFn =
    typeof globalThis.btoa === "function"
      ? globalThis.btoa.bind(globalThis)
      : typeof Buffer !== "undefined"
        ? (value: string) => Buffer.from(value, "binary").toString("base64")
        : null;
  if (!btoaFn) throw new Error("Base64 encoding is unavailable on this platform.");
  return btoaFn(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcsDateTime(local: string) {
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return "";
  const [, y, m, d, h, min] = match;
  return `${y}${m}${d}T${h}${min}00`;
}

function buildMedicationEvents(
  medications: Medication[],
  logs: MedicationLog[],
  dateKeys: string[],
): LifeOSCalendarEvent[] {
  const events: LifeOSCalendarEvent[] = [];
  for (const raw of medications) {
    const med = normalizeMedication(raw);
    if (med.active === false || (med.medicationType ?? "scheduled") === "prn") continue;
    const doses = med.doses ?? [];
    if (doses.length === 0) continue;
    const medLogs = logs.filter((log) => log.medicationId === med.id);
    const anchorDateKey = medLogs.map((log) => log.date).sort()[0] ?? dateKeys[0] ?? null;

    for (const dateKey of dateKeys) {
      if (!isMedicationScheduledOnDate(med, dateKey, { anchorDateKey })) continue;
      doses.forEach((dose, doseIndex) => {
        const start = parseLocalDateTime(dateKey, getDoseTime(dose));
        if (!start) return;
        const end = new Date(start.getTime() + 15 * 60 * 1000);
        const taken = medLogs.some(
          (log) => log.date === dateKey && (log.doseIndex ?? 0) === doseIndex && log.taken,
        );
        events.push({
          id: `synapse-med-${med.id}-${dateKey}-${doseIndex}`,
          title: `${med.name || "Medication"}${taken ? " (taken)" : ""}`,
          start: formatLocalDateTime(start),
          end: formatLocalDateTime(end),
          source: "Synapse",
          color: MED_COLOR,
          notes: [getDoseLabel(dose), taken ? "Logged in Synapse" : "Medication dose", "Open Synapse to log"]
            .filter(Boolean)
            .join(" · "),
        });
      });
    }
  }
  return events;
}

function buildAppointmentEvents(appointments: Appointment[], dateKeys: string[]): LifeOSCalendarEvent[] {
  const startKey = dateKeys[0];
  const endKey = dateKeys[dateKeys.length - 1];
  if (!startKey || !endKey) return [];

  const events: LifeOSCalendarEvent[] = [];
  for (const appointment of appointments) {
    if (appointment.status != null && appointment.status !== "rescheduled") continue;
    if (appointment.date < startKey || appointment.date > endKey) continue;
    const start = parseLocalDateTime(appointment.date, appointment.time || "09:00");
    if (!start) continue;
    const end =
      (appointment.endTime ? parseLocalDateTime(appointment.date, appointment.endTime) : null) ??
      new Date(start.getTime() + 60 * 60 * 1000);
    events.push({
      id: `synapse-appt-${appointment.id}`,
      title: appointmentTitle(appointment),
      start: formatLocalDateTime(start),
      end: formatLocalDateTime(end),
      source: "Synapse",
      color: APPT_COLOR,
      location: appointment.location?.trim() || undefined,
      notes: [appointment.specialty, appointment.notes, "From Synapse"].filter(Boolean).join(" · ") || undefined,
    });
  }
  return events;
}

/** Build a LifeOS-compatible day plan from local Synapse meds + appointments. */
export async function buildLifeOSDayPlan(options?: { days?: number; today?: string }): Promise<LifeOSDayPlanPayload> {
  const windowDays = Math.max(1, Math.min(14, options?.days ?? DEFAULT_WINDOW_DAYS));
  const today = options?.today ?? getToday();
  const dateKeys = dateKeysInWindow(today, windowDays);
  const [medications, logs, appointments] = await Promise.all([
    medicationStorage.getAll(),
    medicationLogStorage.getAll(),
    appointmentStorage.getAll(),
  ]);

  const events = [
    ...buildMedicationEvents(medications, logs, dateKeys),
    ...buildAppointmentEvents(appointments, dateKeys),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return {
    v: 1,
    exportedAt: new Date().toISOString(),
    windowDays,
    events,
  };
}

export function dayPlanToJson(plan: LifeOSDayPlanPayload) {
  return JSON.stringify(plan);
}

export function dayPlanToIcs(plan: LifeOSDayPlanPayload) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Synapse//LifeOS Day Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Synapse Health",
  ];
  for (const event of plan.events) {
    const dtStart = toIcsDateTime(event.start);
    const dtEnd = toIcsDateTime(event.end || event.start);
    if (!dtStart) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@synapse.lifeos`,
      `DTSTAMP:${toIcsDateTime(formatLocalDateTime(new Date())) || dtStart}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd || dtStart}`,
      `SUMMARY:${icsEscape(event.title)}`,
    );
    if (event.notes) lines.push(`DESCRIPTION:${icsEscape(event.notes)}`);
    if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function encodeDayPlanDeepLink(plan: LifeOSDayPlanPayload): string | null {
  const payload = utf8ToBase64Url(dayPlanToJson(plan));
  const url = `${LIFEOS_IMPORT_SCHEME}?v=1&payload=${payload}`;
  if (url.length > MAX_DEEP_LINK_CHARS) return null;
  return url;
}

export function dayPlanSummary(plan: LifeOSDayPlanPayload) {
  const meds = plan.events.filter((e) => e.id.startsWith("synapse-med-")).length;
  const appts = plan.events.filter((e) => e.id.startsWith("synapse-appt-")).length;
  return {
    total: plan.events.length,
    medications: meds,
    appointments: appts,
    windowDays: plan.windowDays,
  };
}

export type ShareDayPlanResult =
  | { ok: true; mode: "deep_link"; url: string; summary: ReturnType<typeof dayPlanSummary>; plan: LifeOSDayPlanPayload }
  | { ok: true; mode: "clipboard_handoff"; url: string; json: string; summary: ReturnType<typeof dayPlanSummary>; plan: LifeOSDayPlanPayload }
  | { ok: false; error: string };

/**
 * Prefer opening LifeOS with an embedded payload. If the plan is too large for a URL,
 * open the import route and return JSON for the caller to put on the clipboard / Share sheet.
 */
export async function prepareLifeOSDayPlanShare(options?: { days?: number }): Promise<ShareDayPlanResult> {
  try {
    const plan = await buildLifeOSDayPlan(options);
    const summary = dayPlanSummary(plan);
    if (summary.total === 0) {
      return { ok: false, error: "Nothing upcoming in the next week to share. Add medications or appointments first." };
    }
    const deepLink = encodeDayPlanDeepLink(plan);
    if (deepLink) {
      return { ok: true, mode: "deep_link", url: deepLink, summary, plan };
    }
    return {
      ok: true,
      mode: "clipboard_handoff",
      url: LIFEOS_IMPORT_SCHEME,
      json: dayPlanToJson(plan),
      summary,
      plan,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not build day plan." };
  }
}

export async function openLifeOSImport(url: string) {
  const canOpen = await Linking.canOpenURL("lifeos://");
  if (!canOpen) {
    return { ok: false as const, error: "LifeOS is not installed on this device (lifeos://)." };
  }
  await Linking.openURL(url);
  return { ok: true as const };
}
