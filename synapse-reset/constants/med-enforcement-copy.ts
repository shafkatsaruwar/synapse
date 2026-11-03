/**
 * Copy for Medication Enforcement Mode notifications.
 *
 * IMPORTANT: This wording is an accountability nudge only. It must NEVER assert
 * medical lateness, a "safe window", or any dose/skip/double recommendation.
 * The enforcement layer only knows scheduledTime, unresolvedTimeElapsed, and
 * reminderEscalationLevel — not whether a dose is medically late.
 */

export type EscalationTier = "gentle" | "firm" | "severe";

/**
 * Default escalation offsets in minutes, measured FROM the original scheduled
 * reminder time (not sequential gaps). Kept intentionally small and bounded.
 */
export const DEFAULT_ESCALATION_OFFSETS_MIN: readonly number[] = [5, 10, 15];

/** Snooze duration options (minutes). */
export const ENFORCEMENT_SNOOZE_OPTIONS_MIN: readonly number[] = [5, 10, 15];
export const DEFAULT_ENFORCEMENT_SNOOZE_MIN = 10;

type EscalationCopy = { tier: EscalationTier; title: string; body: (medicationName: string) => string };

/**
 * Escalation copy by level (1-based). Level 0 is the initial "due" notification,
 * which is delivered by Synapse's existing medication reminder.
 */
const ESCALATION_LEVELS: readonly EscalationCopy[] = [
  {
    tier: "gentle",
    title: "Medication check-in",
    body: () => "Still waiting for confirmation. Have you taken it?",
  },
  {
    tier: "firm",
    title: "Still not confirmed",
    body: () => "You haven't confirmed this dose yet. Please update its status.",
  },
  {
    tier: "firm",
    title: "Still waiting",
    body: () => "This dose still needs an answer. Open Synapse to review it.",
  },
];

/** Copy for a given 1-based escalation level, clamped to the defined levels. */
export function escalationCopy(level: number, medicationName: string): { tier: EscalationTier; title: string; body: string } {
  const index = Math.min(Math.max(level, 1), ESCALATION_LEVELS.length) - 1;
  const entry = ESCALATION_LEVELS[index];
  const name = medicationName?.trim() || "your medication";
  return { tier: entry.tier, title: entry.title, body: entry.body(name) };
}

export const ESCALATION_LEVEL_COUNT = ESCALATION_LEVELS.length;
