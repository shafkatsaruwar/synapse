import AsyncStorage from "@react-native-async-storage/async-storage";

const DISMISSED_TIPS_KEY = "app_dismissed_contextual_tips_v1";

export type ContextualTipId =
  | "medications_first_open"
  | "appointments_first_open"
  | "healthrecords_first_open"
  | "feeling_first_open"
  | "health_hub_first_open"
  | "you_hub_first_open";

export const CONTEXTUAL_TIP_COPY: Record<
  ContextualTipId,
  { title: string; body: string }
> = {
  medications_first_open: {
    title: "Medications",
    body: "Add your medications here. Synapse can help you keep track of when they’re due.",
  },
  appointments_first_open: {
    title: "Appointments",
    body: "Keep upcoming visits and important details together.",
  },
  healthrecords_first_open: {
    title: "Health Records",
    body: "Your health history, organized in one place.",
  },
  feeling_first_open: {
    title: "How I’m Feeling",
    body: "Log mood, energy, sleep, or symptoms whenever you want—no pressure to fill every field.",
  },
  health_hub_first_open: {
    title: "Health",
    body: "Medications, appointments, how you’re feeling, and more—all in one place.",
  },
  you_hub_first_open: {
    title: "You",
    body: "Profile, emergency info, privacy, and preferences live here.",
  },
};

/** Screens where contextual tips must never appear. */
export const TIP_BLOCKED_SCREENS = new Set([
  "emergency",
  "emergencycard",
  "sickmode",
]);

export async function getDismissedTips(): Promise<Set<ContextualTipId>> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_TIPS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is ContextualTipId => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export async function isTipDismissed(id: ContextualTipId): Promise<boolean> {
  const dismissed = await getDismissedTips();
  return dismissed.has(id);
}

export async function dismissTip(id: ContextualTipId): Promise<void> {
  try {
    const dismissed = await getDismissedTips();
    dismissed.add(id);
    await AsyncStorage.setItem(DISMISSED_TIPS_KEY, JSON.stringify(Array.from(dismissed)));
  } catch {}
}

export async function resetDismissedTips(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DISMISSED_TIPS_KEY);
  } catch {}
}

export function tipIdForScreen(screen: string): ContextualTipId | null {
  switch (screen) {
    case "medications":
      return "medications_first_open";
    case "appointments":
      return "appointments_first_open";
    case "healthrecords":
      return "healthrecords_first_open";
    case "feeling":
      return "feeling_first_open";
    case "health":
      return "health_hub_first_open";
    case "you":
      return "you_hub_first_open";
    default:
      return null;
  }
}
