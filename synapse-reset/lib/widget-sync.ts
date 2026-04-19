import { NativeModules, Platform } from "react-native";
import {
  appointmentStorage,
  healthProfileStorage,
  medicationLogStorage,
  medicationStorage,
  normalizeMedication,
  type Appointment,
  type Medication,
  type MedicationDose,
  type WidgetAppearancePreference,
} from "@/lib/storage";

type WidgetSnapshot = {
  appearance: WidgetAppearancePreference;
  medication: null | {
    name: string;
    detail: string;
    dueAt: string | null;
    windowStart: string | null;
    dueText: string;
    isTaken: boolean;
    nextText: string | null;
  };
  appointment: null | {
    doctorName: string;
    detail: string;
    startsAt: string | null;
    whenText: string;
  };
  updatedAt: string;
};

type NativeWidgetBridge = {
  saveSnapshot?: (payload: string) => Promise<boolean>;
};

const APP_WIDGET_BRIDGE = NativeModules.SynapseWidgetBridge as NativeWidgetBridge | undefined;

function getDoseSortMinutes(dose: MedicationDose) {
  if (dose.reminderTime?.includes(":")) {
    const [h, m] = dose.reminderTime.split(":").map((part) => parseInt(part, 10));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }
  const label = dose.timeOfDay.toLowerCase();
  if (label.includes("morning")) return 8 * 60;
  if (label.includes("afternoon")) return 13 * 60;
  if (label.includes("evening")) return 18 * 60;
  if (label.includes("night")) return 21 * 60;
  return 9 * 60;
}

function doseDetail(dose: MedicationDose) {
  if (dose.amount?.trim()) {
    return `${dose.amount.trim()} ${dose.unit?.trim() || ""} • ${dose.timeOfDay}`.trim();
  }
  return dose.timeOfDay;
}

function tomorrowAt(hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function buildMedicationWindow(sortedDoses: MedicationDose[], index: number, dueAt: Date) {
  const previousDose = index > 0 ? sortedDoses[index - 1] : sortedDoses[sortedDoses.length - 1];
  const [prevHour, prevMinute] = (previousDose.reminderTime || "09:00").split(":").map((part) => parseInt(part, 10));
  const previousDate = new Date(dueAt);
  previousDate.setHours(Number.isFinite(prevHour) ? prevHour : 9, Number.isFinite(prevMinute) ? prevMinute : 0, 0, 0);
  if (index === 0) previousDate.setDate(previousDate.getDate() - 1);
  return previousDate;
}

function getNextMedicationSnapshot(medications: Medication[], logs: { medicationId: string; doseIndex?: number; taken: boolean }[]) {
  const now = new Date();
  const pendingCandidates: Array<{
    dueAt: Date;
    windowStart: Date;
    med: Medication;
    dose: MedicationDose;
    doseIndex: number;
  }> = [];
  let takenWinner: null | {
    dueAt: Date;
    windowStart: Date;
    med: Medication;
    dose: MedicationDose;
  } = null;

  for (const rawMed of medications) {
    const med = normalizeMedication(rawMed);
    if (!med.active) continue;
    const doses = (med.doses || [])
      .filter((dose) => !!dose.reminderTime)
      .sort((a, b) => getDoseSortMinutes(a) - getDoseSortMinutes(b));
    if (!doses.length) continue;

    for (let index = 0; index < doses.length; index++) {
      const dose = doses[index];
      const [hour, minute] = (dose.reminderTime || "09:00").split(":").map((part) => parseInt(part, 10));
      const safeHour = Number.isFinite(hour) ? hour : 9;
      const safeMinute = Number.isFinite(minute) ? minute : 0;
      const takenToday = logs.some((log) => log.medicationId === med.id && (log.doseIndex ?? 0) === index && log.taken);

      if (!takenToday) {
        const dueAt = new Date(now);
        dueAt.setHours(safeHour, safeMinute, 0, 0);
        const windowStart = buildMedicationWindow(doses, index, dueAt);
        pendingCandidates.push({ dueAt, windowStart, med, dose, doseIndex: index });
      } else {
        const dueAt = tomorrowAt(safeHour, safeMinute);
        const windowStart = buildMedicationWindow(doses, index, dueAt);
        if (!takenWinner || dueAt < takenWinner.dueAt) {
          takenWinner = { dueAt, windowStart, med, dose };
        }
      }
    }
  }

  const pendingWinner =
    pendingCandidates
      .filter((candidate) => candidate.dueAt.getTime() <= now.getTime())
      .sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime())[0] ??
    pendingCandidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0] ??
    null;

  if (pendingWinner) {
    return {
      name: pendingWinner.med.name,
      detail: doseDetail(pendingWinner.dose),
      dueAt: pendingWinner.dueAt.toISOString(),
      windowStart: pendingWinner.windowStart.toISOString(),
      dueText: "Due soon",
      isTaken: false,
      nextText: null,
    };
  }

  if (takenWinner) {
    return {
      name: takenWinner.med.name,
      detail: doseDetail(takenWinner.dose),
      dueAt: takenWinner.dueAt.toISOString(),
      windowStart: takenWinner.windowStart.toISOString(),
      dueText: "Taken ✓",
      isTaken: true,
      nextText: "Next: tomorrow",
    };
  }

  return null;
}

