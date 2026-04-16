import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export interface HealthLog {
  id: string;
  date: string;
  energy: number;
  mood: number;
  sleep: number;
  notes: string;
  fasting: boolean;
  entryOwner?: RecordOwner;
}

export interface Symptom {
  id: string;
  date: string;
  name: string;
  severity: number;
  notes: string;
  temperature?: number;
}

/** A single dose: amount, unit, time of day. Each is tracked independently for reminders and logging. */
export interface MedicationDose {
  id: string;
  amount: string;
  unit: string;
  timeOfDay: string;
  /** When to send the reminder (e.g. "08:00", "20:00"). Used by notification scheduler. */
  reminderTime?: string;
  optionalNotes?: string;
}

export interface Medication {
  id: string;
  name: string;
  /** @deprecated Use doses[].amount + unit. Kept for migration. */
  dosage?: string;
  frequency: string;
  /** @deprecated Use doses[].unit. Kept for migration. */
  unit?: string;
  route?: string;
  emoji?: string;
  pharmacyId?: string;
  pharmacyName?: string;
  pharmacyPhone?: string;
  pharmacyAddress?: string;
  pharmacyHospital?: string;
  reminderCadence?: "daily" | "weekly" | "biweekly" | "custom";
  reminderWeekday?: number;
  reminderIntervalValue?: number;
  reminderIntervalUnit?: "days" | "weeks";
  /** New: array of independent doses. If present, use this instead of dosage/timeTag/doses count. */
  doses?: MedicationDose[];
  /** @deprecated Use doses[].timeOfDay. Kept for migration. */
  timeTag?: string | string[];
  active: boolean;
  /** @deprecated Kept for migration. Use amountPerRefill/currentSupplyAmount. */
  totalPills?: number;
  /** @deprecated Kept for migration. Use currentSupplyAmount. */
  pillsRemaining?: number;
  /** @deprecated Kept for migration. Use inventoryUnit. */
  refillUnit?: string;
  inventoryUnit?: string;
  currentSupplyAmount?: number;
  amountPerRefill?: number;
  refillsRemaining?: number;
  supplyPerDose?: number;
  lowSupplyThreshold?: number;
  concentrationMgPerMl?: number;
  hasStressDose?: boolean;
  stressDoseAmount?: string;
  stressDoseFrequency?: string;
  stressDoseDurationDays?: number;
  stressDoseInstructions?: string;
  entryOwner?: RecordOwner;
}

/** Normalize legacy medication (dosage + timeTag + doses count) to doses array. */
export function normalizeMedication(med: Medication): Medication {
  if (Array.isArray(med.doses) && med.doses.length > 0) {
    return { ...med, doses: med.doses };
  }
  const legacyDosage = (med as { dosage?: string }).dosage ?? "";
  const legacyUnit = (med as { unit?: string }).unit ?? "mg";
  const legacyTimeTag = (med as { timeTag?: string | string[] }).timeTag;
  const tags = Array.isArray(legacyTimeTag)
    ? legacyTimeTag
    : typeof legacyTimeTag === "string"
    ? [legacyTimeTag]
    : ["Morning"];
  const count = Math.max(1, (med as { doses?: number }).doses ?? tags.length);
  const timeLabels = count <= tags.length ? tags.slice(0, count) : [...tags, ...Array.from({ length: count - tags.length }, (_, i) => `Dose ${i + 1}`)];
  const doses: MedicationDose[] = timeLabels.map((timeOfDay, i) => ({
    id: `legacy-${med.id}-${i}`,
    amount: i === 0 ? legacyDosage : "",
    unit: legacyUnit,
    timeOfDay,
    optionalNotes: undefined,
  }));
  return { ...med, doses };
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  doseIndex?: number;
  date: string;
  taken: boolean;
}

export interface SickModeData {
  active: boolean;
  startedAt?: string;
  recoveryMode?: boolean;
  checkInTimer?: string;
  lastCheckIn?: string;
  hydrationMl: number;
  foodChecklist: { lightMeal: boolean; saltySnack: boolean; liquidCalories: boolean };
  restChecklist: { lying: boolean; napping: boolean; screenBreak: boolean };
  symptoms: string[];
  temperatures: { time: string; value: number }[];
  prnDoses: { med: string; time: string }[];
}

export interface AllergyInfo {
  hasAllergies: boolean;
  allergyName: string;
  reactionDescription: string;
  hasEpiPen: boolean;
  primaryEpiPenLocation: string;
  backupEpiPenLocation: string;
  noTreatmentConsequence: string;
}

export type UserRole = "self" | "caregiver" | "backup";
export type RecordOwner = "self" | "care_recipient";
export type WidgetAppearancePreference = "system" | "calm" | "light" | "dark";

export interface BackupCriticalMedication {
  id: string;
  name: string;
  instructions?: string;
}

export interface VaccineRecord {
  id: string;
  vaccine: string;
  receivedAt: string;
  location?: string;
  lotNumber?: string;
  recordImageUri?: string;
}

export interface SurgeryRecord {
  id: string;
  procedure: string;
  estimatedWhen: string;
  location?: string;
}

export interface HealthProfileInfo {
  age?: number;
  dateOfBirth?: string;
  profileImageUri?: string;
  userRole?: UserRole;
  widgetAppearance?: WidgetAppearancePreference;
  caredForName?: string;
  caredForAge?: number;
  backupEmergencyProtocols?: string;
  backupCriticalMedications?: BackupCriticalMedication[];
  vaccines?: VaccineRecord[];
  surgeries?: SurgeryRecord[];
}

export type RepeatUnit = "day" | "week" | "month";

