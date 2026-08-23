/**
 * Medication Enforcement Mode (PRIVATE) — orchestration layer.
 *
 * Ties the pure core (lib/med-enforcement-core.ts) to storage and the existing
 * notification system. It NEVER changes medication schedules, doses, or the
 * canonical adherence math in Reports. TAKEN writes the normal medication log
 * (idempotently); SKIPPED / UNABLE_TO_TAKE / MISSED are accountability metadata
 * only and never fabricate medication logs.
 *
 * This module statically imports notification-manager's low-level enforcement
 * helpers; notification-manager only imports THIS module lazily (dynamic import)
 * to avoid a require cycle.
 */
import { featureFlags } from "@/constants/feature-flags";
import { DEFAULT_ESCALATION_OFFSETS_MIN, DEFAULT_ENFORCEMENT_SNOOZE_MIN } from "@/constants/med-enforcement-copy";
import { getDaysAgo, getToday } from "@/lib/date-utils";
import {
  medicationEnforcementStorage,
  medicationLogStorage,
  medicationStorage,
  normalizeMedication,
  settingsStorage,
  type Medication,
} from "@/lib/storage";
import {
  applyResolution,
  applySnooze,
  buildEscalationPlan,
  buildSnoozeEscalationPlan,
  computeEnforcementMetrics,
  createEnforcementEvent,
  doseEventId,
  enforcementActiveOccurrenceMs,
  finalizeStaleAsMissed,
  localDateKey,
  selectOccurrencesWithinBudget,
  snoozeReminderNotificationId,
  type EnforcementMetrics,
  type EnforcementResolution,
  type MedicationEnforcementEvent,
  type OccurrenceCandidate,
} from "@/lib/med-enforcement-core";
import {
  DEFAULT_REMINDER_TIMES,
  cancelAllEnforcementNotifications,
  cancelEnforcementNotifications,
  debugDumpEnforcementNotifications,
  scheduleEnforcementNotificationsForPlan,
} from "@/lib/notification-manager";

/** DEV-only structured logging for enforcement scheduling (stripped in production). */
function isDevBuild(): boolean {
  return !!(globalThis as { __DEV__?: boolean }).__DEV__;
}
function enforcementDevLog(message: string, lines?: string[]): void {
  if (!isDevBuild()) return;
  console.log(`[med-enforce] ${message}`);
  (lines ?? []).forEach((line) => console.log(`[med-enforce]   ${line}`));
}

/**
 * The feature is active only when BOTH the compile-time master flag AND the
 * private persisted per-install setting are enabled. Not tied to Supabase auth —
 * Synapse works logged out and health data is local-first.
 */
export async function isMedicationEnforcementActive(): Promise<boolean> {
  if (!featureFlags.medicationEnforcementEnabled) return false;
  try {
    const settings = await settingsStorage.get();
    return settings.medicationEnforcementEnabled === true;
  } catch {
    return false;
  }
}

function doseTime(med: Medication, doseIndex: number): { hour: number; minute: number } {
  const normalized = normalizeMedication(med);
  const dose = normalized.doses?.[doseIndex];
  if (dose?.reminderTime && /^\d{1,2}:\d{2}$/.test(dose.reminderTime)) {
    const [h, m] = dose.reminderTime.split(":").map((n) => parseInt(n, 10) || 0);
    return { hour: h, minute: m };
  }
  const def = DEFAULT_REMINDER_TIMES[dose?.timeOfDay ?? "Morning"] ?? DEFAULT_REMINDER_TIMES.Morning;
  return { hour: def.hour, minute: def.minute };
}

/**
 * V1 enforcement covers daily-cadence scheduled medications. Weekly / interval
 * medications keep their normal reminders but do not get an escalation ladder in
 * V1 (documented limitation), because inferring their exact next occurrence here
 * would risk enforcing on a day the dose is not actually due.
 */
