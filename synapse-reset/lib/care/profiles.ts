import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  PROFILE_KEY_PREFIX,
  SELF_PROFILE_ID,
  STORAGE_BASE_KEYS,
  profileStorageKey,
  selfStores,
  setActiveProfileId,
  type Appointment,
  type Medication,
  type MedicationLog,
} from "@/lib/storage";
import { CARE_SCHEMA_VERSION, type CareRoleFlags, type LocalCareProfile, type ProfileRegistry } from "./types";
import { deviceTimeZone, isValidTimeZone } from "./time-zone";

export const PROFILE_REGISTRY_KEY = "synapse_care_profiles_v1";
export const CARE_ROLES_KEY = "synapse_care_roles_v1";
/** Keys under this prefix belong to other Care modules and are wiped with a profile. */
export const CARE_KEY_PREFIX = "synapse_care_";

let queue: Promise<unknown> = Promise.resolve();
/** Serialises read-modify-write on the registry so two quick taps can't overwrite each other. */
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function makeSelfProfile(now = new Date().toISOString()): LocalCareProfile {
  const tz = deviceTimeZone();
  return {
    id: SELF_PROFILE_ID,
    schemaVersion: CARE_SCHEMA_VERSION,
    type: "self",
    displayName: "Me",
    guardianClaim: "none",
    timeZone: tz,
    medScheduleTimeZone: tz,
    contactHours: null,
    createdAt: now,
    updatedAt: now,
  };
}

function sanitizeProfile(raw: Partial<LocalCareProfile>): LocalCareProfile | null {
  if (!raw || typeof raw.id !== "string" || !raw.id) return null;
  const now = new Date().toISOString();
  const tz = isValidTimeZone(raw.timeZone) ? raw.timeZone : deviceTimeZone();
  const type = raw.type === "caregiver_managed" || raw.type === "connected_reference" || raw.type === "self" ? raw.type : "caregiver_managed";
  return {
    id: raw.id,
    schemaVersion: CARE_SCHEMA_VERSION,
    type: raw.id === SELF_PROFILE_ID ? "self" : type,
    displayName: (raw.displayName ?? "").toString().trim().slice(0, 60) || (raw.id === SELF_PROFILE_ID ? "Me" : "Someone"),
    dateOfBirth: typeof raw.dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dateOfBirth) ? raw.dateOfBirth : undefined,
    legacyAge: Number.isFinite(raw.legacyAge) ? Math.max(0, Math.round(raw.legacyAge as number)) : undefined,
    relationship: raw.relationship?.toString().trim().slice(0, 40) || undefined,
    guardianClaim: raw.guardianClaim === "self_declared" ? "self_declared" : "none",
    timeZone: tz,
    medScheduleTimeZone: isValidTimeZone(raw.medScheduleTimeZone) ? raw.medScheduleTimeZone : tz,
    contactHours: raw.contactHours && typeof raw.contactHours.start === "string" && typeof raw.contactHours.end === "string" ? raw.contactHours : null,
    travelTimeZone: isValidTimeZone(raw.travelTimeZone) ? raw.travelTimeZone : null,
    connectionId: raw.connectionId,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

async function readRegistry(): Promise<ProfileRegistry> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProfileRegistry>;
      const profiles = (Array.isArray(parsed.profiles) ? parsed.profiles : [])
        .map((p) => sanitizeProfile(p))
        .filter((p): p is LocalCareProfile => p !== null && p.id !== SELF_PROFILE_ID);
      const active = profiles.some((p) => p.id === parsed.activeProfileId) ? (parsed.activeProfileId as string) : SELF_PROFILE_ID;
      return {
        schemaVersion: CARE_SCHEMA_VERSION,
        profiles: [makeSelfProfile(), ...profiles],
        activeProfileId: active,
        legacyCaregiverMigrated: !!parsed.legacyCaregiverMigrated,
      };
    }
  } catch (e) {
    console.warn("care profile registry read failed", e);
  }
  return { schemaVersion: CARE_SCHEMA_VERSION, profiles: [makeSelfProfile()], activeProfileId: SELF_PROFILE_ID, legacyCaregiverMigrated: false };
}

async function writeRegistry(reg: ProfileRegistry): Promise<void> {
  const others = reg.profiles.filter((p) => p.id !== SELF_PROFILE_ID);
  await AsyncStorage.setItem(
    PROFILE_REGISTRY_KEY,
    JSON.stringify({ schemaVersion: CARE_SCHEMA_VERSION, profiles: others, activeProfileId: reg.activeProfileId, legacyCaregiverMigrated: reg.legacyCaregiverMigrated }),
  );
}

export async function loadRegistry(): Promise<ProfileRegistry> {
  const reg = await readRegistry();
  setActiveProfileId(reg.activeProfileId);
  return reg;
}

