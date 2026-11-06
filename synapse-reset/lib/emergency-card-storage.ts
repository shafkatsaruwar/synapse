import AsyncStorage from "@react-native-async-storage/async-storage";

const EMERGENCY_CARD_KEY = "emergency_card";

export interface EmergencyCardData {
  fullName: string;
  /** Age in years (free-text digits). Replaces former dateOfBirth on the card. */
  age: string;
  allergies: string;
  currentMedications: string;
  epipenAvailable: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  primaryDoctorName: string;
  doctorPhone: string;
  optionalNotes: string;
}

const DEFAULT: EmergencyCardData = {
  fullName: "",
  age: "",
  allergies: "",
  currentMedications: "",
  epipenAvailable: false,
  emergencyContactName: "",
  emergencyContactPhone: "",
  primaryDoctorName: "",
  doctorPhone: "",
  optionalNotes: "",
};

/** Older cards stored free-text `dateOfBirth`; keep numeric values as age. */
function migrateAge(raw: Record<string, unknown>): string {
  if (typeof raw.age === "string" && raw.age.trim()) return raw.age.trim();
  const dob = typeof raw.dateOfBirth === "string" ? raw.dateOfBirth.trim() : "";
  if (/^\d{1,3}$/.test(dob)) return dob;
  return "";
}

export async function getEmergencyCard(): Promise<EmergencyCardData> {
  try {
    const raw = await AsyncStorage.getItem(EMERGENCY_CARD_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const { dateOfBirth: _legacyDob, ...rest } = parsed;
    return { ...DEFAULT, ...(rest as Partial<EmergencyCardData>), age: migrateAge(parsed) };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveEmergencyCard(data: EmergencyCardData): Promise<void> {
  try {
    await AsyncStorage.setItem(EMERGENCY_CARD_KEY, JSON.stringify(data));
  } catch {}
}
