import { NativeModules, Platform } from "react-native";

export type AppleCalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  notes: string;
  calendarTitle: string;
};

type SynapseCalendarBridgeModule = {
  requestAccess?: () => Promise<boolean>;
  getEvents?: (startISO: string, endISO: string) => Promise<AppleCalendarEvent[]>;
};

const bridge = NativeModules.SynapseCalendarBridge as SynapseCalendarBridgeModule | undefined;

export function isAppleCalendarImportSupported() {
  return Platform.OS === "ios" && !!bridge?.requestAccess && !!bridge?.getEvents;
}

export async function requestAppleCalendarAccess() {
  if (Platform.OS !== "ios" || !bridge?.requestAccess) return false;
  return bridge.requestAccess();
}

export async function getUpcomingAppleCalendarEvents(daysAhead = 30) {
  if (Platform.OS !== "ios" || !bridge?.getEvents) return [];

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);

  return bridge.getEvents(start.toISOString(), end.toISOString());
}

export function appleEventDateParts(event: Pick<AppleCalendarEvent, "startDate" | "endDate">) {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;

  return {
    date: `${safeStart.getFullYear()}-${String(safeStart.getMonth() + 1).padStart(2, "0")}-${String(safeStart.getDate()).padStart(2, "0")}`,
    time: `${String(safeStart.getHours()).padStart(2, "0")}:${String(safeStart.getMinutes()).padStart(2, "0")}`,
    endTime: `${String(safeEnd.getHours()).padStart(2, "0")}:${String(safeEnd.getMinutes()).padStart(2, "0")}`,
  };
}
