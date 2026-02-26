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

export interface UserSettings {
  name: string;
  conditions: string[];
  ramadanMode: boolean;
  sickMode: boolean;
  highContrast?: boolean;
  onboardingCompleted?: true;
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
  MONTHLY_CHECK_INS: "fir_monthly_check_ins",
  EATING_LOGS: "fir_eating_logs",
  MENTAL_HEALTH_MODE: "fir_mental_health_mode",
  COMFORT_ITEMS: "fir_comfort_items",
  GOALS: "fir_goals",
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
    const raw = await AsyncStorage.getItem(KEYS.MENTAL_HEALTH_MODE);
    return raw ? { ...DEFAULT_MENTAL_HEALTH_MODE, ...JSON.parse(raw) } : { ...DEFAULT_MENTAL_HEALTH_MODE };
  },
  save: async (data: MentalHealthModeData) => {
    await AsyncStorage.setItem(KEYS.MENTAL_HEALTH_MODE, JSON.stringify(data));
  },
  reset: async () => {
    await AsyncStorage.setItem(KEYS.MENTAL_HEALTH_MODE, JSON.stringify(DEFAULT_MENTAL_HEALTH_MODE));
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
  healthLogs: HealthLog[];
  symptoms: Symptom[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
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
};

export const exportAllData = async (): Promise<ExportPayload> => {
  const [
    healthLogs,
    symptoms,
    medications,
    medLogs,
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
  ] = await Promise.all([
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
    allergyStorage.get(),
    conditionStorage.getAll(),
    sickModeStorage.get(),
  ]);
  const [medComparisons, monthlyCheckIns, eatingLogs, mentalHealthMode, comfortItems, goals] = await Promise.all([
    medComparisonStorage.getAll(),
    monthlyCheckInStorage.getAll(),
    eatingStorage.getAll(),
    mentalHealthModeStorage.get(),
    comfortStorage.getAll(),
    goalStorage.getAll(),
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
    allergy,
    conditions,
    sickMode,
    medComparisons,
    monthlyCheckIns,
    eatingLogs,
    mentalHealthMode,
    comfortItems,
    goals,
  };
};

export const importAllData = async (payload: ExportPayload): Promise<void> => {
  await clearAllData();
  await settingsStorage.save(payload.profile);
  if (payload.allergy) await allergyStorage.save(payload.allergy);
  if (payload.sickMode) await sickModeStorage.save(payload.sickMode);
  await setItem(KEYS.HEALTH_LOGS, payload.healthLogs);
  await setItem(KEYS.SYMPTOMS, payload.symptoms);
  await setItem(KEYS.MEDICATIONS, payload.medications);
  await setItem(KEYS.MEDICATION_LOGS, payload.medicationLogs);
  await setItem(KEYS.APPOINTMENTS, payload.appointments);
  await setItem(KEYS.DOCTOR_NOTES, payload.doctorNotes);
  await setItem(KEYS.FASTING_LOGS, payload.fastingLogs);
  await setItem(KEYS.VITALS, payload.vitals);
  await setItem(KEYS.DOCUMENTS, payload.documents ?? []);
  await setItem(KEYS.INSIGHTS, payload.insights ?? []);
  await setItem(KEYS.MED_COMPARISONS, payload.medComparisons ?? []);
  await setItem(KEYS.CONDITIONS, payload.conditions ?? []);
  if (payload.monthlyCheckIns?.length) await setItem(KEYS.MONTHLY_CHECK_INS, payload.monthlyCheckIns);
  if (payload.eatingLogs?.length) await setItem(KEYS.EATING_LOGS, payload.eatingLogs);
  if (payload.mentalHealthMode?.active) await mentalHealthModeStorage.save(payload.mentalHealthMode);
  if (payload.comfortItems?.length) await setItem(KEYS.COMFORT_ITEMS, payload.comfortItems);
  if (payload.goals?.length) await setItem(KEYS.GOALS, payload.goals);
};

export const clearAllData = async () => {
  await Promise.all(
    Object.values(KEYS).map((key) => AsyncStorage.removeItem(key))
  );
};
