/**
 * Retainer Care — pure state machine and scheduling helpers.
 * No React Native / AsyncStorage imports (tsx-testable).
 */

import {
  DEFAULT_BEDTIME,
  DEFAULT_FIRST_FOLLOW_UP_MIN,
  DEFAULT_FOLLOW_UP_INTERVAL_MIN,
  DEFAULT_MAX_FOLLOW_UPS,
  DEFAULT_MORNING_CUTOFF_HOUR,
  DEFAULT_SNACK_FOLLOW_UP_MIN,
  DEFAULT_SNOOZE_MIN,
} from "../constants/retainer-care-copy";

export type RetainerState =
  | "scheduled"
  | "pending"
  | "acknowledged"
  | "snoozed"
  | "inserted"
  | "temporarily_removed"
  | "paused"
  | "completed"
  | "skipped"
  | "expired"
  | "pain_stopped";

export type RetainerHistoryAction =
  | "schedule"
  | "remind"
  | "snooze"
  | "confirm_prompt"
  | "confirm_yes"
  | "confirm_not_yet"
  | "pain"
  | "snack_remove"
  | "snack_still_eating"
  | "pause"
  | "skip"
  | "expire"
  | "resume";

export type RetainerHistoryEntry = {
  at: string;
  from: RetainerState;
  to: RetainerState;
  action: RetainerHistoryAction;
  note?: string;
};

export type RetainerSettings = {
  /** Master local enable (still requires compile-time feature flag). */
  enabled: boolean;
  enforcementEnabled: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
  firstFollowUpMin: number;
  followUpIntervalMin: number;
  maxFollowUps: number;
  snackFollowUpMin: number;
  snoozeMin: number;
  quietHoursStartHour: number | null;
  quietHoursStartMinute: number | null;
  quietHoursEndHour: number | null;
  quietHoursEndMinute: number | null;
  /** Optional pause through this nightId (inclusive). */
  pausedUntilNightId?: string | null;
};

