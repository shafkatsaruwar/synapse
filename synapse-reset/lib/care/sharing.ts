/**
 * Manual, permission-controlled sharing between two Synapse installs. Nothing here runs in the
 * background: the user builds an export, reviews it, and sends it with the share sheet / AirDrop.
 * Imports land in their own "shared copy" store and never touch the person's own records.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStoresForProfile, SELF_PROFILE_ID } from "@/lib/storage";
import { getEmergencyCard } from "@/lib/emergency-card-storage";
import { decryptPackage, encryptPackage, fromBase64Url, PACKAGE_MAX_BYTES } from "./crypto";
import { getDeviceIdentity, loadConnections, loadSeenPackageIds, markSeen, recordConnectionTransfer, extractJsonFromInput, isTrusted } from "./connections";
import { CARE_KEY_PREFIX, loadRegistry, profileIsMinor } from "./profiles";
import { CATEGORY_LABEL, describePayload, diffKeys, importFailureMessage, sanitizePayload, freshnessLabel, type ImportDiff } from "./sharing-core";
import {
  CARE_SCHEMA_VERSION, type CareConnection, type SharedAppointment, type SharedConfirmation, type SharedMedication, type SharedPayload,
  type SharedProvenance, type SharedRecordItem, type SharingCategory, type StoredSharedData,
} from "./types";

const MINOR_RESTRICTED: SharingCategory[] = ["selected_records", "emergency_info", "med_confirmations"];

const sharedKey = (connectionId: string) => `${CARE_KEY_PREFIX}shared_v1_${connectionId}`;

const emptyStored = (connectionId: string, fromName: string, timeZone: string): StoredSharedData => ({
  schemaVersion: CARE_SCHEMA_VERSION,
  connectionId,
  fromName,
  timeZone,
  med_schedule: null,
  upcoming_appointments: null,
  med_confirmations: null,
  selected_records: null,
  emergency_info: null,
});

export async function loadSharedData(connectionId: string): Promise<StoredSharedData | null> {
  try {
    const raw = await AsyncStorage.getItem(sharedKey(connectionId));
    return raw ? (JSON.parse(raw) as StoredSharedData) : null;
  } catch {
    return null;
  }
}

// ---------- export ----------

const WEEKDAY_NONE: number[] = [];

function weekdaysFor(med: { reminderCadence?: string; reminderWeekday?: number }): number[] {
  return med.reminderCadence === "weekly" && typeof med.reminderWeekday === "number" ? [med.reminderWeekday] : WEEKDAY_NONE;
}

/** The profile whose records a connection exports from: the person it is about, else me. */
function sourceProfileId(conn: CareConnection): string {
  return conn.profileId ?? SELF_PROFILE_ID;
}

export type ExportSelection = {
  selectedRecordKeys?: string[];
};

