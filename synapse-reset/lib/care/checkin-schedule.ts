import {
  addCalendarDays,
  calendarDateInZone,
  getLocalParts,
  parseHHMM,
  resolveZonedTime,
  weekdayOfCalendarDate,
  type CalendarDate,
} from "./time-zone";

const MINUTE = 60_000;

export const CHECKIN_DELAY_OPTIONS = [10, 15, 30] as const;
export const DEFAULT_CHECKIN_DELAY_MINUTES = 15;
export const MAX_CUSTOM_DELAY_MINUTES = 180;

export type QuietHours = { start: string; end: string } | null;
export type ContactWindow = { start: string; end: string } | null;

export type ReminderPostponement = {
  reason: "quiet_hours";
  originalInstant: number;
};

export type CheckInTimes = {
  /** When the schedule says the dose happens (in the schedule time zone). */
  scheduleInstant: number;
  scheduleResolution: "normal" | "gap" | "overlap";
  /** Schedule instant plus the caregiver's chosen check-in delay. */
  baseInstant: number;
  /** When the reminder will actually fire on the caregiver's device. */
  fireInstant: number;
  postponed: ReminderPostponement | null;
  /** Whether the fire time falls inside the recipient's preferred contact window (null = none set). */
  withinRecipientContactHours: boolean | null;
};

export function clampDelayMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CHECKIN_DELAY_MINUTES;
  return Math.min(MAX_CUSTOM_DELAY_MINUTES, Math.max(1, Math.round(value)));
}

function minutesOfDay(hhmm: string): number | null {
  const p = parseHHMM(hhmm);
  return p ? p.hour * 60 + p.minute : null;
}

/** True when `minute` (0..1439) is inside [start, end), including windows that span midnight. */
export function isMinuteInWindow(minute: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

/** Next instant at or after `instant` when the caregiver's quiet hours end. */
export function quietHoursEndInstant(instant: number, timeZone: string, quiet: { start: string; end: string }): number | null {
  const start = minutesOfDay(quiet.start);
  const end = minutesOfDay(quiet.end);
  if (start === null || end === null) return null;
  const local = getLocalParts(timeZone, instant);
  const minute = local.hour * 60 + local.minute;
  if (!isMinuteInWindow(minute, start, end)) return null;
  const endParts = parseHHMM(quiet.end)!;
  let date: CalendarDate = { year: local.year, month: local.month, day: local.day };
  // A window that spans midnight ends tomorrow when we are in the evening part of it.
  if (start > end && minute >= start) date = addCalendarDays(date, 1);
  let resolved = resolveZonedTime(timeZone, date.year, date.month, date.day, endParts.hour, endParts.minute).instant;
  if (resolved <= instant) {
    const next = addCalendarDays(date, 1);
    resolved = resolveZonedTime(timeZone, next.year, next.month, next.day, endParts.hour, endParts.minute).instant;
  }
  return resolved;
}

export function computeCheckInTimes(input: {
  scheduleTimeZone: string;
  /** Calendar date of the dose in the schedule's own time zone. */
  scheduleDate: CalendarDate;
  scheduleTime: string;
  delayMinutes: number;
  caregiverTimeZone: string;
  quietHours?: QuietHours;
  recipientTimeZone?: string;
  recipientContactWindow?: ContactWindow;
}): CheckInTimes | null {
  const t = parseHHMM(input.scheduleTime);
  if (!t) return null;
  const resolved = resolveZonedTime(
    input.scheduleTimeZone,
    input.scheduleDate.year,
    input.scheduleDate.month,
    input.scheduleDate.day,
    t.hour,
    t.minute,
  );
  const scheduleInstant = resolved.instant;
  const baseInstant = scheduleInstant + clampDelayMinutes(input.delayMinutes) * MINUTE;

  let fireInstant = baseInstant;
  let postponed: ReminderPostponement | null = null;
  if (input.quietHours) {
    const end = quietHoursEndInstant(baseInstant, input.caregiverTimeZone, input.quietHours);
    if (end !== null) {
      fireInstant = end;
      postponed = { reason: "quiet_hours", originalInstant: baseInstant };
    }
  }

  let within: boolean | null = null;
  if (input.recipientContactWindow && input.recipientTimeZone) {
    const s = minutesOfDay(input.recipientContactWindow.start);
    const e = minutesOfDay(input.recipientContactWindow.end);
    if (s !== null && e !== null) {
      const local = getLocalParts(input.recipientTimeZone, fireInstant);
      within = isMinuteInWindow(local.hour * 60 + local.minute, s, e);
    }
  }

  return {
    scheduleInstant,
    scheduleResolution: resolved.kind,
    baseInstant,
    fireInstant,
    postponed,
    withinRecipientContactHours: within,
  };
}

export type ScheduledDoseTime = {
  id: string;
  label: string;
  /** HH:MM in the schedule time zone. */
  time: string;
  /** 0 (Sun) .. 6 (Sat); empty or undefined means every day. */
  weekdays?: number[];
};

export type PlannedCheckIn = CheckInTimes & { doseId: string; doseLabel: string; scheduleDate: CalendarDate };

/** Plans upcoming check-in reminders (soonest first), never in the past, capped to `limit`. */
export function planUpcomingCheckIns(input: {
  now: number;
  doses: ScheduledDoseTime[];
  scheduleTimeZone: string;
  delayMinutes: number;
  caregiverTimeZone: string;
  quietHours?: QuietHours;
  recipientTimeZone?: string;
  recipientContactWindow?: ContactWindow;
  daysAhead?: number;
  limit?: number;
}): PlannedCheckIn[] {
  const days = input.daysAhead ?? 7;
  const out: PlannedCheckIn[] = [];
  // Start one day back in the schedule zone: yesterday's dose may still have a reminder due
  // (delay or quiet hours can push it past midnight, and the two people may be on different dates).
  const startDate = addCalendarDays(calendarDateInZone(input.scheduleTimeZone, input.now), -1);
  for (let i = 0; i <= days + 1; i++) {
    const date = addCalendarDays(startDate, i);
    const weekday = weekdayOfCalendarDate(date);
    for (const dose of input.doses) {
      if (dose.weekdays && dose.weekdays.length > 0 && !dose.weekdays.includes(weekday)) continue;
      const times = computeCheckInTimes({
        scheduleTimeZone: input.scheduleTimeZone,
        scheduleDate: date,
        scheduleTime: dose.time,
        delayMinutes: input.delayMinutes,
        caregiverTimeZone: input.caregiverTimeZone,
        quietHours: input.quietHours,
        recipientTimeZone: input.recipientTimeZone,
        recipientContactWindow: input.recipientContactWindow,
      });
      if (!times || times.fireInstant <= input.now) continue;
      out.push({ ...times, doseId: dose.id, doseLabel: dose.label, scheduleDate: date });
    }
  }
  out.sort((a, b) => a.fireInstant - b.fireInstant);
  return out.slice(0, input.limit ?? 40);
}
