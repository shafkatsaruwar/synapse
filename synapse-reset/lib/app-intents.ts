import { NativeModules, Platform } from "react-native";
import {
  appointmentStorage,
  hydrationStorage,
  medicationLogStorage,
  medicationStorage,
  normalizeMedication,
  settingsStorage,
  sickModeStorage,
  type Appointment,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

type NativeWidgetBridge = {
  getPendingAppIntentActions?: () => Promise<string | null>;
  clearPendingAppIntentActions?: () => Promise<boolean>;
};

type PendingIntentAction = {
  id: string;
  type: "logMedication" | "startSickMode" | "logHydration" | "addAppointment" | "scanMedicalInfo";
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type AppIntentProcessingResult = {
  handledCount: number;
  target?: "medications" | "sickmode" | "eating" | "appointments";
  appointmentId?: string;
};

const bridge = NativeModules.SynapseWidgetBridge as NativeWidgetBridge | undefined;

export async function processPendingAppIntentActions(): Promise<AppIntentProcessingResult> {
  if (Platform.OS !== "ios" || !bridge?.getPendingAppIntentActions || !bridge.clearPendingAppIntentActions) {
    return { handledCount: 0 };
  }

  const raw = await bridge.getPendingAppIntentActions().catch(() => null);
  const actions = parseActions(raw);
  if (actions.length === 0) return { handledCount: 0 };

  const result: AppIntentProcessingResult = { handledCount: 0 };

  for (const action of actions) {
    try {
      const next = await processAction(action);
      result.handledCount += 1;
      if (next.target) result.target = next.target;
      if (next.appointmentId) result.appointmentId = next.appointmentId;
    } catch (error) {
      console.warn("Failed to process App Intent action", action.type, error);
    }
  }

  await bridge.clearPendingAppIntentActions().catch(() => false);
  if (result.handledCount > 0) {
    await syncWidgetSnapshot().catch(() => {});
  }
  return result;
}

function parseActions(raw: string | null | undefined): PendingIntentAction[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is PendingIntentAction => !!item && typeof item.type === "string" && typeof item.id === "string")
      : [];
  } catch {
    return [];
  }
}

async function processAction(action: PendingIntentAction): Promise<AppIntentProcessingResult> {
  switch (action.type) {
    case "logMedication":
      await logMedicationByName(String(action.payload?.medicationName ?? ""));
      return { handledCount: 1, target: "medications" };
    case "startSickMode":
      await startSickMode();
      return { handledCount: 1, target: "sickmode" };
    case "logHydration":
      await hydrationStorage.save({
        date: getToday(),
        time: new Date().toISOString(),
        what: String(action.payload?.what ?? "Water"),
        amount: numberFromPayload(action.payload?.amount, 8),
        unit: hydrationUnitFromPayload(action.payload?.unit),
      });
      return { handledCount: 1, target: "eating" };
    case "addAppointment": {
      const saved = await addAppointmentFromIntent(action.payload ?? {});
      return { handledCount: 1, target: "appointments", appointmentId: saved.id };
    }
    case "scanMedicalInfo":
      return { handledCount: 1, target: "appointments" };
    default:
      return { handledCount: 0 };
  }
}

async function logMedicationByName(name: string) {
  const normalizedNeedle = normalizeSearch(name);
  const medications = (await medicationStorage.getAll()).map((med) => normalizeMedication(med));
  const match = medications.find((med) => {
    const normalizedName = normalizeSearch(med.name);
    return normalizedName === normalizedNeedle || normalizedName.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedName);
  }) ?? medications.find((med) => med.active);

  if (!match) return;

  const today = getToday();
  const logs = await medicationLogStorage.getByDate(today);
  const doses = match.medicationType === "prn" ? [] : match.doses ?? [];
  const nextDoseIndex = doses.findIndex((_, index) => !logs.some((log) => log.medicationId === match.id && (log.doseIndex ?? 0) === index && log.taken));

  if (match.medicationType === "prn") {
    await medicationLogStorage.logPrnDose(match.id);
    return;
  }

  await medicationLogStorage.toggle(match.id, today, nextDoseIndex >= 0 ? nextDoseIndex : 0);
}

async function startSickMode() {
  const settings = await settingsStorage.get();
  const current = await sickModeStorage.get();
  if (!settings.sickMode) {
    await settingsStorage.save({ ...settings, sickMode: true });
  }
  if (!current.active) {
    await sickModeStorage.save({
      ...current,
      active: true,
      startedAt: new Date().toISOString(),
      checkInTimer: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
  }
}

async function addAppointmentFromIntent(payload: Record<string, unknown>) {
  const startsAt = parseIntentDate(String(payload.dateISO ?? ""));
  const title = String(payload.title ?? "Appointment").trim() || "Appointment";
  const saved = await appointmentStorage.save({
    doctorName: title,
    specialty: "",
    date: startsAt.date,
    time: startsAt.time,
    location: String(payload.location ?? "").trim(),
    notes: String(payload.notes ?? "").trim(),
    entryOwner: "self",
  });
  return saved as Appointment;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numberFromPayload(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function hydrationUnitFromPayload(value: unknown): "oz" | "ml" | "L" | "glasses" {
  const normalized = String(value ?? "oz").toLowerCase();
  if (normalized === "ml" || normalized === "milliliter" || normalized === "milliliters") return "ml";
  if (normalized === "l" || normalized === "liter" || normalized === "liters") return "L";
  if (normalized === "glass" || normalized === "glasses") return "glasses";
  return "oz";
}

function parseIntentDate(value: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    date: safeDate.toISOString().slice(0, 10),
    time: `${String(safeDate.getHours()).padStart(2, "0")}:${String(safeDate.getMinutes()).padStart(2, "0")}`,
  };
}
