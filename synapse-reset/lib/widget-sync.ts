import { NativeModules, Platform } from "react-native";
import {
  appointmentStorage,
  medicationStorage,
  normalizeMedication,
  type Appointment,
  type Medication,
  type MedicationDose,
} from "@/lib/storage";

type WidgetSnapshot = {
  medication: null | {
    name: string;
    detail: string;
    dueAt: string | null;
    windowStart: string | null;
    dueText: string;
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

function buildMedicationWindow(sortedDoses: MedicationDose[], index: number, dueAt: Date) {
  const previousDose = index > 0 ? sortedDoses[index - 1] : sortedDoses[sortedDoses.length - 1];
  const [prevHour, prevMinute] = (previousDose.reminderTime || "09:00").split(":").map((part) => parseInt(part, 10));
  const previousDate = new Date(dueAt);
  previousDate.setHours(Number.isFinite(prevHour) ? prevHour : 9, Number.isFinite(prevMinute) ? prevMinute : 0, 0, 0);
  if (index === 0) previousDate.setDate(previousDate.getDate() - 1);
  return previousDate;
}

function getNextMedicationSnapshot(medications: Medication[]) {
  const now = new Date();
  let winner: null | {
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

    doses.forEach((dose, index) => {
      const [hour, minute] = (dose.reminderTime || "09:00").split(":").map((part) => parseInt(part, 10));
      const dueAt = new Date(now);
      dueAt.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
      if (dueAt <= now) {
        dueAt.setDate(dueAt.getDate() + 1);
      }
      const windowStart = buildMedicationWindow(doses, index, dueAt);
      if (!winner || dueAt < winner.dueAt) {
        winner = { dueAt, windowStart, med, dose };
      }
    });
  }

  if (!winner) return null;
  return {
    name: winner.med.name,
    detail: doseDetail(winner.dose),
    dueAt: winner.dueAt.toISOString(),
    windowStart: winner.windowStart.toISOString(),
    dueText: "Due soon",
  };
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
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getNextAppointmentSnapshot(appointments: Appointment[]) {
  const now = new Date();
  const upcoming = appointments
    .filter((appointment) => appointment.status === undefined)
    .map((appointment) => ({ appointment, startsAt: parseAppointmentDateTime(appointment) }))
    .filter((item): item is { appointment: Appointment; startsAt: Date } => !!item.startsAt && item.startsAt >= now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  if (!upcoming.length) return null;
  const { appointment, startsAt } = upcoming[0];
  return {
    doctorName: appointment.doctorName || "Appointment",
    detail: appointment.specialty || appointment.location || "Upcoming visit",
    startsAt: startsAt.toISOString(),
    whenText: formatAppointmentWhen(startsAt),
  };
}

export async function syncWidgetSnapshot() {
  if (Platform.OS !== "ios" || !APP_WIDGET_BRIDGE?.saveSnapshot) return;

  const [medications, appointments] = await Promise.all([
    medicationStorage.getAll(),
    appointmentStorage.getAll(),
  ]);

  const snapshot: WidgetSnapshot = {
    medication: getNextMedicationSnapshot(medications),
    appointment: getNextAppointmentSnapshot(appointments),
    updatedAt: new Date().toISOString(),
  };

  await APP_WIDGET_BRIDGE.saveSnapshot(JSON.stringify(snapshot));
}
