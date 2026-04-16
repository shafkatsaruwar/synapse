/**
 * Centralized local notification service for Synapse.
 * Uses expo-notifications (iOS: UNUserNotificationCenter). No push/backend.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  medicationLogStorage,
  medicationStorage,
  appointmentStorage,
  settingsStorage,
  healthProfileStorage,
  normalizeMedication,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";

const REFILL_THRESHOLD = 5;
const MEDICATION_CATEGORY = "MEDICATION_REMINDER";
const SNOOZE_MINUTES = 10;

/** Default hour/minute for time-of-day labels when no explicit time is set. */
export const DEFAULT_REMINDER_TIMES: Record<string, { hour: number; minute: number }> = {
  Morning: { hour: 8, minute: 0 },
  Afternoon: { hour: 14, minute: 0 },
  Evening: { hour: 18, minute: 0 },
  Night: { hour: 21, minute: 0 },
  "As Needed": { hour: 9, minute: 0 },
};

export const NOTIFICATION_IDS = {
  prefixMed: "med",
  prefixMedSnooze: "med-snooze",
  prefixRefill: "refill",
  prefixApt1day: "apt-1d",
  prefixApt1hr: "apt-1h",
  dailyCheckIn: "daily-checkin",
  monthlyCheckIn: "monthly-checkin",
  screening: "screening-reminder",
} as const;

function isNative(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** Request notification permission (alert, sound, badge). Resolves to granted status. */
export async function requestPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
      android: {},
    });
    return status === "granted";
  } catch {
    return false;
  }
}

/** Get current permission status. */
export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
  if (!isNative()) return "denied" as Notifications.PermissionStatus;
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Set up notification handler so notifications show when app is in foreground. */
export function setNotificationHandler(): void {
  if (!isNative()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Register medication reminder category with "Mark as Taken" and "Snooze 10 minutes". */
export async function setupMedicationCategory(): Promise<void> {
  if (!isNative()) return;
  try {
    await Notifications.setNotificationCategoryAsync(MEDICATION_CATEGORY, [
      { identifier: "MARK_TAKEN", buttonTitle: "Mark as Taken", options: { isDestructive: false, isAuthenticationRequired: false } },
      { identifier: "SNOOZE", buttonTitle: "Snooze 10 minutes", options: { isDestructive: false, isAuthenticationRequired: false } },
    ]);
  } catch (e) {
    console.warn("setupMedicationCategory failed", e);
  }
}

/** Schedule daily medication reminder. Identifier prevents duplicates. */
export async function scheduleMedicationReminder(params: {
  medicationId: string;
  doseIndex: number;
  medicationName: string;
  dosage: string;
  hour: number;
  minute: number;
  cadence?: "daily" | "weekly" | "biweekly" | "custom";
  weekday?: number;
  intervalValue?: number;
  intervalUnit?: "days" | "weeks";
}): Promise<string | null> {
  if (!isNative()) return null;
  const { medicationId, doseIndex, medicationName, dosage, hour, minute, cadence = "daily", weekday, intervalValue, intervalUnit } = params;
  const identifier = `${NOTIFICATION_IDS.prefixMed}-${medicationId}-${doseIndex}`;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled
      .filter((item) => item.identifier.startsWith(identifier))
      .map((item) => item.identifier);
    for (const id of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }

    if (cadence === "biweekly" || cadence === "custom") {
      return scheduleIntervalMedicationReminders({
        identifier,
        medicationId,
        doseIndex,
        medicationName,
        dosage,
        hour,
        minute,
        cadence,
        weekday,
        intervalValue,
        intervalUnit,
      });
    }

    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Medication Reminder",
        body: `Time to take ${medicationName}${dosage ? ` (${dosage})` : ""}`,
        data: { medicationId, doseIndex, medicationName, dosage },
        categoryIdentifier: MEDICATION_CATEGORY,
      },
      trigger:
        cadence === "weekly" && weekday
          ? {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday,
              hour,
              minute,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour,
              minute,
            },
    });
    return id;
  } catch (e) {
    console.warn("scheduleMedicationReminder failed", e);
    return null;
  }
}

function getNextMatchingWeekdayDate(hour: number, minute: number, weekday: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  const currentWeekday = getCurrentExpoWeekday();
  let offset = weekday - currentWeekday;
  if (offset < 0) offset += 7;
  if (offset === 0 && target.getTime() <= now.getTime()) {
    offset = 7;
  }
  target.setDate(target.getDate() + offset);
  return target;
}