export type NewProfileInput = {
  type?: "caregiver_managed" | "connected_reference";
  displayName: string;
  dateOfBirth?: string;
  legacyAge?: number;
  relationship?: string;
  guardianClaim?: "none" | "self_declared";
  timeZone?: string;
  medScheduleTimeZone?: string;
  connectionId?: string;
};

export function createProfile(input: NewProfileInput): Promise<{ registry: ProfileRegistry; profile: LocalCareProfile }> {
  return serial(async () => {
    const reg = await readRegistry();
    const now = new Date().toISOString();
    const tz = isValidTimeZone(input.timeZone) ? input.timeZone : deviceTimeZone();
    const profile = sanitizeProfile({
      id: Crypto.randomUUID().replace(/-/g, "").slice(0, 20),
      type: input.type ?? "caregiver_managed",
      displayName: input.displayName,
      dateOfBirth: input.dateOfBirth,
      legacyAge: input.legacyAge,
      relationship: input.relationship,
      guardianClaim: input.guardianClaim ?? "none",
      timeZone: tz,
      medScheduleTimeZone: input.medScheduleTimeZone ?? tz,
      contactHours: null,
      connectionId: input.connectionId,
      createdAt: now,
      updatedAt: now,
    })!;
    reg.profiles.push(profile);
    await writeRegistry(reg);
    return { registry: reg, profile };
  });
}

export function updateProfile(id: string, patch: Partial<Omit<LocalCareProfile, "id" | "type" | "createdAt">>): Promise<ProfileRegistry> {
  return serial(async () => {
    const reg = await readRegistry();
    reg.profiles = reg.profiles.map((p) =>
      p.id === id ? (sanitizeProfile({ ...p, ...patch, id: p.id, type: p.type, createdAt: p.createdAt, updatedAt: new Date().toISOString() }) ?? p) : p,
    );
    await writeRegistry(reg);
    return reg;
  });
}

export function setActiveProfile(id: string): Promise<ProfileRegistry> {
  return serial(async () => {
    const reg = await readRegistry();
    reg.activeProfileId = reg.profiles.some((p) => p.id === id) ? id : SELF_PROFILE_ID;
    await writeRegistry(reg);
    setActiveProfileId(reg.activeProfileId);
    return reg;
  });
}

/** Removes one profile and every record that belongs to it. Self cannot be deleted here. */
export function deleteProfile(id: string): Promise<ProfileRegistry> {
  return serial(async () => {
    if (id === SELF_PROFILE_ID) throw new Error("The personal profile cannot be deleted.");
    const reg = await readRegistry();
    reg.profiles = reg.profiles.filter((p) => p.id !== id);
    if (reg.activeProfileId === id) reg.activeProfileId = SELF_PROFILE_ID;
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter((k) => k.startsWith(`${PROFILE_KEY_PREFIX}${id}_`) || k.startsWith(`${CARE_KEY_PREFIX}profile_${id}_`));
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
    await writeRegistry(reg);
    setActiveProfileId(reg.activeProfileId);
    return reg;
  });
}

// ---------- roles (non-exclusive) ----------

export async function loadRoleFlags(): Promise<CareRoleFlags> {
  try {
    const raw = await AsyncStorage.getItem(CARE_ROLES_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<CareRoleFlags>;
      return { caregiver: !!p.caregiver, backup: !!p.backup };
    }
    // First run after upgrade: carry the old single role over.
    const legacy = await selfStores.roleStorage.get();
    const flags: CareRoleFlags = { caregiver: legacy === "caregiver", backup: legacy === "backup" };
    await AsyncStorage.setItem(CARE_ROLES_KEY, JSON.stringify(flags));
    return flags;
  } catch {
    return { caregiver: false, backup: false };
  }
}

export async function saveRoleFlags(flags: CareRoleFlags): Promise<void> {
  await AsyncStorage.setItem(CARE_ROLES_KEY, JSON.stringify(flags));
}

// ---------- legacy migration (copy first, never delete) ----------

/**
 * Older versions kept one managed person in a global blob with records flagged
 * entryOwner="care_recipient". Copy them into their own profile. The originals are left alone.
 */