export interface Doctor {
  id: string;
  name: string;
  specialty?: string;
  phone?: string;
  address?: string;
  hospital?: string;
  created_at?: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  hospital?: string;
  created_at?: string;
}

export type AppointmentStatus = "completed" | "rescheduled" | "cancelled";

export interface Appointment {
  id: string;
  doctor_id?: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  is_recurring?: boolean;
  repeat_interval?: number;
  repeat_unit?: RepeatUnit;
  repeat_end_date?: string | null;
  parent_recurring_id?: string | null;
  status?: AppointmentStatus;
  entryOwner?: RecordOwner;
}

export interface DoctorNote {
  id: string;
  text: string;
  appointmentId?: string;
  createdAt: string;
}

export interface FastingLog {
  id: string;
  date: string;
  suhoorTime: string;
  iftarTime: string;
  hydrationGlasses: number;
  energyLevel: number;
  notes: string;
}

export interface Vital {
  id: string;
  date: string;
  recordedAt?: string;
  type: string;
  value: string;
  unit: string;
}

export interface MonthlyCheckIn {
  id: string;
  date: string;
  bp?: string;
  weight?: string;
  weightUnit?: string;
  height?: string;
  heightUnit?: string;
  heartRate?: string;
  ecgNotes?: string;
  mentalHealthNotes?: string;
}

export type CycleFlow = "light" | "medium" | "heavy";

export interface CycleEntry {
  id: string;
  date: string;
  flow?: CycleFlow;
  symptoms?: string;
  notes?: string;
}

export type EatingAmount = "small" | "medium" | "large";

export interface EatingEntry {
  id: string;
  date: string;
  time?: string;
  what: string;
  amount: EatingAmount;
}

export interface MentalHealthModeData {
  active: boolean;
  startedAt?: string;
  hourlyCheckInTimer?: string;
  lastCheckIn?: string;
  whatsHappening?: string;
  medsOnTime?: boolean;
}

export interface ComfortItem {
  id: string;
  label: string;
}

export interface Goal {
  id: string;
  title: string;
  type: "meds_streak" | "custom";
  targetDays?: number;
  startDate?: string;
  completedAt?: string;
}

export interface DocumentExtraction {
  id: string;
  date: string;
  imageUri?: string;
  diagnoses: string[];
  medications: { name: string; dosage: string; frequency: string; status: string }[];
  labResults: { test: string; value: string; unit: string; referenceRange: string; flag: string }[];
  followUpDates: { date: string; doctor: string; purpose: string }[];
  doctorInstructions: string[];
  summary: string;
}

export interface HealthInsight {
  id: string;
  date: string;
  changes: { title: string; description: string; type: string }[];
  unclear: { title: string; description: string; suggestion: string }[];
  labsToTrack: { test: string; reason: string; frequency: string }[];
  symptomCorrelations: { pattern: string; description: string; confidence: string }[];
  medicationNotes: { medication: string; note: string; type: string }[];
  ramadanTips: { tip: string; category: string }[];
  summary: string;
}

export interface MedComparison {
  id: string;
  date: string;
  documentId: string;
  newMeds: { name: string; dosage: string; frequency: string; source: string }[];
  stoppedMeds: { name: string; dosage: string; reason: string }[];
  doseChanged: { name: string; oldDosage: string; newDosage: string }[];
  unchanged: { name: string; dosage: string }[];
  summary: string;
}

export interface HealthCondition {
  id: string;
  name: string;
  source: "database" | "custom";
  dateAdded: string;
  notes?: string;
  requiresStressDose?: boolean;
}

/** Section keys that can be enabled/disabled by user (v1.3). If undefined, all sections are shown. */
/** Sections the user cannot turn off — always shown. */
export const REQUIRED_SECTION_KEYS: readonly string[] = ["medications", "appointments", "healthdata"];

export const ALL_SECTION_KEYS = [
  "log", "healthdata", "medications", "symptoms", "monthlycheckin",
  "eating", "mentalhealth", "comfort", "goals", "appointments", "reports", "privacy", "cycletracking",
] as const;
export type SectionKey = (typeof ALL_SECTION_KEYS)[number];

export interface UserSettings {
  name: string;
  firstName?: string;
  lastName?: string;
  conditions: string[];
  ramadanMode: boolean;
  sickMode: boolean;
  highContrast?: boolean;
  onboardingCompleted?: true;
  /** Sections the user chose in onboarding (v1.3). Undefined = show all. */
  enabledSections?: string[];
  /** Notification toggles (default true when enabled). */
  notificationsMedications?: boolean;
  notificationsAppointments?: boolean;
  notificationsDailyCheckIn?: boolean;
  notificationsMonthly?: boolean;
  /** Daily check-in reminder time "HH:mm" (default "20:00" = 8 PM). */
  dailyCheckInReminderTime?: string;
}

const KEYS = {
  HEALTH_LOGS: "fir_health_logs",
  SYMPTOMS: "fir_symptoms",
  MEDICATIONS: "fir_medications",
  MEDICATION_LOGS: "fir_medication_logs",
  APPOINTMENTS: "fir_appointments",
  DOCTOR_NOTES: "fir_doctor_notes",
  FASTING_LOGS: "fir_fasting_logs",
  VITALS: "fir_vitals",
  SETTINGS: "fir_settings",
  SICK_MODE: "fir_sick_mode",
  DOCUMENTS: "fir_documents",
  INSIGHTS: "fir_insights",
  MED_COMPARISONS: "fir_med_comparisons",
  ALLERGY_INFO: "fir_allergy_info",
  CONDITIONS: "fir_conditions",
  HEALTH_PROFILE_INFO: "fir_health_profile_info",
  MONTHLY_CHECK_INS: "fir_monthly_check_ins",
  EATING_LOGS: "fir_eating_logs",
  MENTAL_HEALTH_MODE: "fir_mental_health_mode",
  COMFORT_ITEMS: "fir_comfort_items",
  GOALS: "fir_goals",
  DOCTORS: "fir_doctors",
  PHARMACIES: "fir_pharmacies",
  CYCLE_ENTRIES: "fir_cycle_entries",
};

