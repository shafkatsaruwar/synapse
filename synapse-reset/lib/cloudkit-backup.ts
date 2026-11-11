import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, NativeModules, Platform } from "react-native";
import { featureFlags } from "@/constants/feature-flags";
import {
  decryptBackupEnvelope,
  encryptBackupPayload,
  isCloudKitBackupEnvelope,
  parseCloudKitBackupEnvelope,
  passphraseFailureMessage,
  CLOUDKIT_SNAPSHOT_RETENTION,
  type CloudKitBackupSummary,
} from "@/lib/cloudkit-crypto";
import {
  getCloudKitRecoveryStatus,
  getStoredBackupDek,
  getStoredWrap,
  requireBackupDek,
  setCloudKitAutoBackupEnabled,
  unlockBackupWithPassphrase,
} from "@/lib/cloudkit-keys";
import {
  getLocalDataUpdatedAt,
  markCloudKitBackupDirty,
  setLocalDataUpdatedAt,
  subscribeToCloudKitBackupDirty,
  withCloudKitBackupSuppressed,
} from "@/lib/cloudkit-backup-scheduler";
import { formatRestorePreview, parseSynapseExport, type BackupFileSummary } from "@/lib/backup-import";
import { exportAllData, importAllDataTransactional, type ExportPayload } from "@/lib/storage-self";

const LAST_SYNCED_AT_KEY = "synapse_cloudkit_last_synced_at";
const LAST_ERROR_KEY = "synapse_cloudkit_last_error";
const RETRY_ATTEMPTS = 3;

type CloudKitMetadata = {
  available?: boolean;
  status?: string;
  recordName?: string;
  userId?: string;
  lastUpdated?: string;
  schemaVersion?: number;
  summaryJson?: string;
  encrypted?: boolean;
};

type CloudKitPayloadResult = CloudKitMetadata & {
  payload?: string;
};

export type CloudKitSnapshotInfo = {
  recordName: string;
  createdAt: string;
  schemaVersion: number | null;
  summary: BackupFileSummary | null;
  encrypted: boolean;
};

type SynapseCloudKitBridge = {
  getStatus(): Promise<CloudKitMetadata>;
  fetchBackupMetadata(): Promise<CloudKitMetadata | null>;
  savePayload(
    payload: string,
    lastUpdatedISO: string,
    schemaVersion: number,
    summaryJson: string,
    encrypted: boolean,
  ): Promise<CloudKitMetadata>;
  restorePayload(): Promise<CloudKitPayloadResult | null>;
  listSnapshots(): Promise<CloudKitSnapshotInfo[] | CloudKitMetadata>;
  restorePayloadByRecordName(recordName: string): Promise<CloudKitPayloadResult | null>;
};

const bridge = NativeModules.SynapseCloudKitBridge as SynapseCloudKitBridge | undefined;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let restoreInFlight = false;
let installed = false;

function isFeatureEnabled() {
  return featureFlags.cloudKitBackupEnabled === true;
}

function hasNativeBridge() {
  return Platform.OS === "ios" && !!bridge;
}

