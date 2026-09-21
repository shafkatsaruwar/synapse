/**
 * Pure parse + validation for a manual "Restore From File" of a Synapse export.
 *
 * No React Native imports so it can be unit-tested in plain Node. Restore is
 * destructive (importAllData clears the device first), so validation must run
 * BEFORE any import: a file that isn't a plausible Synapse export must be
 * rejected here rather than wiping data.
 */
import type { ExportPayload } from "@/lib/storage";

export type ParseExportResult =
  | { ok: true; payload: ExportPayload }
  | { ok: false; reason: string };

/**
 * Parse the text of a picked file and confirm it looks like a Synapse export.
 * Lenient about which sections are present (importAllData defaults missing arrays
 * to empty), but strict enough that arbitrary/foreign files are rejected.
 */
export function parseSynapseExport(text: string): ParseExportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "This file isn't valid JSON, so it can't be a Synapse export." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "This doesn't look like a Synapse export file." };
  }
  const obj = raw as Record<string, unknown>;
  const looksLikeExport =
    typeof obj.exportDate === "string" ||
    (obj.profile != null && typeof obj.profile === "object") ||
    Array.isArray(obj.healthLogs) ||
    Array.isArray(obj.medications);
  if (!looksLikeExport) {
    return { ok: false, reason: "This doesn't look like a Synapse export (missing expected fields)." };
  }
  return { ok: true, payload: obj as unknown as ExportPayload };
}
