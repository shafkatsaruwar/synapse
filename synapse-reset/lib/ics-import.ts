import { NativeModules, Platform } from "react-native";

export type IcsImportEvent = {
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  notes: string;
};

export type IcsImportPayload = {
  events: IcsImportEvent[];
  importedAt?: string;
};

type SynapseWidgetBridgeModule = {
  getPendingICSImport?: () => Promise<string | null>;
  clearPendingICSImport?: () => Promise<boolean>;
};

const bridge = NativeModules.SynapseWidgetBridge as SynapseWidgetBridgeModule | undefined;

function cleanEvent(event: Partial<IcsImportEvent>): IcsImportEvent {
  return {
    title: typeof event.title === "string" && event.title.trim() ? event.title.trim() : "Appointment",
    date: typeof event.date === "string" ? event.date.trim() : "",
    time: typeof event.time === "string" && event.time.trim() ? event.time.trim() : "09:00",
    endTime: typeof event.endTime === "string" ? event.endTime.trim() : "",
    location: typeof event.location === "string" ? event.location.trim() : "",
    notes: typeof event.notes === "string" ? event.notes.trim() : "",
  };
}

export async function getPendingIcsImport(): Promise<IcsImportPayload | null> {
  if (Platform.OS !== "ios" || !bridge?.getPendingICSImport) return null;

  const raw = await bridge.getPendingICSImport();
  if (!raw) return null;

  const parsed = JSON.parse(raw) as Partial<IcsImportPayload>;
  const events = Array.isArray(parsed.events) ? parsed.events.map(cleanEvent) : [];
  return { events, importedAt: parsed.importedAt };
}

export async function clearPendingIcsImport() {
  if (Platform.OS !== "ios" || !bridge?.clearPendingICSImport) return;
  await bridge.clearPendingICSImport();
}
