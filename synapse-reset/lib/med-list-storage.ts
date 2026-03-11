import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const MED_LIST_KEY = "med_list";

export type DurationUnit = "Days" | "Weeks" | "Months";

export interface MedListItem {
  id: string;
  name: string;
  dosage: string;
  prescribingDoctor: string;
  pharmacyName: string;
  pharmacyPhone: string;
  pharmacyAddress: string;
  refillsRemaining: number;
  duration?: number;
  durationUnit?: DurationUnit;
}

function normalizeItem(x: unknown): MedListItem | null {
  if (x == null || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name : "";
  const refillsRemaining = typeof o.refillsRemaining === "number" ? o.refillsRemaining : 0;
  if (!id || !name) return null;
  const prescribingDoctor = typeof o.prescribingDoctor === "string" ? o.prescribingDoctor : (typeof o.prescriberName === "string" ? o.prescriberName : "");
  const dosage = typeof o.dosage === "string" ? o.dosage : "";
  const pharmacyName = typeof o.pharmacyName === "string" ? o.pharmacyName : (typeof o.pharmacy === "string" ? o.pharmacy : "");
  const pharmacyPhone = typeof o.pharmacyPhone === "string" ? o.pharmacyPhone : "";
  const pharmacyAddress = typeof o.pharmacyAddress === "string" ? o.pharmacyAddress : "";
  const duration = typeof o.duration === "number" ? o.duration : undefined;
  const durationUnit = o.durationUnit === "Days" || o.durationUnit === "Weeks" || o.durationUnit === "Months" ? o.durationUnit : undefined;
  return { id, name, dosage, prescribingDoctor, pharmacyName, pharmacyPhone, pharmacyAddress, refillsRemaining, duration, durationUnit };
}

export async function getMedList(): Promise<MedListItem[]> {
  try {
    const raw = await AsyncStorage.getItem(MED_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).filter((x): x is MedListItem => x !== null);
  } catch {
    return [];
  }
}

export async function saveMedList(items: MedListItem[]): Promise<void> {
  await AsyncStorage.setItem(MED_LIST_KEY, JSON.stringify(items));
}

export async function addMedListItem(entry: Omit<MedListItem, "id">): Promise<MedListItem> {
  const list = await getMedList();
  const id = Crypto.randomUUID();
  const item: MedListItem = { ...entry, id };
  list.push(item);
  await saveMedList(list);
  return item;
}

export async function removeMedListItem(id: string): Promise<void> {
  const list = await getMedList();
  await saveMedList(list.filter((x) => x.id !== id));
}