function getNextMatchingDailyDate(hour: number, minute: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

async function scheduleIntervalMedicationReminders(params: {
  identifier: string;
  medicationId: string;
  doseIndex: number;
  medicationName: string;
  dosage: string;
  hour: number;
  minute: number;
  cadence: "biweekly" | "custom";
  weekday?: number;
  intervalValue?: number;
  intervalUnit?: "days" | "weeks";
}): Promise<string | null> {
  const {
    identifier,
    medicationId,
    doseIndex,
    medicationName,
    dosage,
    hour,
    minute,
    cadence,
    weekday,
    intervalValue,
    intervalUnit,
  } = params;

  const normalizedIntervalValue = cadence === "biweekly" ? 2 : Math.max(1, intervalValue ?? 1);
  const normalizedIntervalUnit = cadence === "biweekly" ? "weeks" : (intervalUnit ?? "days");
  const startDate =
    normalizedIntervalUnit === "weeks"
      ? getNextMatchingWeekdayDate(hour, minute, weekday && weekday >= 1 && weekday <= 7 ? weekday : getCurrentExpoWeekday())
      : getNextMatchingDailyDate(hour, minute);

  const horizonDays = normalizedIntervalUnit === "weeks" ? 420 : 180;
  const maxOccurrences = 60;
  let scheduledId: string | null = null;

  for (let i = 0; i < maxOccurrences; i++) {
    const date = new Date(startDate);
    if (normalizedIntervalUnit === "weeks") {
      date.setDate(date.getDate() + i * normalizedIntervalValue * 7);
    } else {
      date.setDate(date.getDate() + i * normalizedIntervalValue);
    }
    const daysOut = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysOut > horizonDays) break;

    const nextId = await Notifications.scheduleNotificationAsync({
      identifier: `${identifier}-${i}`,
      content: {
        title: "Medication Reminder",
        body: `Time to take ${medicationName}${dosage ? ` (${dosage})` : ""}`,
        data: { medicationId, doseIndex, medicationName, dosage },
        categoryIdentifier: MEDICATION_CATEGORY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    if (!scheduledId) scheduledId = nextId;
  }

  return scheduledId;
}

/** Schedule one-time snooze (10 minutes from now). */
export async function scheduleMedicationSnooze(params: {
  medicationId: string;
  doseIndex: number;
  medicationName: string;
  dosage: string;
}): Promise<string | null> {
  if (!isNative()) return null;
  const identifier = `${NOTIFICATION_IDS.prefixMedSnooze}-${params.medicationId}-${params.doseIndex}-${Date.now()}`;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Medication Reminder",
        body: `Time to take ${params.medicationName}${params.dosage ? ` (${params.dosage})` : ""}`,
        data: { medicationId: params.medicationId, doseIndex: params.doseIndex, medicationName: params.medicationName, dosage: params.dosage },
        categoryIdentifier: MEDICATION_CATEGORY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: SNOOZE_MINUTES * 60,
        repeats: false,
      },
    });
    return id;
  } catch (e) {
    console.warn("scheduleMedicationSnooze failed", e);
    return null;
  }
}

/** Schedule refill reminder (one-time). Send only once until supply updated. */
export async function scheduleMedicationRefillReminder(medicationId: string, medicationName: string, body?: string): Promise<string | null> {
  if (!isNative()) return null;
  const identifier = `${NOTIFICATION_IDS.prefixRefill}-${medicationId}`;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Medication Refill Reminder",
        body: body ?? `Your ${medicationName} supply is running low.`,
        data: { medicationId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3600,
        repeats: false,
      },
    });
    return id;
  } catch (e) {
    console.warn("scheduleMedicationRefillReminder failed", e);
    return null;
  }
}

function normalizeInventoryUnit(value?: string): string {
  if (!value) return "pills";
  return value.toLowerCase();
}

function displayInventoryUnit(value?: string, count?: number): string {
  const unit = normalizeInventoryUnit(value);
  if (count === 1) {
    switch (unit) {
      case "pills": return "pill";
      case "tablets": return "tablet";
      case "capsules": return "capsule";
      case "pre-filled pens": return "pre-filled pen";
      case "bottles": return "bottle";
      case "vials": return "vial";
      case "syringes": return "syringe";
      case "inhalers": return "inhaler";
      case "patches": return "patch";
      case "boxes": return "box";
      case "ml": return "mL";
      default: return unit;
    }
  }
  return unit === "ml" ? "mL" : unit;
}

