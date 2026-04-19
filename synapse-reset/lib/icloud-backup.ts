import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File } from "expo-file-system";
import { exportAllData, importAllData, type ExportPayload } from "@/lib/storage";

const ICLOUD_BACKUP_LAST_DATE_KEY = "synapse_icloud_backup_last_date";
const ICLOUD_BACKUP_LAST_FILE_KEY = "synapse_icloud_backup_last_file";

export type ICloudBackupStatus = {
  lastBackupAt: string | null;
  lastBackupFileName: string | null;
};

export type ICloudBackupResult = {
  backupAt: string;
  fileName: string;
};

function buildBackupFileName(date: Date) {
  const iso = date.toISOString().replace(/[:.]/g, "-");
  return `synapse-backup-${iso}.json`;
}

function isLikelyExportPayload(value: unknown): value is ExportPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.exportDate === "string" && Array.isArray(payload.healthLogs) && Array.isArray(payload.symptoms);
}

function isPickerCancellation(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("cancel") || message.includes("canceled") || message.includes("cancelled");
}

function getFileNameFromUri(uri: string) {
  const parts = uri.split("/");
  return parts[parts.length - 1] || "synapse-backup.json";
}

async function persistBackupMetadata(backupAt: string, fileName: string) {
  await AsyncStorage.multiSet([
    [ICLOUD_BACKUP_LAST_DATE_KEY, backupAt],
    [ICLOUD_BACKUP_LAST_FILE_KEY, fileName],
  ]);
}

export async function getICloudBackupStatus(): Promise<ICloudBackupStatus> {
  const [lastBackupAt, lastBackupFileName] = await AsyncStorage.multiGet([ICLOUD_BACKUP_LAST_DATE_KEY, ICLOUD_BACKUP_LAST_FILE_KEY]);
  return {
    lastBackupAt: lastBackupAt?.[1] ?? null,
    lastBackupFileName: lastBackupFileName?.[1] ?? null,
  };
}

export async function backupToICloudDrive(): Promise<ICloudBackupResult | null> {
  try {
    const targetDirectory = await Directory.pickDirectoryAsync();
    const payload = await exportAllData();
    const backupAt = new Date().toISOString();
    const fileName = buildBackupFileName(new Date(backupAt));
    const backupFile = targetDirectory.createFile(fileName, "application/json");
    backupFile.write(JSON.stringify(payload, null, 2));
    await persistBackupMetadata(backupAt, fileName);
    return { backupAt, fileName };
  } catch (error) {
    if (isPickerCancellation(error)) {
      return null;
    }
    throw error;
  }
}

export async function restoreFromICloudDrive(): Promise<{ fileName: string; backupAt: string | null } | null> {
  try {
    const selected = await File.pickFileAsync(undefined, "application/json");
    const selectedFile = Array.isArray(selected) ? selected[0] : selected;
    if (!selectedFile) {
      return null;
    }
    const contents = await selectedFile.text();
    const parsed = JSON.parse(contents) as unknown;
    if (!isLikelyExportPayload(parsed)) {
      throw new Error("That file does not look like a Synapse backup.");
    }
    await importAllData(parsed);
    const backupAt = typeof parsed.exportDate === "string" ? parsed.exportDate : null;
    const fileName = getFileNameFromUri(selectedFile.uri);
    if (backupAt) {
      await persistBackupMetadata(backupAt, fileName);
    }
    return { fileName, backupAt };
  } catch (error) {
    if (isPickerCancellation(error)) {
      return null;
    }
    throw error;
  }
}
