import AsyncStorage from "@react-native-async-storage/async-storage";
import { AES, Base64, Utf8, WordArray } from "crypto-es";
import { supabase } from "@/lib/supabase";
import { exportAllData, importAllData, type ExportPayload } from "@/lib/storage";

const BACKUP_KEY_STORAGE = "fir_backup_encryption_key";
const BACKUP_LAST_SYNC = "fir_backup_last_sync";

async function getOrCreateBackupKey(): Promise<string> {
  let key = await AsyncStorage.getItem(BACKUP_KEY_STORAGE);
  if (!key) {
    const wordArray = WordArray.random(32);
    key = Base64.stringify(wordArray);
    await AsyncStorage.setItem(BACKUP_KEY_STORAGE, key);
  }
  return key;
}

export async function encryptPayload(payload: ExportPayload): Promise<string> {
  const keyBase64 = await getOrCreateBackupKey();
  const key = Base64.parse(keyBase64);
  const plain = JSON.stringify(payload);
  const encrypted = AES.encrypt(plain, key).toString();
  return encrypted;
}

export async function decryptPayload(encryptedBlob: string): Promise<ExportPayload> {
  const keyBase64 = await AsyncStorage.getItem(BACKUP_KEY_STORAGE);
  if (!keyBase64) throw new Error("No backup key found. Restore is only supported on the device that created the backup.");
  const key = Base64.parse(keyBase64);
  const decrypted = AES.decrypt(encryptedBlob, key).toString(Utf8);
  if (!decrypted) throw new Error("Decryption failed.");
  return JSON.parse(decrypted) as ExportPayload;
}

export type BackupStatus = {
  hasBackup: boolean;
  lastSyncedAt: string | null;
};

export async function getBackupStatus(userId: string): Promise<BackupStatus> {
  const { data, error } = await supabase.from("user_backups").select("updated_at").eq("user_id", userId).maybeSingle();
  if (error) return { hasBackup: false, lastSyncedAt: null };
  const lastSyncedAt = data?.updated_at ?? null;
  const lastStored = await AsyncStorage.getItem(BACKUP_LAST_SYNC);
  return {
    hasBackup: !!data,
    lastSyncedAt: lastSyncedAt ?? lastStored,
  };
}

export async function backupNow(userId: string): Promise<{ error: Error | null }> {
  try {
    const payload = await exportAllData();
    const encrypted = await encryptPayload(payload);
    const { error } = await supabase.from("user_backups").upsert(
      { user_id: userId, encrypted_blob: encrypted, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) {
      return { error: new Error(error.message ?? "Backup failed") };
    }
    await AsyncStorage.setItem(BACKUP_LAST_SYNC, new Date().toISOString());
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function restoreFromCloud(userId: string): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await supabase.from("user_backups").select("encrypted_blob").eq("user_id", userId).maybeSingle();
    if (error || !data?.encrypted_blob) return { error: error ? new Error(error.message) : new Error("No backup found") };
    const payload = await decryptPayload(data.encrypted_blob);
    await importAllData(payload);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