function formatSupplyAmount(value?: number): string {
  if (value == null || Number.isNaN(value)) return "0";
  if (Math.abs(value - Math.round(value)) < 0.001) return String(Math.round(value));
  if (value < 1) return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return value.toFixed(1).replace(/\.0$/, "");
}

function getCurrentExpoWeekday() {
  const day = new Date().getDay();
  return day === 0 ? 1 : day + 1;
}

function inferMedicationReminderCadence(med: {
  reminderCadence?: "daily" | "weekly" | "biweekly" | "custom";
  frequency?: string;
  reminderWeekday?: number;
  reminderIntervalValue?: number;
  reminderIntervalUnit?: "days" | "weeks";
}) {
  const safeWeekday = med.reminderWeekday && med.reminderWeekday >= 1 && med.reminderWeekday <= 7 ? med.reminderWeekday : getCurrentExpoWeekday();
  const safeIntervalValue = med.reminderIntervalValue && med.reminderIntervalValue > 0 ? med.reminderIntervalValue : 1;
  const safeIntervalUnit = med.reminderIntervalUnit ?? "days";

  if (med.reminderCadence === "biweekly") {
    return { cadence: "biweekly" as const, weekday: safeWeekday, intervalValue: 2, intervalUnit: "weeks" as const };
  }
  if (med.reminderCadence === "custom") {
    return { cadence: "custom" as const, weekday: safeWeekday, intervalValue: safeIntervalValue, intervalUnit: safeIntervalUnit };
  }
  if (med.reminderCadence === "weekly") {
    return { cadence: "weekly" as const, weekday: safeWeekday, intervalValue: undefined, intervalUnit: undefined };
  }
  if (med.reminderCadence === "daily") {
    return { cadence: "daily" as const, weekday: undefined, intervalValue: undefined, intervalUnit: undefined };
  }
  const freq = med.frequency?.trim().toLowerCase() ?? "";
  const customWeekMatch = freq.match(/every\s+(\d+)\s+weeks?/);
  if (customWeekMatch) {
    const parsed = Math.max(1, parseInt(customWeekMatch[1], 10) || 1);
    return {
      cadence: parsed === 2 ? "biweekly" as const : "custom" as const,
      weekday: safeWeekday,
      intervalValue: parsed,
      intervalUnit: "weeks" as const,
    };
  }
  const customDayMatch = freq.match(/every\s+(\d+)\s+days?/);
  if (customDayMatch) {
    return {
      cadence: "custom" as const,
      weekday: undefined,
      intervalValue: Math.max(1, parseInt(customDayMatch[1], 10) || 1),
      intervalUnit: "days" as const,
    };
  }
  if (freq.includes("week")) {
    return { cadence: "weekly" as const, weekday: safeWeekday, intervalValue: undefined, intervalUnit: undefined };
  }
  return { cadence: "daily" as const, weekday: undefined, intervalValue: undefined, intervalUnit: undefined };
}

/** Schedule appointment reminder (1 day before or 1 hour before). */
export async function scheduleAppointmentReminder(params: {
  appointmentId: string;
  doctorName: string;
  date: string;
  time: string;
  when: "1day" | "1hr";
}): Promise<string | null> {
  if (!isNative()) return null;
  const { appointmentId, doctorName, date, time, when } = params;
  const identifier = when === "1day"
    ? `${NOTIFICATION_IDS.prefixApt1day}-${appointmentId}`
    : `${NOTIFICATION_IDS.prefixApt1hr}-${appointmentId}`;
  try {
    const [y, m, d] = date.split("-").map(Number);
    const timeMatch = time.match(/(\d+):(\d+)/);
    const hour = timeMatch ? parseInt(timeMatch[1], 10) : 9;
    const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;
    const triggerDate = new Date(y, m - 1, d, hour, minute, 0);
    if (when === "1day") {
      triggerDate.setDate(triggerDate.getDate() - 1);
    } else {
      triggerDate.setHours(triggerDate.getHours() - 1);
    }
    if (triggerDate.getTime() <= Date.now()) return null;
    await Notifications.cancelScheduledNotificationAsync(identifier);
    const body =
      when === "1day"
        ? `Appointment with ${doctorName} tomorrow at ${time}.`
        : `Appointment with ${doctorName} in 1 hour at ${time}.`;
    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Upcoming Appointment",
        body,
        data: { appointmentId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    return id;
  } catch (e) {
    console.warn("scheduleAppointmentReminder failed", e);
    return null;
  }
}

/** Schedule daily check-in reminder (default 8 PM). */
export async function scheduleDailyCheckIn(hour: number, minute: number): Promise<string | null> {
  if (!isNative()) return null;
  const identifier = NOTIFICATION_IDS.dailyCheckIn;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Daily Check-In",
        body: "How are you feeling today? Log your mood and symptoms.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch (e) {
    console.warn("scheduleDailyCheckIn failed", e);
    return null;
  }
}

