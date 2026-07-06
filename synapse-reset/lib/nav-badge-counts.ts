import { getToday } from "@/lib/date-utils";
import {
  appointmentStorage,
  doctorNoteStorage,
  medicationLogStorage,
  medicationStorage,
  monthlyCheckInStorage,
  type Appointment,
} from "@/lib/storage";

export type NavBadgeCounts = Record<string, number>;

interface PendingWorkCounts {
  medications: number;
  dueAppointments: number;
  doctorNotes: number;
  monthlyCheckIn: number;
}

function isDueAppointment(appointment: Appointment, today: string): boolean {
  if (appointment.status === "completed" || appointment.status === "cancelled" || appointment.status === "rescheduled") {
    return false;
  }
  return appointment.date <= today;
}

async function getPendingWorkCounts(): Promise<PendingWorkCounts> {
  const today = getToday();
  const monthKey = today.slice(0, 7);
  const [medications, medicationLogs, appointments, doctorNotes, monthlyCheckIns] = await Promise.all([
    medicationStorage.getAll(),
    medicationLogStorage.getByDate(today),
    appointmentStorage.getAll(),
    doctorNoteStorage.getAll(),
    monthlyCheckInStorage.getAll(),
  ]);

  const medicationCount = medications
    .filter((medication) => medication.active !== false && medication.medicationType !== "prn")
    .reduce((count, medication) => {
      const doseCount = Math.max(1, medication.doses?.length ?? 1);
      const takenCount = Array.from({ length: doseCount }, (_, doseIndex) =>
        medicationLogs.some((log) => log.medicationId === medication.id && (log.doseIndex ?? 0) === doseIndex && log.taken)
      ).filter(Boolean).length;
      return count + Math.max(0, doseCount - takenCount);
    }, 0);

  const appointmentCount = appointments.filter((appointment) => isDueAppointment(appointment, today)).length;
  const doctorNoteCount = doctorNotes.filter((note) => !!note?.text && !note.talkedAbout).length;
  const monthlyCheckInDone = monthlyCheckIns.some((checkIn) => checkIn.date.slice(0, 7) === monthKey);

  return {
    medications: medicationCount,
    dueAppointments: appointmentCount,
    doctorNotes: doctorNoteCount,
    monthlyCheckIn: monthlyCheckInDone ? 0 : 1,
  };
}

export async function getNavBadgeCounts(): Promise<NavBadgeCounts> {
  const counts = await getPendingWorkCounts();
  return {
    medications: counts.medications,
    appointments: counts.dueAppointments + counts.doctorNotes,
    doctors: counts.doctorNotes,
    monthlycheckin: counts.monthlyCheckIn,
  };
}

export async function getHomeScreenBadgeCount(): Promise<number> {
  const counts = await getPendingWorkCounts();
  return counts.medications + counts.dueAppointments + counts.doctorNotes + counts.monthlyCheckIn;
}