async function getItem<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("AsyncStorage getItem failed", key, e);
    return [];
  }
}

async function setItem<T>(key: string, data: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("AsyncStorage setItem failed", key, e);
  }
}

export const healthLogStorage = {
  getAll: async () => {
    const logs = await getItem<HealthLog>(KEYS.HEALTH_LOGS);
    return logs.map((log) => ({ ...log, entryOwner: log.entryOwner ?? "self" }));
  },
  getByDate: async (date: string, entryOwner: RecordOwner = "self") => {
    const logs = await getItem<HealthLog>(KEYS.HEALTH_LOGS);
    return logs.find((l) => l.date === date && (l.entryOwner ?? "self") === entryOwner);
  },
  save: async (log: Omit<HealthLog, "id">) => {
    const logs = await getItem<HealthLog>(KEYS.HEALTH_LOGS);
    const owner = log.entryOwner ?? "self";
    const existing = logs.findIndex((l) => l.date === log.date && (l.entryOwner ?? "self") === owner);
    if (existing >= 0) {
      logs[existing] = { ...logs[existing], ...log, entryOwner: owner };
    } else {
      logs.push({ ...log, id: Crypto.randomUUID(), entryOwner: owner });
    }
    await setItem(KEYS.HEALTH_LOGS, logs);
  },
  delete: async (id: string) => {
    const logs = await getItem<HealthLog>(KEYS.HEALTH_LOGS);
    await setItem(KEYS.HEALTH_LOGS, logs.filter((l) => l.id !== id));
  },
};

export const symptomStorage = {
  getAll: () => getItem<Symptom>(KEYS.SYMPTOMS),
  getByDate: async (date: string) => {
    const all = await getItem<Symptom>(KEYS.SYMPTOMS);
    return all.filter((s) => s.date === date);
  },
  save: async (symptom: Omit<Symptom, "id">) => {
    const all = await getItem<Symptom>(KEYS.SYMPTOMS);
    all.push({ ...symptom, id: Crypto.randomUUID() });
    await setItem(KEYS.SYMPTOMS, all);
  },
  delete: async (id: string) => {
    const all = await getItem<Symptom>(KEYS.SYMPTOMS);
    await setItem(KEYS.SYMPTOMS, all.filter((s) => s.id !== id));
  },
};

export const medicationStorage = {
  getAll: async () => {
    const raw = await getItem<Medication>(KEYS.MEDICATIONS);
    return raw.map((med) => ({ ...normalizeMedication(med), entryOwner: med.entryOwner ?? "self" }));
  },
  save: async (med: Omit<Medication, "id">) => {
    const meds = await getItem<Medication>(KEYS.MEDICATIONS);
    meds.push({ ...med, id: Crypto.randomUUID(), entryOwner: med.entryOwner ?? "self" });
    await setItem(KEYS.MEDICATIONS, meds);
  },
  update: async (id: string, updates: Partial<Medication>) => {
    const meds = await getItem<Medication>(KEYS.MEDICATIONS);
    const idx = meds.findIndex((m) => m.id === id);
    if (idx >= 0) {
      meds[idx] = { ...meds[idx], ...updates };
      await setItem(KEYS.MEDICATIONS, meds);
    }
  },
  delete: async (id: string) => {
    const meds = await getItem<Medication>(KEYS.MEDICATIONS);
    await setItem(KEYS.MEDICATIONS, meds.filter((m) => m.id !== id));
  },
};

export const medicationLogStorage = {
  getAll: () => getItem<MedicationLog>(KEYS.MEDICATION_LOGS),
  getByDate: async (date: string) => {
    const logs = await getItem<MedicationLog>(KEYS.MEDICATION_LOGS);
    return logs.filter((l) => l.date === date);
  },
  toggle: async (medicationId: string, date: string, doseIndex?: number) => {
    const logs = await getItem<MedicationLog>(KEYS.MEDICATION_LOGS);
    const existing = logs.findIndex(
      (l) => l.medicationId === medicationId && l.date === date && (l.doseIndex ?? 0) === (doseIndex ?? 0),
    );
    if (existing >= 0) {
      logs[existing].taken = !logs[existing].taken;
    } else {
      logs.push({ id: Crypto.randomUUID(), medicationId, doseIndex: doseIndex ?? 0, date, taken: true });
    }
    await setItem(KEYS.MEDICATION_LOGS, logs);
  },
};

