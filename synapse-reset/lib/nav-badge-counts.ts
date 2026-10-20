import { getToday } from "@/lib/date-utils";
import { DEFAULT_REMINDER_TIMES } from "@/lib/notification-manager";
import {
  appointmentStorage,
  doctorNoteStorage,
  medicationLogStorage,
  medicationStorage,
  type Appointment,
  type Medication,
  type MedicationDose,
} from "@/lib/storage";

export type NavBadgeCounts = Record<string, number>;

interface PendingWorkCounts {
  medications: number;
  dueAppointments: number;
  doctorNotes: number;
}

function isDueAppointment(appointment: Appointment, today: string): boolean {
  if (appointment.status === "completed" || appointment.status === "cancelled" || appointment.status === "rescheduled") {
    return false;
  }
  return appointment.date <= today;
}

function parseTimeToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function fallbackMinutesForTimeOfDay(timeOfDay?: string): number | null {
  if (!timeOfDay) return null;
  const def = DEFAULT_REMINDER_TIMES[timeOfDay] ?? DEFAULT_REMINDER_TIMES.Morning;
  return def.hour * 60 + def.minute;
}

function doseDueMinutes(dose: MedicationDose): number | null {
  return parseTimeToMinutes(dose.reminderTime) ?? fallbackMinutesForTimeOfDay(dose.timeOfDay);
}

/** Count only doses that are due/overdue right now — not later-today doses still ahead. */
function countDueUntakenDoses(medications: Medication[], medicationLogs: { medicationId: string; doseIndex?: number; taken?: boolean }[], currentMinutes: number): number {
  return medications
    .filter((medication) => medication.active !== false && medication.medicationType !== "prn")
    .reduce((count, medication) => {
      const doses = Array.isArray(medication.doses) && medication.doses.length > 0 ? medication.doses : [];
      if (doses.length === 0) {
        // Legacy single-dose meds without a doses array: treat as due in the morning window.
        const alreadyTaken = medicationLogs.some(
          (log) => log.medicationId === medication.id && (log.doseIndex ?? 0) === 0 && log.taken
        );
        const morningDue = fallbackMinutesForTimeOfDay("Morning") ?? 8 * 60;
        return count + (!alreadyTaken && morningDue <= currentMinutes ? 1 : 0);
      }
      let dueUntaken = 0;
      doses.forEach((dose, doseIndex) => {
        const alreadyTaken = medicationLogs.some(
          (log) => log.medicationId === medication.id && (log.doseIndex ?? 0) === doseIndex && log.taken
        );
        if (alreadyTaken) return;
        const dueAt = doseDueMinutes(dose);
        if (dueAt == null || dueAt > currentMinutes) return;
        dueUntaken += 1;
      });
      return count + dueUntaken;
    }, 0);
}

async function getPendingWorkCounts(): Promise<PendingWorkCounts> {
  const today = getToday();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [medications, medicationLogs, appointments, doctorNotes] = await Promise.all([
    medicationStorage.getAll(),
    medicationLogStorage.getByDate(today),
    appointmentStorage.getAll(),
    doctorNoteStorage.getAll(),
  ]);

  const medicationCount = countDueUntakenDoses(medications, medicationLogs, currentMinutes);
  const appointmentCount = appointments.filter((appointment) => isDueAppointment(appointment, today)).length;
  const doctorNoteCount = doctorNotes.filter((note) => !!note?.text && !note.talkedAbout).length;

  return {
    medications: medicationCount,
    dueAppointments: appointmentCount,
    doctorNotes: doctorNoteCount,
  };
}

/**
 * Badges for navigation chrome.
 * Only actionable medication / appointment work — no optional monthly check-in,
 * and no duplicate roll-ups onto category hubs.
 * Medication badges count due/overdue untaken doses only (not future doses today).
 */
export async function getNavBadgeCounts(): Promise<NavBadgeCounts> {
  const counts = await getPendingWorkCounts();
  return {
    medications: counts.medications,
    appointments: counts.dueAppointments,
  };
}

/** Home-screen / app-icon style aggregate of actionable pending work. */
export async function getHomeScreenBadgeCount(): Promise<number> {
  const counts = await getPendingWorkCounts();
  return counts.medications + counts.dueAppointments;
}
