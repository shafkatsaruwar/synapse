import { getToday } from "@/lib/date-utils";
import {
  appointmentStorage,
  doctorNoteStorage,
  medicationLogStorage,
  medicationStorage,
  normalizeMedication,
  type Appointment,
  type Medication,
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

/** Parse "HH:mm" (and tolerant variants) to minutes since midnight. */
function reminderTimeToMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const trimmed = hhmm.trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Count doses that are actually due/overdue right now — same rule as Medications
 * “missed” status: scheduled reminder time is in the past and not taken.
 * Future doses later today (e.g. 11:00 while it is 5:15) do NOT count.
 */
function countDueUntakenDoses(
  medications: Medication[],
  medicationLogs: { medicationId: string; doseIndex?: number; taken?: boolean }[],
  currentMinutes: number
): number {
  return medications
    .filter((medication) => medication.active !== false && medication.medicationType !== "prn")
    .reduce((count, medication) => {
      const normalized = normalizeMedication(medication);
      const doses = normalized.doses ?? [];
      if (doses.length === 0) return count;

      let dueUntaken = 0;
      doses.forEach((dose, doseIndex) => {
        const alreadyTaken = medicationLogs.some(
          (log) => log.medicationId === medication.id && (log.doseIndex ?? 0) === doseIndex && log.taken
        );
        if (alreadyTaken) return;
        const scheduledMinutes = reminderTimeToMinutes(dose.reminderTime);
        // No known clock time → do not treat as needing attention yet.
        if (scheduledMinutes == null) return;
        if (scheduledMinutes > currentMinutes) return;
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
