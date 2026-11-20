/**
 * Local-only persistence for personal Retainer Care.
 * Intentionally does NOT call markCloudKitBackupDirty and is excluded from exportAllData.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  mergeRetainerSettings,
  type RetainerOccurrence,
  type RetainerSettings,
} from "@/lib/retainer-care-core";

export const RETAINER_SETTINGS_KEY = "synapse_retainer_care_settings_v1";
export const RETAINER_OCCURRENCES_KEY = "synapse_retainer_care_occurrences_v1";

export const RETAINER_CLEAR_KEYS = [RETAINER_SETTINGS_KEY, RETAINER_OCCURRENCES_KEY] as const;

export async function loadRetainerSettings(): Promise<RetainerSettings> {
  try {
    const raw = await AsyncStorage.getItem(RETAINER_SETTINGS_KEY);
    if (!raw) return mergeRetainerSettings();
    return mergeRetainerSettings(JSON.parse(raw) as Partial<RetainerSettings>);
  } catch {
    return mergeRetainerSettings();
  }
}

export async function saveRetainerSettings(settings: RetainerSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(RETAINER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("saveRetainerSettings failed", e);
  }
}

export async function loadRetainerOccurrences(): Promise<RetainerOccurrence[]> {
  try {
    const raw = await AsyncStorage.getItem(RETAINER_OCCURRENCES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RetainerOccurrence[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRetainerOccurrences(occurrences: RetainerOccurrence[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RETAINER_OCCURRENCES_KEY, JSON.stringify(occurrences));
  } catch (e) {
    console.warn("saveRetainerOccurrences failed", e);
  }
}

export async function upsertRetainerOccurrence(occurrence: RetainerOccurrence): Promise<void> {
  const all = await loadRetainerOccurrences();
  const index = all.findIndex((item) => item.id === occurrence.id);
  if (index >= 0) all[index] = occurrence;
  else all.push(occurrence);
  // Keep a bounded local history (~180 nights).
  all.sort((a, b) => b.nightId.localeCompare(a.nightId));
  await saveRetainerOccurrences(all.slice(0, 180));
}

export async function getRetainerOccurrenceById(id: string): Promise<RetainerOccurrence | null> {
  const all = await loadRetainerOccurrences();
  return all.find((item) => item.id === id) ?? null;
}

export async function clearRetainerCareData(): Promise<void> {
  await Promise.all(RETAINER_CLEAR_KEYS.map((key) => AsyncStorage.removeItem(key).catch(() => {})));
}