function isDailyCadenceMed(med: Medication): boolean {
  if (med.medicationType === "prn") return false;
  if (med.reminderCadence && med.reminderCadence !== "daily") return false;
  const freq = (med.frequency ?? "").toLowerCase();
  if (/week|every\s+\d+\s+days?|month/.test(freq)) return false;
  return true;
}

function doseLabel(med: Medication, doseIndex: number): string {
  const normalized = normalizeMedication(med);
  const dose = normalized.doses?.[doseIndex];
  if (!dose) return "";
  return `${dose.amount ?? ""} ${dose.unit ?? ""}`.trim();
}

async function loadEvents(): Promise<MedicationEnforcementEvent[]> {
  return medicationEnforcementStorage.getAll();
}

/**
 * Reconcile the bounded escalation ladders. Safe to call repeatedly (on load,
 * app-active, and after medication/settings changes). Uses deterministic
 * notification IDs and a cancel-then-reschedule pass so it never creates
 * duplicate pending notifications.
 */
export async function reconcileEnforcement(options?: { medicationNotificationsEnabled?: boolean }): Promise<void> {
  const active = await isMedicationEnforcementActive();
  const medsOn = options?.medicationNotificationsEnabled !== false;

  if (!active || !medsOn) {
    // Feature off (or medication reminders muted): remove all enforcement
    // notifications but keep metadata. Normal medication reminders are untouched.
    await cancelAllEnforcementNotifications();
    return;
  }

  const now = Date.now();
  const today = getToday();
  const escalationWindowMin = Math.max(...DEFAULT_ESCALATION_OFFSETS_MIN);

  // 1) Administrative finalize: past-date unresolved events become MISSED.
  const existing = await loadEvents();
  const { events: afterFinalize, changedIds } = finalizeStaleAsMissed(existing, today, now);
  if (changedIds.length > 0) {
    await medicationEnforcementStorage.setAll(afterFinalize);
  }
  const byId = new Map(afterFinalize.map((event) => [event.id, event]));

  // 2) Build candidate occurrences for the nearest daily doses. We target the
  //    currently-active occurrence (today) for the full escalation window so a
  //    reconcile that runs at/after the scheduled minute does not abandon today's
  //    ladder by rolling to tomorrow.
  const meds = await medicationStorage.getAll();
  const candidates: OccurrenceCandidate[] = [];
  for (const med of meds) {
    if (!med.active || !isDailyCadenceMed(med)) continue;
    const normalized = normalizeMedication(med);
    const doseCount = Math.max(1, normalized.doses?.length ?? 1);
    for (let doseIndex = 0; doseIndex < doseCount; doseIndex++) {
      const { hour, minute } = doseTime(med, doseIndex);
      const scheduledAtMs = enforcementActiveOccurrenceMs(now, hour, minute, escalationWindowMin);
      candidates.push({
        medicationId: med.id,
        doseIndex,
        medicationName: med.name ?? "Medication",
        dosage: doseLabel(med, doseIndex),
        scheduledAtMs,
      });
    }
  }

  enforcementDevLog(
    `reconcile: active=${active} medsOn=${medsOn} candidates=${candidates.length}`,
    candidates.map((c) => `${c.medicationId}:${c.doseIndex} @ ${new Date(c.scheduledAtMs).toLocaleString()}`),
  );

  const selected = selectOccurrencesWithinBudget(candidates);
  const selectedIds = new Set(
    selected.map((c) => doseEventId(c.medicationId, c.doseIndex, localDateKey(c.scheduledAtMs))),
  );

  // 3) Clear all enforcement notifications, then reschedule only for selected,
  //    still-unresolved occurrences. This guarantees no duplicate pending IDs.
  await cancelAllEnforcementNotifications();

  for (const candidate of selected) {
    const date = localDateKey(candidate.scheduledAtMs);
    const id = doseEventId(candidate.medicationId, candidate.doseIndex, date);
    let event = byId.get(id);
    if (!event) {
      event = createEnforcementEvent({
        medicationId: candidate.medicationId,
        doseIndex: candidate.doseIndex,
        scheduledAtMs: candidate.scheduledAtMs,
        nowMs: now,
      });
    }
    // Do not re-nudge an already-resolved dose.
    if (event.status !== "unresolved" && event.status !== "snoozed") {
      await medicationEnforcementStorage.upsert(event);
      continue;
    }
    const plan = buildEscalationPlan(id, candidate.scheduledAtMs, now, DEFAULT_ESCALATION_OFFSETS_MIN);
    const updated: MedicationEnforcementEvent = {
      ...event,
      firstNotifiedAt: event.firstNotifiedAt ?? new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
    await medicationEnforcementStorage.upsert(updated);
    if (plan.length > 0) {
      await scheduleEnforcementNotificationsForPlan(plan, {
        doseEventId: id,
        medicationId: candidate.medicationId,
        doseIndex: candidate.doseIndex,
        medicationName: candidate.medicationName,
        dosage: candidate.dosage,
      });
    }
    enforcementDevLog(
      `scheduled ladder for ${id} (scheduledAt ${new Date(candidate.scheduledAtMs).toLocaleString()}), planned=${plan.length}`,
      plan.map((p) => `${p.id} @ ${new Date(p.fireAtMs).toLocaleString()}`),
    );
  }
  void selectedIds;

  // DEV-only: read back the ACTUAL pending enforcement notifications from the OS.
  await debugDumpEnforcementNotifications();
}

async function ensureEvent(
  eventId: string,
  context?: { medicationId?: string; doseIndex?: number },
): Promise<MedicationEnforcementEvent> {
  const existing = await medicationEnforcementStorage.getById(eventId);
  if (existing) return existing;

  // Reconstruct from the id (medicationId:doseIndex:date) so resolution works even
  // if reconcile has not yet created the event (e.g. app relaunch from a notification).
  const parts = eventId.split(":");
  const date = parts[parts.length - 1];
  const doseIndex = context?.doseIndex ?? (parseInt(parts[parts.length - 2] ?? "0", 10) || 0);
  const medicationId = context?.medicationId || parts.slice(0, parts.length - 2).join(":");
  const now = Date.now();
  let scheduledAtMs = now;
  try {
    const meds = await medicationStorage.getAll();
    const med = meds.find((m) => m.id === medicationId);
    if (med && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const { hour, minute } = doseTime(med, doseIndex);
      const [y, mo, d] = date.split("-").map(Number);
      scheduledAtMs = new Date(y, mo - 1, d, hour, minute, 0, 0).getTime();
    }
  } catch {
    // best-effort; fall back to now
  }
  const event = createEnforcementEvent({ medicationId, doseIndex, scheduledAtMs, nowMs: now });
  // Preserve the exact id we were asked to resolve.
  return { ...event, id: eventId };
}

/**
 * Resolve a dose event to a terminal state.
 * - TAKEN writes the normal medication log via the idempotent ensureTaken path.
 * - SKIPPED / UNABLE_TO_TAKE record metadata + optional verbatim reason only.
 * - Cancels all remaining escalation notifications for the dose.
 */
export async function resolveDoseEvent(
  eventId: string,
  resolution: Exclude<EnforcementResolution, "MISSED">,
  options?: { reason?: string; medicationId?: string; doseIndex?: number },
): Promise<MedicationEnforcementEvent> {
  const event = await ensureEvent(eventId, options);
  const now = Date.now();

  if (resolution === "TAKEN") {
    // Canonical adherence write — idempotent, never un-takes, never duplicates.
    await medicationLogStorage.ensureTaken(event.medicationId, event.date, event.doseIndex, {
      scheduledTime: event.scheduledAt,
    });
  }

  const resolved = applyResolution(event, resolution, now, options?.reason, DEFAULT_ESCALATION_OFFSETS_MIN);
  await medicationEnforcementStorage.upsert(resolved);
  await cancelEnforcementNotifications(eventId);
  return resolved;
}

/**
 * Snooze a dose event. Does NOT resolve it and does NOT touch adherence.
 * Cancels the current ladder, increments snoozeCount, then schedules the snoozed
 * reminder plus a bounded follow-up escalation ladder for that snooze occurrence.
 */
export async function snoozeDoseEvent(
  eventId: string,
  snoozeMinutes: number = DEFAULT_ENFORCEMENT_SNOOZE_MIN,
  options?: { medicationId?: string; doseIndex?: number; medicationName?: string; dosage?: string },
): Promise<MedicationEnforcementEvent> {
  const event = await ensureEvent(eventId, options);
  const now = Date.now();
  const { event: snoozed, snoozeIndex, snoozeFireAtMs } = applySnooze(event, now, snoozeMinutes);
  await medicationEnforcementStorage.upsert(snoozed);
  await cancelEnforcementNotifications(eventId);

  const followUp = buildSnoozeEscalationPlan(eventId, snoozeIndex, snoozeFireAtMs, now, DEFAULT_ESCALATION_OFFSETS_MIN);
  const plan = [
    { id: snoozeReminderNotificationId(eventId, snoozeIndex), fireAtMs: snoozeFireAtMs, level: 1 },
    ...followUp,
  ].filter((item) => item.fireAtMs > now);

  if (plan.length > 0) {
    let medicationName = options?.medicationName;
    let dosage = options?.dosage;
    if (!medicationName) {
      try {
        const meds = await medicationStorage.getAll();
        const med = meds.find((m) => m.id === event.medicationId);
        medicationName = med?.name ?? "Medication";
        dosage = dosage ?? (med ? doseLabel(med, event.doseIndex) : "");
      } catch {
        medicationName = "Medication";
      }
    }
    await scheduleEnforcementNotificationsForPlan(plan, {
      doseEventId: eventId,
      medicationId: event.medicationId,
      doseIndex: event.doseIndex,
      medicationName: medicationName ?? "Medication",
      dosage: dosage ?? "",
    });
  }
  return snoozed;
}

/** Route a notification quick-action (from the enforcement escalation notifications). */
export async function handleEnforcementNotificationAction(
  actionId: string,
  data: { doseEventId: string; medicationId: string; doseIndex: number },
): Promise<void> {
  if (!(await isMedicationEnforcementActive())) return;
  const context = { medicationId: data.medicationId, doseIndex: data.doseIndex };
  if (actionId === "MARK_TAKEN") {
    await resolveDoseEvent(data.doseEventId, "TAKEN", context);
  } else if (actionId === "SNOOZE") {
    await snoozeDoseEvent(data.doseEventId, DEFAULT_ENFORCEMENT_SNOOZE_MIN, context);
  }
  // Any other action (including tapping the banner) does NOT resolve the dose.
}

/** The nearest unresolved dose event whose scheduled time has arrived (for the resolution card). */
export async function getActiveDueEvent(): Promise<{
  event: MedicationEnforcementEvent;
  medication: Medication | null;
  instructions: string;
} | null> {
  if (!(await isMedicationEnforcementActive())) return null;
  const now = Date.now();
  const today = getToday();
  const events = await loadEvents();
  const due = events
    .filter((event) => (event.status === "unresolved" || event.status === "snoozed") && event.date === today)
    .filter((event) => new Date(event.scheduledAt).getTime() <= now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const event = due[0];
  if (!event) return null;
  let medication: Medication | null = null;
  try {
    const meds = await medicationStorage.getAll();
    medication = meds.find((m) => m.id === event.medicationId) ?? null;
  } catch {
    medication = null;
  }
  const dose = medication ? normalizeMedication(medication).doses?.[event.doseIndex] : undefined;
  const instructions = [doseLabel(medication as Medication, event.doseIndex), dose?.optionalNotes]
    .filter(Boolean)
    .join(" · ");
  return { event, medication, instructions };
}

/** Private 30-day enforcement metrics. NOT a second adherence percentage. */
export async function getEnforcementMetrics(days = 30): Promise<EnforcementMetrics> {
  const events = await loadEvents();
  return computeEnforcementMetrics(events, getDaysAgo(days));
}
