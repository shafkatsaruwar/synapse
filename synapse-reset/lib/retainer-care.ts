/**
 * Retainer Care orchestration — ties pure core to local storage + notifications.
 * Personal / local-only. Does not write medication logs or CloudKit export payloads.
 */
import { featureFlags } from "@/constants/feature-flags";
import {
  DEFAULT_SNOOZE_MIN,
  initialRetainerReminderCopy,
  retainerFollowUpCopy,
  snackFollowUpCopy,
} from "@/constants/retainer-care-copy";
import {
  buildRetainerNotificationPlan,
  bumpFollowUpCount,
  confirmRetainerInserted,
  confirmRetainerNotYet,
  createRetainerOccurrence,
  expireRetainerFollowUps,
  markRetainerAcknowledged,
  markRetainerPending,
  markStillEating,
  mergeRetainerSettings,
  nextBedtimeMs,
  nightIdForTimestamp,
  nightOccurrenceId,
  pauseRetainerTonight,
  removeRetainerForSnack,
  reportRetainerPain,
  scheduledAtForNightId,
  shouldExpireOpenOccurrence,
  skipRetainerTonight,
  snoozeRetainer,
  statusViewForOccurrence,
  type RetainerOccurrence,
  type RetainerSettings,
  type RetainerStatusView,
} from "@/lib/retainer-care-core";
import {
  getRetainerOccurrenceById,
  loadRetainerOccurrences,
  loadRetainerSettings,
  saveRetainerSettings,
  upsertRetainerOccurrence,
} from "@/lib/retainer-care-storage";
import {
  cancelRetainerNotifications,
  scheduleRetainerNotificationsForPlan,
} from "@/lib/notification-manager";

function planWithCopy(
  plan: ReturnType<typeof buildRetainerNotificationPlan>,
) {
  return plan.map((item) => {
    const copy = retainerNotificationContentForPlanItem(item.kind, item.level);
    return { ...item, title: copy.title, body: copy.body };
  });
}

export async function isRetainerCareActive(): Promise<boolean> {
  if (!featureFlags.retainerCareEnabled) return false;
  try {
    const settings = await loadRetainerSettings();
    return settings.enabled === true;
  } catch {
    return false;
  }
}

export async function getRetainerSettings(): Promise<RetainerSettings> {
  return loadRetainerSettings();
}

export async function updateRetainerSettings(partial: Partial<RetainerSettings>): Promise<RetainerSettings> {
  const current = await loadRetainerSettings();
  const next = mergeRetainerSettings({ ...current, ...partial });
  await saveRetainerSettings(next);
  await reconcileRetainerCare();
  return next;
}

async function ensureTonightOccurrence(nowMs = Date.now()): Promise<{ occurrence: RetainerOccurrence; settings: RetainerSettings }> {
  const settings = await loadRetainerSettings();
  const nightId = nightIdForTimestamp(nowMs, settings.bedtimeHour);
  const id = nightOccurrenceId(nightId);
  let occurrence = await getRetainerOccurrenceById(id);
  if (!occurrence) {
    const scheduledAtMs = scheduledAtForNightId(nightId, settings.bedtimeHour, settings.bedtimeMinute);
    occurrence = createRetainerOccurrence({ nightId, scheduledAtMs, nowMs });
    await upsertRetainerOccurrence(occurrence);
  }

  if (settings.pausedUntilNightId && nightId <= settings.pausedUntilNightId && occurrence.state === "scheduled") {
    occurrence = pauseRetainerTonight(occurrence, nowMs);
    await upsertRetainerOccurrence(occurrence);
  }

  const scheduledAtMs = new Date(occurrence.scheduledAt).getTime();
  if (occurrence.state === "scheduled" && scheduledAtMs <= nowMs) {
    occurrence = markRetainerPending(occurrence, nowMs);
    await upsertRetainerOccurrence(occurrence);
  }

  if (shouldExpireOpenOccurrence(occurrence, settings, nowMs)) {
    occurrence = expireRetainerFollowUps(occurrence, nowMs);
    await upsertRetainerOccurrence(occurrence);
  }

  return { occurrence, settings };
}