export const doctorsStorage = {
  getAll: () => getItem<Doctor>(KEYS.DOCTORS),
  save: async (doc: Omit<Doctor, "id" | "created_at">) => {
    const all = await getItem<Doctor>(KEYS.DOCTORS);
    const newDoc: Doctor = {
      ...doc,
      name: (doc.name ?? "").trim(),
      specialty: doc.specialty?.trim() || undefined,
      phone: doc.phone?.trim() || undefined,
      address: doc.address?.trim() || undefined,
      hospital: doc.hospital?.trim() || undefined,
      id: Crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    all.push(newDoc);
    await setItem(KEYS.DOCTORS, all);
    return newDoc;
  },
  addOrGet: async (doc: { name: string; specialty?: string; phone?: string; address?: string; hospital?: string }) => {
    const all = await getItem<Doctor>(KEYS.DOCTORS);
    const name = (doc.name ?? "").trim();
    const normalized = name.toLowerCase();
    const existing = all.find((d) => (d.name ?? "").trim().toLowerCase() === normalized);
    if (existing) return existing;
    const newDoc: Doctor = {
      id: Crypto.randomUUID(),
      name,
      specialty: doc.specialty?.trim() || undefined,
      phone: doc.phone?.trim() || undefined,
      address: doc.address?.trim() || undefined,
      hospital: doc.hospital?.trim() || undefined,
      created_at: new Date().toISOString(),
    };
    all.push(newDoc);
    await setItem(KEYS.DOCTORS, all);
    return newDoc;
  },
  update: async (id: string, updates: Partial<Omit<Doctor, "id" | "created_at">>) => {
    const all = await getItem<Doctor>(KEYS.DOCTORS);
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) return;
    all[idx] = {
      ...all[idx],
      ...updates,
      name: (updates.name ?? all[idx].name ?? "").trim(),
      specialty: updates.specialty !== undefined ? (updates.specialty?.trim() || undefined) : all[idx].specialty,
      phone: updates.phone !== undefined ? (updates.phone?.trim() || undefined) : all[idx].phone,
      address: updates.address !== undefined ? (updates.address?.trim() || undefined) : all[idx].address,
      hospital: updates.hospital !== undefined ? (updates.hospital?.trim() || undefined) : all[idx].hospital,
    };
    await setItem(KEYS.DOCTORS, all);
  },
  mergeFromRemote: async (remote: Doctor[]) => {
    const local = await getItem<Doctor>(KEYS.DOCTORS);
    const byId = new Map(local.map((d) => [d.id, d]));
    remote.forEach((r) => byId.set(r.id, r));
    await setItem(KEYS.DOCTORS, Array.from(byId.values()));
  },
  delete: async (id: string) => {
    const all = await getItem<Doctor>(KEYS.DOCTORS);
    await setItem(KEYS.DOCTORS, all.filter((d) => d.id !== id));
  },
};

