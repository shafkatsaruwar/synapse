/**
 * IANA time-zone math with no stored UTC offsets. All conversions go through Intl, so daylight
 * saving rules come from the platform's tz database, not from this file.
 */

const MINUTE = 60_000;
const DAY = 86_400_000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone) return false;
  // Offsets like "+05:00" are accepted by Intl but are not IANA identifiers and ignore DST.
  if (timeZone !== "UTC" && timeZone !== "GMT" && !/^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+)+$/.test(timeZone)) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : "UTC";
  } catch {
    return "UTC";
  }
}

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function getLocalParts(timeZone: string, instantMs: number): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset (minutes east of UTC) that applied in `timeZone` at the given instant. */
export function getOffsetMinutes(timeZone: string, instantMs: number): number {
  const p = getLocalParts(timeZone, instantMs);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / MINUTE);
}

export type ZonedResolution =
  | { kind: "normal"; instant: number }
  /** Wall time does not exist (spring forward). `instant` is the first real moment after the gap. */
  | { kind: "gap"; instant: number }
  /** Wall time happens twice (fall back). `instant` is the first occurrence; `second` the repeat. */
  | { kind: "overlap"; instant: number; second: number };

/** Resolve a wall-clock time in an IANA zone to an exact instant, handling DST gaps and repeats. */
export function resolveZonedTime(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): ZonedResolution {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsets = new Set<number>([getOffsetMinutes(timeZone, naive - DAY), getOffsetMinutes(timeZone, naive + DAY)]);
  const valid: number[] = [];
  for (const offset of offsets) {
    const instant = naive - offset * MINUTE;
    if (getOffsetMinutes(timeZone, instant) === offset) valid.push(instant);
  }
  valid.sort((a, b) => a - b);
  if (valid.length === 1) return { kind: "normal", instant: valid[0] };
  if (valid.length >= 2) return { kind: "overlap", instant: valid[0], second: valid[valid.length - 1] };
  // Gap: reading the wall time with the pre-transition offset lands just after the gap.
  const before = getOffsetMinutes(timeZone, naive - DAY);
  return { kind: "gap", instant: naive - before * MINUTE };
}

export type CalendarDate = { year: number; month: number; day: number };

export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function calendarDateInZone(timeZone: string, instantMs: number): CalendarDate {
  const p = getLocalParts(timeZone, instantMs);
  return { year: p.year, month: p.month, day: p.day };
}

export function weekdayOfCalendarDate(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function parseHHMM(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatInZone(
  instantMs: number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { weekday: "short", hour: "numeric", minute: "2-digit" },
): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(new Date(instantMs));
}

export function zoneShortName(instantMs: number, timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date(instantMs))
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
