import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, NativeModules, Platform } from "react-native";
import { exportAllData, importAllData, type ExportPayload } from "@/lib/storage";
import {
  getLocalDataUpdatedAt,
  markCloudKitBackupDirty,
  setLocalDataUpdatedAt,
  subscribeToCloudKitBackupDirty,
  withCloudKitBackupSuppressed,
} from "@/lib/cloudkit-backup-scheduler";

const LAST_SYNCED_AT_KEY = "synapse_cloudkit_last_synced_at";
const LAST_ERROR_KEY = "synapse_cloudkit_last_error";

type CloudKitMetadata = {
  available?: boolean;
  status?: string;
  recordName?: string;
  userId?: string;
  lastUpdated?: string;
};

type CloudKitPayloadResult = CloudKitMetadata & {
  payload?: string;
};

type SynapseCloudKitBridge = {
  getStatus(): Promise<CloudKitMetadata>;
  fetchBackupMetadata(): Promise<CloudKitMetadata | null>;
  savePayload(payload: string, lastUpdatedISO: string): Promise<CloudKitMetadata>;
  restorePayload(): Promise<CloudKitPayloadResult | null>;
};

const bridge = NativeModules.SynapseCloudKitBridge as SynapseCloudKitBridge | undefined;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let restoreInFlight = false;
let installed = false;

function isCloudKitAvailable() {
  return Platform.OS === "ios" && !!bridge;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function setLastSyncedAt(value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNCED_AT_KEY, value);
    await AsyncStorage.removeItem(LAST_ERROR_KEY);
  } catch {
    // Metadata persistence is best-effort.
  }
}

async function setLastError(error: unknown): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    await AsyncStorage.setItem(LAST_ERROR_KEY, message);
  } catch {
    // Best-effort only.
  }
}

function normalizeRestorePayload(raw: unknown): ExportPayload {
  const payload = raw as ExportPayload;
  return {
    ...payload,
    healthLogs: payload.healthLogs ?? [],
    symptoms: payload.symptoms ?? [],
    medications: payload.medications ?? [],
    medicationLogs: payload.medicationLogs ?? [],
    appointments: payload.appointments ?? [],
    labWork: payload.labWork ?? [],
    imaging: payload.imaging ?? [],
  };
}

export async function getCloudKitBackupStatus(): Promise<{
  available: boolean;
  accountStatus: string;
  lastSyncedAt: string | null;
  cloudLastUpdatedAt: string | null;
  lastError: string | null;
}> {
  const [lastSyncedAt, lastError] = await Promise.all([
    AsyncStorage.getItem(LAST_SYNCED_AT_KEY).catch(() => null),
    AsyncStorage.getItem(LAST_ERROR_KEY).catch(() => null),
  ]);

  if (!isCloudKitAvailable() || !bridge) {
    return { available: false, accountStatus: "unavailable", lastSyncedAt, cloudLastUpdatedAt: null, lastError };
  }

  try {
    const [status, metadata] = await Promise.all([
      bridge.getStatus(),
      bridge.fetchBackupMetadata().catch(() => null),
    ]);
    return {
      available: status.available === true,
      accountStatus: status.status ?? "unknown",
      lastSyncedAt,
      cloudLastUpdatedAt: metadata?.lastUpdated || null,
      lastError,
    };
  } catch (error) {
    await setLastError(error);
    return { available: false, accountStatus: "error", lastSyncedAt, cloudLastUpdatedAt: null, lastError: String(error) };
  }
}

export async function saveToICloud(): Promise<{ skipped?: boolean; error?: Error | null }> {
  if (!isCloudKitAvailable() || !bridge) return { skipped: true };
  if (saveInFlight) return { skipped: true };

  saveInFlight = true;
  try {
    const payload = await exportAllData();
    const localUpdatedAt = (await getLocalDataUpdatedAt()) ?? payload.exportDate ?? new Date().toISOString();
    const saved = await bridge.savePayload(JSON.stringify(payload), localUpdatedAt);
    if (saved.available === false) return { skipped: true };
    const syncedAt = saved.lastUpdated || localUpdatedAt;
    await setLocalDataUpdatedAt(syncedAt);
    await setLastSyncedAt(syncedAt);
    return { error: null };
  } catch (error) {
    await setLastError(error);
    return { error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    saveInFlight = false;
  }
}

export async function restoreFromICloud(options?: { uploadLocalIfNewer?: boolean }): Promise<{
  restored: boolean;
  uploadedLocal?: boolean;
  skipped?: boolean;
  error?: Error | null;
}> {
  if (!isCloudKitAvailable() || !bridge) return { restored: false, skipped: true };
  if (restoreInFlight) return { restored: false, skipped: true };

  restoreInFlight = true;
  try {
    const cloud = await bridge.restorePayload();
    if (cloud?.available === false) return { restored: false, skipped: true };
    if (!cloud?.payload || !cloud.lastUpdated) return { restored: false, skipped: true };

    const localUpdatedAt = await getLocalDataUpdatedAt();
    const cloudTime = dateValue(cloud.lastUpdated);
    const localTime = dateValue(localUpdatedAt);

    if (cloudTime > localTime) {
      const parsed = normalizeRestorePayload(JSON.parse(cloud.payload));
      await withCloudKitBackupSuppressed(async () => {
        await importAllData(parsed);
      });
      await setLocalDataUpdatedAt(cloud.lastUpdated!);
      await setLastSyncedAt(cloud.lastUpdated!);
      return { restored: true, error: null };
    }

    if (options?.uploadLocalIfNewer && localTime > cloudTime) {
      await saveToICloud();
      return { restored: false, uploadedLocal: true, error: null };
    }

    return { restored: false, skipped: true };
  } catch (error) {
    await setLastError(error);
    return { restored: false, error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    restoreInFlight = false;
  }
}

export function scheduleCloudKitBackup(delayMs = 12_000) {
  if (!isCloudKitAvailable()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveToICloud().catch(() => {});
  }, delayMs);
}

export function installCloudKitAutoSync() {
  if (installed || !isCloudKitAvailable()) return () => {};
  installed = true;

  restoreFromICloud({ uploadLocalIfNewer: true }).catch(() => {});

  const unsubscribeDirty = subscribeToCloudKitBackupDirty(() => {
    scheduleCloudKitBackup();
  });

  const appStateSub = AppState.addEventListener("change", (state) => {
    if (state === "background" || state === "inactive") {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      saveToICloud().catch(() => {});
    }
    if (state === "active") {
      restoreFromICloud({ uploadLocalIfNewer: true }).catch(() => {});
    }
  });

  return () => {
    unsubscribeDirty();
    appStateSub.remove();
    installed = false;
  };
}

export { markCloudKitBackupDirty };
