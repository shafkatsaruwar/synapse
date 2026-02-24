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
}

export interface Symptom {
  id: string;
  date: string;
  name: string;
  severity: number;
  notes: string;
  temperature?: number;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  unit?: string;
  route?: string;
  emoji?: string;
  doses?: number;
  timeTag: string | string[];
  active: boolean;
  hasStressDose?: boolean;
  stressDoseAmount?: string;
  stressDoseFrequency?: string;
  stressDoseDurationDays?: number;
  stressDoseInstructions?: string;
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

export interface Appointment {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
  notes: string;
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
  type: string;
  value: string;
  unit: string;
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

export interface UserSettings {
  name: string;
  conditions: string[];
  ramadanMode: boolean;
  sickMode: boolean;
  highContrast?: boolean;
  onboardingCompleted?: boolean;
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
};

async function getItem<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function setItem<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

export const healthLogStorage = {
  getAll: () => getItem<HealthLog>(KEYS.HEALTH_LOGS),
  getByDate: async (date: string) => {
    const logs = await getItem<HealthLog>(KEYS.HEALTH_LOGS);
    return logs.find((l) => l.date === date);
  },
  save: async (log: Omit<HealthLog, "id">) => {
    const logs = await getItem<HealthLog>(KEYS.HEALTH_LOGS);
    const existing = logs.findIndex((l) => l.date === log.date);
    if (existing >= 0) {
      logs[existing] = { ...logs[existing], ...log };
    } else {
      logs.push({ ...log, id: Crypto.randomUUID() });
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
  getAll: () => getItem<Medication>(KEYS.MEDICATIONS),
  save: async (med: Omit<Medication, "id">) => {
    const meds = await getItem<Medication>(KEYS.MEDICATIONS);
    meds.push({ ...med, id: Crypto.randomUUID() });
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

export const appointmentStorage = {
  getAll: () => getItem<Appointment>(KEYS.APPOINTMENTS),
  save: async (apt: Omit<Appointment, "id">) => {
    const apts = await getItem<Appointment>(KEYS.APPOINTMENTS);
    apts.push({ ...apt, id: Crypto.randomUUID() });
    await setItem(KEYS.APPOINTMENTS, apts);
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
  delete: async (id: string) => {
    const all = await getItem<Vital>(KEYS.VITALS);
    await setItem(KEYS.VITALS, all.filter((v) => v.id !== id));
  },
};

export const settingsStorage = {
  get: async (): Promise<UserSettings> => {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    const defaults: UserSettings = { name: "", conditions: [], ramadanMode: true, sickMode: false };
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  },
  save: async (settings: UserSettings) => {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
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
    const raw = await AsyncStorage.getItem(KEYS.SICK_MODE);
    return raw ? { ...DEFAULT_SICK_MODE, ...JSON.parse(raw) } : { ...DEFAULT_SICK_MODE };
  },
  save: async (data: SickModeData) => {
    await AsyncStorage.setItem(KEYS.SICK_MODE, JSON.stringify(data));
  },
  reset: async () => {
    await AsyncStorage.setItem(KEYS.SICK_MODE, JSON.stringify(DEFAULT_SICK_MODE));
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
    const raw = await AsyncStorage.getItem(KEYS.ALLERGY_INFO);
    return raw ? { ...DEFAULT_ALLERGY_INFO, ...JSON.parse(raw) } : { ...DEFAULT_ALLERGY_INFO };
  },
  save: async (data: AllergyInfo) => {
    await AsyncStorage.setItem(KEYS.ALLERGY_INFO, JSON.stringify(data));
  },
};

export const exportAllData = async () => {
  const [healthLogs, symptoms, medications, medLogs, appointments, doctorNotes, fastingLogs, vitals, settings, documents, insights] = await Promise.all([
    healthLogStorage.getAll(),
    symptomStorage.getAll(),
    medicationStorage.getAll(),
    medicationLogStorage.getAll(),
    appointmentStorage.getAll(),
    doctorNoteStorage.getAll(),
    fastingLogStorage.getAll(),
    vitalStorage.getAll(),
    settingsStorage.get(),
    documentStorage.getAll(),
    insightStorage.getAll(),
  ]);
  return {
    exportDate: new Date().toISOString(),
    appVersion: "1.0",
    profile: settings,
    healthLogs,
    symptoms,
    medications,
    medicationLogs: medLogs,
    appointments,
    doctorNotes,
    fastingLogs,
    vitals,
    documents,
    insights,
  };
};

export const clearAllData = async () => {
  await Promise.all(
    Object.values(KEYS).map((key) => AsyncStorage.removeItem(key))
  );
};
