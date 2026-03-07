import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSupabase } from "@/lib/supabase";
import { exportAllData, importAllData, type ExportPayload } from "@/lib/storage";

const BACKUP_LAST_SYNC = "fir_backup_last_sync";

export type BackupStatus = {
  hasBackup: boolean;
  lastSyncedAt: string | null;
};

async function getBackupLastSync(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BACKUP_LAST_SYNC);
  } catch (e) {
    console.warn("AsyncStorage getItem backup sync failed", e);
    return null;
  }
}

async function setBackupLastSync(value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(BACKUP_LAST_SYNC, value);
  } catch (e) {
    console.warn("AsyncStorage setItem backup sync failed", e);
  }
}

export async function getBackupStatus(userId: string): Promise<BackupStatus> {
  const supabase = getSupabase();
  if (!supabase) return { hasBackup: false, lastSyncedAt: null };
  try {
    const { data, error } = await supabase.from("user_backups").select("updated_at").eq("user_id", userId).maybeSingle();
    if (error) return { hasBackup: false, lastSyncedAt: null };
    const lastSyncedAt = data?.updated_at ?? null;
    const lastStored = await getBackupLastSync();
    return {
      hasBackup: !!data,
      lastSyncedAt: lastSyncedAt ?? lastStored,
    };
  } catch (e) {
    console.warn("getBackupStatus error", e);
    return { hasBackup: false, lastSyncedAt: null };
  }
}

/** Ensure payload has medications and medicationLogs so they are never dropped when serializing to Supabase. */
function normalizeBackupPayload(payload: ExportPayload): Record<string, unknown> {
  const data = payload as unknown as Record<string, unknown>;
  data.medications = Array.isArray(payload.medications) ? payload.medications : [];
  data.medicationLogs = Array.isArray(payload.medicationLogs) ? payload.medicationLogs : [];
  return data;
}

export async function backupNow(userId: string): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabase();
    if (!supabase) return { error: new Error("Supabase not configured") };
    const payload = await exportAllData();
    const data = normalizeBackupPayload(payload);
    const { error } = await supabase.from("user_backups").upsert(
      {
        user_id: userId,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) {
      return { error: new Error(error.message ?? "Backup failed") };
    }
    await setBackupLastSync(new Date().toISOString());
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** Ensure restored payload has medications and medicationLogs (e.g. older backup format). */
function normalizeRestorePayload(raw: unknown): ExportPayload {
  const p = raw as Record<string, unknown>;
  const payload = { ...p } as ExportPayload;
  if (!Array.isArray(payload.medications)) payload.medications = [];
  if (!Array.isArray(payload.medicationLogs)) payload.medicationLogs = [];
  return payload;
}

export async function restoreFromCloud(userId: string): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabase();
    if (!supabase) return { error: new Error("Supabase not configured") };
    const { data, error } = await supabase.from("user_backups").select("data").eq("user_id", userId).maybeSingle();
    if (error || !data?.data) return { error: error ? new Error(error.message) : new Error("No backup found") };
    const payload = normalizeRestorePayload(data.data);
    await importAllData(payload);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
