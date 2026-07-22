import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { exportAllData } from "@/lib/storage";

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

function isPickerCancellation(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("cancel") || message.includes("canceled") || message.includes("cancelled");
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
    if (!FileSystem.documentDirectory) {
      throw new Error("Backup files are not available in this runtime.");
    }
    const payload = await exportAllData();
    const backupAt = new Date().toISOString();
    const fileName = buildBackupFileName(new Date(backupAt));
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Sharing is not available. Backup file was created locally but could not be exported.");
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: "application/json",
      dialogTitle: "Save Synapse backup",
      UTI: "public.json",
    });

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
  throw new Error("Restore from a backup file needs a native build with document picker support.");
}