/** Schedule monthly health review (e.g. 1st of month at 9 AM). */
export async function scheduleMonthlyCheckIn(dayOfMonth: number, hour: number, minute: number): Promise<string | null> {
  if (!isNative()) return null;
  const identifier = NOTIFICATION_IDS.monthlyCheckIn;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Monthly Health Review",
        body: "It’s a new month. Please take a moment to update your health details.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: dayOfMonth,
        hour,
        minute,
      },
    });
    return id;
  } catch (e) {
    console.warn("scheduleMonthlyCheckIn failed", e);
    return null;
  }
}

const SCREENING_MILESTONES: { age: number; screening: string }[] = [
  { age: 21, screening: "routine preventive screening" },
  { age: 45, screening: "colon cancer screening" },
  { age: 50, screening: "routine preventive screening" },
  { age: 65, screening: "bone health screening" },
];

function parseDateOnly(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 10, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getUpcomingScreeningMilestone(dateOfBirth?: string): { age: number; screening: string; triggerDate: Date } | null {
  const dob = parseDateOnly(dateOfBirth);
  if (!dob) return null;
  const now = new Date();
  for (const milestone of SCREENING_MILESTONES) {
    const triggerDate = new Date(dob);
    triggerDate.setFullYear(dob.getFullYear() + milestone.age);
    triggerDate.setHours(10, 0, 0, 0);
    if (triggerDate.getTime() > now.getTime()) {
      return { ...milestone, triggerDate };
    }
  }
  return null;
}

async function cancelScreeningNotifications(): Promise<void> {
  if (!isNative()) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled
      .filter((item) => item.identifier.startsWith(`${NOTIFICATION_IDS.screening}-`))
      .map((item) => item.identifier);
    for (const id of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  } catch {}
}

export async function scheduleAgeBasedScreeningReminder(dateOfBirth?: string): Promise<string | null> {
  if (!isNative()) return null;
  const nextMilestone = getUpcomingScreeningMilestone(dateOfBirth);
  await cancelScreeningNotifications();
  if (!nextMilestone) return null;
  const identifier = `${NOTIFICATION_IDS.screening}-${nextMilestone.age}`;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Preventive Care Reminder",
        body: `You are now ${nextMilestone.age} years old. Consider asking your doctor about ${nextMilestone.screening}.`,
        data: { age: nextMilestone.age, screening: nextMilestone.screening },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextMilestone.triggerDate,
      },
    });
    return id;
  } catch (e) {
    console.warn("scheduleAgeBasedScreeningReminder failed", e);
    return null;
  }
}

