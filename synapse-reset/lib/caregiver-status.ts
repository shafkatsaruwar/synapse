import {
  appointmentStorage,
  healthLogStorage,
  medicationLogStorage,
  medicationStorage,
  normalizeMedication,
  sickModeStorage,
  type Appointment,
  type CaregiverProfile,
  type Medication,
  type MedicationDose,
  type MedicationLog,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";

export interface CaregiverMedicationStatus {
  medication: Medication;
  dose: MedicationDose;
  doseIndex: number;
  scheduledMinutes: number;
  taken: boolean;
}

export interface CaregiverStatus {
  nextMedication: CaregiverMedicationStatus | null;
  missedMedications: CaregiverMedicationStatus[];
  nextAppointment: Appointment | null;
  alerts: string[];
}

function timeToMinutes(value?: string): number | null {
  if (!value) return null;
  const [hour, minute] = value.split(":").map((part) => parseInt(part, 10));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function formatDoseName(item: CaregiverMedicationStatus): string {
  const dose = item.dose.amount && item.dose.unit ? `${item.dose.amount} ${item.dose.unit}` : item.dose.timeOfDay;
  return `${item.medication.name} ${dose}`.trim();
}

export async function getCaregiverStatus(profile: CaregiverProfile | null): Promise<CaregiverStatus> {
  const today = getToday();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [medications, logs, appointments, healthLogs, sickMode] = await Promise.all([
    medicationStorage.getAll(),
    medicationLogStorage.getByDate(today),
    appointmentStorage.getAll(),
    healthLogStorage.getByDate(today, "care_recipient"),
    sickModeStorage.get(),
  ]);

  const careRecipientMeds = medications
    .filter((med) => med.active && (med.entryOwner ?? "self") === "care_recipient" && (med.medicationType ?? "scheduled") !== "prn")
    .map(normalizeMedication);

  const doseStatuses = careRecipientMeds.flatMap((medication) =>
    (medication.doses ?? []).map((dose, doseIndex) => {
      const scheduledMinutes = timeToMinutes(dose.reminderTime) ?? currentMinutes;
      const taken = logs.some(
        (log) => log.medicationId === medication.id && (log.doseIndex ?? 0) === doseIndex && log.taken,
      );
      return { medication, dose, doseIndex, scheduledMinutes, taken };
    })
  );

  const nextMedication = doseStatuses
    .filter((item) => !item.taken && item.scheduledMinutes >= currentMinutes)
    .sort((a, b) => a.scheduledMinutes - b.scheduledMinutes)[0] ?? null;

  const missedMedications = doseStatuses
    .filter((item) => !item.taken && item.scheduledMinutes < currentMinutes)
    .sort((a, b) => a.scheduledMinutes - b.scheduledMinutes);

  const nextAppointment = appointments
    .filter((appointment) => (appointment.entryOwner ?? "self") === "care_recipient")
    .filter((appointment) => (!appointment.status || appointment.status !== "cancelled") && appointment.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))[0] ?? null;

  const alerts: string[] = [];
  if (missedMedications.length > 0) {
    alerts.push(`${missedMedications.length} missed medication${missedMedications.length === 1 ? "" : "s"}`);
  }
  if (!healthLogs) alerts.push("No logs today");
  if (sickMode.recoveryMode || sickMode.active) alerts.push("Recovery mode active");
  if (!profile?.name?.trim()) alerts.push("Managed person profile incomplete");

  return {
    nextMedication,
    missedMedications,
    nextAppointment,
    alerts,
  };
}

export function getCaregiverStatusLabel(status: CaregiverStatus): "good" | "pending" | "urgent" {
  if (status.missedMedications.length > 0) return "urgent";
  if (status.alerts.length > 0 || status.nextMedication || status.nextAppointment) return "pending";
  return "good";
}

export function formatCaregiverMedicationStatus(item: CaregiverMedicationStatus | null): string {
  if (!item) return "No upcoming dose";
  return formatDoseName(item);
}
