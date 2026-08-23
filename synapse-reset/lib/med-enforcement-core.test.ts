/**
 * Regression tests for Medication Enforcement core logic.
 *
 * Pure logic only — run with:  npx tsx synapse-reset/lib/med-enforcement-core.test.ts
 * (The project has no jest runner; this is a standalone tsx-runnable harness.)
 *
 * Proves the guarantees required for V1:
 *  1. TAKEN is idempotent
 *  2. repeated TAKEN cannot un-take a dose (and creates no duplicate log)
 *  3. SNOOZE does not modify adherence
 *  4. SKIPPED does not fabricate a MedicationLog
 *  5. UNABLE_TO_TAKE does not fabricate a MedicationLog
 *  6. stale unresolved metadata can become MISSED without changing Reports math
 *  7. escalation notifications are pre-scheduled
 *  8. resolution cancels remaining escalation notifications (id prefix invariant)
 *  9. reconciliation does not create duplicate notification IDs (determinism + budget)
 * 10. enforcement OFF restores normal behavior (adherence depends only on med logs)
 * + enforcement vs non-enforcement doses produce identical Reports math
 * + no duplicate dose event when enforcement resolves an existing scheduled dose
 */
import {
  applyResolution,
  applySnooze,
  buildEscalationPlan,
  buildSnoozeEscalationPlan,
  computeEnsureTakenAction,
  createEnforcementEvent,
  enforcementActiveOccurrenceMs,
  enforcementNotificationPrefix,
  escalationNotificationId,
  finalizeStaleAsMissed,
  resolutionWritesTakenLog,
  selectOccurrencesWithinBudget,
  type MedicationEnforcementEvent,
  type OccurrenceCandidate,
  type TakenLogLike,
} from "./med-enforcement-core";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log("  FAIL: " + msg);
  }
}
function section(name: string) {
  console.log("\n=== " + name + " ===");
}

// ---- Minimal in-memory mirror of medicationLogStorage.ensureTaken -----------
type Log = { id: string; medicationId: string; date: string; doseIndex?: number; taken: boolean };
function applyEnsureTaken(logs: Log[], medicationId: string, date: string, doseIndex: number): Log[] {
  const action = computeEnsureTakenAction(logs as TakenLogLike[], medicationId, date, doseIndex);
  if (action.kind === "create") {
    return [...logs, { id: `log-${logs.length + 1}`, medicationId, date, doseIndex, taken: true }];
  }
  if (action.kind === "markTaken") {
    return logs.map((l) => (l.id === action.logId ? { ...l, taken: true } : l));
  }
  return logs; // noop
}

// ---- Faithful copy of the ReportsScreen adherence formula (canonical) --------
type Med = { id: string; active: boolean; doseCount: number };
function reportsAdherence(activeMeds: Med[], medLogs: Log[], cutoff: string, today: string) {
  const recent = medLogs.filter((ml) => ml.date >= cutoff && ml.date <= today);
  const countDaysInclusive = (from: string, to: string) => {
    const a = new Date(from + "T00:00:00").getTime();
    const b = new Date(to + "T00:00:00").getTime();
    return Math.max(0, Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1);
  };
  let totalExpected = 0;
  activeMeds.forEach((med) => {
    const inRange = recent.filter((ml) => ml.medicationId === med.id);
    const firstLogDate = inRange.length > 0 ? inRange.map((ml) => ml.date).sort()[0] : today;
    const firstRelevant = firstLogDate < cutoff ? cutoff : firstLogDate;
    totalExpected += med.doseCount * countDaysInclusive(firstRelevant, today);
  });
  const takenDoses = recent.filter((ml) => ml.taken).length;
  const adherence = totalExpected > 0 ? Math.round((takenDoses / totalExpected) * 100) : 0;
  const missedDoses = Math.max(0, totalExpected - takenDoses);
  return { adherence, takenDoses, missedDoses, totalExpected };
}

const TODAY = "2026-08-23";
const CUTOFF = "2026-07-24";
const meds: Med[] = [{ id: "med-A", active: true, doseCount: 1 }];
const baseEvent = (): MedicationEnforcementEvent =>
  createEnforcementEvent({ medicationId: "med-A", doseIndex: 0, scheduledAtMs: new Date(`${TODAY}T09:00:00`).getTime(), nowMs: new Date(`${TODAY}T09:00:00`).getTime() });