/** Builds exactly what would be sent, limited to categories this connection is allowed to receive. */
export async function buildExportPayload(
  conn: CareConnection,
  senderName: string,
  senderTimeZone: string,
  selection: ExportSelection = {},
): Promise<SharedPayload> {
  const allowed = new Set<SharingCategory>(conn.grants.map((g) => g.category));
  // A minor's sensitive information is never exported through a connection unless the caregiver has at
  // least declared guardianship. Synapse can't verify that offline, so this is a floor, not proof.
  if (conn.profileId) {
    const source = (await loadRegistry()).profiles.find((p) => p.id === conn.profileId);
    if (source && profileIsMinor(source) && conn.guardianClaim !== "self_declared" && source.guardianClaim !== "self_declared") {
      for (const c of MINOR_RESTRICTED) allowed.delete(c);
    }
  }
  const stores = getStoresForProfile(sourceProfileId(conn));
  const payload: SharedPayload = { schema: 1, senderName, senderTimeZone };

  if (allowed.has("med_schedule")) {
    const meds = (await stores.medicationStorage.getAll()).filter((m) => m.active !== false && m.medicationType !== "prn");
    payload.med_schedule = meds.map((m): SharedMedication => {
      const doses = m.doses ?? [];
      return {
        key: m.id,
        name: m.name,
        dose: doses[0] ? `${doses[0].amount} ${doses[0].unit}`.trim() : m.dosage,
        times: doses.map((d) => d.reminderTime).filter((t): t is string => !!t && /^\d{1,2}:\d{2}$/.test(t)),
        weekdays: weekdaysFor(m),
      };
    });
  }
  if (allowed.has("upcoming_appointments")) {
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
    const appts = (await stores.appointmentStorage.getAll()).filter((a) => a.status !== "cancelled" && a.date >= today && a.date <= horizon);
    payload.upcoming_appointments = appts.map((a): SharedAppointment => ({ key: a.id, date: a.date, time: a.time, doctorName: a.doctorName, location: a.location }));
  }
  if (allowed.has("med_confirmations")) {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const [meds, logs] = await Promise.all([stores.medicationStorage.getAll(), stores.medicationLogStorage.getAll()]);
    const names = new Map(meds.map((m) => [m.id, m.name]));
    payload.med_confirmations = logs
      .filter((l) => l.date >= since && names.has(l.medicationId))
      .map((l): SharedConfirmation => ({
        key: l.id,
        medicationName: names.get(l.medicationId) ?? "Medication",
        date: l.date,
        doseIndex: l.doseIndex ?? 0,
        taken: l.taken,
        recordedAt: l.recordedAt,
        enteredBy: l.enteredBy ?? "self",
      }));
  }
  if (allowed.has("selected_records")) {
    const items: SharedRecordItem[] = [];
    const conditions = await stores.conditionStorage.getAll();
    for (const c of conditions) items.push({ key: `condition:${c.id}`, kind: "condition", label: c.name });
    const allergy = await stores.allergyStorage.get();
    if (allergy.hasAllergies && allergy.allergyName.trim()) items.push({ key: "allergy:primary", kind: "allergy", label: allergy.allergyName.trim() });
    const picked = selection.selectedRecordKeys ? new Set(selection.selectedRecordKeys) : null;
    payload.selected_records = picked ? items.filter((i) => picked.has(i.key)) : [];
  }
  if (allowed.has("emergency_info") && sourceProfileId(conn) === SELF_PROFILE_ID) {
    const card = await getEmergencyCard();
    payload.emergency_info = { allergies: card.allergies.trim() || undefined, notes: card.optionalNotes.trim() || undefined };
  }
  return payload;
}

export async function createExportPackage(conn: CareConnection, payload: SharedPayload): Promise<{ ok: true; json: string } | { ok: false; reason: string }> {
  if (!isTrusted(conn)) return { ok: false, reason: "not_verified" };
  const identity = await getDeviceIdentity();
  const env = encryptPackage(identity, { signPublic: fromBase64Url(conn.peerSignPublic!), agreePublic: fromBase64Url(conn.peerAgreePublic!) }, payload);
  const json = JSON.stringify(env);
  if (json.length > PACKAGE_MAX_BYTES) return { ok: false, reason: "too_large" };
  await recordConnectionTransfer(conn.id, "export");
  return { ok: true, json };
}

// ---------- import ----------

export type ImportPreview =
  | {
      ok: true;
      connection: CareConnection;
      packageId: string;
      exportedAt: number;
      payload: SharedPayload;
      diffs: ImportDiff[];
      /** True when this snapshot is older than what is already stored; applying would be refused. */
      olderThanStored: boolean;
    }
  | { ok: false; reason: string };

