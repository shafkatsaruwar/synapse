/**
 * Edit access, done offline. The person being cared for grants "edit" per category. The caregiver
 * builds a signed, encrypted *proposal* from the last shared update. The owner reviews every change,
 * and only the ones they accept are applied. There is no silent write path and no live session.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getStoresForProfile, SELF_PROFILE_ID, type ChangedByInfo, type Medication, type MedicationDose } from "@/lib/storage";
import { encryptPackage, fromBase64Url, PACKAGE_MAX_BYTES } from "./crypto";
import { getDeviceIdentity, isTrusted, markSeen, recordConnectionTransfer } from "./connections";
import { CARE_KEY_PREFIX } from "./profiles";
import { loadSharedData, openIncomingPackage } from "./sharing";
import { conflictingFields, describeChange, describeFieldChanges, sanitizeChangeSet, timeOfDayFor } from "./changes-core";
import type { AppliedEdit, CareConnection, ChangeSet, ProposedChange, SharingCategory } from "./types";

const EDITS_KEY = `${CARE_KEY_PREFIX}edits_v1`;
const MAX_EDITS = 200;

export function newChangeId(): string {
  return Crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

// ---------- proposer side ----------

/** Categories the other person has allowed me to send proposals for, from their last shared update. */
export async function proposableCategories(conn: CareConnection): Promise<SharingCategory[]> {
  if (!isTrusted(conn)) return [];
  return (await loadSharedData(conn.id))?.editable ?? [];
}

export async function buildChangePackage(
  conn: CareConnection,
  changes: ProposedChange[],
  senderName: string,
  senderTimeZone: string,
): Promise<{ ok: true; json: string } | { ok: false; reason: string }> {
  if (!isTrusted(conn)) return { ok: false, reason: "not_verified" };
  const shared = await loadSharedData(conn.id);
  const allowed = new Set(shared?.editable ?? []);
  if (changes.length === 0) return { ok: false, reason: "nothing_to_send" };
  if (changes.some((c) => !allowed.has(c.category))) return { ok: false, reason: "not_authorized" };
  const set: ChangeSet = {
    schema: 1,
    kind: "changes",
    senderName,
    senderTimeZone,
    baseExportedAt: shared?.med_schedule?.provenance.exportedAt ?? shared?.upcoming_appointments?.provenance.exportedAt,
    changes,
  };
  const identity = await getDeviceIdentity();
  const env = encryptPackage(identity, { signPublic: fromBase64Url(conn.peerSignPublic!), agreePublic: fromBase64Url(conn.peerAgreePublic!) }, set);
  const json = JSON.stringify(env);
  if (json.length > PACKAGE_MAX_BYTES) return { ok: false, reason: "too_large" };
  await recordConnectionTransfer(conn.id, "export");
  return { ok: true, json };
}

// ---------- owner side ----------

export type ChangeRowStatus = "ok" | "conflict" | "missing" | "not_authorized";

export type ChangeRow = {
  change: ProposedChange;
  status: ChangeRowStatus;
  summary: string;
  /** For updates: what would change. */
  fields: { field: string; from: string; to: string }[];
  /** Fields that no longer match what the proposer saw. */
  conflicts: string[];
};

export type ChangePreview =
  | { ok: true; connection: CareConnection; packageId: string; exportedAt: number; senderName: string; rows: ChangeRow[] }
  | { ok: false; reason: string };

function targetProfile(conn: CareConnection): string {
  return conn.profileId ?? SELF_PROFILE_ID;
}

function medView(m: Medication) {
  const doses = m.doses ?? [];
  return {
    name: m.name,
    amount: doses[0]?.amount,
    unit: doses[0]?.unit,
    times: doses.map((d) => d.reminderTime).filter((t): t is string => !!t),
  };
}

function buildDoses(times: string[], amount: string, unit: string): MedicationDose[] {
  return times.map((t) => ({ id: newChangeId(), amount, unit, timeOfDay: timeOfDayFor(t), reminderTime: t }));
}

export async function previewChanges(input: string): Promise<ChangePreview> {
  const opened = await openIncomingPackage(input);
  if (!opened.ok) return opened;
  const set = sanitizeChangeSet(opened.payload);
  if (!set) return { ok: false, reason: "invalid_payload" };
  const conn = opened.connection;
  const editable = new Set(conn.grants.filter((g) => g.access === "edit").map((g) => g.category));
  if (editable.size === 0) return { ok: false, reason: "not_authorized" };

  const stores = getStoresForProfile(targetProfile(conn));
  const [meds, appts] = await Promise.all([stores.medicationStorage.getAll(), stores.appointmentStorage.getAll()]);
  const rows: ChangeRow[] = set.changes.map((change) => {
    const base = { change, summary: describeChange(change), fields: [] as ChangeRow["fields"], conflicts: [] as string[] };
    if (!editable.has(change.category)) return { ...base, status: "not_authorized" as const };
    if (change.category === "med_schedule" && change.op !== "add") {
      const m = meds.find((x) => x.id === change.key);
      if (!m) return { ...base, status: "missing" as const };
      const current = medView(m);
      const conflicts = conflictingFields(change.before as Record<string, unknown>, current);
      const fields = change.op === "update" ? describeFieldChanges({ ...current, ...(change.before as object) }, change.after as Record<string, unknown>) : [];
      return { ...base, fields, conflicts, status: conflicts.length ? ("conflict" as const) : ("ok" as const) };
    }
    if (change.category === "upcoming_appointments" && change.op !== "add") {
      const a = appts.find((x) => x.id === change.key);
      if (!a) return { ...base, status: "missing" as const };
      const current = { date: a.date, time: a.time, doctorName: a.doctorName, location: a.location };
      const conflicts = conflictingFields(change.before as Record<string, unknown>, current);
      const fields = change.op === "update" ? describeFieldChanges({ ...current, ...(change.before as object) }, change.after as Record<string, unknown>) : [];
      return { ...base, fields, conflicts, status: conflicts.length ? ("conflict" as const) : ("ok" as const) };
    }
    if (change.category === "med_confirmations") {
      const m = meds.find((x) => x.id === change.after.medicationKey);
      return { ...base, status: m ? ("ok" as const) : ("missing" as const) };
    }
    return { ...base, status: "ok" as const };
  });
  if (rows.every((r) => r.status === "not_authorized")) return { ok: false, reason: "nothing_allowed" };
  return { ok: true, connection: conn, packageId: opened.packageId, exportedAt: opened.exportedAt, senderName: conn.peerName, rows };
}

