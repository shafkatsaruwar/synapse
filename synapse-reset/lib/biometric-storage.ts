import AsyncStorage from "@react-native-async-storage/async-storage";

const BIOMETRIC_LOCK_KEY = "biometric_lock_enabled";

export async function getBiometricLockEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(BIOMETRIC_LOCK_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, enabled ? "true" : "false");
  } catch {}
}
