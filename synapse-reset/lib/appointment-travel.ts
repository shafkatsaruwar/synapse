import { NativeModules, Platform } from "react-native";
import type { Appointment, Doctor } from "@/lib/storage";

type NativeTravelEstimate = {
  travelMinutes?: number;
  travelText?: string;
  source?: string;
};

type CalendarBridge = {
  getTravelEstimate?: (destination: string, allowPermissionPrompt: boolean) => Promise<NativeTravelEstimate | null>;
};

const CALENDAR_BRIDGE = NativeModules.SynapseCalendarBridge as CalendarBridge | undefined;

type TravelEstimateOptions = {
  allowPermissionPrompt?: boolean;
};

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseAppointmentDateTime(appointment: Pick<Appointment, "date" | "time">) {
  const date = appointment.date?.trim();
  if (!date) return null;
  const rawTime = appointment.time?.trim() || "09:00";
  const parsed = new Date(`${date}T${rawTime.length === 5 ? rawTime : "09:00"}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getAppointmentTravelDestination(appointment: Appointment, doctor?: Doctor | null) {
  return doctor?.address?.trim() || appointment.location?.trim() || doctor?.hospital?.trim() || "";
}

export async function getAppointmentTravelEstimate(
  appointment: Appointment,
  doctor?: Doctor | null,
  options?: TravelEstimateOptions,
): Promise<string | null> {
  const destination = getAppointmentTravelDestination(appointment, doctor);
  if (!destination || Platform.OS !== "ios" || !CALENDAR_BRIDGE?.getTravelEstimate) return null;

  try {
    const estimate = await CALENDAR_BRIDGE.getTravelEstimate(destination, options?.allowPermissionPrompt ?? true);
    const minutes = estimate?.travelMinutes;
    if (!minutes || minutes <= 0) return estimate?.travelText?.trim() || null;

    const startsAt = parseAppointmentDateTime(appointment);
    if (!startsAt) return estimate?.travelText?.trim() || `${minutes} min drive`;

    const leaveAt = new Date(startsAt.getTime() - minutes * 60 * 1000);
    return `Leave around ${formatClock(leaveAt)} • ${minutes} min drive`;
  } catch {
    return null;
  }
}
