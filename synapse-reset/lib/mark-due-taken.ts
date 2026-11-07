/**
 * "Mark Due as Taken" — batch logging for doses already in the app's due window.
 * Eligibility reuses Today's Doses needs_attention (not upcoming / completed / inactive / PRN).
 */
import { doseEventId, computeEnsureTakenAction } from "@/lib/med-enforcement-core";
import {
  bucketTodayDoses,
  buildTodayDoseInstances,
  formatDoseAmountLabel,
  formatReminderClock,
  type TodayDoseInstance,
} from "@/lib/medication-today";
import type { Medication, MedicationLog } from "@/lib/storage";

export { doseEventId };

export type DueDoseCandidate = TodayDoseInstance & {
  /** Stable idempotency key: medicationId:doseIndex:date */
  eventId: string;
  amountLabel: string;
  timeLabel: string;
};

export type MarkDueBatchPlan = {
  dateKey: string;
  reportedTakenAt: string;
  selected: DueDoseCandidate[];
  /** Actions derived against current logs — already-taken selected rows become noops. */
  actions: Array<
    | { kind: "noop"; eventId: string; candidate: DueDoseCandidate }
    | { kind: "create"; eventId: string; candidate: DueDoseCandidate }
    | { kind: "markTaken"; eventId: string; candidate: DueDoseCandidate; logId: string }
  >;
  writable: DueDoseCandidate[];
};

/** Doses currently eligible in the app due window (today's needs_attention). */
export function listDueUntakenDoses(
  medications: Medication[],
  logsForDate: MedicationLog[],
  dateKey: string,
  now: Date = new Date(),
): DueDoseCandidate[] {
  const due = bucketTodayDoses(buildTodayDoseInstances(medications, logsForDate, dateKey, now)).needsAttention;
  return due.map((dose) => ({
    ...dose,
    eventId: doseEventId(dose.medicationId, dose.doseIndex, dateKey),
    amountLabel: formatDoseAmountLabel(dose.amount, dose.unit),
    timeLabel: formatReminderClock(dose.reminderTime, dose.timeOfDay),
  }));
}

export function buildMarkDueBatchPlan(params: {
  candidates: DueDoseCandidate[];
  selectedKeys: ReadonlySet<string> | readonly string[];
  logs: readonly MedicationLog[];
  dateKey: string;
  reportedTakenAt?: string;
}): MarkDueBatchPlan {
  const selectedKeySet =
    params.selectedKeys instanceof Set ? params.selectedKeys : new Set(params.selectedKeys);
  const selected = params.candidates.filter((c) => selectedKeySet.has(c.key));
  const reportedTakenAt = params.reportedTakenAt ?? new Date().toISOString();
  const actions = selected.map((candidate) => {
    const eventId = candidate.eventId;
    const decision = computeEnsureTakenAction(
      params.logs,
      candidate.medicationId,
      params.dateKey,
      candidate.doseIndex,
    );
    if (decision.kind === "noop") return { kind: "noop" as const, eventId, candidate };
    if (decision.kind === "markTaken") {
      return { kind: "markTaken" as const, eventId, candidate, logId: decision.logId };
    }
    return { kind: "create" as const, eventId, candidate };
  });
  return {
    dateKey: params.dateKey,
    reportedTakenAt,
    selected,
    actions,
    writable: actions.filter((a) => a.kind !== "noop").map((a) => a.candidate),
  };
}

/** Apply a mark-due plan onto an in-memory log list (atomic pure transform for tests + storage). */
export function applyMarkDuePlanToLogs(
  logs: MedicationLog[],
  plan: MarkDueBatchPlan,
): { logs: MedicationLog[]; newlyMarkedKeys: string[]; newlyMarkedEventIds: string[] } {
  const next = logs.map((l) => ({ ...l }));
  const newlyMarkedKeys: string[] = [];
  const newlyMarkedEventIds: string[] = [];

  for (const action of plan.actions) {
    if (action.kind === "noop") continue;
    const { candidate } = action;
    const idx = next.findIndex(
      (l) =>
        l.medicationId === candidate.medicationId &&
        l.date === plan.dateKey &&
        (l.doseIndex ?? 0) === candidate.doseIndex,
    );
    if (idx >= 0) {
      if (next[idx].taken) continue;
      next[idx] = {
        ...next[idx],
        taken: true,
        recordedAt: plan.reportedTakenAt,
        scheduledTime: candidate.reminderTime ?? next[idx].scheduledTime,
      };
    } else {
      next.push({
        id: `mark-due-${action.eventId}`,
        medicationId: candidate.medicationId,
        doseIndex: candidate.doseIndex,
        date: plan.dateKey,
        taken: true,
        recordedAt: plan.reportedTakenAt,
        scheduledTime: candidate.reminderTime ?? undefined,
      });
    }
    newlyMarkedKeys.push(candidate.key);
    newlyMarkedEventIds.push(action.eventId);
  }

  return { logs: next, newlyMarkedKeys, newlyMarkedEventIds };
}

/** Undo doses previously newly marked by a batch (sets taken=false; preserves row). */
export function applyUndoMarkDueToLogs(
  logs: MedicationLog[],
  dateKey: string,
  keys: readonly string[],
): MedicationLog[] {
  const keySet = new Set(keys);
  return logs.map((log) => {
    const key = `${log.medicationId}:${log.doseIndex ?? 0}`;
    if (!keySet.has(key) || log.date !== dateKey || !log.taken) return log;
    return { ...log, taken: false, recordedAt: undefined };
  });
}

export function markDueUndoLabel(count: number): string {
  if (count <= 0) return "Nothing changed";
  if (count === 1) return "Logged 1 due dose";
  return `Logged ${count} due doses`;
}
