/**
 * Local-only metadata for the manual Backup & Restore experience.
 * Never stores health record contents — only timestamps / user-confirmed flags.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STATUS_KEY = "synapse_manual_backup_status_v1";
const REMINDER_DISMISS_KEY = "synapse_manual_backup_reminder_dismissed_at";

export const MANUAL_BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type ManualBackupStatus = {
  /** Share sheet / export completed; not proof the file was saved elsewhere. */
  lastExportedAt: string | null;
  /** User explicitly confirmed they saved the file somewhere safe. */
  lastConfirmedAt: string | null;
  lastFileName: string | null;
};

const EMPTY: ManualBackupStatus = {
  lastExportedAt: null,
  lastConfirmedAt: null,
  lastFileName: null,
};

export async function getManualBackupStatus(): Promise<ManualBackupStatus> {
  try {
    const raw = await AsyncStorage.getItem(STATUS_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<ManualBackupStatus>;
    return {
      lastExportedAt: typeof parsed.lastExportedAt === "string" ? parsed.lastExportedAt : null,
      lastConfirmedAt: typeof parsed.lastConfirmedAt === "string" ? parsed.lastConfirmedAt : null,
      lastFileName: typeof parsed.lastFileName === "string" ? parsed.lastFileName : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

async function saveStatus(next: ManualBackupStatus): Promise<void> {
  await AsyncStorage.setItem(STATUS_KEY, JSON.stringify(next));
}

/** Call after the share sheet closes — does NOT mean the user saved the file. */
export async function markBackupExported(fileName: string): Promise<ManualBackupStatus> {
  const prev = await getManualBackupStatus();
  const next: ManualBackupStatus = {
    ...prev,
    lastExportedAt: new Date().toISOString(),
    lastFileName: fileName,
  };
  await saveStatus(next);
  return next;
}

/** Call only after the user confirms they saved the file somewhere safe. */
export async function markBackupConfirmed(fileName?: string | null): Promise<ManualBackupStatus> {
  const prev = await getManualBackupStatus();
  const next: ManualBackupStatus = {
    lastExportedAt: prev.lastExportedAt ?? new Date().toISOString(),
    lastConfirmedAt: new Date().toISOString(),
    lastFileName: fileName ?? prev.lastFileName,
  };
  await saveStatus(next);
  return next;
}

export function formatBackupDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type BackupStatusLabel =
  | { kind: "none"; title: string; detail: string }
  | { kind: "exported"; title: string; detail: string }
  | { kind: "confirmed"; title: string; detail: string; stale: boolean };

export function describeBackupStatus(status: ManualBackupStatus): BackupStatusLabel {
  if (status.lastConfirmedAt) {
    const when = formatBackupDate(status.lastConfirmedAt);
    const age = Date.now() - new Date(status.lastConfirmedAt).getTime();
    const stale = Number.isFinite(age) && age > BACKUP_STALE_AFTER_MS;
    return {
      kind: "confirmed",
      title: when ? `Last saved ${when}` : "Backup confirmed",
      detail: stale
        ? "It’s been more than 30 days since your last confirmed backup. Consider saving a new one."
        : "You confirmed this backup was saved somewhere safe.",
      stale,
    };
  }
  if (status.lastExportedAt) {
    const when = formatBackupDate(status.lastExportedAt);
    return {
      kind: "exported",
      title: when ? `Backup exported ${when}` : "Backup exported",
      detail:
        "Synapse prepared a backup file, but can’t confirm you saved it outside the app. Tap Save My Backup again if you’re unsure.",
    };
  }
  return {
    kind: "none",
    title: "Not yet confirmed",
    detail: "Save a backup so you can restore your information if you lose or replace this phone.",
  };
}

export function shouldShowBackupReminder(input: {
  status: ManualBackupStatus;
  hasMeaningfulData: boolean;
  reminderDismissedAt: string | null;
}): boolean {
  if (!input.hasMeaningfulData) return false;
  const dismissedAt = input.reminderDismissedAt ? new Date(input.reminderDismissedAt).getTime() : 0;
  if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < BACKUP_STALE_AFTER_MS) {
    return false;
  }
  if (!input.status.lastConfirmedAt) return true;
  const confirmedAt = new Date(input.status.lastConfirmedAt).getTime();
  return Number.isFinite(confirmedAt) && Date.now() - confirmedAt > BACKUP_STALE_AFTER_MS;
}

export async function getBackupReminderDismissedAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REMINDER_DISMISS_KEY);
  } catch {
    return null;
  }
}

export async function dismissBackupReminder(): Promise<void> {
  await AsyncStorage.setItem(REMINDER_DISMISS_KEY, new Date().toISOString());
}