export const pharmacyStorage = {
  getAll: () => getItem<Pharmacy>(KEYS.PHARMACIES),
  save: async (pharmacy: Omit<Pharmacy, "id" | "created_at">) => {
    const all = await getItem<Pharmacy>(KEYS.PHARMACIES);
    const newPharmacy: Pharmacy = {
      ...pharmacy,
      name: (pharmacy.name ?? "").trim(),
      phone: pharmacy.phone?.trim() || undefined,
      address: pharmacy.address?.trim() || undefined,
      hospital: pharmacy.hospital?.trim() || undefined,
      id: Crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    all.push(newPharmacy);
    await setItem(KEYS.PHARMACIES, all);
    return newPharmacy;
  },
  addOrGet: async (pharmacy: { name: string; phone?: string; address?: string; hospital?: string }) => {
    const all = await getItem<Pharmacy>(KEYS.PHARMACIES);
    const name = (pharmacy.name ?? "").trim();
    const normalized = name.toLowerCase();
    const existing = all.find((p) => (p.name ?? "").trim().toLowerCase() === normalized);
    if (existing) return existing;
    const newPharmacy: Pharmacy = {
      id: Crypto.randomUUID(),
      name,
      phone: pharmacy.phone?.trim() || undefined,
      address: pharmacy.address?.trim() || undefined,
      hospital: pharmacy.hospital?.trim() || undefined,
      created_at: new Date().toISOString(),
    };
    all.push(newPharmacy);
    await setItem(KEYS.PHARMACIES, all);
    return newPharmacy;
  },
  update: async (id: string, updates: Partial<Omit<Pharmacy, "id" | "created_at">>) => {
    const all = await getItem<Pharmacy>(KEYS.PHARMACIES);
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return;
    all[idx] = {
      ...all[idx],
      ...updates,
      name: (updates.name ?? all[idx].name ?? "").trim(),
      phone: updates.phone !== undefined ? (updates.phone?.trim() || undefined) : all[idx].phone,
      address: updates.address !== undefined ? (updates.address?.trim() || undefined) : all[idx].address,
      hospital: updates.hospital !== undefined ? (updates.hospital?.trim() || undefined) : all[idx].hospital,
    };
    await setItem(KEYS.PHARMACIES, all);
  },
  delete: async (id: string) => {
    const all = await getItem<Pharmacy>(KEYS.PHARMACIES);
    await setItem(KEYS.PHARMACIES, all.filter((p) => p.id !== id));
  },
};

function addIntervalToDate(dateStr: string, interval: number, unit: RepeatUnit): string {
  const d = new Date(dateStr + "T12:00:00");
  if (unit === "day") d.setDate(d.getDate() + interval);
  else if (unit === "week") d.setDate(d.getDate() + interval * 7);
  else if (unit === "month") d.setMonth(d.getMonth() + interval);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const appointmentStorage = {
  getAll: async () => {
    const apts = await getItem<Appointment>(KEYS.APPOINTMENTS);
    return apts.map((apt) => ({ ...apt, entryOwner: apt.entryOwner ?? "self" }));
  },
  setAll: async (apts: Appointment[]) => {
    await setItem(KEYS.APPOINTMENTS, apts);
  },
  save: async (apt: Omit<Appointment, "id">) => {
    const apts = await getItem<Appointment>(KEYS.APPOINTMENTS);
    const id = Crypto.randomUUID();
    const first: Appointment = { ...apt, id, entryOwner: apt.entryOwner ?? "self" };
    apts.push(first);
    const isRecurring = apt.is_recurring && apt.repeat_interval != null && apt.repeat_unit;
    if (isRecurring && apt.repeat_interval != null && apt.repeat_unit) {
      const interval = apt.repeat_interval;
      const unit = apt.repeat_unit;
      const end = apt.repeat_end_date ?? (() => {
        const d = new Date(apt.date + "T12:00:00");
        d.setMonth(d.getMonth() + 6);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
      let nextDate = addIntervalToDate(apt.date, interval, unit);
      while (nextDate <= end) {
        apts.push({
          ...apt,
          id: Crypto.randomUUID(),
          date: nextDate,
          parent_recurring_id: id,
          is_recurring: false,
          repeat_interval: undefined,
          repeat_unit: undefined,
          repeat_end_date: undefined,
          entryOwner: apt.entryOwner ?? "self",
        });
        nextDate = addIntervalToDate(nextDate, interval, unit);
      }
    }
    await setItem(KEYS.APPOINTMENTS, apts);
    return first;
  },
  update: async (id: string, updates: Partial<Appointment>) => {
    const apts = await getItem<Appointment>(KEYS.APPOINTMENTS);
    const idx = apts.findIndex((a) => a.id === id);
    if (idx >= 0) {
      apts[idx] = { ...apts[idx], ...updates };
      await setItem(KEYS.APPOINTMENTS, apts);
    }
  },
  delete: async (id: string) => {
    const apts = await getItem<Appointment>(KEYS.APPOINTMENTS);
    await setItem(KEYS.APPOINTMENTS, apts.filter((a) => a.id !== id));
  },
  deleteRecurringFuture: async (parentId: string, fromDate: string) => {
    const apts = await getItem<Appointment>(KEYS.APPOINTMENTS);
    const filtered = apts.filter((a) => !(a.parent_recurring_id === parentId && a.date >= fromDate));
    await setItem(KEYS.APPOINTMENTS, filtered);
  },
};

export const doctorNoteStorage = {
  getAll: () => getItem<DoctorNote>(KEYS.DOCTOR_NOTES),
  save: async (note: Omit<DoctorNote, "id" | "createdAt">) => {
    const notes = await getItem<DoctorNote>(KEYS.DOCTOR_NOTES);
    notes.push({ ...note, id: Crypto.randomUUID(), createdAt: new Date().toISOString() });
    await setItem(KEYS.DOCTOR_NOTES, notes);
  },
  delete: async (id: string) => {
    const notes = await getItem<DoctorNote>(KEYS.DOCTOR_NOTES);
    await setItem(KEYS.DOCTOR_NOTES, notes.filter((n) => n.id !== id));
  },
};

export const fastingLogStorage = {
  getAll: () => getItem<FastingLog>(KEYS.FASTING_LOGS),
  getByDate: async (date: string) => {
    const all = await getItem<FastingLog>(KEYS.FASTING_LOGS);
    return all.find((f) => f.date === date);
  },
  save: async (log: Omit<FastingLog, "id">) => {
    const all = await getItem<FastingLog>(KEYS.FASTING_LOGS);
    const existing = all.findIndex((f) => f.date === log.date);
    if (existing >= 0) {
      all[existing] = { ...all[existing], ...log };
    } else {
      all.push({ ...log, id: Crypto.randomUUID() });
    }
    await setItem(KEYS.FASTING_LOGS, all);
  },
};

export const vitalStorage = {
  getAll: () => getItem<Vital>(KEYS.VITALS),
  save: async (vital: Omit<Vital, "id">) => {
    const all = await getItem<Vital>(KEYS.VITALS);
    all.push({ ...vital, id: Crypto.randomUUID() });
    await setItem(KEYS.VITALS, all);
  },
  update: async (id: string, updates: Partial<Omit<Vital, "id">>) => {
    const all = await getItem<Vital>(KEYS.VITALS);
    const idx = all.findIndex((v) => v.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...updates };
    await setItem(KEYS.VITALS, all);
  },
  delete: async (id: string) => {
    const all = await getItem<Vital>(KEYS.VITALS);
    await setItem(KEYS.VITALS, all.filter((v) => v.id !== id));
  },
};

export const settingsStorage = {
  get: async (): Promise<UserSettings> => {
    const defaults: UserSettings = { name: "", conditions: [], ramadanMode: false, sickMode: false };
    try {
      const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch (e) {
      console.warn("AsyncStorage settings get failed", e);
      return defaults;
    }
  },
  save: async (settings: UserSettings) => {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn("AsyncStorage settings save failed", e);
    }
  },
};

const DEFAULT_SICK_MODE: SickModeData = {
  active: false,
  hydrationMl: 0,
  foodChecklist: { lightMeal: false, saltySnack: false, liquidCalories: false },
  restChecklist: { lying: false, napping: false, screenBreak: false },
  symptoms: [],
  temperatures: [],
  prnDoses: [],
};

export const sickModeStorage = {
  get: async (): Promise<SickModeData> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SICK_MODE);
      return raw ? { ...DEFAULT_SICK_MODE, ...JSON.parse(raw) } : { ...DEFAULT_SICK_MODE };
    } catch (e) {
      console.warn("AsyncStorage sickMode get failed", e);
      return { ...DEFAULT_SICK_MODE };
    }
  },
  save: async (data: SickModeData) => {
    try {
      await AsyncStorage.setItem(KEYS.SICK_MODE, JSON.stringify(data));
    } catch (e) {
      console.warn("AsyncStorage sickMode save failed", e);
    }
  },
  reset: async () => {
    try {
      await AsyncStorage.setItem(KEYS.SICK_MODE, JSON.stringify(DEFAULT_SICK_MODE));
    } catch (e) {
      console.warn("AsyncStorage sickMode reset failed", e);
    }
  },
};

export const documentStorage = {
  getAll: () => getItem<DocumentExtraction>(KEYS.DOCUMENTS),
  save: async (doc: Omit<DocumentExtraction, "id">) => {
    const all = await getItem<DocumentExtraction>(KEYS.DOCUMENTS);
    const newDoc = { ...doc, id: Crypto.randomUUID() };
    all.push(newDoc);
    await setItem(KEYS.DOCUMENTS, all);
    return newDoc;
  },
  delete: async (id: string) => {
    const all = await getItem<DocumentExtraction>(KEYS.DOCUMENTS);
    await setItem(KEYS.DOCUMENTS, all.filter((d) => d.id !== id));
  },
};

export const insightStorage = {
  getAll: () => getItem<HealthInsight>(KEYS.INSIGHTS),
  getLatest: async () => {
    const all = await getItem<HealthInsight>(KEYS.INSIGHTS);
    return all.sort((a, b) => b.date.localeCompare(a.date))[0];
  },
  save: async (insight: Omit<HealthInsight, "id">) => {
    const all = await getItem<HealthInsight>(KEYS.INSIGHTS);
    const newInsight = { ...insight, id: Crypto.randomUUID() };
    all.push(newInsight);
    await setItem(KEYS.INSIGHTS, all);
    return newInsight;
  },
  deleteAll: async () => {
    await setItem(KEYS.INSIGHTS, []);
  },
};

export const medComparisonStorage = {
  getAll: () => getItem<MedComparison>(KEYS.MED_COMPARISONS),
  save: async (comp: Omit<MedComparison, "id">) => {
    const all = await getItem<MedComparison>(KEYS.MED_COMPARISONS);
    const newComp = { ...comp, id: Crypto.randomUUID() };
    all.push(newComp);
    await setItem(KEYS.MED_COMPARISONS, all);
    return newComp;
  },
  delete: async (id: string) => {
    const all = await getItem<MedComparison>(KEYS.MED_COMPARISONS);
    await setItem(KEYS.MED_COMPARISONS, all.filter((c) => c.id !== id));
  },
};

const DEFAULT_ALLERGY_INFO: AllergyInfo = {
  hasAllergies: false,
  allergyName: "",
  reactionDescription: "",
  hasEpiPen: false,
  primaryEpiPenLocation: "",
  backupEpiPenLocation: "",
  noTreatmentConsequence: "",
};

export const allergyStorage = {
  get: async (): Promise<AllergyInfo> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ALLERGY_INFO);
      return raw ? { ...DEFAULT_ALLERGY_INFO, ...JSON.parse(raw) } : { ...DEFAULT_ALLERGY_INFO };
    } catch (e) {
      console.warn("AsyncStorage allergy get failed", e);
      return { ...DEFAULT_ALLERGY_INFO };
    }
  },
  save: async (data: AllergyInfo) => {
    try {
      await AsyncStorage.setItem(KEYS.ALLERGY_INFO, JSON.stringify(data));
    } catch (e) {
      console.warn("AsyncStorage allergy save failed", e);
    }
  },
};

