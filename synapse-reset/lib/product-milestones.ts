/**
 * Privacy-conscious product milestones.
 *
 * Stores only non-sensitive event names and timestamps locally.
 * Never records diagnoses, medication names, symptom details, or other PHI.
 * Does not upload telemetry. See docs/RETENTION_MEASUREMENT.md.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const MILESTONES_KEY = "app_product_milestones_v1";
const SESSION_KEY = "app_product_session_v1";

export type ProductMilestoneId =
  | "onboarding_completed"
  | "first_useful_action"
  | "first_medication_configured"
  | "first_appointment_added"
  | "first_checkin_completed"
  | "contextual_help_dismissed"
  | "return_session";

export type ProductMilestonesState = {
  /** ISO timestamps keyed by milestone; first occurrence only for most events. */
  milestones: Partial<Record<ProductMilestoneId, string>>;
  /** Count of app foreground sessions after onboarding. */
  sessionCount: number;
  /** ISO date (YYYY-MM-DD) of first open after onboarding. */
  firstOpenDate?: string;
  /** ISO date of last recorded session. */
  lastSessionDate?: string;
};

const EMPTY: ProductMilestonesState = {
  milestones: {},
  sessionCount: 0,
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getProductMilestones(): Promise<ProductMilestonesState> {
  try {
    const raw = await AsyncStorage.getItem(MILESTONES_KEY);
    if (!raw) return { ...EMPTY, milestones: {} };
    const parsed = JSON.parse(raw) as ProductMilestonesState;
    return {
      milestones: parsed.milestones ?? {},
      sessionCount: typeof parsed.sessionCount === "number" ? parsed.sessionCount : 0,
      firstOpenDate: parsed.firstOpenDate,
      lastSessionDate: parsed.lastSessionDate,
    };
  } catch {
    return { ...EMPTY, milestones: {} };
  }
}

async function saveProductMilestones(state: ProductMilestonesState): Promise<void> {
  try {
    await AsyncStorage.setItem(MILESTONES_KEY, JSON.stringify(state));
  } catch {}
}

/** Record a milestone once (idempotent for first-occurrence events). */
export async function recordMilestone(id: ProductMilestoneId): Promise<boolean> {
  const state = await getProductMilestones();
  if (state.milestones[id]) return false;
  state.milestones[id] = new Date().toISOString();
  await saveProductMilestones(state);
  return true;
}

/**
 * Call on app become-active after onboarding.
 * Tracks return sessions without storing sensitive content.
 */
export async function trackReturnSession(): Promise<void> {
  const state = await getProductMilestones();
  const today = todayIsoDate();
  if (!state.firstOpenDate) {
    state.firstOpenDate = today;
  }
  if (state.lastSessionDate !== today) {
    state.sessionCount += 1;
    state.lastSessionDate = today;
    // Returning after a gap of 3+ calendar days since first open counts as return activity.
    if (state.sessionCount > 1) {
      if (!state.milestones.return_session) {
        state.milestones.return_session = new Date().toISOString();
      }
    }
    await saveProductMilestones(state);
  }
}

/** Local aggregate counts for optional opt-in reporting (never includes PHI). */
export async function getLocalMilestoneSummary(): Promise<{
  activation: boolean;
  day1Returned: boolean;
  day7Eligible: boolean;
  day28Eligible: boolean;
  milestoneIds: ProductMilestoneId[];
  sessionCount: number;
}> {
  const state = await getProductMilestones();
  const activation = Boolean(
    state.milestones.first_useful_action ||
      state.milestones.first_medication_configured ||
      state.milestones.first_appointment_added ||
      state.milestones.first_checkin_completed
  );
  const first = state.firstOpenDate ? new Date(state.firstOpenDate + "T12:00:00") : null;
  const now = new Date();
  const daysSinceFirst = first
    ? Math.floor((now.getTime() - first.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  return {
    activation,
    day1Returned: state.sessionCount >= 2 && daysSinceFirst >= 1,
    day7Eligible: daysSinceFirst >= 7,
    day28Eligible: daysSinceFirst >= 28,
    milestoneIds: Object.keys(state.milestones) as ProductMilestoneId[],
    sessionCount: state.sessionCount,
  };
}

export async function clearProductMilestonesForTests(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([MILESTONES_KEY, SESSION_KEY]);
  } catch {}
}