function parseAppointmentDateTime(appointment: Appointment) {
  const date = appointment.date?.trim();
  if (!date) return null;
  const rawTime = appointment.time?.trim() || "09:00";

  let hours = 9;
  let minutes = 0;

  const amPmMatch = rawTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    hours = parseInt(amPmMatch[1], 10) % 12;
    minutes = parseInt(amPmMatch[2], 10);
    if (amPmMatch[3].toUpperCase() === "PM") hours += 12;
  } else {
    const twentyFourHourMatch = rawTime.match(/^(\d{1,2}):(\d{2})$/);
    if (twentyFourHourMatch) {
      hours = parseInt(twentyFourHourMatch[1], 10);
      minutes = parseInt(twentyFourHourMatch[2], 10);
    }
  }

  const parsed = new Date(`${date}T00:00:00`);
  parsed.setHours(hours, minutes, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAppointmentWhen(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date) + " • " + new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function simplifyAppointmentDetail(detail?: string) {
  const raw = detail?.trim();
  if (!raw) return "Visit";
  let normalized = raw
    .replace(/\bphysician\b/gi, "")
    .replace(/\bdoctor\b/gi, "")
    .replace(/\bprovider\b/gi, "")
    .replace(/\bclinic\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) normalized = raw;

  const words = normalized.split(" ");
  if (words.length > 2) {
    normalized = words.slice(0, 2).join(" ");
  }

  return normalized;
}

function getNextAppointmentSnapshot(appointments: Appointment[]) {
  const now = new Date();
  const graceWindowMs = 1000 * 60 * 60 * 2;
  const upcoming = appointments
    .filter((appointment) => appointment.status === undefined || appointment.status === "rescheduled")
    .map((appointment) => ({ appointment, startsAt: parseAppointmentDateTime(appointment) }))
    .filter(
      (item): item is { appointment: Appointment; startsAt: Date } =>
        !!item.startsAt && item.startsAt.getTime() >= now.getTime() - graceWindowMs
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  if (!upcoming.length) return null;
  const { appointment, startsAt } = upcoming[0];
  return {
    doctorName: appointment.doctorName || "Appointment",
    detail: simplifyAppointmentDetail(appointment.specialty || appointment.location || "Upcoming visit"),
    startsAt: startsAt.toISOString(),
    whenText: formatAppointmentWhen(startsAt),
  };
}

export async function syncWidgetSnapshot() {
  if (Platform.OS !== "ios" || !APP_WIDGET_BRIDGE?.saveSnapshot) return;

  const [medications, appointments, profile] = await Promise.all([
    medicationStorage.getAll(),
    appointmentStorage.getAll(),
    healthProfileStorage.get(),
  ]);
  const logs = await medicationLogStorage.getByDate(new Date().toISOString().slice(0, 10));

  const snapshot: WidgetSnapshot = {
    appearance: profile.widgetAppearance ?? "system",
    medication: getNextMedicationSnapshot(medications, logs),
    appointment: getNextAppointmentSnapshot(appointments),
    updatedAt: new Date().toISOString(),
  };

  await APP_WIDGET_BRIDGE.saveSnapshot(JSON.stringify(snapshot));
}
