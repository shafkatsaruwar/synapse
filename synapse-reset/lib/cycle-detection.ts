import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import {
  cycleTrackingStorage,
  settingsStorage,
  symptomStorage,
  type UserSettings,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";

const COOLDOWN_KEY = "fir_cycle_detection_prompt_cooldown_until";
const COOLDOWN_MS = 48 * 60 * 60 * 1000;

const CYCLE_KEYWORDS = [
  "cramps",
  "menstrual cramps",
  "period pain",
  "on my period",
  "bleeding",
  "pms",
  "cycle started",
] as const;

type CycleDetectionSource = "daily-check-in" | "symptom-log" | "doctor-note" | "notes";

interface MaybePromptForCycleTrackingOptions {
  text: string;
  source: CycleDetectionSource;
  symptomName?: string;
  symptomAlreadyLogged?: boolean;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

function getCycleKeyword(text: string): string | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  return CYCLE_KEYWORDS.find((keyword) => normalized.includes(keyword)) ?? null;
}

function getDetectedSymptom(keyword: string, fallback?: string) {
  const normalizedFallback = fallback?.trim();
  if (normalizedFallback) return normalizedFallback;
  if (keyword === "bleeding" || keyword === "cycle started" || keyword === "on my period") return "Menstrual cycle";
  if (keyword === "pms") return "PMS";
  return "Cramps";
}

function cycleTrackingEnabled(settings: UserSettings) {
  return settings.enabledSections === undefined || settings.enabledSections.includes("cycletracking");
}

async function isOnCooldown() {
  const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
  if (!raw) return false;
  const until = new Date(raw).getTime();
  return Number.isFinite(until) && until > Date.now();
}

async function applyCooldown() {
  await AsyncStorage.setItem(COOLDOWN_KEY, new Date(Date.now() + COOLDOWN_MS).toISOString());
}

async function logDetectedSymptom(symptomName: string, notes: string, timestamp: string, alreadyLogged?: boolean) {
  if (alreadyLogged) return;
  await symptomStorage.save({
    date: getToday(),
    recordedAt: timestamp,
    name: symptomName,
    severity: 5,
    notes,
    trigger: "Cycle detection",
  });
}

async function startCycleTracking(symptomName: string, keyword: string, source: CycleDetectionSource, timestamp: string, symptomAlreadyLogged?: boolean) {
  await cycleTrackingStorage.save({
    date: getToday(),
    recordedAt: timestamp,
    flow: "medium",
    symptomTags: symptomName.toLowerCase().includes("cramp") ? ["cramping"] : [],
    symptoms: symptomName,
    notes: `Started from ${source.replace(/-/g, " ")} after detecting "${keyword}".`,
    cycleId: `cycle-${getToday()}-${Date.now()}`,
    cycleDay: 1,
    isCycleStart: true,
  });
  await logDetectedSymptom(symptomName, `Detected from ${source.replace(/-/g, " ")}.`, timestamp, symptomAlreadyLogged);
  await applyCooldown();
}

async function logForTodayOnly(symptomName: string, source: CycleDetectionSource, timestamp: string, symptomAlreadyLogged?: boolean) {
  await logDetectedSymptom(symptomName, `Cycle-related symptom detected from ${source.replace(/-/g, " ")}.`, timestamp, symptomAlreadyLogged);
  await applyCooldown();
}

export async function maybePromptForCycleTracking(options: MaybePromptForCycleTrackingOptions) {
  const keyword = getCycleKeyword([options.symptomName, options.text].filter(Boolean).join(" "));
  if (!keyword) return false;

  const [settings, cooldownActive] = await Promise.all([
    settingsStorage.get(),
    isOnCooldown(),
  ]);
  if (cooldownActive || !cycleTrackingEnabled(settings)) return false;

  const timestamp = new Date().toISOString();
  const symptomName = getDetectedSymptom(keyword, options.symptomName);

  Alert.alert(
    "Quick check",
    "Are you currently on your cycle?",
    [
      {
        text: "Yes",
        onPress: () => {
          Alert.alert(
            "Got it.",
            "Want me to track this cycle for you?",
            [
              {
                text: "Start tracking",
                onPress: () => {
                  void startCycleTracking(symptomName, keyword, options.source, timestamp, options.symptomAlreadyLogged);
                },
              },
              {
                text: "Just for today",
                onPress: () => {
                  void logForTodayOnly(symptomName, options.source, timestamp, options.symptomAlreadyLogged);
                },
              },
            ],
            {
              cancelable: true,
              onDismiss: () => {
                void applyCooldown();
              },
            }
          );
        },
      },
      {
        text: "No",
        onPress: () => {
          void applyCooldown();
        },
      },
      {
        text: "Not now",
        style: "cancel",
        onPress: () => {
          void applyCooldown();
        },
      },
    ],
    {
      cancelable: true,
      onDismiss: () => {
        void applyCooldown();
      },
    }
  );

  return true;
}
