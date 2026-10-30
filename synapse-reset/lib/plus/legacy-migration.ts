/**
 * Existing-install transition for Synapse Plus.
 *
 * Limitation: we cannot identify App Store download date or prior App Store
 * purchasers who reinstall on a wiped device. Detection is local-only:
 * walkthrough completed, product milestones, or existing meds/appointments.
 *
 * Strategy: one-time 30-day Plus transition for detected legacy installs.
 * No blocking paywall on first launch. Data is never deleted.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getHasSeenWalkthrough } from "@/lib/walkthrough-storage";
import { getProductMilestones } from "@/lib/product-milestones";
import { appointmentStorage, medicationStorage } from "@/lib/storage-self";

const KEYS = {
  evaluated: "synapse_plus_legacy_evaluated_v1",
  isLegacy: "synapse_plus_legacy_install_v1",
  transitionUntil: "synapse_plus_legacy_transition_until_v1",
  introSeen: "synapse_plus_legacy_intro_seen_v1",
  /** First time this Plus-aware binary ran (ISO). */
  plusAwareFirstOpen: "synapse_plus_aware_first_open_v1",
} as const;

export const LEGACY_TRANSITION_DAYS = 30;

export type LegacyMigrationState = {
  evaluated: boolean;
  isLegacyInstall: boolean;
  transitionUntilIso: string | null;
  introSeen: boolean;
  plusAwareFirstOpenIso: string | null;
};

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}

export async function getLegacyMigrationState(): Promise<LegacyMigrationState> {
  const [evaluated, isLegacy, until, introSeen, firstOpen] = await Promise.all([
    getItem(KEYS.evaluated),
    getItem(KEYS.isLegacy),
    getItem(KEYS.transitionUntil),
    getItem(KEYS.introSeen),
    getItem(KEYS.plusAwareFirstOpen),
  ]);
  return {
    evaluated: evaluated === "true",
    isLegacyInstall: isLegacy === "true",
    transitionUntilIso: until,
    introSeen: introSeen === "true",
    plusAwareFirstOpenIso: firstOpen,
  };
}

async function detectLegacySignals(): Promise<boolean> {
  const [walkthrough, milestones, meds, appointments] = await Promise.all([
    getHasSeenWalkthrough(),
    getProductMilestones(),
    medicationStorage.getAll().catch(() => []),
    appointmentStorage.getAll().catch(() => []),
  ]);

  if (walkthrough) return true;
  if (milestones.firstOpenDate) return true;
  if (milestones.milestones.onboarding_completed) return true;
  if (milestones.milestones.first_useful_action) return true;
  if (milestones.milestones.first_medication_configured) return true;
  if (milestones.milestones.first_appointment_added) return true;
  if (Array.isArray(meds) && meds.length > 0) return true;
  if (Array.isArray(appointments) && appointments.length > 0) return true;
  return false;
}

/**
 * Idempotent. Call once on app start after storage is ready.
 * New empty installs are not grandfathered.
 */
export async function ensureLegacyMigrationEvaluated(
  nowMs = Date.now()
): Promise<LegacyMigrationState> {
  const existing = await getLegacyMigrationState();
  if (!existing.plusAwareFirstOpenIso) {
    await setItem(KEYS.plusAwareFirstOpen, new Date(nowMs).toISOString());
  }
  if (existing.evaluated) {
    return getLegacyMigrationState();
  }

  const isLegacy = await detectLegacySignals();
  await setItem(KEYS.evaluated, "true");
  await setItem(KEYS.isLegacy, isLegacy ? "true" : "false");

  if (isLegacy) {
    const until = new Date(nowMs + LEGACY_TRANSITION_DAYS * 24 * 60 * 60 * 1000);
    await setItem(KEYS.transitionUntil, until.toISOString());
  }

  return getLegacyMigrationState();
}

export async function markLegacyIntroSeen(): Promise<void> {
  await setItem(KEYS.introSeen, "true");
}

/** Active transition window granting temporary Plus (not a StoreKit purchase). */
export async function getActiveLegacyTransitionUntil(
  nowMs = Date.now()
): Promise<string | null> {
  const state = await getLegacyMigrationState();
  if (!state.transitionUntilIso) return null;
  const until = Date.parse(state.transitionUntilIso);
  if (!Number.isFinite(until) || until <= nowMs) return null;
  return state.transitionUntilIso;
}

export async function clearLegacyMigrationForTests(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  } catch {}
}