export async function cancelNotification(identifier: string): Promise<void> {
  if (!isNative()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {}
}

export async function cancelAllNotifications(): Promise<void> {
  if (!isNative()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

/** Cancel all medication reminders for a medication. */
export async function cancelMedicationReminders(medicationId: string): Promise<void> {
  if (!isNative()) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled
    .filter((n) => n.identifier.startsWith(`${NOTIFICATION_IDS.prefixMed}-${medicationId}`) || n.identifier.startsWith(`${NOTIFICATION_IDS.prefixMedSnooze}-${medicationId}`))
    .map((n) => n.identifier);
  for (const id of toCancel) await Notifications.cancelScheduledNotificationAsync(id);
  await Notifications.cancelScheduledNotificationAsync(`${NOTIFICATION_IDS.prefixRefill}-${medicationId}`);
}

/** Cancel appointment reminders for an appointment. */
export async function cancelAppointmentReminders(appointmentId: string): Promise<void> {
  if (!isNative()) return;
  await Notifications.cancelScheduledNotificationAsync(`${NOTIFICATION_IDS.prefixApt1day}-${appointmentId}`);
  await Notifications.cancelScheduledNotificationAsync(`${NOTIFICATION_IDS.prefixApt1hr}-${appointmentId}`);
}

/** Map a notification identifier to an app screen key. */
function getScreenForNotificationId(id: string): string | null {
  if (id.startsWith("med-") || id.startsWith("refill-")) return "medications";
  if (id.startsWith("apt-")) return "appointments";
  if (id === NOTIFICATION_IDS.dailyCheckIn) return "log";
  if (id === NOTIFICATION_IDS.monthlyCheckIn) return "monthlycheckin";
  if (id.startsWith(`${NOTIFICATION_IDS.screening}-`)) return "healthprofile";
  return null;
}

/** Module-level navigation callback — set via setNotificationNavigateCallback(). */
let _navigateCallback: ((screen: string) => void) | null = null;

/** Register the app's navigate function so notification taps can route to the right screen. */
export function setNotificationNavigateCallback(fn: (screen: string) => void): void {
  _navigateCallback = fn;
}

/** Call on app mount to handle any notification that launched the app from a killed state. */
export async function handleLastNotificationResponse(): Promise<void> {
  if (!isNative()) return;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;
    const id = response.notification.request.identifier;
    const screen = getScreenForNotificationId(id);
    if (screen && _navigateCallback) _navigateCallback(screen);
  } catch {}
}

/** Subscribe to notification responses (Mark as Taken, Snooze). Call once at app root. */
export function addNotificationResponseListener(
  onMarkTaken: (medicationId: string, doseIndex: number) => void,
  onSnooze: (medicationId: string, doseIndex: number, medicationName: string, dosage: string) => void,
): () => void {
  if (!isNative()) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const actionId = response.actionIdentifier;
    const data = response.notification.request.content.data as { medicationId?: string; doseIndex?: number; medicationName?: string; dosage?: string };
    if (actionId === "MARK_TAKEN" && data?.medicationId != null) {
      const doseIndex = data.doseIndex ?? 0;
      const date = getToday();
      medicationLogStorage.toggle(data.medicationId, date, doseIndex).catch(() => {});
      onMarkTaken(data.medicationId, doseIndex);
    } else if (actionId === "SNOOZE" && data?.medicationId != null) {
      scheduleMedicationSnooze({
        medicationId: data.medicationId,
        doseIndex: data.doseIndex ?? 0,
        medicationName: data.medicationName ?? "Medication",
        dosage: data.dosage ?? "",
      }).then(() => {
        onSnooze(data.medicationId!, data.doseIndex ?? 0, data.medicationName ?? "Medication", data.dosage ?? "");
      });
    } else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      // User tapped the notification banner — route to the relevant screen
      const id = response.notification.request.identifier;
      const screen = getScreenForNotificationId(id);
      if (screen && _navigateCallback) _navigateCallback(screen);
    }
  });
  return () => sub.remove();
}

/** Parse "HH:mm" to { hour, minute }. Default 20:00. */
function parseTimeHHMM(s: string | undefined): { hour: number; minute: number } {
  if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return { hour: 20, minute: 0 };
  const [h, m] = s.split(":").map(Number);
  return { hour: Math.min(23, Math.max(0, h)), minute: Math.min(59, Math.max(0, m)) };
}

/**
 * Sync all scheduled notifications from current settings, medications, and appointments.
 * Call after app load and when any of these change. Cancels and reschedules to avoid duplicates.
 */