export function migrateLegacyCaregiver(): Promise<ProfileRegistry> {
  return serial(async () => {
    const reg = await readRegistry();
    if (reg.legacyCaregiverMigrated) return reg;
    try {
      const legacy = await selfStores.caregiverProfileStorage.get();
      const name = legacy?.name?.trim();
      if (legacy && name) {
        const now = new Date().toISOString();
        const id = Crypto.randomUUID().replace(/-/g, "").slice(0, 20);
        const tz = deviceTimeZone();
        const profile = sanitizeProfile({
          id,
          type: "caregiver_managed",
          displayName: name,
          legacyAge: legacy.age || undefined,
          relationship: legacy.relation,
          guardianClaim: "none",
          timeZone: tz,
          medScheduleTimeZone: tz,
          contactHours: null,
          createdAt: now,
          updatedAt: now,
        })!;
        const K = STORAGE_BASE_KEYS;
        const read = async <T,>(key: string): Promise<T[]> => {
          try {
            const raw = await AsyncStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T[]) : [];
          } catch {
            return [];
          }
        };
        const meds = (await read<Medication>(K.MEDICATIONS)).filter((m) => m.entryOwner === "care_recipient");
        const medIds = new Set(meds.map((m) => m.id));
        const logs = (await read<MedicationLog>(K.MEDICATION_LOGS)).filter((l) => medIds.has(l.medicationId)).map((l) => ({ ...l, enteredBy: l.enteredBy ?? ("caregiver" as const) }));
        const appts = (await read<Appointment>(K.APPOINTMENTS)).filter((a) => a.entryOwner === "care_recipient");
        const writes: [string, string][] = [];
        if (meds.length) writes.push([profileStorageKey(id, K.MEDICATIONS), JSON.stringify(meds)]);
        if (logs.length) writes.push([profileStorageKey(id, K.MEDICATION_LOGS), JSON.stringify(logs)]);
        if (appts.length) writes.push([profileStorageKey(id, K.APPOINTMENTS), JSON.stringify(appts)]);
        if (writes.length) await AsyncStorage.multiSet(writes);
        reg.profiles.push(profile);
        // Someone already in caregiver mode keeps seeing the person they were managing.
        const previousRole = await selfStores.roleStorage.get();
        if (previousRole === "caregiver") {
          reg.activeProfileId = id;
          // The role now lives in the non-exclusive flags below; the old single value would otherwise
          // keep the whole app in caregiver mode while viewing yourself.
          await selfStores.roleStorage.save("self");
        }
        await AsyncStorage.setItem(CARE_ROLES_KEY, JSON.stringify({ caregiver: true, backup: previousRole === "backup" }));
      }
      reg.legacyCaregiverMigrated = true;
      await writeRegistry(reg);
    } catch (e) {
      // Leave the flag unset so the copy is retried next launch; nothing original was touched.
      console.warn("legacy caregiver migration failed", e);
    }
    setActiveProfileId(reg.activeProfileId);
    return reg;
  });
}

/** Erases every care-related key (called by "Reset app"). */
export async function clearAllCareData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const doomed = keys.filter((k) => k.startsWith(PROFILE_KEY_PREFIX) || k.startsWith(CARE_KEY_PREFIX));
  if (doomed.length) await AsyncStorage.multiRemove(doomed);
  setActiveProfileId(SELF_PROFILE_ID);
}

export function profileAgeLabel(p: Pick<LocalCareProfile, "dateOfBirth" | "legacyAge">, now = new Date()): string | null {
  if (p.dateOfBirth) {
    const [y, m, d] = p.dateOfBirth.split("-").map(Number);
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
    return age >= 0 ? `${age} yrs` : null;
  }
  return p.legacyAge ? `${p.legacyAge} yrs` : null;
}

/**
 * After a legacy migration the old care-recipient records still sit in the person's own lists.
 * This removes only those that were copied into the profile, and only when the user asks.
 */
export async function removeLegacyCopies(profileId: string): Promise<{ medications: number; appointments: number }> {
  const K = STORAGE_BASE_KEYS;
  const read = async <T,>(key: string): Promise<T[]> => {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  };
  const copiedMeds = new Set((await read<Medication>(profileStorageKey(profileId, K.MEDICATIONS))).map((m) => m.id));
  const copiedAppts = new Set((await read<Appointment>(profileStorageKey(profileId, K.APPOINTMENTS))).map((a) => a.id));
  const meds = await read<Medication>(K.MEDICATIONS);
  const appts = await read<Appointment>(K.APPOINTMENTS);
  const logs = await read<MedicationLog>(K.MEDICATION_LOGS);
  const keepMeds = meds.filter((m) => !(m.entryOwner === "care_recipient" && copiedMeds.has(m.id)));
  const keepAppts = appts.filter((a) => !(a.entryOwner === "care_recipient" && copiedAppts.has(a.id)));
  const removedMedIds = new Set(meds.filter((m) => !keepMeds.includes(m)).map((m) => m.id));
  const keepLogs = logs.filter((l) => !removedMedIds.has(l.medicationId));
  await AsyncStorage.multiSet([
    [K.MEDICATIONS, JSON.stringify(keepMeds)],
    [K.APPOINTMENTS, JSON.stringify(keepAppts)],
    [K.MEDICATION_LOGS, JSON.stringify(keepLogs)],
  ]);
  return { medications: meds.length - keepMeds.length, appointments: appts.length - keepAppts.length };
}