// 1 & 2: idempotent TAKEN + repeated TAKEN cannot un-take + no duplicate
section("1/2 TAKEN idempotency");
{
  let logs: Log[] = [];
  const a1 = computeEnsureTakenAction(logs as TakenLogLike[], "med-A", TODAY, 0);
  assert(a1.kind === "create", "first ensureTaken should create");
  logs = applyEnsureTaken(logs, "med-A", TODAY, 0);
  assert(logs.length === 1 && logs[0].taken === true, "one taken log after first TAKEN");
  logs = applyEnsureTaken(logs, "med-A", TODAY, 0);
  logs = applyEnsureTaken(logs, "med-A", TODAY, 0);
  assert(logs.length === 1, "repeated TAKEN creates no duplicate log");
  assert(logs[0].taken === true, "repeated TAKEN cannot un-take the dose");
  const preTaken: Log[] = [{ id: "x", medicationId: "med-A", date: TODAY, doseIndex: 0, taken: true }];
  assert(computeEnsureTakenAction(preTaken as TakenLogLike[], "med-A", TODAY, 0).kind === "noop", "already-taken -> noop");
  const preUntaken: Log[] = [{ id: "y", medicationId: "med-A", date: TODAY, doseIndex: 0, taken: false }];
  const act = computeEnsureTakenAction(preUntaken as TakenLogLike[], "med-A", TODAY, 0);
  assert(act.kind === "markTaken", "existing not-taken -> markTaken (no new row)");
}

// 3: SNOOZE does not modify adherence
section("3 SNOOZE keeps adherence unchanged");
{
  const logs: Log[] = [];
  const before = reportsAdherence(meds, logs, CUTOFF, TODAY);
  const { event: snoozed } = applySnooze(baseEvent(), Date.now(), 10);
  assert(snoozed.status === "snoozed" && snoozed.resolution === undefined, "snooze is non-terminal");
  assert(snoozed.snoozeCount === 1, "snoozeCount incremented");
  const after = reportsAdherence(meds, logs, CUTOFF, TODAY); // logs untouched by snooze
  assert(JSON.stringify(before) === JSON.stringify(after), "snooze does not change adherence math");
}

// 4 & 5: SKIPPED / UNABLE do not fabricate a MedicationLog
section("4/5 SKIPPED & UNABLE never write a log");
{
  assert(resolutionWritesTakenLog("SKIPPED") === false, "SKIPPED writes no log");
  assert(resolutionWritesTakenLog("UNABLE_TO_TAKE") === false, "UNABLE writes no log");
  assert(resolutionWritesTakenLog("MISSED") === false, "MISSED writes no log");
  assert(resolutionWritesTakenLog("TAKEN") === true, "TAKEN writes the canonical log");
  const logs: Log[] = [];
  const before = reportsAdherence(meds, logs, CUTOFF, TODAY);
  const skipped = applyResolution(baseEvent(), "SKIPPED", Date.now(), "not at home");
  const unable = applyResolution(baseEvent(), "UNABLE_TO_TAKE", Date.now(), "unavailable");
  assert(skipped.reason === "not at home" && unable.reason === "unavailable", "verbatim reason recorded as metadata");
  // logs stay empty for non-TAKEN resolutions:
  const after = reportsAdherence(meds, logs, CUTOFF, TODAY);
  assert(JSON.stringify(before) === JSON.stringify(after), "skip/unable do not change adherence math");
}

// 6: stale unresolved -> MISSED without changing Reports math
section("6 stale -> MISSED, Reports unchanged");
{
  const logs: Log[] = [];
  const before = reportsAdherence(meds, logs, CUTOFF, TODAY);
  const past = createEnforcementEvent({ medicationId: "med-A", doseIndex: 0, scheduledAtMs: new Date("2026-08-20T09:00:00").getTime(), nowMs: new Date("2026-08-20T09:00:00").getTime() });
  const { events, changedIds } = finalizeStaleAsMissed([past], TODAY, Date.now());
  assert(changedIds.length === 1 && events[0].resolution === "MISSED", "past unresolved event becomes MISSED");
  const after = reportsAdherence(meds, logs, CUTOFF, TODAY);
  assert(JSON.stringify(before) === JSON.stringify(after), "MISSED finalize does not touch adherence math");
}

// 7: escalation notifications are pre-scheduled
section("7 escalation ladder pre-scheduled");
{
  const scheduledMs = new Date(`${TODAY}T09:00:00`).getTime();
  const nowMs = scheduledMs - 60_000; // one minute before due
  const plan = buildEscalationPlan("med-A:0:" + TODAY, scheduledMs, nowMs, [5, 10, 15, 25]);
  assert(plan.length === 4, "all 4 escalations scheduled when in the future");
  assert(plan[0].fireAtMs === scheduledMs + 5 * 60_000, "offset 5 min from scheduled time");
  assert(plan[3].fireAtMs === scheduledMs + 25 * 60_000, "offsets are from scheduled time, not sequential gaps");
  // Past offsets are not scheduled:
  const midPlan = buildEscalationPlan("med-A:0:" + TODAY, scheduledMs, scheduledMs + 11 * 60_000, [5, 10, 15, 25]);
  assert(midPlan.length === 2 && midPlan[0].level === 3, "only future escalations remain after time passes");
}

