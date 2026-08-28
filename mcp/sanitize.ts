import type { HealthSnapshot, JsonRecord } from "./types";

const OMIT_KEY = /^(email|profileImageUri|imageUri|documentUri|recordImageUri)$/i;
const OMIT_KEY_SUFFIX = /Uri$/i;

function shouldOmitKey(key: string): boolean {
  return OMIT_KEY.test(key) || OMIT_KEY_SUFFIX.test(key);
}

export function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    const out: JsonRecord = {};
    for (const [key, nested] of Object.entries(value as JsonRecord)) {
      if (shouldOmitKey(key)) continue;
      out[key] = sanitizeValue(nested);
    }
    return out;
  }
  return value;
}

export function asRecordArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is JsonRecord => !!item && typeof item === "object" && !Array.isArray(item));
}

export function asRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as JsonRecord;
}

export function snapshotFromUnknown(raw: unknown, extras?: Partial<HealthSnapshot>): HealthSnapshot {
  const data = asRecord(raw) ?? {};
  const sanitized = sanitizeValue(data) as JsonRecord;
  return {
    source: extras?.source ?? "empty",
    ownerUserId: extras?.ownerUserId,
    updatedAt: extras?.updatedAt ?? null,
    exportDate: typeof sanitized.exportDate === "string" ? sanitized.exportDate : undefined,
    appVersion: typeof sanitized.appVersion === "string" ? sanitized.appVersion : undefined,
    profile: asRecord(sanitized.profile),
    healthProfile: asRecord(sanitized.healthProfile),
    allergy: asRecord(sanitized.allergy),
    conditions: asRecordArray(sanitized.conditions),
    healthLogs: asRecordArray(sanitized.healthLogs),
    symptoms: asRecordArray(sanitized.symptoms),
    medications: asRecordArray(sanitized.medications),
    medicationLogs: asRecordArray(sanitized.medicationLogs),
    doctors: asRecordArray(sanitized.doctors),
    pharmacies: asRecordArray(sanitized.pharmacies),
    appointments: asRecordArray(sanitized.appointments),
    doctorNotes: asRecordArray(sanitized.doctorNotes),
    labWork: asRecordArray(sanitized.labWork),
    imaging: asRecordArray(sanitized.imaging),
    fastingLogs: asRecordArray(sanitized.fastingLogs),
    vitals: asRecordArray(sanitized.vitals),
    sickMode: asRecord(sanitized.sickMode),
    monthlyCheckIns: asRecordArray(sanitized.monthlyCheckIns),
    eatingLogs: asRecordArray(sanitized.eatingLogs),
    hydrationLogs: asRecordArray(sanitized.hydrationLogs),
    mentalHealthMode: asRecord(sanitized.mentalHealthMode),
    goals: asRecordArray(sanitized.goals),
    cycleEntries: asRecordArray(sanitized.cycleEntries),
    insights: asRecordArray(sanitized.insights),
  };
}
