import AsyncStorage from "@react-native-async-storage/async-storage";
import { feedbackStorage, medicationLogStorage } from "@/lib/storage";

const FEEDBACK_PROMPT_KEY = "feedback_prompt_state_v1";

export const FEEDBACK_PROMPT_RULES = {
  minAppOpens: 5,
  minDaysSinceFirstOpen: 3,
  minMedicationLogs: 3,
  minWidgetLaunches: 1,
  cooldownDays: 21,
} as const;

type FeedbackPromptState = {
  firstOpenedAt?: string;
  appOpenCount: number;
  widgetLaunchCount: number;
  lastPromptAt?: string;
  dismissedForVersions?: string[];
  completedForVersions?: string[];
};

const DEFAULT_STATE: FeedbackPromptState = {
  appOpenCount: 0,
  widgetLaunchCount: 0,
  dismissedForVersions: [],
  completedForVersions: [],
};

function diffDays(from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

async function readState(): Promise<FeedbackPromptState> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_PROMPT_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(next: FeedbackPromptState) {
  await AsyncStorage.setItem(FEEDBACK_PROMPT_KEY, JSON.stringify(next));
}

export async function trackFeedbackAppOpen() {
  const state = await readState();
  const now = new Date().toISOString();
  await writeState({
    ...state,
    firstOpenedAt: state.firstOpenedAt ?? now,
    appOpenCount: state.appOpenCount + 1,
  });
}

export async function trackFeedbackWidgetLaunch() {
  const state = await readState();
  await writeState({
    ...state,
    widgetLaunchCount: state.widgetLaunchCount + 1,
  });
}

export async function markFeedbackPromptDismissed(versionKey: string) {
  const state = await readState();
  const dismissedForVersions = new Set(state.dismissedForVersions ?? []);
  dismissedForVersions.add(versionKey);
  await writeState({
    ...state,
    lastPromptAt: new Date().toISOString(),
    dismissedForVersions: Array.from(dismissedForVersions),
  });
}

export async function markFeedbackPromptCompleted(versionKey: string) {
  const state = await readState();
  const completedForVersions = new Set(state.completedForVersions ?? []);
  completedForVersions.add(versionKey);
  await writeState({
    ...state,
    lastPromptAt: new Date().toISOString(),
    completedForVersions: Array.from(completedForVersions),
  });
}

export async function shouldShowFeedbackPrompt(versionKey: string) {
  const [state, medicationLogs, feedbackEntries] = await Promise.all([
    readState(),
    medicationLogStorage.getAll(),
    feedbackStorage.getAll(),
  ]);

  if (!state.firstOpenedAt) return false;
  if ((state.dismissedForVersions ?? []).includes(versionKey)) return false;
  if ((state.completedForVersions ?? []).includes(versionKey)) return false;
  if (feedbackEntries.length > 0) return false;

  const now = new Date().toISOString();
  const daysSinceFirstOpen = diffDays(state.firstOpenedAt, now);
  const daysSinceLastPrompt = state.lastPromptAt ? diffDays(state.lastPromptAt, now) : Number.POSITIVE_INFINITY;
  const takenMedicationLogs = medicationLogs.filter((log) => log.taken).length;

  if (daysSinceLastPrompt < FEEDBACK_PROMPT_RULES.cooldownDays) return false;

  const engagementSignals = [
    state.appOpenCount >= FEEDBACK_PROMPT_RULES.minAppOpens,
    daysSinceFirstOpen >= FEEDBACK_PROMPT_RULES.minDaysSinceFirstOpen,
    takenMedicationLogs >= FEEDBACK_PROMPT_RULES.minMedicationLogs,
    state.widgetLaunchCount >= FEEDBACK_PROMPT_RULES.minWidgetLaunches,
  ].filter(Boolean).length;

  return engagementSignals >= 3;
}

