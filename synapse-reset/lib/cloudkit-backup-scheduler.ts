import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCAL_DATA_UPDATED_AT_KEY = "synapse_cloudkit_local_data_updated_at";

type BackupListener = (updatedAt: string) => void;

let suppressed = false;
const listeners = new Set<BackupListener>();

export async function getLocalDataUpdatedAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LOCAL_DATA_UPDATED_AT_KEY);
  } catch {
    return null;
  }
}

export async function setLocalDataUpdatedAt(value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_DATA_UPDATED_AT_KEY, value);
  } catch {
    // Backup metadata should never block local app use.
  }
}

export async function markCloudKitBackupDirty(): Promise<void> {
  if (suppressed) return;
  const updatedAt = new Date().toISOString();
  await setLocalDataUpdatedAt(updatedAt);
  listeners.forEach((listener) => listener(updatedAt));
}

export function subscribeToCloudKitBackupDirty(listener: BackupListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function withCloudKitBackupSuppressed<T>(work: () => Promise<T>): Promise<T> {
  suppressed = true;
  try {
    return await work();
  } finally {
    suppressed = false;
  }
}
