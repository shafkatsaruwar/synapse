import AsyncStorage from "@react-native-async-storage/async-storage";

const EMERGENCY_CARD_KEY = "emergency_card";

export interface EmergencyCardData {
  fullName: string;
  dateOfBirth: string;
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
  dateOfBirth: "",
  allergies: "",
  currentMedications: "",
  epipenAvailable: false,
  emergencyContactName: "",
  emergencyContactPhone: "",
  primaryDoctorName: "",
  doctorPhone: "",
  optionalNotes: "",
};

export async function getEmergencyCard(): Promise<EmergencyCardData> {
  try {
    const raw = await AsyncStorage.getItem(EMERGENCY_CARD_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<EmergencyCardData>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveEmergencyCard(data: EmergencyCardData): Promise<void> {
  try {
    await AsyncStorage.setItem(EMERGENCY_CARD_KEY, JSON.stringify(data));
  } catch {}
}
