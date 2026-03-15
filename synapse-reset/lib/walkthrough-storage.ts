import AsyncStorage from "@react-native-async-storage/async-storage";

const WALKTHROUGH_SEEN_KEY = "app_has_seen_walkthrough";

export async function getHasSeenWalkthrough(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(WALKTHROUGH_SEEN_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function setHasSeenWalkthrough(seen: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(WALKTHROUGH_SEEN_KEY, seen ? "true" : "false");
  } catch {}
}
