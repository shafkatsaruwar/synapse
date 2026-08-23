/**
 * Medication Enforcement Mode — pure logic core.
 *
 * This module is intentionally free of any React Native / AsyncStorage / Expo
 * imports so it can be unit-tested in plain Node (via tsx). All side-effecting
 * work (storage, notifications) lives in lib/med-enforcement.ts and
 * lib/notification-manager.ts and calls into these pure helpers.
 *
 * SAFETY: nothing here decides what/when/dose is medically appropriate. It only
 * works with scheduledTime, elapsed time, and escalation level.
 */

import { DEFAULT_ESCALATION_OFFSETS_MIN } from "@/constants/med-enforcement-copy";

/** Terminal resolution states. */
export type EnforcementResolution = "TAKEN" | "SKIPPED" | "UNABLE_TO_TAKE" | "MISSED";
/** "unresolved" and "snoozed" are both non-terminal (dose not yet resolved). */
export type EnforcementStatus = "unresolved" | "snoozed" | EnforcementResolution;

export interface MedicationEnforcementEvent {
  /** doseEventId = `${medicationId}:${doseIndex}:${date}` */
  id: string;
  medicationId: string;
  doseIndex: number;
  /** Local scheduled calendar date YYYY-MM-DD. */
  date: string;
  /** ISO timestamp of the scheduled dose time (source of truth for delays). */
  scheduledAt: string;
  firstNotifiedAt?: string;
  status: EnforcementStatus;
  resolution?: EnforcementResolution;
  resolvedAt?: string;
  takenAt?: string;
  responseDelayMinutes?: number;
  snoozeCount: number;
  escalationLevelReached: number;
  /** Optional short reason for SKIPPED / UNABLE_TO_TAKE. Recorded verbatim, never interpreted. */
  reason?: string;
  /**
   * Reserved for a future opt-in visual-proof feature. NOT used in V1.
   * A photo can never prove ingestion; adherence stays user-confirmed.
   */
  proof?: {
    type?: string;
    match?: boolean;
    confidence?: number;
    reason?: string;
    manualOverride?: boolean;
    checkedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** Minimal shape of a medication log needed to decide idempotent "taken". */
export type TakenLogLike = {
  id: string;
  medicationId: string;
  date: string;
  doseIndex?: number;
  taken: boolean;
};

// ---- Notification-budget guardrails (respect the iOS ~64 pending limit) ----
/** Max distinct dose occurrences enforcement will pre-schedule ladders for. */
export const ENFORCEMENT_MAX_OCCURRENCES = 4;
/** Hard cap on enforcement escalation notifications pending at once. */
export const ENFORCEMENT_NOTIFICATION_BUDGET = 20;

export function doseEventId(medicationId: string, doseIndex: number, date: string): string {
  return `${medicationId}:${doseIndex}:${date}`;
}

const ENFORCE_PREFIX = "med-enforce";

/** Deterministic notification id prefix for one dose event (used for cancel-by-event). */
export function enforcementNotificationPrefix(eventId: string): string {
  return `${ENFORCE_PREFIX}:${eventId}`;
}

export function escalationNotificationId(eventId: string, level: number): string {
  return `${ENFORCE_PREFIX}:${eventId}:esc:${level}`;
}

export function snoozeEscalationNotificationId(eventId: string, snoozeIndex: number, level: number): string {
  return `${ENFORCE_PREFIX}:${eventId}:snooze:${snoozeIndex}:esc:${level}`;
}

export function snoozeReminderNotificationId(eventId: string, snoozeIndex: number): string {
  return `${ENFORCE_PREFIX}:${eventId}:snooze:${snoozeIndex}`;
}

export type PlannedEnforcementNotification = {
  id: string;
  fireAtMs: number;
  level: number;
};

/**
 * Build the bounded escalation ladder for a dose occurrence. Offsets are minutes
 * from the scheduled time. Only future fire times (relative to nowMs) are
 * returned, so already-past escalations are not scheduled. The "initial" due
 * notification is delivered by Synapse's existing medication reminder and is not
 * duplicated here.
 */
export function buildEscalationPlan(
  eventId: string,
  scheduledAtMs: number,
  nowMs: number,
  offsetsMin: readonly number[] = DEFAULT_ESCALATION_OFFSETS_MIN,
): PlannedEnforcementNotification[] {
  const plan: PlannedEnforcementNotification[] = [];
  offsetsMin.forEach((offset, index) => {
    const level = index + 1;
    const fireAtMs = scheduledAtMs + offset * 60_000;
    if (fireAtMs > nowMs) {
      plan.push({ id: escalationNotificationId(eventId, level), fireAtMs, level });
    }
  });
  return plan;
}

/** Bounded follow-up escalations for a snooze occurrence (same offsets from snooze time). */
export function buildSnoozeEscalationPlan(
  eventId: string,
  snoozeIndex: number,
  snoozeFireAtMs: number,
  nowMs: number,
  offsetsMin: readonly number[] = DEFAULT_ESCALATION_OFFSETS_MIN,
): PlannedEnforcementNotification[] {
  const plan: PlannedEnforcementNotification[] = [];
  offsetsMin.forEach((offset, index) => {
    const level = index + 1;
    const fireAtMs = snoozeFireAtMs + offset * 60_000;
    if (fireAtMs > nowMs) {
      plan.push({ id: snoozeEscalationNotificationId(eventId, snoozeIndex, level), fireAtMs, level });
    }
  });
  return plan;
}

/** Next occurrence timestamp for a daily dose at hour:minute (today if still ahead, else tomorrow). */
export function nextDailyOccurrenceMs(nowMs: number, hour: number, minute: number): number {
  const now = new Date(nowMs);
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= nowMs) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

/**
 * The dose occurrence enforcement should currently target.
 *
 * Unlike {@link nextDailyOccurrenceMs}, this keeps TODAY's occurrence as the
 * target for the entire escalation window (until scheduledTime + windowMinutes),
 * and only rolls to tomorrow once that window has fully elapsed. This prevents a
 * reconcile that runs at/after the scheduled minute from abandoning the dose the
 * user is actively supposed to resolve (which previously cancelled today's
 * escalation ladder, e.g. esc:1 at +5 min).
 *
 * `windowMinutes` should be >= the largest escalation offset.
 */
export function enforcementActiveOccurrenceMs(
  nowMs: number,
  hour: number,
  minute: number,
  windowMinutes: number,
): number {
  const todayAt = new Date(nowMs);
  todayAt.setHours(hour, minute, 0, 0);
  if (nowMs <= todayAt.getTime() + windowMinutes * 60_000) {
    return todayAt.getTime();
  }
  const tomorrow = new Date(todayAt.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getTime();
}

/** Local YYYY-MM-DD for a timestamp. */
export function localDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Idempotent "taken" decision. Never flips an already-taken dose back to false
 * and never creates a duplicate log for the same (medication, date, doseIndex).
 */
export function computeEnsureTakenAction(
  logs: readonly TakenLogLike[],
  medicationId: string,
  date: string,
  doseIndex: number,
): { kind: "noop" } | { kind: "create" } | { kind: "markTaken"; logId: string } {
  const existing = logs.find(
    (log) => log.medicationId === medicationId && log.date === date && (log.doseIndex ?? 0) === doseIndex,
  );
  if (!existing) return { kind: "create" };
  if (existing.taken) return { kind: "noop" };
  return { kind: "markTaken", logId: existing.id };
}

/** Escalation level reached given elapsed minutes since scheduled time. */
export function escalationLevelForElapsed(
  elapsedMinutes: number,
  offsetsMin: readonly number[] = DEFAULT_ESCALATION_OFFSETS_MIN,
): number {
  return offsetsMin.filter((offset) => elapsedMinutes >= offset).length;
}

function minutesBetween(fromIso: string, toMs: number): number {
  const fromMs = new Date(fromIso).getTime();
  if (!Number.isFinite(fromMs)) return 0;
  return Math.max(0, Math.round((toMs - fromMs) / 60_000));
}

/**
 * Resolve a dose event into a terminal state. Pure — returns a new event.
 * TAKEN records takenAt; SKIPPED/UNABLE_TO_TAKE record an optional verbatim reason.
 * None of these fabricate a MedicationLog (that is handled only for TAKEN, by the
 * caller, via the idempotent ensureTaken path).
 */
export function applyResolution(
  event: MedicationEnforcementEvent,
  resolution: EnforcementResolution,
  atMs: number,
  reason?: string,
  offsetsMin: readonly number[] = DEFAULT_ESCALATION_OFFSETS_MIN,
): MedicationEnforcementEvent {
  const resolvedAtIso = new Date(atMs).toISOString();
  const responseDelayMinutes = minutesBetween(event.scheduledAt, atMs);
  const escalationLevelReached = Math.max(
    event.escalationLevelReached,
    escalationLevelForElapsed(responseDelayMinutes, offsetsMin),
  );
  return {
    ...event,
    status: resolution,
    resolution,
    resolvedAt: resolvedAtIso,
    takenAt: resolution === "TAKEN" ? resolvedAtIso : event.takenAt,
    responseDelayMinutes,
    escalationLevelReached,
    reason: resolution === "SKIPPED" || resolution === "UNABLE_TO_TAKE" ? reason?.trim() || undefined : event.reason,
    updatedAt: resolvedAtIso,
  };
}

/**
 * Apply a snooze. Does NOT resolve the dose and does NOT touch adherence.
 * Preserves the original scheduledAt, increments snoozeCount, and returns the
 * planned snooze reminder time so the caller can schedule notifications.
 */
export function applySnooze(
  event: MedicationEnforcementEvent,
  atMs: number,
  snoozeMinutes: number,
): { event: MedicationEnforcementEvent; snoozeIndex: number; snoozeFireAtMs: number } {
  const snoozeIndex = event.snoozeCount + 1;
  const snoozeFireAtMs = atMs + snoozeMinutes * 60_000;
  const updated: MedicationEnforcementEvent = {
    ...event,
    status: "snoozed",
    snoozeCount: snoozeIndex,
    updatedAt: new Date(atMs).toISOString(),
  };
  return { event: updated, snoozeIndex, snoozeFireAtMs };
}

function isUnresolved(status: EnforcementStatus): boolean {
  return status === "unresolved" || status === "snoozed";
}

/**
 * Finalize stale unresolved events as MISSED using a neutral administrative
 * boundary: the scheduled date is in the past (date rollover). This is NOT a
 * medical judgment and must never change medicationLogStorage adherence math —
 * it only annotates enforcement metadata.
 */
export function finalizeStaleAsMissed(
  events: readonly MedicationEnforcementEvent[],
  todayDateStr: string,
  nowMs: number,
): { events: MedicationEnforcementEvent[]; changedIds: string[] } {
  const changedIds: string[] = [];
  const next = events.map((event) => {
    if (event.date < todayDateStr && isUnresolved(event.status)) {
      changedIds.push(event.id);
      return applyResolution(event, "MISSED", nowMs);
    }
    return event;
  });
  return { events: next, changedIds };
}

export type EnforcementMetrics = {
  scheduledOccurrences: number;
  confirmedTaken: number;
  skipped: number;
  unableToTake: number;
  unresolvedOrMissed: number;
  averageResponseDelayMinutes: number | null;
  totalSnoozes: number;
  averageSnoozes: number | null;
  highestEscalationLevelReached: number;
};

/**
 * Private 30-day enforcement accountability metrics. Deliberately NOT a second
 * adherence percentage — Reports remains the canonical adherence source.
 */
export function computeEnforcementMetrics(
  events: readonly MedicationEnforcementEvent[],
  sinceDateStr: string,
): EnforcementMetrics {
  const scoped = events.filter((event) => event.date >= sinceDateStr);
  const taken = scoped.filter((event) => event.resolution === "TAKEN");
  const delays = taken
    .map((event) => event.responseDelayMinutes)
    .filter((value): value is number => typeof value === "number");
  const snoozeTotal = scoped.reduce((sum, event) => sum + (event.snoozeCount || 0), 0);
  const withSnoozeData = scoped.length;
  return {
    scheduledOccurrences: scoped.length,
    confirmedTaken: taken.length,
    skipped: scoped.filter((event) => event.resolution === "SKIPPED").length,
    unableToTake: scoped.filter((event) => event.resolution === "UNABLE_TO_TAKE").length,
    unresolvedOrMissed: scoped.filter((event) => event.resolution === "MISSED" || isUnresolved(event.status)).length,
    averageResponseDelayMinutes: delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
    totalSnoozes: snoozeTotal,
    averageSnoozes: withSnoozeData > 0 ? Math.round((snoozeTotal / withSnoozeData) * 10) / 10 : null,
    highestEscalationLevelReached: scoped.reduce((max, event) => Math.max(max, event.escalationLevelReached || 0), 0),
  };
}

export type OccurrenceCandidate = {
  medicationId: string;
  doseIndex: number;
  medicationName: string;
  dosage: string;
  scheduledAtMs: number;
};

/**
 * Choose only the nearest upcoming occurrences that fit the enforcement budget,
 * leaving pending-notification headroom for normal reminders, appointments, etc.
 */
export function selectOccurrencesWithinBudget(
  candidates: readonly OccurrenceCandidate[],
  offsetsCount: number = DEFAULT_ESCALATION_OFFSETS_MIN.length,
  maxOccurrences: number = ENFORCEMENT_MAX_OCCURRENCES,
  notificationBudget: number = ENFORCEMENT_NOTIFICATION_BUDGET,
): OccurrenceCandidate[] {
  const perOccurrence = Math.max(1, offsetsCount);
  const budgetOccurrences = Math.floor(notificationBudget / perOccurrence);
  const limit = Math.max(0, Math.min(maxOccurrences, budgetOccurrences));
  return [...candidates].sort((a, b) => a.scheduledAtMs - b.scheduledAtMs).slice(0, limit);
}

/**
 * Only TAKEN writes to the canonical medication log. SKIPPED / UNABLE_TO_TAKE /
 * MISSED are accountability metadata and must never fabricate a medication log
 * (which would alter the existing Reports adherence denominator/behavior).
 */
export function resolutionWritesTakenLog(resolution: EnforcementResolution): boolean {
  return resolution === "TAKEN";
}

export function createEnforcementEvent(params: {
  medicationId: string;
  doseIndex: number;
  scheduledAtMs: number;
  nowMs: number;
}): MedicationEnforcementEvent {
  const date = localDateKey(params.scheduledAtMs);
  const nowIso = new Date(params.nowMs).toISOString();
  return {
    id: doseEventId(params.medicationId, params.doseIndex, date),
    medicationId: params.medicationId,
    doseIndex: params.doseIndex,
    date,
    scheduledAt: new Date(params.scheduledAtMs).toISOString(),
    status: "unresolved",
    snoozeCount: 0,
    escalationLevelReached: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
