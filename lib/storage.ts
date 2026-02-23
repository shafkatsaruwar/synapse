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
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  timeTag: "Before Fajr" | "After Iftar" | "Morning" | "Afternoon" | "Night";
  active: boolean;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  date: string;
  taken: boolean;
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

export interface UserSettings {
  name: string;
  conditions: string[];
  ramadanMode: boolean;
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
  toggle: async (medicationId: string, date: string) => {
    const logs = await getItem<MedicationLog>(KEYS.MEDICATION_LOGS);
    const existing = logs.findIndex(
      (l) => l.medicationId === medicationId && l.date === date,
    );
    if (existing >= 0) {
      logs[existing].taken = !logs[existing].taken;
    } else {
      logs.push({ id: Crypto.randomUUID(), medicationId, date, taken: true });
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
    return raw
      ? JSON.parse(raw)
      : { name: "", conditions: [], ramadanMode: false };
  },
  save: async (settings: UserSettings) => {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },
};