/** Runtime readiness for automatic encrypted CloudKit backup. */
export function isCloudKitBackupRuntimeReady() {
  return isFeatureEnabled() && hasNativeBridge();
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    // Never persist medical content — bridge errors are status strings only.
    await AsyncStorage.setItem(LAST_ERROR_KEY, message.slice(0, 500));
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

function asBackupFileSummary(summary: CloudKitBackupSummary | BackupFileSummary | null | undefined): BackupFileSummary | null {
  if (!summary || typeof summary !== "object") return null;
  return {
    exportDate: summary.exportDate ?? null,
    appVersion: summary.appVersion ?? null,
    schemaVersion: summary.schemaVersion ?? null,
    medicationCount: summary.medicationCount ?? 0,
    appointmentCount: summary.appointmentCount ?? 0,
    healthLogCount: summary.healthLogCount ?? 0,
    conditionCount: summary.conditionCount ?? 0,
  };
}

function parseSummaryJson(raw?: string | null): BackupFileSummary | null {
  if (!raw) return null;
  try {
    return asBackupFileSummary(JSON.parse(raw) as CloudKitBackupSummary);
  } catch {
    return null;
  }
}

export async function getCloudKitBackupStatus(): Promise<{
  available: boolean;
  featureEnabled: boolean;
  nativeBridgeAvailable: boolean;
  platform: string;
  accountStatus: string;
  lastSyncedAt: string | null;
  cloudLastUpdatedAt: string | null;
  lastError: string | null;
  recoveryConfigured: boolean;
  autoBackupEnabled: boolean;
  dekPresent: boolean;
  canEnableAutomaticBackup: boolean;
}> {
  const [lastSyncedAt, lastError, recovery] = await Promise.all([
    AsyncStorage.getItem(LAST_SYNCED_AT_KEY).catch(() => null),
    AsyncStorage.getItem(LAST_ERROR_KEY).catch(() => null),
    getCloudKitRecoveryStatus(),
  ]);

  if (!isFeatureEnabled()) {
    return {
      available: false,
      featureEnabled: false,
      nativeBridgeAvailable: !!bridge,
      platform: Platform.OS,
      accountStatus: "feature_disabled",
      lastSyncedAt,
      cloudLastUpdatedAt: null,
      lastError,
      recoveryConfigured: recovery.recoveryConfigured,
      autoBackupEnabled: recovery.autoBackupEnabled,
      dekPresent: recovery.dekPresent,
      canEnableAutomaticBackup: false,
    };
  }

  if (!hasNativeBridge() || !bridge) {
    return {
      available: false,
      featureEnabled: true,
      nativeBridgeAvailable: false,
      platform: Platform.OS,
      accountStatus: Platform.OS === "ios" ? "native_bridge_missing" : "unsupported_platform",
      lastSyncedAt,
      cloudLastUpdatedAt: null,
      lastError,
      recoveryConfigured: recovery.recoveryConfigured,
      autoBackupEnabled: recovery.autoBackupEnabled,
      dekPresent: recovery.dekPresent,
      canEnableAutomaticBackup: false,
    };
  }

  try {
    const [status, metadata] = await Promise.all([
      bridge.getStatus(),
      bridge.fetchBackupMetadata().catch(() => null),
    ]);
    const available = status.available === true;
    return {
      available,
      featureEnabled: true,
      nativeBridgeAvailable: true,
      platform: Platform.OS,
      accountStatus: status.status ?? "unknown",
      lastSyncedAt,
      cloudLastUpdatedAt: metadata?.lastUpdated || null,
      lastError,
      recoveryConfigured: recovery.recoveryConfigured,
      autoBackupEnabled: recovery.autoBackupEnabled,
      dekPresent: recovery.dekPresent,
      canEnableAutomaticBackup: available && recovery.recoveryConfigured && recovery.dekPresent,
    };
  } catch (error) {
    await setLastError(error);
    return {
      available: false,
      featureEnabled: true,
      nativeBridgeAvailable: true,
      platform: Platform.OS,
      accountStatus: "error",
      lastSyncedAt,
      cloudLastUpdatedAt: null,
      lastError: error instanceof Error ? error.message : String(error),
      recoveryConfigured: recovery.recoveryConfigured,
      autoBackupEnabled: recovery.autoBackupEnabled,
      dekPresent: recovery.dekPresent,
      canEnableAutomaticBackup: false,
    };
  }
}

async function buildEncryptedUpload(payload: ExportPayload, createdAt: string): Promise<string> {
  const dek = await requireBackupDek();
  const wrap = await getStoredWrap();
  if (!dek || !wrap) {
    throw new Error("Recovery passphrase is not set up on this device.");
  }
  const envelope = await encryptBackupPayload(
    payload as unknown as Record<string, unknown>,
    dek,
    wrap,
    createdAt,
  );
  return JSON.stringify(envelope);
}

async function saveEncryptedOnce(): Promise<{
  skipped?: boolean;
  skipReason?: string;
  error?: Error | null;
  syncedAt?: string;
}> {
  if (!isCloudKitBackupRuntimeReady() || !bridge) {
    return {
      skipped: true,
      skipReason: !isFeatureEnabled()
        ? "feature_disabled"
        : Platform.OS === "ios"
          ? "native_bridge_missing"
          : "unsupported_platform",
    };
  }

  const recovery = await getCloudKitRecoveryStatus();
  if (!recovery.recoveryConfigured || !recovery.dekPresent) {
    return { skipped: true, skipReason: "recovery_not_configured" };
  }

  const payload = await exportAllData();
  const localUpdatedAt = (await getLocalDataUpdatedAt()) ?? payload.exportDate ?? new Date().toISOString();
  const encrypted = await buildEncryptedUpload(payload, localUpdatedAt);
  const parsedForSummary = JSON.parse(encrypted) as unknown;
  const summaryJson = JSON.stringify(
    isCloudKitBackupEnvelope(parsedForSummary) ? parsedForSummary.summary : {},
  );

  const saved = await bridge.savePayload(
    encrypted,
    localUpdatedAt,
    typeof payload.schemaVersion === "number" ? payload.schemaVersion : 1,
    summaryJson,
    true,
  );

  if (saved.available === false) {
    return { skipped: true, skipReason: saved.status || "account_unavailable" };
  }

  const syncedAt = saved.lastUpdated || localUpdatedAt;
  await setLocalDataUpdatedAt(syncedAt);
  await setLastSyncedAt(syncedAt);
  return { error: null, syncedAt };
}

export async function saveToICloud(): Promise<{
  skipped?: boolean;
  skipReason?: string;
  error?: Error | null;
}> {
  if (saveInFlight) return { skipped: true, skipReason: "save_in_progress" };
  saveInFlight = true;
  try {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await saveEncryptedOnce();
        if (result.skipped) return result;
        if (!result.error) return { error: null };
        lastError = result.error;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await setLastError(lastError);
      }
      if (attempt < RETRY_ATTEMPTS - 1) {
        await sleep(1000 * 2 ** attempt);
      }
    }
    return { error: lastError ?? new Error("iCloud backup failed") };
  } finally {
    saveInFlight = false;
  }
}

