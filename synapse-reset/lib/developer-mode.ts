import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVELOPER_MODE_KEY = "synapse_hq_developer_mode";

export type DeveloperModeState = {
  isDeveloper: true;
};

export async function getDeveloperMode(): Promise<DeveloperModeState | null> {
  try {
    const raw = await AsyncStorage.getItem(DEVELOPER_MODE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeveloperModeState>;
    return parsed?.isDeveloper === true ? { isDeveloper: true } : null;
  } catch (error) {
    console.warn("Developer mode read failed", error);
    return null;
  }
}

export async function enableDeveloperMode(): Promise<DeveloperModeState> {
  const state: DeveloperModeState = { isDeveloper: true };
  try {
    await AsyncStorage.setItem(DEVELOPER_MODE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Developer mode save failed", error);
  }
  return state;
}

export async function clearDeveloperMode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVELOPER_MODE_KEY);
  } catch (error) {
    console.warn("Developer mode clear failed", error);
  }
}
