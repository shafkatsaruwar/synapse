import AsyncStorage from "@react-native-async-storage/async-storage";

const RAMADAN_DAILY_LOG_KEY = "ramadan_daily_log";

export type WaterUnit = "glasses" | "ml" | "oz";

export interface RamadanDailyLogEntry {
  date: string;
  fasted: boolean;
  waterIntake: number;
  waterUnit: WaterUnit;
  energy: number;
  mood: number;
  motivation: number;
}

function parseRaw(raw: unknown): RamadanDailyLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item == null || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const date = typeof o.date === "string" ? o.date : "";
      if (!date) return null;
      const fasted = o.fasted === true;
      const waterIntake = typeof o.waterIntake === "number" ? o.waterIntake : 0;
      const waterUnit =
        o.waterUnit === "glasses" || o.waterUnit === "ml" || o.waterUnit === "oz"
          ? o.waterUnit
          : "glasses";
      const energy =
        typeof o.energy === "number" && o.energy >= 1 && o.energy <= 5
          ? o.energy
          : 3;
      const mood =
        typeof o.mood === "number" && o.mood >= 1 && o.mood <= 5 ? o.mood : 3;
      const motivation =
        typeof o.motivation === "number" &&
        o.motivation >= 1 &&
        o.motivation <= 5
          ? o.motivation
          : 3;
      return {
        date,
        fasted,
        waterIntake,
        waterUnit,
        energy,
        mood,
        motivation,
      };
    })
    .filter((e): e is RamadanDailyLogEntry => e != null);
}

export async function getRamadanDailyLog(): Promise<RamadanDailyLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(RAMADAN_DAILY_LOG_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    return parseRaw(parsed);
  } catch {
    return [];
  }
}

export async function getRamadanDailyLogByDate(
  date: string
): Promise<RamadanDailyLogEntry | null> {
  const all = await getRamadanDailyLog();
  return all.find((e) => e.date === date) ?? null;
}

export async function saveRamadanDailyLogEntry(
  entry: RamadanDailyLogEntry
): Promise<void> {
  const all = await getRamadanDailyLog();
  const rest = all.filter((e) => e.date !== entry.date);
  await AsyncStorage.setItem(
    RAMADAN_DAILY_LOG_KEY,
    JSON.stringify([...rest, entry])
  );
}
