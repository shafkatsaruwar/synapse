import type { DateRange, HealthSnapshot, JsonRecord } from "./types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function itemDate(item: JsonRecord): string {
  const date = asString(item.date).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const recorded = asString(item.recordedAt || item.createdAt || item.created_at);
  if (recorded) return recorded.slice(0, 10);
  return "";
}

export function inDateRange(item: JsonRecord, range?: DateRange): boolean {
  if (!range?.from && !range?.to) return true;
  const date = itemDate(item);
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function sortByDateDesc<T extends JsonRecord>(items: T[]): T[] {
  return [...items].sort((a, b) => itemDate(b).localeCompare(itemDate(a)));
}

export function sortByDateAsc<T extends JsonRecord>(items: T[]): T[] {
  return [...items].sort((a, b) => itemDate(a).localeCompare(itemDate(b)));
}

export function todayISODate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function daysAgoISODate(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return todayISODate(d);
}

export function limitItems<T>(items: T[], limit?: number): T[] {
  if (limit == null || limit <= 0) return items;
  return items.slice(0, limit);
}

export function averageField(items: JsonRecord[], field: string): number | null {
  const nums = items.map((item) => asNumber(item[field])).filter((n): n is number => n != null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((sum, n) => sum + n, 0) / nums.length) * 10) / 10;
}

export function listSymptoms(snapshot: HealthSnapshot, options?: DateRange & { limit?: number }) {
  const items = sortByDateDesc((snapshot.symptoms ?? []).filter((item) => inDateRange(item, options)));
  return limitItems(items, options?.limit ?? 30);
}

export function listCheckIns(snapshot: HealthSnapshot, options?: DateRange & { limit?: number }) {
  const items = sortByDateDesc((snapshot.healthLogs ?? []).filter((item) => inDateRange(item, options)));
  return limitItems(items, options?.limit ?? 30);
}

export function listVitals(snapshot: HealthSnapshot, options?: DateRange & { limit?: number }) {
  const items = sortByDateDesc((snapshot.vitals ?? []).filter((item) => inDateRange(item, options)));
  return limitItems(items, options?.limit ?? 30);
}

export function listLabWork(snapshot: HealthSnapshot, options?: DateRange & { limit?: number }) {
  const items = sortByDateDesc((snapshot.labWork ?? []).filter((item) => inDateRange(item, options)));
  return limitItems(items, options?.limit ?? 20);
}

export function listUpcomingAppointments(snapshot: HealthSnapshot, options?: { from?: string; limit?: number }) {
  const from = options?.from ?? todayISODate();
  const upcoming = (snapshot.appointments ?? []).filter((apt) => {
    const status = asString(apt.status).toLowerCase();
    if (status === "cancelled") return false;
    const date = itemDate(apt);
    return date >= from;
  });
  const sorted = sortByDateAsc(upcoming).sort((a, b) => {
    const dateCmp = itemDate(a).localeCompare(itemDate(b));
    if (dateCmp !== 0) return dateCmp;
    return asString(a.time).localeCompare(asString(b.time));
  });
  return limitItems(sorted, options?.limit ?? 20);
}

function medDoseCount(med: JsonRecord): number {
  const doses = med.doses;
  if (Array.isArray(doses) && doses.length > 0) return doses.length;
  return 1;
}

export function listMedications(snapshot: HealthSnapshot, options?: DateRange & { includeInactive?: boolean }) {
  const meds = (snapshot.medications ?? []).filter((med) => options?.includeInactive || med.active !== false);
  const range: DateRange = {
    from: options?.from ?? daysAgoISODate(14),
    to: options?.to ?? todayISODate(),
  };
  const logs = (snapshot.medicationLogs ?? []).filter((log) => inDateRange(log, range));

  return meds.map((med) => {
    const id = asString(med.id);
    const medLogs = logs.filter((log) => asString(log.medicationId) === id);
    const taken = medLogs.filter((log) => log.taken === true).length;
    const skipped = medLogs.filter((log) => log.taken === false).length;
    const recorded = medLogs.length;
    return {
      id,
      name: asString(med.name),
      active: med.active !== false,
      medicationType: asString(med.medicationType) || "scheduled",
      frequency: asString(med.frequency),
      doses: Array.isArray(med.doses) ? med.doses : undefined,
      dosage: med.dosage,
      unit: med.unit,
      timeTag: med.timeTag,
      pharmacyName: med.pharmacyName,
      hasStressDose: med.hasStressDose === true,
      doseCount: medDoseCount(med),
      adherence: {
        range,
        recordedDoses: recorded,
        taken,
        skipped,
        takenPercent: recorded === 0 ? null : Math.round((taken / recorded) * 100),
      },
    };
  });
}

export function getHealthProfile(snapshot: HealthSnapshot) {
  const profile = snapshot.profile ?? {};
  const healthProfile = snapshot.healthProfile ?? {};
  const allergy = snapshot.allergy ?? {};
  const sick = snapshot.sickMode ?? {};
  const mental = snapshot.mentalHealthMode ?? {};
  return {
    name: asString(profile.name) || asString(profile.firstName),
    conditions: snapshot.conditions ?? [],
    healthProfile: {
      age: healthProfile.age,
      dateOfBirth: healthProfile.dateOfBirth,
      recoveryTrackingEnabled: healthProfile.recoveryTrackingEnabled === true,
      recoveryFocus: healthProfile.recoveryFocus,
      vaccines: healthProfile.vaccines,
      surgeries: healthProfile.surgeries,
    },
    allergy: {
      hasAllergies: allergy.hasAllergies === true,
      allergyName: allergy.allergyName,
      reactionDescription: allergy.reactionDescription,
      hasEpiPen: allergy.hasEpiPen === true,
      noTreatmentConsequence: allergy.noTreatmentConsequence,
    },
    sickMode: {
      active: sick.active === true,
      recoveryMode: sick.recoveryMode === true,
      startedAt: sick.startedAt,
      hydrationMl: sick.hydrationMl,
      symptoms: sick.symptoms,
    },
    mentalHealthMode: {
      active: mental.active === true,
      startedAt: mental.startedAt,
    },
    ramadanMode: profile.ramadanMode === true,
    source: snapshot.source,
    backupUpdatedAt: snapshot.updatedAt ?? snapshot.exportDate ?? null,
  };
}