export async function getRetainerCareSnapshot(nowMs = Date.now()): Promise<{
  active: boolean;
  settings: RetainerSettings;
  occurrence: RetainerOccurrence | null;
  statusView: RetainerStatusView;
  nextFollowUpAt: string | null;
  recent: RetainerOccurrence[];
}> {
  const active = await isRetainerCareActive();
  const settings = await loadRetainerSettings();
  if (!active) {
    const recent = await loadRetainerOccurrences();
    return {
      active: false,
      settings,
      occurrence: null,
      statusView: "scheduled",
      nextFollowUpAt: null,
      recent: recent.slice(0, 14),
    };
  }

  const { occurrence } = await ensureTonightOccurrence(nowMs);
  const plan = buildRetainerNotificationPlan(occurrence, settings, nowMs);
  const next = plan.sort((a, b) => a.fireAtMs - b.fireAtMs)[0];
  const recent = (await loadRetainerOccurrences()).slice(0, 14);
  return {
    active: true,
    settings,
    occurrence,
    statusView: statusViewForOccurrence(occurrence),
    nextFollowUpAt: next ? new Date(next.fireAtMs).toISOString() : null,
    recent,
  };
}

async function persistAndReschedule(occurrence: RetainerOccurrence, settings?: RetainerSettings): Promise<RetainerOccurrence> {
  await upsertRetainerOccurrence(occurrence);
  const resolvedSettings = settings ?? (await loadRetainerSettings());
  await cancelRetainerNotifications(occurrence.id);
  if (resolvedSettings.enabled && resolvedSettings.enforcementEnabled) {
    const plan = planWithCopy(buildRetainerNotificationPlan(occurrence, resolvedSettings, Date.now()));
    await scheduleRetainerNotificationsForPlan(plan, { occurrenceId: occurrence.id, nightId: occurrence.nightId });
  }
  return occurrence;
}

/** Begin confirm flow — does not complete. */
export async function beginRetainerConfirm(): Promise<RetainerOccurrence> {
  const { occurrence } = await ensureTonightOccurrence();
  const next = markRetainerAcknowledged(occurrence, Date.now());
  await upsertRetainerOccurrence(next);
  return next;
}

export async function confirmRetainersYes(): Promise<RetainerOccurrence> {
  const { occurrence, settings } = await ensureTonightOccurrence();
  const next = confirmRetainerInserted(occurrence, Date.now());
  return persistAndReschedule(next, settings);
}

export async function confirmRetainersNotYet(): Promise<RetainerOccurrence> {
  const { occurrence, settings } = await ensureTonightOccurrence();
  const next = confirmRetainerNotYet(occurrence, Date.now());
  return persistAndReschedule(next, settings);
}

export async function reportRetainersHurt(note?: string): Promise<RetainerOccurrence> {
  const { occurrence, settings } = await ensureTonightOccurrence();
  const next = reportRetainerPain(occurrence, Date.now(), note);
  return persistAndReschedule(next, settings);
}

export async function removedForSnack(): Promise<RetainerOccurrence> {
  const { occurrence, settings } = await ensureTonightOccurrence();
  const next = removeRetainerForSnack(occurrence, Date.now());
  return persistAndReschedule(next, settings);
}

export async function stillEating(): Promise<RetainerOccurrence> {
  const { occurrence, settings } = await ensureTonightOccurrence();
  const next = markStillEating(occurrence, Date.now());
  return persistAndReschedule(next, settings);
}

export async function snoozeRetainerCare(minutes?: number): Promise<RetainerOccurrence> {
  const { occurrence, settings } = await ensureTonightOccurrence();
  const snoozeMin = minutes ?? settings.snoozeMin ?? DEFAULT_SNOOZE_MIN;
  const { occurrence: snoozed, snoozeIndex, snoozeFireAtMs } = snoozeRetainer(occurrence, Date.now(), snoozeMin);
  await upsertRetainerOccurrence(snoozed);
  await cancelRetainerNotifications(snoozed.id);
  if (settings.enabled && settings.enforcementEnabled) {
    const plan = planWithCopy([
      {
        id: `retainer:${snoozed.id}:snooze:${snoozeIndex}`,
        fireAtMs: snoozeFireAtMs,
        kind: "snooze" as const,
      },
      ...buildRetainerNotificationPlan(snoozed, settings, Date.now()),
    ]);
    await scheduleRetainerNotificationsForPlan(plan, { occurrenceId: snoozed.id, nightId: snoozed.nightId });
  }
  return snoozed;
}

export async function pauseRetainerCareTonight(): Promise<RetainerOccurrence> {
  const { occurrence, settings } = await ensureTonightOccurrence();
  const next = pauseRetainerTonight(occurrence, Date.now());
  await saveRetainerSettings({ ...settings, pausedUntilNightId: occurrence.nightId });
  return persistAndReschedule(next, { ...settings, pausedUntilNightId: occurrence.nightId });
}

