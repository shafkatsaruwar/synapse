import { buildTodayAtAGlance, type TodayAtAGlanceSummary } from "@/lib/today-at-a-glance";
import {
  appointmentStorage,
  healthProfileStorage,
  imagingStorage,
  labWorkStorage,
  medicationLogStorage,
  medicationStorage,
  monthlyCheckInStorage,
  sickModeStorage,
  symptomStorage,
  vitalStorage,
  type Appointment,
  type Imaging,
  type LabWork,
  type Medication,
  type MedicationDose,
  type MedicationLog,
} from "@/lib/storage";
import { formatDate, formatTime12h, getToday } from "@/lib/date-utils";
import type {
  ModuleIntegrationEvent,
  ModuleIntegrationNotification,
  ModuleIntegrationQuickAction,
  ModuleIntegrationService,
  ModuleIntegrationTodayCard,
  IntegrationPriority,
} from "@/lib/module-integration";

const SOURCE = "Synapse";
const RECENT_IMPORT_WINDOW_DAYS = 7;
const UPCOMING_EVENT_WINDOW_DAYS = 90;

const DEFAULT_DOSE_TIMES: Record<string, string> = {
  Morning: "08:00",
  Afternoon: "14:00",
  Evening: "18:00",
  Night: "21:00",
  "As Needed": "09:00",
};

export const SynapseDeepLinks = {
  dashboard: "synapse://dashboard",
  medications: "synapse://medications",
  medication: (id: string) => `synapse://medications/${encodeURIComponent(id)}`,
  appointments: "synapse://appointments",
  appointment: (id: string) => `synapse://appointments/${encodeURIComponent(id)}`,
  labs: "synapse://labs",
  imaging: "synapse://imaging",
  sickMode: "synapse://sick-mode",
  recovery: "synapse://recovery",
  symptoms: "synapse://symptoms",
  notes: "synapse://notes",
  monthlyReview: "synapse://monthly-review",
} as const;

export type HealthObservationType =
  | "medication_due"
  | "medication_missed"
  | "appointment_today"
  | "appointment_tomorrow"
  | "sick_mode_active"
  | "recovery_active"
  | "lab_imported"
  | "imaging_imported"
  | "monthly_review_due";

export interface HealthIntegrationObservation {
  source: typeof SOURCE;
  type: HealthObservationType;
  priority: IntegrationPriority;
  title: string;
  timestamp: string;
  deeplink?: string;
}

export interface HealthMedicationDueItem {
  id: string;
  medicationId: string;
  medicationName: string;
  doseIndex: number;
  doseLabel: string;
  dueAt: string;
  status: "due" | "missed";
  deeplink: string;
}

export interface HealthAppointmentItem {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  deeplink: string;
}

export interface HealthPendingTask {
  id: string;
  title: string;
  type: HealthObservationType;
  priority: IntegrationPriority;
  deeplink: string;
}

export interface HealthDashboardSummary {
  medicationsDue: HealthMedicationDueItem[];
  upcomingAppointments: HealthAppointmentItem[];
  activeRecovery: null | {
    title: string;
    startedAt?: string;
    focus?: string;
    deeplink: string;
  };
  sickMode: boolean;
  pendingTasks: HealthPendingTask[];
  todaySummary: TodayAtAGlanceSummary;
}