export type RetainerOccurrence = {
  /** Stable night key: `night:YYYY-MM-DD` (calendar day of bedtime). */
  id: string;
  nightId: string;
  state: RetainerState;
  scheduledAt: string;
  confirmedAt?: string;
  removedAt?: string;
  followUpCount: number;
  snoozeCount: number;
  lastRemovalReason?: "snack";
  painReported?: boolean;
  skipReason?: string;
  history: RetainerHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type PlannedRetainerNotification = {
  id: string;
  fireAtMs: number;
  kind: "initial" | "follow_up" | "snack" | "snooze";
  level?: number;
};

export const DEFAULT_RETAINER_SETTINGS: RetainerSettings = {
  enabled: true,
  enforcementEnabled: true,
  bedtimeHour: DEFAULT_BEDTIME.hour,
  bedtimeMinute: DEFAULT_BEDTIME.minute,
  firstFollowUpMin: DEFAULT_FIRST_FOLLOW_UP_MIN,
  followUpIntervalMin: DEFAULT_FOLLOW_UP_INTERVAL_MIN,
  maxFollowUps: DEFAULT_MAX_FOLLOW_UPS,
  snackFollowUpMin: DEFAULT_SNACK_FOLLOW_UP_MIN,
  snoozeMin: DEFAULT_SNOOZE_MIN,
  quietHoursStartHour: null,
  quietHoursStartMinute: null,
  quietHoursEndHour: null,
  quietHoursEndMinute: null,
  pausedUntilNightId: null,
};

export function nightOccurrenceId(nightId: string): string {
  return `night:${nightId}`;
}

export function retainerNotificationPrefix(occurrenceId: string): string {
  return `retainer:${occurrenceId}`;
}

export function retainerInitialNotificationId(occurrenceId: string): string {
  return `${retainerNotificationPrefix(occurrenceId)}:initial`;
}

export function retainerFollowUpNotificationId(occurrenceId: string, level: number): string {
  return `${retainerNotificationPrefix(occurrenceId)}:esc:${level}`;
}

export function retainerSnoozeNotificationId(occurrenceId: string, snoozeIndex: number): string {
  return `${retainerNotificationPrefix(occurrenceId)}:snooze:${snoozeIndex}`;
}

export function retainerSnackNotificationId(occurrenceId: string, index: number): string {
  return `${retainerNotificationPrefix(occurrenceId)}:snack:${index}`;
}

/** Local YYYY-MM-DD. */
export function localDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Night id for a timestamp given evening bedtime.
 * After midnight and before morningCutoffHour, still belongs to yesterday's night.
 */
export function nightIdForTimestamp(
  ms: number,
  bedtimeHour: number = DEFAULT_BEDTIME.hour,
  morningCutoffHour: number = DEFAULT_MORNING_CUTOFF_HOUR,
): string {
  const d = new Date(ms);
  const candidate = new Date(d);
  if (bedtimeHour >= 12 && d.getHours() < morningCutoffHour) {
    candidate.setDate(candidate.getDate() - 1);
  }
  return localDateKey(candidate.getTime());
}

/** Next bedtime fire time (today if still ahead, else tomorrow). */
export function nextBedtimeMs(nowMs: number, hour: number, minute: number): number {
  const now = new Date(nowMs);
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= nowMs) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

export function scheduledAtForNightId(nightId: string, hour: number, minute: number): number {
  const [y, m, d] = nightId.split("-").map((n) => parseInt(n, 10));
  const at = new Date(y, (m || 1) - 1, d || 1, hour, minute, 0, 0);
  return at.getTime();
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** True if local clock falls inside quiet hours (supports wrap past midnight). */
export function isInQuietHours(
  ms: number,
  settings: Pick<
    RetainerSettings,
    "quietHoursStartHour" | "quietHoursStartMinute" | "quietHoursEndHour" | "quietHoursEndMinute"
  >,
): boolean {
  const { quietHoursStartHour: sh, quietHoursStartMinute: sm, quietHoursEndHour: eh, quietHoursEndMinute: em } = settings;
  if (sh == null || sm == null || eh == null || em == null) return false;
  const d = new Date(ms);
  const now = minutesOfDay(d.getHours(), d.getMinutes());
  const start = minutesOfDay(sh, sm);
  const end = minutesOfDay(eh, em);
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

/**
 * Shift a fire time out of quiet hours to the quiet-hours end (same or next day).
 * Bedtime reminder itself is allowed even if it lands in quiet hours (explicit bedtime override).
 */
export function adjustFireAtAroundQuietHours(fireAtMs: number, settings: RetainerSettings, options?: { allowDuringQuiet?: boolean }): number {
  if (options?.allowDuringQuiet) return fireAtMs;
  if (!isInQuietHours(fireAtMs, settings)) return fireAtMs;
  const eh = settings.quietHoursEndHour;
  const em = settings.quietHoursEndMinute;
  if (eh == null || em == null) return fireAtMs;
  const d = new Date(fireAtMs);
  const end = new Date(d);
  end.setHours(eh, em, 0, 0);
  if (end.getTime() <= fireAtMs) {
    end.setDate(end.getDate() + 1);
  }
  return end.getTime();
}

const OPEN_STATES: ReadonlySet<RetainerState> = new Set([
  "scheduled",
  "pending",
  "acknowledged",
  "snoozed",
  "inserted",
  "temporarily_removed",
]);

export function isOpenRetainerState(state: RetainerState): boolean {
  return OPEN_STATES.has(state);
}

export function isTerminalRetainerState(state: RetainerState): boolean {
  return state === "completed" || state === "skipped" || state === "expired" || state === "pain_stopped" || state === "paused";
}

function pushHistory(
  occurrence: RetainerOccurrence,
  to: RetainerState,
  action: RetainerHistoryAction,
  atMs: number,
  note?: string,
): RetainerOccurrence {
  const at = new Date(atMs).toISOString();
  return {
    ...occurrence,
    state: to,
    updatedAt: at,
    history: [
      ...occurrence.history,
      { at, from: occurrence.state, to, action, note },
    ],
  };
}

export function createRetainerOccurrence(params: {
  nightId: string;
  scheduledAtMs: number;
  nowMs: number;
}): RetainerOccurrence {
  const nowIso = new Date(params.nowMs).toISOString();
  const id = nightOccurrenceId(params.nightId);
  const scheduledAt = new Date(params.scheduledAtMs).toISOString();
  const base: RetainerOccurrence = {
    id,
    nightId: params.nightId,
    state: "scheduled",
    scheduledAt,
    followUpCount: 0,
    snoozeCount: 0,
    history: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return pushHistory(base, "scheduled", "schedule", params.nowMs);
}

/** Mark due: scheduled → pending when bedtime has arrived. */
export function markRetainerPending(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  if (occurrence.state !== "scheduled") return occurrence;
  return pushHistory(occurrence, "pending", "remind", atMs);
}

/** User opened confirm sheet — not completion. */
export function markRetainerAcknowledged(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  if (occurrence.state === "completed" || occurrence.state === "pain_stopped" || occurrence.state === "skipped") {
    return occurrence;
  }
  if (occurrence.state === "temporarily_removed") {
    return pushHistory(occurrence, "acknowledged", "confirm_prompt", atMs);
  }
  if (occurrence.state === "pending" || occurrence.state === "snoozed" || occurrence.state === "scheduled" || occurrence.state === "inserted") {
    return pushHistory(occurrence, "acknowledged", "confirm_prompt", atMs);
  }
  return occurrence;
}

/** Only after “Yes, confirmed”. */
export function confirmRetainerInserted(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  const next = pushHistory(
    {
      ...occurrence,
      confirmedAt: new Date(atMs).toISOString(),
      removedAt: undefined,
      lastRemovalReason: undefined,
    },
    "inserted",
    "confirm_yes",
    atMs,
  );
  return pushHistory(next, "completed", "confirm_yes", atMs);
}

export function confirmRetainerNotYet(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  if (occurrence.state === "completed" || occurrence.state === "pain_stopped") return occurrence;
  return pushHistory({ ...occurrence, state: "pending" }, "pending", "confirm_not_yet", atMs);
}

export function reportRetainerPain(occurrence: RetainerOccurrence, atMs: number, note?: string): RetainerOccurrence {
  return pushHistory(
    { ...occurrence, painReported: true },
    "pain_stopped",
    "pain",
    atMs,
    note,
  );
}

export function removeRetainerForSnack(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  // Reopen the same night — even from completed.
  return pushHistory(
    {
      ...occurrence,
      removedAt: new Date(atMs).toISOString(),
      lastRemovalReason: "snack",
      confirmedAt: occurrence.confirmedAt,
    },
    "temporarily_removed",
    "snack_remove",
    atMs,
  );
}

export function markStillEating(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  if (occurrence.state !== "temporarily_removed") {
    return removeRetainerForSnack(occurrence, atMs);
  }
  return pushHistory(occurrence, "temporarily_removed", "snack_still_eating", atMs);
}

export function snoozeRetainer(
  occurrence: RetainerOccurrence,
  atMs: number,
  snoozeMinutes: number,
): { occurrence: RetainerOccurrence; snoozeIndex: number; snoozeFireAtMs: number } {
  const snoozeIndex = occurrence.snoozeCount + 1;
  const snoozeFireAtMs = atMs + snoozeMinutes * 60_000;
  const next = pushHistory(
    { ...occurrence, snoozeCount: snoozeIndex },
    "snoozed",
    "snooze",
    atMs,
  );
  return { occurrence: next, snoozeIndex, snoozeFireAtMs };
}

export function pauseRetainerTonight(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  return pushHistory(occurrence, "paused", "pause", atMs);
}

export function skipRetainerTonight(occurrence: RetainerOccurrence, atMs: number, reason?: string): RetainerOccurrence {
  return pushHistory(
    { ...occurrence, skipReason: reason?.trim() || undefined },
    "skipped",
    "skip",
    atMs,
    reason,
  );
}

/** After max follow-ups: stop notifying but keep visibly unresolved via expired. */
export function expireRetainerFollowUps(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  if (!isOpenRetainerState(occurrence.state) && occurrence.state !== "snoozed") return occurrence;
  return pushHistory(occurrence, "expired", "expire", atMs);
}

export function bumpFollowUpCount(occurrence: RetainerOccurrence, atMs: number): RetainerOccurrence {
  return {
    ...occurrence,
    followUpCount: occurrence.followUpCount + 1,
    updatedAt: new Date(atMs).toISOString(),
  };
}

/**
 * Build bounded notifications for an open night.
 * Initial bedtime is included when still in the future.
 * Follow-ups use first delay then interval, capped by maxFollowUps.
 */
export function buildRetainerNotificationPlan(
  occurrence: RetainerOccurrence,
  settings: RetainerSettings,
  nowMs: number,
): PlannedRetainerNotification[] {
  if (!settings.enabled || !settings.enforcementEnabled) return [];
  if (occurrence.state === "completed" || occurrence.state === "skipped" || occurrence.state === "pain_stopped" || occurrence.state === "paused") {
    return [];
  }

  const plan: PlannedRetainerNotification[] = [];
  const scheduledAtMs = new Date(occurrence.scheduledAt).getTime();

  if (occurrence.state === "temporarily_removed") {
    const removedAt = occurrence.removedAt ? new Date(occurrence.removedAt).getTime() : nowMs;
    const snackIndex = Math.max(1, occurrence.history.filter((h) => h.action === "snack_remove" || h.action === "snack_still_eating").length);
    const fireAtMs = adjustFireAtAroundQuietHours(removedAt + settings.snackFollowUpMin * 60_000, settings);
    if (fireAtMs > nowMs) {
      plan.push({
        id: retainerSnackNotificationId(occurrence.id, snackIndex),
        fireAtMs,
        kind: "snack",
      });
    }
    return plan;
  }

  if (occurrence.state === "expired") {
    // No more notifications; UI still shows pending/expired.
    return [];
  }

  if (scheduledAtMs > nowMs && (occurrence.state === "scheduled" || occurrence.state === "pending")) {
    plan.push({
      id: retainerInitialNotificationId(occurrence.id),
      fireAtMs: adjustFireAtAroundQuietHours(scheduledAtMs, settings, { allowDuringQuiet: true }),
      kind: "initial",
    });
  }

  const baseMs = Math.max(scheduledAtMs, nowMs);
  const max = Math.max(0, settings.maxFollowUps);
  for (let level = 1; level <= max; level++) {
    const offsetMin =
      settings.firstFollowUpMin + (level - 1) * settings.followUpIntervalMin;
    const rawFire = scheduledAtMs + offsetMin * 60_000;
    if (rawFire <= nowMs) continue;
    if (level <= occurrence.followUpCount && occurrence.state !== "snoozed") continue;
    plan.push({
      id: retainerFollowUpNotificationId(occurrence.id, level),
      fireAtMs: adjustFireAtAroundQuietHours(rawFire, settings),
      kind: "follow_up",
      level,
    });
  }

  // If already past all follow-up fire times and still open, caller should expire.
  void baseMs;
  return plan.filter((item) => item.fireAtMs > nowMs);
}

export function shouldExpireOpenOccurrence(occurrence: RetainerOccurrence, settings: RetainerSettings, nowMs: number): boolean {
  if (!isOpenRetainerState(occurrence.state) && occurrence.state !== "snoozed") return false;
  if (occurrence.state === "temporarily_removed") return false;
  const scheduledAtMs = new Date(occurrence.scheduledAt).getTime();
  const lastFollowUpMs =
    scheduledAtMs +
    (settings.firstFollowUpMin + Math.max(0, settings.maxFollowUps - 1) * settings.followUpIntervalMin) * 60_000;
  return nowMs > lastFollowUpMs + 60_000 && occurrence.followUpCount >= settings.maxFollowUps;
}

export type RetainerStatusView =
  | "retainers_in"
  | "retainers_out"
  | "confirmation_pending"
  | "paused"
  | "completed_tonight"
  | "skipped"
  | "pain_stopped"
  | "scheduled";

export function statusViewForOccurrence(occurrence: RetainerOccurrence | null): RetainerStatusView {
  if (!occurrence) return "scheduled";
  switch (occurrence.state) {
    case "completed":
      return "completed_tonight";
    case "temporarily_removed":
      return "retainers_out";
    case "inserted":
      return "retainers_in";
    case "paused":
      return "paused";
    case "skipped":
      return "skipped";
    case "pain_stopped":
      return "pain_stopped";
    case "scheduled":
      return "scheduled";
    case "pending":
    case "acknowledged":
    case "snoozed":
    case "expired":
      return "confirmation_pending";
    default:
      return "confirmation_pending";
  }
}

export function mergeRetainerSettings(partial?: Partial<RetainerSettings> | null): RetainerSettings {
  return { ...DEFAULT_RETAINER_SETTINGS, ...(partial ?? {}) };
}