export async function previewImport(input: string): Promise<ImportPreview> {
  const json = extractJsonFromInput(input) ?? (input.trim().startsWith("{") ? input.trim() : null);
  if (!json) return { ok: false, reason: "malformed" };
  let from = "";
  try {
    from = (JSON.parse(json) as { from?: string }).from ?? "";
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const connections = await loadConnections();
  const conn = connections.find((c) => c.peerSignPublic === from && isTrusted(c));
  if (!conn) return { ok: false, reason: connections.some((c) => c.peerSignPublic === from) ? "not_connected" : "unknown_sender" };
  const [me, seen] = await Promise.all([getDeviceIdentity(), loadSeenPackageIds()]);
  const result = decryptPackage(me, { signPublic: fromBase64Url(conn.peerSignPublic!), agreePublic: fromBase64Url(conn.peerAgreePublic!) }, json, seen);
  if (!result.ok) return { ok: false, reason: result.reason };
  const payload = sanitizePayload(result.payload);
  if (!payload) return { ok: false, reason: "invalid_payload" };

  const stored = (await loadSharedData(conn.id)) ?? emptyStored(conn.id, conn.peerName, payload.senderTimeZone);
  const diffs: ImportDiff[] = [];
  const keyed = ["med_schedule", "upcoming_appointments", "med_confirmations", "selected_records"] as const;
  for (const cat of keyed) {
    const incoming = payload[cat] as { key: string }[] | undefined;
    if (incoming) diffs.push({ category: cat, label: CATEGORY_LABEL[cat], ...diffKeys(stored[cat]?.items as { key: string }[] | undefined, incoming) });
  }
  if (payload.emergency_info) {
    const same = JSON.stringify(stored.emergency_info?.items ?? null) === JSON.stringify(payload.emergency_info);
    diffs.push({ category: "emergency_info", label: CATEGORY_LABEL.emergency_info, added: stored.emergency_info ? 0 : 1, updated: stored.emergency_info && !same ? 1 : 0, unchanged: same ? 1 : 0, removed: 0 });
  }
  const newest = Math.max(0, ...keyed.map((c) => (stored[c] ? Date.parse(stored[c]!.provenance.exportedAt) : 0)), stored.emergency_info ? Date.parse(stored.emergency_info.provenance.exportedAt) : 0);
  return { ok: true, connection: conn, packageId: result.id, exportedAt: result.exportedAt, payload, diffs, olderThanStored: result.exportedAt < newest };
}

/** Applies a previewed import to the shared-copy store only. Returns false if refused. */
export async function applyImport(preview: Extract<ImportPreview, { ok: true }>): Promise<boolean> {
  if (preview.olderThanStored) return false;
  const conn = preview.connection;
  const now = new Date().toISOString();
  const exportedAt = new Date(preview.exportedAt).toISOString();
  const prov: SharedProvenance = { source: "shared_copy", fromConnectionId: conn.id, fromName: conn.peerName, eventAt: exportedAt, exportedAt, importedAt: now };
  const stored = (await loadSharedData(conn.id)) ?? emptyStored(conn.id, conn.peerName, preview.payload.senderTimeZone);
  const p = preview.payload;
  stored.fromName = conn.peerName;
  stored.timeZone = p.senderTimeZone;
  // Only categories this person is still allowed to send are applied; a snapshot replaces, it never merges.
  if (p.med_schedule) stored.med_schedule = { items: p.med_schedule, provenance: prov };
  if (p.upcoming_appointments) stored.upcoming_appointments = { items: p.upcoming_appointments, provenance: prov };
  if (p.med_confirmations) stored.med_confirmations = { items: p.med_confirmations, provenance: prov };
  if (p.selected_records) stored.selected_records = { items: p.selected_records, provenance: prov };
  if (p.emergency_info) stored.emergency_info = { items: p.emergency_info, provenance: prov };
  await AsyncStorage.setItem(sharedKey(conn.id), JSON.stringify(stored));
  await markSeen("packages", preview.packageId);
  await recordConnectionTransfer(conn.id, "import");
  return true;
}


export { describePayload, importFailureMessage, sanitizePayload, freshnessLabel };
export type { ImportDiff };
