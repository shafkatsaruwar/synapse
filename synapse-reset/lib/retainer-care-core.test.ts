/**
 * Regression tests for Retainer Care core logic.
 * Run: npx tsx synapse-reset/lib/retainer-care-core.test.ts
 */
import {
  adjustFireAtAroundQuietHours,
  buildRetainerNotificationPlan,
  confirmRetainerInserted,
  confirmRetainerNotYet,
  createRetainerOccurrence,
  expireRetainerFollowUps,
  isInQuietHours,
  markRetainerPending,
  markStillEating,
  nightIdForTimestamp,
  removeRetainerForSnack,
  reportRetainerPain,
  shouldExpireOpenOccurrence,
  snoozeRetainer,
  statusViewForOccurrence,
  DEFAULT_RETAINER_SETTINGS,
  type RetainerOccurrence,
  type RetainerSettings,
} from "./retainer-care-core";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  FAIL: " + msg);
  }
}
function section(name: string) {
  console.log("\n=== " + name + " ===");
}

const settings: RetainerSettings = { ...DEFAULT_RETAINER_SETTINGS };

function baseOccurrence(overrides?: Partial<RetainerOccurrence>): RetainerOccurrence {
  const nightId = "2026-11-19";
  const scheduledAtMs = new Date(2026, 10, 19, 23, 55, 0, 0).getTime();
  const nowMs = scheduledAtMs - 60_000;
  const occ = createRetainerOccurrence({ nightId, scheduledAtMs, nowMs });
  return { ...occ, ...overrides };
}

section("night id crosses midnight");
{
  const bedtime = 23;
  // 00:30 on Nov 20 still belongs to Nov 19 night
  const afterMidnight = new Date(2026, 10, 20, 0, 30, 0, 0).getTime();
  assert(nightIdForTimestamp(afterMidnight, bedtime) === "2026-11-19", "post-midnight → previous night");
  const evening = new Date(2026, 10, 19, 22, 0, 0, 0).getTime();
  assert(nightIdForTimestamp(evening, bedtime) === "2026-11-19", "evening → same calendar night");
}

section("confirm requires explicit yes");
{
  let occ = baseOccurrence();
  const due = new Date(occ.scheduledAt).getTime() + 1000;
  occ = markRetainerPending(occ, due);
  occ = confirmRetainerNotYet(occ, due + 1000);
  assert(occ.state === "pending", "not yet keeps pending");
  occ = confirmRetainerInserted(occ, due + 2000);
  assert(occ.state === "completed", "yes → completed");
  assert(!!occ.confirmedAt, "confirmedAt set");
}

section("snack reopens same night without duplicate id");
{
  let occ = baseOccurrence();
  const t0 = new Date(occ.scheduledAt).getTime() + 1000;
  occ = markRetainerPending(occ, t0);
  occ = confirmRetainerInserted(occ, t0 + 1000);
  assert(occ.state === "completed", "completed first");
  const id = occ.id;
  occ = removeRetainerForSnack(occ, t0 + 5000);
  assert(occ.state === "temporarily_removed", "reopened for snack");
  assert(occ.id === id, "same occurrence id");
  occ = markStillEating(occ, t0 + 10_000);
  assert(occ.state === "temporarily_removed", "still eating stays out");
  occ = confirmRetainerInserted(occ, t0 + 20_000);
  assert(occ.state === "completed", "re-confirm completes again");
}

section("pain stops enforcement");
{
  let occ = markRetainerPending(baseOccurrence(), Date.now());
  occ = reportRetainerPain(occ, Date.now(), "sore");
  assert(occ.state === "pain_stopped", "pain terminal");
  const plan = buildRetainerNotificationPlan(occ, settings, Date.now());
  assert(plan.length === 0, "no notifications after pain");
}

section("bounded follow-ups + no infinite loop");
{
  const scheduledAtMs = Date.now() + 60_000;
  let occ = createRetainerOccurrence({
    nightId: "2026-11-19",
    scheduledAtMs,
    nowMs: Date.now(),
  });
  const plan = buildRetainerNotificationPlan(occ, settings, Date.now());
  assert(plan.some((p) => p.kind === "initial"), "includes initial");
  const followUps = plan.filter((p) => p.kind === "follow_up");
  assert(followUps.length === settings.maxFollowUps, "caps follow-ups at max");
  const ids = new Set(plan.map((p) => p.id));
  assert(ids.size === plan.length, "deterministic unique ids");
}

section("expire after max follow-ups keeps visible pending semantics");
{
  const scheduledAtMs = Date.now() - 3 * 60 * 60_000;
  let occ = createRetainerOccurrence({
    nightId: "2026-11-18",
    scheduledAtMs,
    nowMs: scheduledAtMs - 1000,
  });
  occ = markRetainerPending(occ, scheduledAtMs + 1000);
  occ = { ...occ, followUpCount: settings.maxFollowUps };
  assert(shouldExpireOpenOccurrence(occ, settings, Date.now()), "should expire");
  occ = expireRetainerFollowUps(occ, Date.now());
  assert(occ.state === "expired", "expired state");
  assert(statusViewForOccurrence(occ) === "confirmation_pending", "still visibly pending");
  assert(buildRetainerNotificationPlan(occ, settings, Date.now()).length === 0, "no more notifs");
}

section("snooze does not complete");
{
  let occ = markRetainerPending(baseOccurrence(), Date.now());
  const { occurrence: snoozed } = snoozeRetainer(occ, Date.now(), 10);
  assert(snoozed.state === "snoozed", "snoozed");
  assert(snoozed.snoozeCount === 1, "snooze count");
  assert(!snoozed.confirmedAt, "no confirm");
}

section("quiet hours adjustment");
{
  const qh: RetainerSettings = {
    ...settings,
    quietHoursStartHour: 1,
    quietHoursStartMinute: 0,
    quietHoursEndHour: 6,
    quietHoursEndMinute: 0,
  };
  const inQuiet = new Date(2026, 10, 20, 2, 0, 0, 0).getTime();
  assert(isInQuietHours(inQuiet, qh) === true, "detects quiet");
  const adjusted = adjustFireAtAroundQuietHours(inQuiet, qh);
  assert(adjusted > inQuiet, "pushes past quiet");
  const bedtime = new Date(2026, 10, 19, 23, 55, 0, 0).getTime();
  assert(
    adjustFireAtAroundQuietHours(bedtime, qh, { allowDuringQuiet: true }) === bedtime,
    "bedtime override allowed",
  );
}

section("enforcement off schedules nothing");
{
  const occ = baseOccurrence();
  const plan = buildRetainerNotificationPlan(occ, { ...settings, enforcementEnabled: false }, Date.now());
  assert(plan.length === 0, "no plan when enforcement off");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