export const emergencyDoctorStorage = {
  getDocId: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem("emergency_doctor");
    } catch {
      return null;
    }
  },
  setDocId: async (id: string | null): Promise<void> => {
    try {
      if (id === null) {
        await AsyncStorage.removeItem("emergency_doctor");
      } else {
        await AsyncStorage.setItem("emergency_doctor", id);
      }
    } catch (e) {
      console.warn("AsyncStorage emergencyDoctor setDocId failed", e);
    }
  },
};

export const primaryDoctorStorage = {
  getDocId: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem("primary_doctor");
    } catch {
      return null;
    }
  },
  setDocId: async (id: string | null): Promise<void> => {
    try {
      if (id === null) {
        await AsyncStorage.removeItem("primary_doctor");
      } else {
        await AsyncStorage.setItem("primary_doctor", id);
      }
    } catch (e) {
      console.warn("AsyncStorage primaryDoctor setDocId failed", e);
    }
  },
};

export const healthProfileStorage = {
  get: async (): Promise<HealthProfileInfo> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.HEALTH_PROFILE_INFO);
      return raw
        ? { userRole: "self", widgetAppearance: "system", backupCriticalMedications: [], vaccines: [], surgeries: [], ...JSON.parse(raw) }
        : { userRole: "self", widgetAppearance: "system", backupCriticalMedications: [], vaccines: [], surgeries: [] };
    } catch (e) {
      console.warn("AsyncStorage healthProfile get failed", e);
      return { userRole: "self", widgetAppearance: "system", backupCriticalMedications: [], vaccines: [], surgeries: [] };
    }
  },
  save: async (data: HealthProfileInfo) => {
    try {
      await AsyncStorage.setItem(
        KEYS.HEALTH_PROFILE_INFO,
        JSON.stringify({
          userRole: "self",
          widgetAppearance: "system",
          backupCriticalMedications: [],
          vaccines: [],
          surgeries: [],
          ...data,
        })
      );
    } catch (e) {
      console.warn("AsyncStorage healthProfile save failed", e);
    }
  },
};

export const cycleTrackingStorage = {
  getAll: () => getItem<CycleEntry>(KEYS.CYCLE_ENTRIES),
  getLatest: async () => {
    const all = await getItem<CycleEntry>(KEYS.CYCLE_ENTRIES);
    return all.sort((a, b) => b.date.localeCompare(a.date))[0];
  },
  save: async (data: Omit<CycleEntry, "id">) => {
    const all = await getItem<CycleEntry>(KEYS.CYCLE_ENTRIES);
    const newItem = { ...data, id: Crypto.randomUUID() };
    all.push(newItem);
    await setItem(KEYS.CYCLE_ENTRIES, all);
    return newItem;
  },
  delete: async (id: string) => {
    const all = await getItem<CycleEntry>(KEYS.CYCLE_ENTRIES);
    await setItem(KEYS.CYCLE_ENTRIES, all.filter((entry) => entry.id !== id));
  },
};