/** Rows the owner may accept (conflicts need an explicit choice; missing and unauthorized never apply). */
export const isSelectable = (r: ChangeRow) => r.status === "ok" || r.status === "conflict";

export async function applyChanges(preview: Extract<ChangePreview, { ok: true }>, acceptedIds: string[]): Promise<{ applied: number; skipped: number }> {
  const conn = preview.connection;
  const accepted = new Set(acceptedIds);
  const stores = getStoresForProfile(targetProfile(conn));
  const by: ChangedByInfo = { name: conn.peerName, at: new Date().toISOString(), via: "care_connection" };
  let applied = 0;
  let skipped = 0;
  const log: AppliedEdit[] = [];

  for (const row of preview.rows) {
    if (!accepted.has(row.change.id) || !isSelectable(row)) {
      skipped += 1;
      continue;
    }
    const c = row.change;
    try {
      if (c.category === "med_schedule") {
        if (c.op === "add") {
          const times = c.after.times ?? [];
          await stores.medicationStorage.save({
            name: c.after.name!,
            frequency: times.length > 1 ? `${times.length} times daily` : "Daily",
            medicationType: "scheduled",
            active: true,
            remindersEnabled: true,
            source: "import",
            doses: buildDoses(times, c.after.amount ?? "1", c.after.unit ?? "dose"),
            changedBy: by,
          });
        } else if (c.op === "stop") {
          await stores.medicationStorage.update(c.key, { active: false, changedBy: by });
        } else {
          const current = (await stores.medicationStorage.getAll()).find((m) => m.id === c.key)!;
          const view = medView(current);
          const updates: Partial<Medication> = { changedBy: by };
          if (c.after.name) updates.name = c.after.name;
          const amount = c.after.amount ?? view.amount ?? "1";
          const unit = c.after.unit ?? view.unit ?? "dose";
          if (c.after.times) updates.doses = buildDoses(c.after.times, amount, unit);
          else if (c.after.amount || c.after.unit) updates.doses = (current.doses ?? []).map((d) => ({ ...d, amount, unit }));
          if (c.after.weekdays) {
            if (c.after.weekdays.length === 1) {
              updates.reminderCadence = "weekly";
              updates.reminderWeekday = c.after.weekdays[0];
            } else {
              updates.reminderCadence = "daily";
              updates.reminderWeekday = undefined;
            }
          }
          await stores.medicationStorage.update(c.key, updates);
        }
      } else if (c.category === "upcoming_appointments") {
        if (c.op === "add") {
          await stores.appointmentStorage.save({
            doctorName: c.after.doctorName ?? "Appointment",
            specialty: "",
            date: c.after.date!,
            time: c.after.time ?? "09:00",
            location: c.after.location ?? "",
            notes: "",
            source: "import",
            changedBy: by,
          });
        } else if (c.op === "cancel") {
          await stores.appointmentStorage.update(c.key, { status: "cancelled", changedBy: by });
        } else {
          await stores.appointmentStorage.update(c.key, { ...c.after, changedBy: by });
        }
      } else {
        await stores.medicationLogStorage.ensureTaken(c.after.medicationKey!, c.after.date!, c.after.doseIndex ?? 0, { enteredBy: "caregiver", notes: `Confirmed by ${conn.peerName}` });
      }
      applied += 1;
      log.push({ id: newChangeId(), connectionId: conn.id, fromName: conn.peerName, at: by.at, summary: row.summary });
    } catch (e) {
      console.warn("apply change failed", e);
      skipped += 1;
    }
  }

  await markSeen("packages", preview.packageId);
  if (log.length) await appendEdits(log);
  if (applied > 0 && targetProfile(conn) === SELF_PROFILE_ID) {
    // Pick up new or changed medication times and appointment reminders.
    try {
      const nm = await import("@/lib/notification-manager");
      await nm.syncAllFromSettings();
    } catch {
      // Reminders refresh on next launch if this can't run.
    }
  }
  return { applied, skipped };
}

/** Owner declines a whole proposal. It is marked seen so the same file can't be replayed. */
export async function declineChanges(preview: Extract<ChangePreview, { ok: true }>): Promise<void> {
  await markSeen("packages", preview.packageId);
}

async function appendEdits(entries: AppliedEdit[]): Promise<void> {
  const all = await loadEdits();
  await AsyncStorage.setItem(EDITS_KEY, JSON.stringify([...all, ...entries].slice(-MAX_EDITS)));
}

export async function loadEdits(connectionId?: string): Promise<AppliedEdit[]> {
  try {
    const raw = await AsyncStorage.getItem(EDITS_KEY);
    const all = raw ? (JSON.parse(raw) as AppliedEdit[]) : [];
    const list = Array.isArray(all) ? all : [];
    return connectionId ? list.filter((e) => e.connectionId === connectionId) : list;
  } catch {
    return [];
  }
}
