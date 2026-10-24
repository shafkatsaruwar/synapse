/**
 * Pure parse + validation for a manual "Restore From File" of a Synapse export.
 *
 * No React Native imports so it can be unit-tested in plain Node. Restore is
 * destructive (importAllData clears the device first), so validation must run
 * BEFORE any import: a file that isn't a plausible Synapse export must be
 * rejected here rather than wiping data.
 */
import type { ExportPayload } from "@/lib/storage-self";
import { MANUAL_BACKUP_SCHEMA_VERSION } from "@/lib/manual-backup-status";

export type ParseExportResult =
  | {
      ok: true;
      payload: ExportPayload;
      summary: BackupFileSummary;
    }
  | { ok: false; reason: string };

export type BackupFileSummary = {
  exportDate: string | null;
  appVersion: string | null;
  schemaVersion: number | null;
  medicationCount: number;
  appointmentCount: number;
  healthLogCount: number;
  conditionCount: number;
};

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function summarizeExportPayload(payload: ExportPayload): BackupFileSummary {
  const conditionsFromProfile = Array.isArray(payload.profile?.conditions)
    ? payload.profile.conditions.length
    : 0;
  return {
    exportDate: typeof payload.exportDate === "string" ? payload.exportDate : null,
    appVersion: typeof payload.appVersion === "string" ? payload.appVersion : null,
    schemaVersion:
      typeof (payload as { schemaVersion?: unknown }).schemaVersion === "number"
        ? ((payload as { schemaVersion?: number }).schemaVersion ?? null)
        : null,
    medicationCount: countArray(payload.medications),
    appointmentCount: countArray(payload.appointments),
    healthLogCount: countArray(payload.healthLogs),
    conditionCount: Math.max(countArray(payload.conditions), conditionsFromProfile),
  };
}

/**
 * Parse the text of a picked file and confirm it looks like a Synapse export.
 * Lenient about which sections are present (importAllData defaults missing arrays
 * to empty), but strict enough that arbitrary/foreign files are rejected.
 * Older exports without schemaVersion (e.g. public 1.10) remain accepted.
 */
export function parseSynapseExport(text: string): ParseExportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "This file isn't valid JSON, so it can't be a Synapse backup." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "This doesn't look like a Synapse backup file." };
  }
  const obj = raw as Record<string, unknown>;
  const looksLikeExport =
    typeof obj.exportDate === "string" ||
    (obj.profile != null && typeof obj.profile === "object") ||
    Array.isArray(obj.healthLogs) ||
    Array.isArray(obj.medications) ||
    Array.isArray(obj.appointments);
  if (!looksLikeExport) {
    return { ok: false, reason: "This doesn't look like a Synapse backup (missing expected fields)." };
  }

  if (typeof obj.schemaVersion === "number" && obj.schemaVersion > MANUAL_BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `This backup was created by a newer Synapse version (schema ${obj.schemaVersion}). Update the app, then try again.`,
    };
  }

  const payload = obj as unknown as ExportPayload;
  return { ok: true, payload, summary: summarizeExportPayload(payload) };
}

export function formatRestorePreview(summary: BackupFileSummary): string {
  const when = summary.exportDate
    ? new Date(summary.exportDate).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unknown date";
  const version = summary.appVersion ? `Synapse ${summary.appVersion}` : "an earlier Synapse version";
  return [
    `Backup created: ${when}`,
    `From: ${version}`,
    `Includes about ${summary.medicationCount} medication(s), ${summary.appointmentCount} appointment(s), ${summary.healthLogCount} health log(s), and ${summary.conditionCount} condition(s), plus other saved Synapse information.`,
  ].join("\n");
}