export const conditionStorage = {
  getAll: () => getItem<HealthCondition>(KEYS.CONDITIONS),
  save: async (data: Omit<HealthCondition, "id">) => {
    const items = await getItem<HealthCondition>(KEYS.CONDITIONS);
    const id = `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    items.push({ ...data, id });
    await setItem(KEYS.CONDITIONS, items);
    return id;
  },
  update: async (id: string, updates: Partial<HealthCondition>) => {
    const items = await getItem<HealthCondition>(KEYS.CONDITIONS);
    const idx = items.findIndex(c => c.id === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...updates };
      await setItem(KEYS.CONDITIONS, items);
    }
  },
  delete: async (id: string) => {
    const items = await getItem<HealthCondition>(KEYS.CONDITIONS);
    await setItem(KEYS.CONDITIONS, items.filter(c => c.id !== id));
  },
};

export const monthlyCheckInStorage = {
  getAll: () => getItem<MonthlyCheckIn>(KEYS.MONTHLY_CHECK_INS),
  getLatest: async () => {
    const all = await getItem<MonthlyCheckIn>(KEYS.MONTHLY_CHECK_INS);
    return all.sort((a, b) => b.date.localeCompare(a.date))[0];
  },
  save: async (data: Omit<MonthlyCheckIn, "id">) => {
    const all = await getItem<MonthlyCheckIn>(KEYS.MONTHLY_CHECK_INS);
    const newItem = { ...data, id: Crypto.randomUUID() };
    all.push(newItem);
    await setItem(KEYS.MONTHLY_CHECK_INS, all);
    return newItem;
  },
  delete: async (id: string) => {
    const all = await getItem<MonthlyCheckIn>(KEYS.MONTHLY_CHECK_INS);
    await setItem(KEYS.MONTHLY_CHECK_INS, all.filter((c) => c.id !== id));
  },
};

export const eatingStorage = {
  getAll: () => getItem<EatingEntry>(KEYS.EATING_LOGS),
  getByDateRange: async (from: string, to: string) => {
    const all = await getItem<EatingEntry>(KEYS.EATING_LOGS);
    return all.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
  },
  save: async (data: Omit<EatingEntry, "id">) => {
    const all = await getItem<EatingEntry>(KEYS.EATING_LOGS);
    const newItem = { ...data, id: Crypto.randomUUID() };
    all.push(newItem);
    await setItem(KEYS.EATING_LOGS, all);
    return newItem;
  },
  delete: async (id: string) => {
    const all = await getItem<EatingEntry>(KEYS.EATING_LOGS);
    await setItem(KEYS.EATING_LOGS, all.filter((e) => e.id !== id));
  },
};

const DEFAULT_MENTAL_HEALTH_MODE: MentalHealthModeData = {
  active: false,
};

export const mentalHealthModeStorage = {
  get: async (): Promise<MentalHealthModeData> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.MENTAL_HEALTH_MODE);
      return raw ? { ...DEFAULT_MENTAL_HEALTH_MODE, ...JSON.parse(raw) } : { ...DEFAULT_MENTAL_HEALTH_MODE };
    } catch (e) {
      console.warn("AsyncStorage mentalHealthMode get failed", e);
      return { ...DEFAULT_MENTAL_HEALTH_MODE };
    }
  },
  save: async (data: MentalHealthModeData) => {
    try {
      await AsyncStorage.setItem(KEYS.MENTAL_HEALTH_MODE, JSON.stringify(data));
    } catch (e) {
      console.warn("AsyncStorage mentalHealthMode save failed", e);
    }
  },
  reset: async () => {
    try {
      await AsyncStorage.setItem(KEYS.MENTAL_HEALTH_MODE, JSON.stringify(DEFAULT_MENTAL_HEALTH_MODE));
    } catch (e) {
      console.warn("AsyncStorage mentalHealthMode reset failed", e);
    }
  },
};

export const comfortStorage = {
  getAll: () => getItem<ComfortItem>(KEYS.COMFORT_ITEMS),
  save: async (data: Omit<ComfortItem, "id">) => {
    const all = await getItem<ComfortItem>(KEYS.COMFORT_ITEMS);
    const newItem = { ...data, id: Crypto.randomUUID() };
    all.push(newItem);
    await setItem(KEYS.COMFORT_ITEMS, all);
    return newItem;
  },
  delete: async (id: string) => {
    const all = await getItem<ComfortItem>(KEYS.COMFORT_ITEMS);
    await setItem(KEYS.COMFORT_ITEMS, all.filter((c) => c.id !== id));
  },
};

export const goalStorage = {
  getAll: () => getItem<Goal>(KEYS.GOALS),
  save: async (data: Omit<Goal, "id">) => {
    const all = await getItem<Goal>(KEYS.GOALS);
    const newItem = { ...data, id: Crypto.randomUUID() };
    all.push(newItem);
    await setItem(KEYS.GOALS, all);
    return newItem;
  },
  update: async (id: string, updates: Partial<Omit<Goal, "id">>) => {
    const all = await getItem<Goal>(KEYS.GOALS);
    const idx = all.findIndex((g) => g.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updates };
      await setItem(KEYS.GOALS, all);
    }
  },
  delete: async (id: string) => {
    const all = await getItem<Goal>(KEYS.GOALS);
    await setItem(KEYS.GOALS, all.filter((g) => g.id !== id));
  },
};

export type ExportPayload = {
  exportDate: string;
  appVersion: string;
  profile: UserSettings;
  healthProfile?: HealthProfileInfo;
  healthLogs: HealthLog[];
  symptoms: Symptom[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
  doctors: Doctor[];
  pharmacies?: Pharmacy[];
  appointments: Appointment[];
  doctorNotes: DoctorNote[];
  fastingLogs: FastingLog[];
  vitals: Vital[];
  documents: DocumentExtraction[];
  insights: HealthInsight[];
  allergy?: AllergyInfo;
  conditions?: HealthCondition[];
  sickMode?: SickModeData;
  medComparisons?: MedComparison[];
  monthlyCheckIns?: MonthlyCheckIn[];
  eatingLogs?: EatingEntry[];
  mentalHealthMode?: MentalHealthModeData;
  comfortItems?: ComfortItem[];
  goals?: Goal[];
  cycleEntries?: CycleEntry[];
};

export const exportAllData = async (): Promise<ExportPayload> => {
  const [
    healthLogs,
    symptoms,
    medications,
    medLogs,
    doctors,
    pharmacies,
    appointments,
    doctorNotes,
    fastingLogs,
    vitals,
    settings,
    documents,
    insights,
    allergy,
    conditions,
    sickMode,
    healthProfile,
  ] = await Promise.all([
    healthLogStorage.getAll(),
    symptomStorage.getAll(),
    medicationStorage.getAll(),
    medicationLogStorage.getAll(),
    doctorsStorage.getAll(),
    pharmacyStorage.getAll(),
    appointmentStorage.getAll(),
    doctorNoteStorage.getAll(),
    fastingLogStorage.getAll(),
    vitalStorage.getAll(),
    settingsStorage.get(),
    documentStorage.getAll(),
    insightStorage.getAll(),
    allergyStorage.get(),
    conditionStorage.getAll(),
    sickModeStorage.get(),
    healthProfileStorage.get(),
  ]);
  const [medComparisons, monthlyCheckIns, eatingLogs, mentalHealthMode, comfortItems, goals, cycleEntries] = await Promise.all([
    medComparisonStorage.getAll(),
    monthlyCheckInStorage.getAll(),
    eatingStorage.getAll(),
    mentalHealthModeStorage.get(),
    comfortStorage.getAll(),
    goalStorage.getAll(),
    cycleTrackingStorage.getAll(),
  ]);
  return {
    exportDate: new Date().toISOString(),
    appVersion: "1.0",
    profile: settings,
    healthProfile,
    healthLogs,
    symptoms,
    medications,
    medicationLogs: medLogs,
    doctors,
    pharmacies,
    appointments,
    doctorNotes,
    fastingLogs,
    vitals,
    documents,
    insights,
    allergy,
    conditions,
    sickMode,
    medComparisons,
    monthlyCheckIns,
    eatingLogs,
    mentalHealthMode,
    comfortItems,
    goals,
    cycleEntries,
  };
};

export const importAllData = async (payload: ExportPayload): Promise<void> => {
  await clearAllData();
  await settingsStorage.save(payload.profile);
  await healthProfileStorage.save(payload.healthProfile ?? { userRole: "self", backupCriticalMedications: [] });
  await allergyStorage.save(payload.allergy ?? { ...DEFAULT_ALLERGY_INFO });
  await sickModeStorage.save(payload.sickMode ?? { ...DEFAULT_SICK_MODE });
  await setItem(KEYS.HEALTH_LOGS, payload.healthLogs ?? []);
  await setItem(KEYS.SYMPTOMS, payload.symptoms ?? []);
  await setItem(KEYS.MEDICATIONS, payload.medications ?? []);
  await setItem(KEYS.MEDICATION_LOGS, payload.medicationLogs ?? []);
  await setItem(KEYS.DOCTORS, payload.doctors ?? []);
  await setItem(KEYS.PHARMACIES, payload.pharmacies ?? []);
  await setItem(KEYS.APPOINTMENTS, payload.appointments ?? []);
  await setItem(KEYS.DOCTOR_NOTES, payload.doctorNotes ?? []);
  await setItem(KEYS.FASTING_LOGS, payload.fastingLogs ?? []);
  await setItem(KEYS.VITALS, payload.vitals ?? []);
  await setItem(KEYS.DOCUMENTS, payload.documents ?? []);
  await setItem(KEYS.INSIGHTS, payload.insights ?? []);
  await setItem(KEYS.MED_COMPARISONS, payload.medComparisons ?? []);
  await setItem(KEYS.CONDITIONS, payload.conditions ?? []);
  await setItem(KEYS.MONTHLY_CHECK_INS, payload.monthlyCheckIns ?? []);
  await setItem(KEYS.EATING_LOGS, payload.eatingLogs ?? []);
  await mentalHealthModeStorage.save(payload.mentalHealthMode ?? { ...DEFAULT_MENTAL_HEALTH_MODE });
  await setItem(KEYS.COMFORT_ITEMS, payload.comfortItems ?? []);
  await setItem(KEYS.GOALS, payload.goals ?? []);
  await setItem(KEYS.CYCLE_ENTRIES, payload.cycleEntries ?? []);
};

export const clearAllData = async () => {
  await Promise.all(
    Object.values(KEYS).map(async (key) => {
      try {
        await AsyncStorage.removeItem(key);
      } catch (e) {
        console.warn("AsyncStorage removeItem failed", key, e);
      }
    })
  );
};