type MedicationDoseState = HealthMedicationDueItem & {
  dueDate: Date;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateTime(date: string, time = "09:00") {
  const parsed = new Date(`${date}T${time || "09:00"}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDoseTime(dose: MedicationDose) {
  return dose.reminderTime || DEFAULT_DOSE_TIMES[dose.timeOfDay] || (/^\d{1,2}:\d{2}$/.test(dose.timeOfDay) ? dose.timeOfDay : "09:00");
}

function getDoseLabel(dose: MedicationDose) {
  const amount = [dose.amount, dose.unit].filter(Boolean).join(" ").trim();
  return amount ? `${amount} ${dose.timeOfDay}` : dose.timeOfDay;
}

function hasTakenDose(logs: MedicationLog[], medicationId: string, doseIndex: number) {
  return logs.some((log) => log.medicationId === medicationId && (log.doseIndex ?? 0) === doseIndex && log.taken);
}

function formatMinutesUntil(dueDate: Date, now: Date) {
  const minutes = Math.round((dueDate.getTime() - now.getTime()) / 60000);
  if (minutes === 0) return "now";
  if (minutes > 0) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const overdue = Math.abs(minutes);
  return `${overdue} minute${overdue === 1 ? "" : "s"} late`;
}

function getAppointmentTitle(appointment: Appointment) {
  return appointment.doctorName || appointment.specialty || "Appointment";
}

function getAppointmentEnd(appointment: Appointment, start: Date) {
  const end = appointment.endTime ? parseDateTime(appointment.date, appointment.endTime) : null;
  return end ?? new Date(start.getTime() + 60 * 60 * 1000);
}

function getUpcomingAppointments(appointments: Appointment[], now: Date) {
  const maxDate = addDays(now, UPCOMING_EVENT_WINDOW_DAYS);
  return appointments
    .filter((appointment) => appointment.status == null || appointment.status === "rescheduled")
    .map((appointment) => ({ appointment, start: parseDateTime(appointment.date, appointment.time) }))
    .filter((item): item is { appointment: Appointment; start: Date } => item.start != null)
    .filter(({ start }) => start.getTime() >= now.getTime() && start.getTime() <= maxDate.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function buildMedicationDoseStates(medications: Medication[], logs: MedicationLog[], now: Date, today: string) {
  return medications
    .filter((medication) => medication.active !== false && (medication.medicationType ?? "scheduled") !== "prn")
    .flatMap((medication) =>
      (medication.doses && medication.doses.length > 0 ? medication.doses : []).map((dose, doseIndex) => {
        const dueDate = parseDateTime(today, getDoseTime(dose));
        if (!dueDate || hasTakenDose(logs, medication.id, doseIndex)) return null;
        const status: HealthMedicationDueItem["status"] = dueDate.getTime() < now.getTime() ? "missed" : "due";
        return {
          id: `${medication.id}:${doseIndex}`,
          medicationId: medication.id,
          medicationName: medication.name || "Medication",
          doseIndex,
          doseLabel: getDoseLabel(dose),
          dueAt: dueDate.toISOString(),
          dueDate,
          status,
          deeplink: SynapseDeepLinks.medication(medication.id),
        };
      }),
    )
    .filter((item): item is MedicationDoseState => item != null)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

function isCurrentMonthMissing(latestDate?: string) {
  if (!latestDate) return true;
  return latestDate.slice(0, 7) !== getToday().slice(0, 7);
}

function buildImportedLabObservation(record: LabWork, now: Date): HealthIntegrationObservation | null {
  if (record.source !== "import" && record.source !== "scan") return null;
  const recordDate = parseDateTime(record.date);
  if (!recordDate || now.getTime() - recordDate.getTime() > RECENT_IMPORT_WINDOW_DAYS * 86400000) return null;
  return {
    source: SOURCE,
    type: "lab_imported",
    priority: "low",
    title: `${record.testName || "Lab"} imported`,
    timestamp: recordDate.toISOString(),
    deeplink: SynapseDeepLinks.labs,
  };
}

function buildImportedImagingObservation(record: Imaging, now: Date): HealthIntegrationObservation | null {
  if (record.source !== "import" && record.source !== "scan") return null;
  const recordDate = parseDateTime(record.date);
  if (!recordDate || now.getTime() - recordDate.getTime() > RECENT_IMPORT_WINDOW_DAYS * 86400000) return null;
  return {
    source: SOURCE,
    type: "imaging_imported",
    priority: "low",
    title: `${record.type || "Imaging"} imported`,
    timestamp: recordDate.toISOString(),
    deeplink: SynapseDeepLinks.imaging,
  };
}

async function getHealthContext() {
  const today = getToday();
  const now = new Date();
  const [medications, medicationLogs, appointments, sickMode, profile, latestMonthlyCheckIn, symptoms, vitals, labWork, imaging] =
    await Promise.all([
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      appointmentStorage.getAll(),
      sickModeStorage.get(),
      healthProfileStorage.get(),
      monthlyCheckInStorage.getLatest(),
      symptomStorage.getByDate(today),
      vitalStorage.getAll(),
      labWorkStorage.getAll(),
      imagingStorage.getAll(),
    ]);

  const todayVitals = vitals.filter((vital) => vital.date === today);
  const todaySummary = buildTodayAtAGlance({
    medications,
    medicationLogs,
    symptoms,
    vitals: todayVitals,
  });

  return {
    today,
    tomorrow: toDateKey(addDays(now, 1)),
    now,
    medications,
    medicationLogs,
    appointments,
    sickMode,
    profile,
    latestMonthlyCheckIn,
    symptoms,
    vitals,
    labWork,
    imaging,
    todaySummary,
  };
}

class SynapseHealthIntegrationService implements ModuleIntegrationService<HealthDashboardSummary, HealthIntegrationObservation> {
  async getDashboardSummary(): Promise<HealthDashboardSummary> {
    const context = await getHealthContext();
    const medicationStates = buildMedicationDoseStates(context.medications, context.medicationLogs, context.now, context.today);
    const upcomingAppointments = getUpcomingAppointments(context.appointments, context.now).slice(0, 3).map(({ appointment, start }) => ({
      id: appointment.id,
      title: getAppointmentTitle(appointment),
      startDate: start.toISOString(),
      endDate: getAppointmentEnd(appointment, start).toISOString(),
      deeplink: SynapseDeepLinks.appointment(appointment.id),
    }));
    const recoveryActive = context.profile.recoveryTrackingEnabled === true || context.sickMode.recoveryMode === true;
    const monthlyReviewDue = isCurrentMonthMissing(context.latestMonthlyCheckIn?.date);
    const pendingTasks: HealthPendingTask[] = [
      ...medicationStates.slice(0, 3).map((item) => ({
        id: item.id,
        title: `${item.medicationName} ${item.status === "missed" ? "missed" : "due"}`,
        type: item.status === "missed" ? "medication_missed" as const : "medication_due" as const,
        priority: item.status === "missed" ? "high" as const : "medium" as const,
        deeplink: item.deeplink,
      })),
      ...(monthlyReviewDue
        ? [{
            id: "monthly-review",
            title: "Monthly health review due",
            type: "monthly_review_due" as const,
            priority: "medium" as const,
            deeplink: SynapseDeepLinks.monthlyReview,
          }]
        : []),
    ];

    return {
      medicationsDue: medicationStates,
      upcomingAppointments,
      activeRecovery: recoveryActive
        ? {
            title: context.profile.recoveryFocus?.trim() || "Recovery active",
            startedAt: context.sickMode.startedAt || context.profile.recoveryTrackingStartedAt,
            focus: context.profile.recoveryFocus?.trim() || undefined,
            deeplink: SynapseDeepLinks.recovery,
          }
        : null,
      sickMode: context.sickMode.active === true,
      pendingTasks,
      todaySummary: context.todaySummary,
    };
  }

  async getUpcomingEvents(): Promise<ModuleIntegrationEvent[]> {
    const context = await getHealthContext();
    return getUpcomingAppointments(context.appointments, context.now).map(({ appointment, start }) => ({
      id: appointment.id,
      title: getAppointmentTitle(appointment),
      startDate: start.toISOString(),
      endDate: getAppointmentEnd(appointment, start).toISOString(),
      type: "appointment",
      source: SOURCE,
      deeplink: SynapseDeepLinks.appointment(appointment.id),
      readOnly: true,
    }));
  }

  async getNotifications(): Promise<ModuleIntegrationNotification[]> {
    const observations = await this.getObservations();
    const allowed: HealthObservationType[] = [
      "medication_due",
      "medication_missed",
      "appointment_today",
      "appointment_tomorrow",
      "monthly_review_due",
      "recovery_active",
    ];
    return observations
      .filter((observation) => allowed.includes(observation.type))
      .map((observation) => ({
        id: `${observation.type}:${observation.timestamp}:${observation.title}`,
        title: observation.title,
        type: observation.type,
        priority: observation.priority,
        timestamp: observation.timestamp,
        deeplink: observation.deeplink,
      }));
  }

  async getQuickActions(): Promise<ModuleIntegrationQuickAction[]> {
    return [
      { id: "log-medication", title: "Log Medication", deeplink: SynapseDeepLinks.medications },
      { id: "log-symptom", title: "Log Symptom", deeplink: SynapseDeepLinks.symptoms },
      { id: "add-note", title: "Add Note", deeplink: SynapseDeepLinks.notes },
      { id: "start-sick-mode", title: "Start Sick Mode", deeplink: SynapseDeepLinks.sickMode },
      { id: "view-appointments", title: "View Appointments", deeplink: SynapseDeepLinks.appointments },
    ];
  }

  async getTodayCard(): Promise<ModuleIntegrationTodayCard> {
    const observations = await this.getObservations();
    const priorityRank: Record<IntegrationPriority, number> = { high: 3, medium: 2, low: 1 };
    const top = observations.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority])[0];
    return {
      title: "Health",
      subtitle: top?.title ?? "No urgent health updates",
      priority: top?.priority ?? "low",
      deeplink: top?.deeplink ?? SynapseDeepLinks.dashboard,
    };
  }

  async getObservations(): Promise<HealthIntegrationObservation[]> {
    const context = await getHealthContext();
    const medicationStates = buildMedicationDoseStates(context.medications, context.medicationLogs, context.now, context.today);
    const observations: HealthIntegrationObservation[] = medicationStates.map((item) => ({
      source: SOURCE,
      type: item.status === "missed" ? "medication_missed" : "medication_due",
      priority: item.status === "missed" ? "high" : "medium",
      title: `${item.medicationName} ${item.status === "missed" ? formatMinutesUntil(item.dueDate, context.now) : `due ${formatMinutesUntil(item.dueDate, context.now)}`}`,
      timestamp: item.dueAt,
      deeplink: item.deeplink,
    }));

    context.appointments.forEach((appointment) => {
      if (appointment.status != null && appointment.status !== "rescheduled") return;
      const start = parseDateTime(appointment.date, appointment.time);
      if (!start) return;
      if (appointment.date !== context.today && appointment.date !== context.tomorrow) return;
      const isToday = appointment.date === context.today;
      observations.push({
        source: SOURCE,
        type: isToday ? "appointment_today" : "appointment_tomorrow",
        priority: isToday ? "high" : "medium",
        title: `${getAppointmentTitle(appointment)} ${isToday ? "today" : "tomorrow"} at ${formatTime12h(appointment.time || "09:00")}`,
        timestamp: start.toISOString(),
        deeplink: SynapseDeepLinks.appointment(appointment.id),
      });
    });

    if (context.sickMode.active === true) {
      observations.push({
        source: SOURCE,
        type: "sick_mode_active",
        priority: "high",
        title: "Sick mode active",
        timestamp: context.sickMode.startedAt || context.now.toISOString(),
        deeplink: SynapseDeepLinks.sickMode,
      });
    }

    if (context.profile.recoveryTrackingEnabled === true || context.sickMode.recoveryMode === true) {
      observations.push({
        source: SOURCE,
        type: "recovery_active",
        priority: "medium",
        title: context.profile.recoveryFocus?.trim() || "Recovery follow-up active",
        timestamp: context.sickMode.startedAt || context.profile.recoveryTrackingStartedAt || context.now.toISOString(),
        deeplink: SynapseDeepLinks.recovery,
      });
    }

    if (isCurrentMonthMissing(context.latestMonthlyCheckIn?.date)) {
      observations.push({
        source: SOURCE,
        type: "monthly_review_due",
        priority: "medium",
        title: `Monthly health review due for ${formatDate(context.today)}`,
        timestamp: context.now.toISOString(),
        deeplink: SynapseDeepLinks.monthlyReview,
      });
    }

    observations.push(...context.labWork.map((record) => buildImportedLabObservation(record, context.now)).filter((item): item is HealthIntegrationObservation => item != null));
    observations.push(...context.imaging.map((record) => buildImportedImagingObservation(record, context.now)).filter((item): item is HealthIntegrationObservation => item != null));

    return observations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}

export const HealthIntegrationService = new SynapseHealthIntegrationService();
