/**
 * Gentle overlap hints for appointments when enough date/time data exists.
 * Does not invent duration when endTime is missing.
 */
import type { Appointment } from "@/lib/storage";

export type AppointmentOverlapHint = {
  appointmentId: string;
  otherAppointmentId: string;
  otherDoctorName: string;
  /** Minutes between this start and the other start (absolute). */
  gapMinutes: number;
  /** True when intervals overlap given known end times; false when only close starts. */
  intervalsOverlap: boolean;
  message: string;
};

function parseStart(apt: Appointment): Date | null {
  if (!apt.date?.trim() || !apt.time?.trim()) return null;
  const d = new Date(`${apt.date.trim()}T${apt.time.trim()}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseEnd(apt: Appointment, start: Date): Date | null {
  if (!apt.endTime?.trim()) return null;
  const d = new Date(`${apt.date.trim()}T${apt.endTime.trim()}:00`);
  if (Number.isNaN(d.getTime()) || d.getTime() <= start.getTime()) return null;
  return d;
}

function isActive(apt: Appointment): boolean {
  return apt.status == null;
}

const CLOSE_START_MINUTES = 15;

/**
 * For each active appointment with a start time, find other active appointments
 * the same day that either (a) have overlapping intervals when both ends known,
 * or (b) start within CLOSE_START_MINUTES when duration is unknown.
 */
export function detectAppointmentOverlaps(appointments: Appointment[]): Map<string, AppointmentOverlapHint> {
  const hints = new Map<string, AppointmentOverlapHint>();
  const active = appointments.filter((a) => isActive(a) && parseStart(a));

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.date !== b.date) continue;

      const startA = parseStart(a)!;
      const startB = parseStart(b)!;
      const endA = parseEnd(a, startA);
      const endB = parseEnd(b, startB);
      const gapMinutes = Math.round(Math.abs(startA.getTime() - startB.getTime()) / 60000);

      let intervalsOverlap = false;
      if (endA && endB) {
        intervalsOverlap = startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
      } else if (endA) {
        intervalsOverlap = startB.getTime() >= startA.getTime() && startB.getTime() < endA.getTime();
      } else if (endB) {
        intervalsOverlap = startA.getTime() >= startB.getTime() && startA.getTime() < endB.getTime();
      }

      const closeStarts = gapMinutes > 0 && gapMinutes <= CLOSE_START_MINUTES;
      if (!intervalsOverlap && !closeStarts) continue;

      const message = intervalsOverlap
        ? `May overlap with ${b.doctorName.trim() || "another appointment"}`
        : `Starts ${gapMinutes} min from ${b.doctorName.trim() || "another appointment"}`;

      const hintA: AppointmentOverlapHint = {
        appointmentId: a.id,
        otherAppointmentId: b.id,
        otherDoctorName: b.doctorName.trim() || "another appointment",
        gapMinutes,
        intervalsOverlap,
        message,
      };
      const hintB: AppointmentOverlapHint = {
        appointmentId: b.id,
        otherAppointmentId: a.id,
        otherDoctorName: a.doctorName.trim() || "another appointment",
        gapMinutes,
        intervalsOverlap,
        message: intervalsOverlap
          ? `May overlap with ${a.doctorName.trim() || "another appointment"}`
          : `Starts ${gapMinutes} min from ${a.doctorName.trim() || "another appointment"}`,
      };

      // Keep the most severe / closest hint per appointment.
      const prevA = hints.get(a.id);
      if (!prevA || (hintA.intervalsOverlap && !prevA.intervalsOverlap) || hintA.gapMinutes < prevA.gapMinutes) {
        hints.set(a.id, hintA);
      }
      const prevB = hints.get(b.id);
      if (!prevB || (hintB.intervalsOverlap && !prevB.intervalsOverlap) || hintB.gapMinutes < prevB.gapMinutes) {
        hints.set(b.id, hintB);
      }
    }
  }

  return hints;
}