export function getRecoveryStatus(snapshot: HealthSnapshot, options?: DateRange & { limit?: number }) {
  const range: DateRange = {
    from: options?.from ?? daysAgoISODate(7),
    to: options?.to ?? todayISODate(),
  };
  const hydration = sortByDateDesc((snapshot.hydrationLogs ?? []).filter((item) => inDateRange(item, range)));
  const eating = sortByDateDesc((snapshot.eatingLogs ?? []).filter((item) => inDateRange(item, range)));
  const checkIns = (snapshot.healthLogs ?? []).filter((item) => inDateRange(item, range));
  return {
    sickMode: snapshot.sickMode ?? { active: false },
    recoveryTrackingEnabled: snapshot.healthProfile?.recoveryTrackingEnabled === true,
    recoveryFocus: snapshot.healthProfile?.recoveryFocus,
    averages: {
      energy: averageField(checkIns, "energy"),
      mood: averageField(checkIns, "mood"),
      sleep: averageField(checkIns, "sleep"),
    },
    recentHydration: limitItems(hydration, options?.limit ?? 14),
    recentEating: limitItems(eating, options?.limit ?? 14),
  };
}

export type QueryCollection =
  | "checkins"
  | "symptoms"
  | "vitals"
  | "medications"
  | "medicationLogs"
  | "appointments"
  | "labs"
  | "imaging"
  | "hydration"
  | "eating";

export function queryHealthData(
  snapshot: HealthSnapshot,
  options: DateRange & { collections?: QueryCollection[]; limit?: number }
) {
  const collections = options.collections?.length
    ? options.collections
    : (["checkins", "symptoms", "vitals", "medicationLogs", "appointments", "labs"] as QueryCollection[]);
  const limit = options.limit ?? 50;
  const range: DateRange = { from: options.from, to: options.to };
  const result: Record<string, JsonRecord[]> = {};

  const pick = (items: JsonRecord[] | undefined) =>
    limitItems(sortByDateDesc((items ?? []).filter((item) => inDateRange(item, range))), limit);

  for (const name of collections) {
    switch (name) {
      case "checkins":
        result.checkins = pick(snapshot.healthLogs);
        break;
      case "symptoms":
        result.symptoms = pick(snapshot.symptoms);
        break;
      case "vitals":
        result.vitals = pick(snapshot.vitals);
        break;
      case "medications":
        result.medications = limitItems(snapshot.medications ?? [], limit);
        break;
      case "medicationLogs":
        result.medicationLogs = pick(snapshot.medicationLogs);
        break;
      case "appointments":
        result.appointments = pick(snapshot.appointments);
        break;
      case "labs":
        result.labs = pick(snapshot.labWork);
        break;
      case "imaging":
        result.imaging = pick(snapshot.imaging);
        break;
      case "hydration":
        result.hydration = pick(snapshot.hydrationLogs);
        break;
      case "eating":
        result.eating = pick(snapshot.eatingLogs);
        break;
    }
  }

  return { range, result };
}

export function getHealthSummary(snapshot: HealthSnapshot, days = 7) {
  const from = daysAgoISODate(days);
  const to = todayISODate();
  const range = { from, to };
  const logs = (snapshot.healthLogs ?? []).filter((item) => inDateRange(item, range));
  const symptoms = (snapshot.symptoms ?? []).filter((item) => inDateRange(item, range));
  const meds = listMedications(snapshot, range);
  const taken = meds.reduce((sum, med) => sum + med.adherence.taken, 0);
  const recorded = meds.reduce((sum, med) => sum + med.adherence.recordedDoses, 0);
  const symptomCounts: Record<string, number> = {};
  for (const symptom of symptoms) {
    const name = asString(symptom.name) || "unspecified";
    symptomCounts[name] = (symptomCounts[name] ?? 0) + 1;
  }

  return {
    range,
    profile: {
      name: asString(snapshot.profile?.name),
      conditionNames: (snapshot.conditions ?? [])
        .map((c) => asString(c.name))
        .filter(Boolean),
    },
    checkIns: {
      count: logs.length,
      averageEnergy: averageField(logs, "energy"),
      averageMood: averageField(logs, "mood"),
      averageSleep: averageField(logs, "sleep"),
    },
    symptoms: {
      count: symptoms.length,
      byName: symptomCounts,
    },
    medications: {
      activeCount: meds.filter((m) => m.active).length,
      taken,
      recorded,
      takenPercent: recorded === 0 ? null : Math.round((taken / recorded) * 100),
    },
    upcomingAppointments: listUpcomingAppointments(snapshot, { limit: 5 }),
    recovery: {
      sickModeActive: snapshot.sickMode?.active === true,
      recoveryMode: snapshot.sickMode?.recoveryMode === true,
      recoveryTrackingEnabled: snapshot.healthProfile?.recoveryTrackingEnabled === true,
    },
    recentVitals: limitItems(listVitals(snapshot, { ...range, limit: 8 }), 8),
    source: snapshot.source,
    backupUpdatedAt: snapshot.updatedAt ?? snapshot.exportDate ?? null,
  };
}
