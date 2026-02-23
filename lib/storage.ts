import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export interface HealthLog {
  id: string;
  date: string;
  energy: number;
  symptoms: string[];
  fasting: boolean;
  notes: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  timeTag: "Before Fajr" | "After Iftar" | "Morning" | "Night";
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

const KEYS = {
  HEALTH_LOGS: "seha_health_logs",
  MEDICATIONS: "seha_medications",
  MEDICATION_LOGS: "seha_medication_logs",
  APPOINTMENTS: "seha_appointments",
  DOCTOR_NOTES: "seha_doctor_notes",
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
    await setItem(
      KEYS.HEALTH_LOGS,
      logs.filter((l) => l.id !== id),
    );
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
    await setItem(
      KEYS.MEDICATIONS,
      meds.filter((m) => m.id !== id),
    );
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
      logs.push({
        id: Crypto.randomUUID(),
        medicationId,
        date,
        taken: true,
      });
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
    await setItem(
      KEYS.APPOINTMENTS,
      apts.filter((a) => a.id !== id),
    );
  },
};

export const doctorNoteStorage = {
  getAll: () => getItem<DoctorNote>(KEYS.DOCTOR_NOTES),
  save: async (note: Omit<DoctorNote, "id" | "createdAt">) => {
    const notes = await getItem<DoctorNote>(KEYS.DOCTOR_NOTES);
    notes.push({
      ...note,
      id: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    await setItem(KEYS.DOCTOR_NOTES, notes);
  },
  update: async (id: string, text: string) => {
    const notes = await getItem<DoctorNote>(KEYS.DOCTOR_NOTES);
    const idx = notes.findIndex((n) => n.id === id);
    if (idx >= 0) {
      notes[idx].text = text;
      await setItem(KEYS.DOCTOR_NOTES, notes);
    }
  },
  delete: async (id: string) => {
    const notes = await getItem<DoctorNote>(KEYS.DOCTOR_NOTES);
    await setItem(
      KEYS.DOCTOR_NOTES,
      notes.filter((n) => n.id !== id),
    );
  },
};
