/**
 * Copy for personal Retainer Care (Firm Enforcement).
 * Accountability only — no guilt, failure language, or medical claims.
 */

export const RETAINER_ROUTINE_LABEL = "Wear retainers";

export const DEFAULT_BEDTIME = { hour: 23, minute: 55 } as const;
/** Minutes after scheduled bedtime before the first follow-up. */
export const DEFAULT_FIRST_FOLLOW_UP_MIN = 10;
/** Minutes between subsequent follow-ups. */
export const DEFAULT_FOLLOW_UP_INTERVAL_MIN = 15;
/** Hard cap on follow-up notifications after the initial reminder. */
export const DEFAULT_MAX_FOLLOW_UPS = 4;
/** Minutes after “Removed for snack” before asking again. */
export const DEFAULT_SNACK_FOLLOW_UP_MIN = 20;
export const DEFAULT_SNOOZE_MIN = 10;
/** Morning cutoff (local hour): before this, post-midnight time still belongs to last night. */
export const DEFAULT_MORNING_CUTOFF_HOUR = 12;

export const RETAINER_CATEGORY = "RETAINER_CARE";

export type RetainerEscalationTier = "gentle" | "firm";

type EscalationCopy = { tier: RetainerEscalationTier; title: string; body: string };

/** 1-based follow-up copy after the initial bedtime reminder. */
const FOLLOW_UP_COPY: readonly EscalationCopy[] = [
  {
    tier: "gentle",
    title: "Retainer routine still open",
    body: "Your retainer routine is still open.",
  },
  {
    tier: "firm",
    title: "Retainers not confirmed yet",
    body: "Retainers haven’t been confirmed yet. Are you ready?",
  },
  {
    tier: "firm",
    title: "Bedtime retainer check pending",
    body: "Your bedtime retainer check is still pending.",
  },
  {
    tier: "firm",
    title: "Retainer check still pending",
    body: "This night’s retainer check is still waiting for a confirmation.",
  },
];

export function initialRetainerReminderCopy(): { title: string; body: string } {
  return {
    title: "Retainer check",
    body: "Are both retainers in?",
  };
}

export function retainerFollowUpCopy(level: number): EscalationCopy {
  const index = Math.min(Math.max(level, 1), FOLLOW_UP_COPY.length) - 1;
  return FOLLOW_UP_COPY[index];
}

export function snackFollowUpCopy(): { title: string; body: string } {
  return {
    title: "Retainers still out",
    body: "Finished eating? Your retainers are still marked as out.",
  };
}

export const RETAINER_FIRM_ENFORCEMENT_EXPLAINER =
  "Firm Enforcement sends a bedtime reminder, then a limited number of follow-ups until you confirm, skip, pause, or report a fit issue. Opening or dismissing a notification never counts as done — only an explicit confirmation does. You can snooze, pause, or turn this off anytime.";