export async function skipRetainerCareTonight(reason?: string): Promise<RetainerOccurrence> {
  const { occurrence, settings } = await ensureTonightOccurrence();
  const next = skipRetainerTonight(occurrence, Date.now(), reason);
  return persistAndReschedule(next, settings);
}

/**
 * Reconcile tonight's occurrence + notifications. Safe to call repeatedly
 * (app active, settings change, after actions).
 */
export async function reconcileRetainerCare(): Promise<void> {
  if (!(await isRetainerCareActive())) {
    const all = await loadRetainerOccurrences();
    for (const item of all.slice(0, 5)) {
      await cancelRetainerNotifications(item.id);
    }
    return;
  }

  const now = Date.now();
  const { occurrence, settings } = await ensureTonightOccurrence(now);

  if (!settings.enforcementEnabled) {
    await cancelRetainerNotifications(occurrence.id);
    return;
  }

  // Pre-create tomorrow's scheduled occurrence quietly so bedtime can fire after kill.
  const nextBed = nextBedtimeMs(now, settings.bedtimeHour, settings.bedtimeMinute);
  const nextNightId = nightIdForTimestamp(nextBed, settings.bedtimeHour);
  if (nextNightId !== occurrence.nightId) {
    const nextId = nightOccurrenceId(nextNightId);
    const existingNext = await getRetainerOccurrenceById(nextId);
    if (!existingNext) {
      const created = createRetainerOccurrence({
        nightId: nextNightId,
        scheduledAtMs: scheduledAtForNightId(nextNightId, settings.bedtimeHour, settings.bedtimeMinute),
        nowMs: now,
      });
      await upsertRetainerOccurrence(created);
      const plan = planWithCopy(buildRetainerNotificationPlan(created, settings, now));
      await scheduleRetainerNotificationsForPlan(plan, { occurrenceId: created.id, nightId: created.nightId });
    }
  }

  let current = occurrence;
  if (shouldExpireOpenOccurrence(current, settings, now)) {
    current = expireRetainerFollowUps(current, now);
    await upsertRetainerOccurrence(current);
  }

  await cancelRetainerNotifications(current.id);
  const plan = planWithCopy(buildRetainerNotificationPlan(current, settings, now));
  await scheduleRetainerNotificationsForPlan(plan, { occurrenceId: current.id, nightId: current.nightId });
}

/** Notification quick-action router. Banner tap alone must not complete. */
export async function handleRetainerNotificationAction(
  actionId: string,
  data: { occurrenceId?: string; nightId?: string },
): Promise<"open" | "noop"> {
  if (!(await isRetainerCareActive())) return "noop";
  const occurrenceId = data.occurrenceId ?? (data.nightId ? nightOccurrenceId(data.nightId) : null);
  if (!occurrenceId) return "open";

  if (actionId === "RETAINER_SNOOZE") {
    await snoozeRetainerCare();
    return "noop";
  }
  if (actionId === "RETAINER_SKIP") {
    await skipRetainerCareTonight();
    return "noop";
  }
  if (actionId === "RETAINER_STILL_EATING") {
    await stillEating();
    return "noop";
  }
  if (actionId === "RETAINER_CONFIRM" || actionId === "RETAINER_BACK_IN") {
    // Open app confirm modal — do not auto-complete from the tray.
    const occurrence = await getRetainerOccurrenceById(occurrenceId);
    if (occurrence) {
      const now = Date.now();
      let next = markRetainerAcknowledged(occurrence, now);
      if (occurrence.state === "pending" || occurrence.state === "snoozed" || occurrence.state === "temporarily_removed") {
        next = bumpFollowUpCount(next, now);
      }
      await upsertRetainerOccurrence(next);
    }
    markPendingRetainerConfirm();
    return "open";
  }
  // Banner tap — open screen; never complete.
  return "open";
}

/** One-shot flag so Retainer Care can open the confirm sheet after a notification action. */
let _pendingRetainerConfirm = false;

export function markPendingRetainerConfirm(): void {
  _pendingRetainerConfirm = true;
}

export function consumePendingRetainerConfirm(): boolean {
  const value = _pendingRetainerConfirm;
  _pendingRetainerConfirm = false;
  return value;
}

export function retainerNotificationContentForPlanItem(kind: "initial" | "follow_up" | "snack" | "snooze", level?: number) {
  if (kind === "initial" || kind === "snooze") return initialRetainerReminderCopy();
  if (kind === "snack") return snackFollowUpCopy();
  return retainerFollowUpCopy(level ?? 1);
}
