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

/** Build a plain object for Supabase so medications, medicationLogs, insights, conditions, and allergy (Health Profile) are never dropped. */
function buildBackupData(payload: ExportPayload): Record<string, unknown> {
  const meds = Array.isArray(payload.medications) ? payload.medications : [];
  const medLogs = Array.isArray(payload.medicationLogs) ? payload.medicationLogs : [];
  const insights = Array.isArray(payload.insights) ? payload.insights : [];
  const conditions = Array.isArray(payload.conditions) ? payload.conditions : [];
  const allergy = payload.allergy != null && typeof payload.allergy === "object" ? payload.allergy : undefined;
  return {
    ...payload,
    medications: meds,
    medicationLogs: medLogs,
    insights,
    conditions,
    allergy,
  } as unknown as Record<string, unknown>;
}

export async function backupNow(userId: string): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabase();
    if (!supabase) return { error: new Error("Supabase not configured") };
    const payload = await exportAllData();
    const medications = Array.isArray(payload.medications) ? payload.medications : [];
    const medicationLogs = Array.isArray(payload.medicationLogs) ? payload.medicationLogs : [];
    const data = buildBackupData(payload);
    const insights = Array.isArray(payload.insights) ? payload.insights : [];
    const conditions = Array.isArray(payload.conditions) ? payload.conditions : [];
    const hasAllergy = payload.allergy != null && typeof payload.allergy === "object";
    if (medications.length > 0 || medicationLogs.length > 0 || insights.length > 0 || conditions.length > 0 || hasAllergy) {
      console.log("Backup: including", medications.length, "medications,", medicationLogs.length, "medication logs,", insights.length, "health insights,", conditions.length, "conditions,", hasAllergy ? "allergy & emergency info" : "no allergy");
    }
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

/** Ensure restored payload has medications, medicationLogs, insights, conditions, and allergy (e.g. older backup format). */
function normalizeRestorePayload(raw: unknown): ExportPayload {
  const p = raw as Record<string, unknown>;
  const payload = { ...p } as ExportPayload;
  if (!Array.isArray(payload.medications)) payload.medications = [];
  if (!Array.isArray(payload.medicationLogs)) payload.medicationLogs = [];
  if (!Array.isArray(payload.insights)) payload.insights = [];
  if (!Array.isArray(payload.conditions)) payload.conditions = [];
  if (payload.allergy == null || typeof payload.allergy !== "object") payload.allergy = undefined;
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