export async function listICloudSnapshots(): Promise<{
  snapshots: CloudKitSnapshotInfo[];
  skipped?: boolean;
  skipReason?: string;
  error?: Error | null;
}> {
  if (!isCloudKitBackupRuntimeReady() || !bridge) {
    return {
      snapshots: [],
      skipped: true,
      skipReason: !isFeatureEnabled()
        ? "feature_disabled"
        : Platform.OS === "ios"
          ? "native_bridge_missing"
          : "unsupported_platform",
    };
  }
  try {
    const result = await bridge.listSnapshots();
    if (result && !Array.isArray(result) && result.available === false) {
      return { snapshots: [], skipped: true, skipReason: result.status || "account_unavailable" };
    }
    const rows = Array.isArray(result) ? result : [];
    const snapshots: CloudKitSnapshotInfo[] = rows
      .map((row) => ({
        recordName: row.recordName,
        createdAt: row.createdAt || "",
        schemaVersion: row.schemaVersion ?? null,
        summary:
          asBackupFileSummary(row.summary as CloudKitBackupSummary | undefined) ??
          parseSummaryJson((row as { summaryJson?: string }).summaryJson),
        encrypted: row.encrypted !== false,
      }))
      .filter((row) => row.recordName)
      .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
      .slice(0, CLOUDKIT_SNAPSHOT_RETENTION);
    return { snapshots, error: null };
  } catch (error) {
    await setLastError(error);
    return { snapshots: [], error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export type ICloudRestorePreview = {
  recordName: string;
  createdAt: string;
  summaryText: string;
  summary: BackupFileSummary | null;
  needsPassphrase: boolean;
  legacyPlaintext: boolean;
};

async function materializePayload(
  cloud: CloudKitPayloadResult,
  passphrase?: string,
): Promise<
  | { ok: true; payload: ExportPayload; createdAt: string; summary: BackupFileSummary | null }
  | { ok: false; reason: string; needsPassphrase?: boolean }
> {
  if (!cloud.payload) return { ok: false, reason: "no_backup_found" };

  const parsedEnvelope = parseCloudKitBackupEnvelope(cloud.payload);
  if (parsedEnvelope.ok) {
    let dek = await getStoredBackupDek();
    if (!dek) {
      if (!passphrase) {
        return { ok: false, reason: "passphrase_required", needsPassphrase: true };
      }
      const unlocked = await unlockBackupWithPassphrase(parsedEnvelope.envelope.wrap, passphrase);
      if (!unlocked.ok) return { ok: false, reason: unlocked.message };
      dek = unlocked.dek;
    }
    const decrypted = await decryptBackupEnvelope(parsedEnvelope.envelope, dek);
    if (!decrypted.ok) {
      // DEK may be wrong for this envelope — try passphrase path if provided.
      if (passphrase) {
        const unlocked = await unlockBackupWithPassphrase(parsedEnvelope.envelope.wrap, passphrase);
        if (!unlocked.ok) return { ok: false, reason: unlocked.message };
        const retry = await decryptBackupEnvelope(parsedEnvelope.envelope, unlocked.dek);
        if (!retry.ok) return { ok: false, reason: passphraseFailureMessage(retry.reason) };
        return {
          ok: true,
          payload: normalizeRestorePayload(retry.payload),
          createdAt: parsedEnvelope.envelope.createdAt,
          summary: asBackupFileSummary(parsedEnvelope.envelope.summary),
        };
      }
      return { ok: false, reason: passphraseFailureMessage(decrypted.reason), needsPassphrase: true };
    }
    return {
      ok: true,
      payload: normalizeRestorePayload(decrypted.payload),
      createdAt: parsedEnvelope.envelope.createdAt,
      summary: asBackupFileSummary(parsedEnvelope.envelope.summary),
    };
  }

  if (parsedEnvelope.reason === "legacy_plaintext") {
    // Encrypted backups are required going forward — do not silently import plaintext CloudKit blobs.
    return { ok: false, reason: passphraseFailureMessage("legacy_plaintext") };
  }

  // Fallback: treat as a normal Synapse export JSON (should not happen for CloudKit uploads).
  const fileParsed = parseSynapseExport(cloud.payload);
  if (!fileParsed.ok) return { ok: false, reason: fileParsed.reason };
  return {
    ok: true,
    payload: normalizeRestorePayload(fileParsed.payload),
    createdAt: cloud.lastUpdated || fileParsed.summary.exportDate || new Date().toISOString(),
    summary: fileParsed.summary,
  };
}

export async function previewICloudRestore(options?: {
  recordName?: string;
  passphrase?: string;
}): Promise<
  | { ok: true; preview: ICloudRestorePreview; payload: ExportPayload }
  | { ok: false; reason: string; needsPassphrase?: boolean }
> {
  if (!isCloudKitBackupRuntimeReady() || !bridge) {
    return {
      ok: false,
      reason: !isFeatureEnabled()
        ? "Automatic iCloud backup is not enabled in this app version yet."
        : Platform.OS === "ios"
          ? "This build doesn’t include the iCloud backup module."
          : "Automatic iCloud backup is available on iPhone only.",
    };
  }
  try {
    const cloud = options?.recordName
      ? await bridge.restorePayloadByRecordName(options.recordName)
      : await bridge.restorePayload();
    if (cloud?.available === false) {
      return { ok: false, reason: "iCloud isn’t available on this device right now." };
    }
    if (!cloud?.payload) {
      return { ok: false, reason: "No iCloud backup was found for this Apple ID." };
    }
    const material = await materializePayload(cloud, options?.passphrase);
    if (!material.ok) {
      return { ok: false, reason: material.reason, needsPassphrase: material.needsPassphrase };
    }
    const summary = material.summary;
    return {
      ok: true,
      payload: material.payload,
      preview: {
        recordName: cloud.recordName || options?.recordName || "current-user-data",
        createdAt: material.createdAt,
        summaryText: summary ? formatRestorePreview(summary) : "Encrypted Synapse backup",
        summary,
        needsPassphrase: false,
        legacyPlaintext: false,
      },
    };
  } catch (error) {
    await setLastError(error);
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not load iCloud backup.",
    };
  }
}

/**
 * Explicit user-driven restore only. Never called automatically when iCloud becomes available.
 * Creates a local rollback snapshot via importAllDataTransactional before applying.
 */
export async function restoreFromICloud(options?: {
  recordName?: string;
  passphrase?: string;
  /** @deprecated Automatic overwrite is not supported; ignored. */
  uploadLocalIfNewer?: boolean;
  /** @deprecated Automatic overwrite is not supported; use explicit confirm in UI. */
  forceRestoreLatest?: boolean;
}): Promise<{
  restored: boolean;
  skipped?: boolean;
  skipReason?: string;
  error?: Error | null;
  needsPassphrase?: boolean;
}> {
  if (!isCloudKitBackupRuntimeReady() || !bridge) {
    return {
      restored: false,
      skipped: true,
      skipReason: !isFeatureEnabled()
        ? "feature_disabled"
        : Platform.OS === "ios"
          ? "native_bridge_missing"
          : "unsupported_platform",
    };
  }
  if (restoreInFlight) return { restored: false, skipped: true, skipReason: "restore_in_progress" };

  restoreInFlight = true;
  try {
    const preview = await previewICloudRestore({
      recordName: options?.recordName,
      passphrase: options?.passphrase,
    });
    if (!preview.ok) {
      return {
        restored: false,
        skipped: true,
        skipReason: preview.reason,
        needsPassphrase: preview.needsPassphrase,
        error: new Error(preview.reason),
      };
    }

    await withCloudKitBackupSuppressed(async () => {
      await importAllDataTransactional(preview.payload);
    });
    const stamped = preview.preview.createdAt || new Date().toISOString();
    await setLocalDataUpdatedAt(stamped);
    await setLastSyncedAt(stamped);
    return { restored: true, error: null };
  } catch (error) {
    await setLastError(error);
    return { restored: false, error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    restoreInFlight = false;
  }
}

export async function enableAutomaticICloudBackup(enabled: boolean): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (!isCloudKitBackupRuntimeReady()) {
    return { ok: false, reason: "feature_disabled" };
  }
  if (enabled) {
    const recovery = await getCloudKitRecoveryStatus();
    if (!recovery.recoveryConfigured || !recovery.dekPresent) {
      return { ok: false, reason: "recovery_not_configured" };
    }
    const status = await getCloudKitBackupStatus();
    if (!status.available) {
      return { ok: false, reason: status.accountStatus || "account_unavailable" };
    }
  }
  await setCloudKitAutoBackupEnabled(enabled);
  if (enabled) {
    scheduleCloudKitBackup(2_000);
  }
  return { ok: true };
}

export function scheduleCloudKitBackup(delayMs = 12_000) {
  if (!isCloudKitBackupRuntimeReady()) return;
  void (async () => {
    const recovery = await getCloudKitRecoveryStatus();
    if (!recovery.autoBackupEnabled || !recovery.recoveryConfigured || !recovery.dekPresent) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveToICloud().catch(() => {});
    }, delayMs);
  })();
}

/**
 * Installs dirty-data + background flush listeners.
 * Does NOT restore from iCloud automatically (prevents silent overwrite on sign-in).
 */
export function installCloudKitAutoSync() {
  if (installed || !isCloudKitBackupRuntimeReady()) return () => {};
  installed = true;

  const unsubscribeDirty = subscribeToCloudKitBackupDirty(() => {
    scheduleCloudKitBackup();
  });

  const appStateSub = AppState.addEventListener("change", (state) => {
    if (state === "background" || state === "inactive") {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      void (async () => {
        const recovery = await getCloudKitRecoveryStatus();
        if (recovery.autoBackupEnabled && recovery.dekPresent) {
          saveToICloud().catch(() => {});
        }
      })();
    }
  });

  return () => {
    unsubscribeDirty();
    appStateSub.remove();
    installed = false;
  };
}

export { markCloudKitBackupDirty, unlockBackupWithPassphrase, getCloudKitRecoveryStatus };
