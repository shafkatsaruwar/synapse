import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const MED_LIST_KEY = "med_list";

export type DurationUnit = "Days" | "Weeks" | "Months";

export type MedListDoseTime = "Morning" | "Afternoon" | "Evening" | "Night" | "As Needed";

export interface MedListDose {
  dosage: string;
  time: MedListDoseTime;
}

export interface MedListItem {
  id: string;
  name: string;
  /** @deprecated Use doses[].dosage for display; kept for migration only. */
  dosage?: string;
  doses: MedListDose[];
  prescribingDoctor: string;
  pharmacyId?: string;
  pharmacyName: string;
  pharmacyPhone: string;
  pharmacyAddress: string;
  pharmacyHospital?: string;
  refillsRemaining: number;
  refillUnit?: string;
  duration?: number;
  durationUnit?: DurationUnit;
}

function parseDoses(o: Record<string, unknown>): MedListDose[] {
  if (Array.isArray(o.doses) && o.doses.length > 0) {
    const times: MedListDoseTime[] = ["Morning", "Afternoon", "Evening", "Night", "As Needed"];
    return o.doses.map((d: unknown) => {
      if (d == null || typeof d !== "object") return { dosage: "", time: "Morning" as MedListDoseTime };
      const dk = d as Record<string, unknown>;
      const dosage = typeof dk.dosage === "string" ? dk.dosage : "";
      const time = typeof dk.time === "string" && times.includes(dk.time as MedListDoseTime) ? (dk.time as MedListDoseTime) : "Morning";
      return { dosage, time };
    });
  }
  const legacyDosage = typeof o.dosage === "string" ? o.dosage : "";
  return [{ dosage: legacyDosage, time: "Morning" }];
}

function normalizeItem(x: unknown): MedListItem | null {
  if (x == null || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name : "";
  const refillsRemaining = typeof o.refillsRemaining === "number" ? o.refillsRemaining : 0;
  if (!id || !name) return null;
  const prescribingDoctor = typeof o.prescribingDoctor === "string" ? o.prescribingDoctor : (typeof o.prescriberName === "string" ? o.prescriberName : "");
  const doses = parseDoses(o);
  const pharmacyId = typeof o.pharmacyId === "string" ? o.pharmacyId : undefined;
  const pharmacyName = typeof o.pharmacyName === "string" ? o.pharmacyName : (typeof o.pharmacy === "string" ? o.pharmacy : "");
  const pharmacyPhone = typeof o.pharmacyPhone === "string" ? o.pharmacyPhone : "";
  const pharmacyAddress = typeof o.pharmacyAddress === "string" ? o.pharmacyAddress : "";
  const pharmacyHospital = typeof o.pharmacyHospital === "string" ? o.pharmacyHospital : "";
  const refillUnit = typeof o.refillUnit === "string" ? o.refillUnit : undefined;
  const duration = typeof o.duration === "number" ? o.duration : undefined;
  const durationUnit = o.durationUnit === "Days" || o.durationUnit === "Weeks" || o.durationUnit === "Months" ? o.durationUnit : undefined;
  return { id, name, doses, prescribingDoctor, pharmacyId, pharmacyName, pharmacyPhone, pharmacyAddress, pharmacyHospital, refillsRemaining, refillUnit, duration, durationUnit };
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

export async function updateMedListItem(item: MedListItem): Promise<void> {
  const list = await getMedList();
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return;
  list[idx] = item;
  await saveMedList(list);
}