export async function syncAllFromSettings(): Promise<void> {
  if (!isNative()) return;
  try {
    const [settings, meds, apts, profile] = await Promise.all([
      settingsStorage.get(),
      medicationStorage.getAll(),
      appointmentStorage.getAll(),
      healthProfileStorage.get(),
    ]);
    const today = getToday();
    const notifMed = settings.notificationsMedications !== false;
    const notifApt = settings.notificationsAppointments !== false;
    const notifDaily = settings.notificationsDailyCheckIn !== false;
    const notifMonthly = settings.notificationsMonthly !== false;

    if (!notifMed) {
      for (const med of meds) {
        await cancelMedicationReminders(med.id);
      }
    } else {
      for (const med of meds) {
        if (!med.active) {
          await cancelMedicationReminders(med.id);
          continue;
        }
        const normalized = normalizeMedication(med);
        const reminderSchedule = inferMedicationReminderCadence(med);
        const doses = Array.isArray(normalized.doses) && normalized.doses.length > 0 ? normalized.doses : [];
        if (doses.length === 0) {
          const { hour, minute } = DEFAULT_REMINDER_TIMES["Morning"];
          await scheduleMedicationReminder({
            medicationId: med.id,
            doseIndex: 0,
            medicationName: med.name ?? "Medication",
            dosage: (med as { dosage?: string }).dosage ?? "",
            hour,
            minute,
            cadence: reminderSchedule.cadence,
            weekday: reminderSchedule.weekday,
            intervalValue: reminderSchedule.intervalValue,
            intervalUnit: reminderSchedule.intervalUnit,
          });
        } else {
          for (let i = 0; i < doses.length; i++) {
            const dose = doses[i];
            let hour: number;
            let minute: number;
            if (dose.reminderTime) {
              const [h, m] = dose.reminderTime.split(":").map((n) => parseInt(n, 10) || 0);
              hour = h;
              minute = m;
            } else {
              const def = DEFAULT_REMINDER_TIMES[dose.timeOfDay] ?? DEFAULT_REMINDER_TIMES["Morning"];
              hour = def.hour;
              minute = def.minute;
            }
            await scheduleMedicationReminder({
              medicationId: med.id,
              doseIndex: i,
              medicationName: med.name ?? "Medication",
              dosage: `${dose.amount} ${dose.unit}`.trim(),
              hour,
              minute,
              cadence: reminderSchedule.cadence,
              weekday: reminderSchedule.weekday,
              intervalValue: reminderSchedule.intervalValue,
              intervalUnit: reminderSchedule.intervalUnit,
            });
          }
        }
        const remaining = (med as { currentSupplyAmount?: number; pillsRemaining?: number }).currentSupplyAmount ?? (med as { pillsRemaining?: number }).pillsRemaining;
        const threshold = (med as { lowSupplyThreshold?: number }).lowSupplyThreshold ?? REFILL_THRESHOLD;
        if (remaining != null && remaining <= threshold) {
          const refillsRemaining = (med as { refillsRemaining?: number }).refillsRemaining;
          const inventoryUnit = (med as { inventoryUnit?: string; refillUnit?: string }).inventoryUnit ?? (med as { refillUnit?: string }).refillUnit;
          const lowSupplyText = `${med.name ?? "Medication"} is running low. Only ${formatSupplyAmount(remaining)} ${displayInventoryUnit(inventoryUnit, remaining)} remaining.`;
          const refillText =
            refillsRemaining === 1
              ? " Only 1 refill remaining. Please contact your pharmacy for refills."
              : refillsRemaining === 0
              ? " No refills remaining. Please contact your pharmacy."
              : "";
          await scheduleMedicationRefillReminder(med.id, med.name ?? "Medication", `${lowSupplyText}${refillText}`);
        }
      }
    }

    if (!notifApt) {
      for (const apt of apts) {
        if (apt.status) continue;
        await cancelAppointmentReminders(apt.id);
      }
    } else {
      for (const apt of apts) {
        if (apt.status === "cancelled" || apt.status === "completed" || apt.status === "rescheduled") continue;
        if (apt.date < today) continue;
        const time = apt.time || "09:00";
        await scheduleAppointmentReminder({ appointmentId: apt.id, doctorName: apt.doctorName, date: apt.date, time, when: "1day" });
        await scheduleAppointmentReminder({ appointmentId: apt.id, doctorName: apt.doctorName, date: apt.date, time, when: "1hr" });
      }
    }

    if (!notifDaily) {
      await cancelNotification(NOTIFICATION_IDS.dailyCheckIn);
    } else {
      const { hour, minute } = parseTimeHHMM(settings.dailyCheckInReminderTime);
      await scheduleDailyCheckIn(hour, minute);
    }

    if (!notifMonthly) {
      await cancelNotification(NOTIFICATION_IDS.monthlyCheckIn);
    } else {
      await scheduleMonthlyCheckIn(1, 9, 0);
    }

    await scheduleAgeBasedScreeningReminder(profile.dateOfBirth);
  } catch (e) {
    console.warn("syncAllFromSettings failed", e);
  }
}