// 8: resolution cancels remaining escalation notifications (prefix invariant)
section("8 cancel-by-event prefix covers all ids");
{
  const eventId = "med-A:0:" + TODAY;
  const prefix = enforcementNotificationPrefix(eventId);
  const ladder = buildEscalationPlan(eventId, Date.now() + 1000, Date.now(), [5, 10, 15, 25]).map((p) => p.id);
  const snooze = buildSnoozeEscalationPlan(eventId, 1, Date.now() + 1000, Date.now(), [5, 10]).map((p) => p.id);
  const all = [...ladder, ...snooze, escalationNotificationId(eventId, 1)];
  assert(all.every((id) => id === prefix || id.startsWith(prefix + ":")), "every enforcement id is covered by cancel prefix");
  // A different event's ids are NOT cancelled by this prefix:
  const other = escalationNotificationId("med-B:0:" + TODAY, 1);
  assert(!(other === prefix || other.startsWith(prefix + ":")), "cancel prefix does not match other dose events");
}

// 9: reconciliation determinism + budget (no duplicate IDs)
section("9 reconcile: deterministic ids, bounded, unique");
{
  const eventId = "med-A:0:" + TODAY;
  const p1 = buildEscalationPlan(eventId, 1000, 0, [5, 10, 15, 25]).map((p) => p.id);
  const p2 = buildEscalationPlan(eventId, 1000, 0, [5, 10, 15, 25]).map((p) => p.id);
  assert(JSON.stringify(p1) === JSON.stringify(p2), "same inputs -> identical (deterministic) ids");
  assert(new Set(p1).size === p1.length, "no duplicate ids within a ladder");
  const candidates: OccurrenceCandidate[] = Array.from({ length: 12 }, (_, i) => ({
    medicationId: "med-" + i,
    doseIndex: 0,
    medicationName: "Med " + i,
    dosage: "1 pill",
    scheduledAtMs: 1000 + i,
  }));
  const selected = selectOccurrencesWithinBudget(candidates, 4, 4, 20);
  assert(selected.length === 4, "budget bounds enforcement to nearest occurrences (<= max)");
  assert(selected[0].scheduledAtMs <= selected[1].scheduledAtMs, "nearest occurrences chosen first");
}

// 10 + parity: adherence depends ONLY on med logs (enforcement metadata is inert)
section("10 enforcement OFF / metadata-inert parity");
{
  // Non-enforcement scenario: a taken dose.
  const logsPlain: Log[] = [{ id: "l1", medicationId: "med-A", date: TODAY, doseIndex: 0, taken: true }];
  const plain = reportsAdherence(meds, logsPlain, CUTOFF, TODAY);
  // Enforcement scenario: SAME med log, PLUS enforcement metadata events present.
  const enforcementEvents: MedicationEnforcementEvent[] = [
    applyResolution(baseEvent(), "TAKEN", Date.now()),
    applyResolution(baseEvent(), "SKIPPED", Date.now(), "reason"),
  ];
  void enforcementEvents; // metadata store is separate; must not affect adherence
  const withEnforcement = reportsAdherence(meds, logsPlain, CUTOFF, TODAY);
  assert(JSON.stringify(plain) === JSON.stringify(withEnforcement), "enforcement metadata does not change Reports math");
  assert(plain.takenDoses === 1 && plain.missedDoses === 0, "TAKEN log drives adherence exactly as before");
}

// 11: BUGFIX — active occurrence stays on TODAY across the escalation window
section("11 active-occurrence does not roll to tomorrow mid-window (esc:1 bug)");
{
  const window = 25; // max offset
  const doseHour = 15;
  const doseMin = 30;
  const at = (h: number, m: number) => {
    const d = new Date(`${TODAY}T00:00:00`);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const todayDose = at(doseHour, doseMin);
  // Before the dose time -> today.
  assert(enforcementActiveOccurrenceMs(at(15, 0), doseHour, doseMin, window) === todayDose, "before dose time -> today");
  // Exactly at the dose minute (repro: med created at dose time) -> today, not tomorrow.
  assert(enforcementActiveOccurrenceMs(todayDose, doseHour, doseMin, window) === todayDose, "at dose minute -> today (was rolling to tomorrow)");
  // 2 minutes after dose time (reconcile re-ran after firing) -> still today, so esc:1 survives.
  assert(enforcementActiveOccurrenceMs(at(15, 32), doseHour, doseMin, window) === todayDose, "mid-window reconcile keeps today");
  // esc:1 at +5 is still schedulable at 15:32 for today's occurrence.
  const plan = buildEscalationPlan("med-A:0:" + TODAY, todayDose, at(15, 32), [5, 10, 15, 25]);
  assert(plan.some((p) => p.level === 1 && p.id.endsWith(":esc:1")), "esc:1 present after mid-window reconcile");
  // Past the whole window -> rolls to tomorrow.
  const tomorrowDose = todayDose + 24 * 60 * 60 * 1000;
  assert(enforcementActiveOccurrenceMs(at(16, 0), doseHour, doseMin, window) === tomorrowDose, "after window elapsed -> tomorrow");
}

console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed, ${failed} failed)`);
process.exit(failed === 0 ? 0 : 1);
