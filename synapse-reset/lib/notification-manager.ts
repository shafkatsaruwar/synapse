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
  if (!isNative()) return "undetermined";
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
}): Promise<string | null> {
  if (!isNative()) return null;
  const { medicationId, doseIndex, medicationName, dosage, hour, minute } = params;
  const identifier = `${NOTIFICATION_IDS.prefixMed}-${medicationId}-${doseIndex}`;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Medication Reminder",
        body: `Time to take ${medicationName}${dosage ? ` (${dosage})` : ""}`,
        data: { medicationId, doseIndex, medicationName, dosage },
        categoryIdentifier: MEDICATION_CATEGORY,
      },
      trigger: {
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
export async function scheduleMedicationRefillReminder(medicationId: string, medicationName: string): Promise<string | null> {
  if (!isNative()) return null;
  const identifier = `${NOTIFICATION_IDS.prefixRefill}-${medicationId}`;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    const id = await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Medication Refill Reminder",
        body: `Your ${medicationName} supply is running low.`,
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
        body: "Take a moment to review your health and progress this month.",
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
    const [settings, meds, apts] = await Promise.all([
      settingsStorage.get(),
      medicationStorage.getAll(),
      appointmentStorage.getAll(),
    ]);
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
          });
        } else {
          for (let i = 0; i < doses.length; i++) {
            const dose = doses[i];
            const { hour, minute } = DEFAULT_REMINDER_TIMES[dose.timeOfDay] ?? DEFAULT_REMINDER_TIMES["Morning"];
            await scheduleMedicationReminder({
              medicationId: med.id,
              doseIndex: i,
              medicationName: med.name ?? "Medication",
              dosage: `${dose.amount} ${dose.unit}`.trim(),
              hour,
              minute,
            });
          }
        }
        const remaining = (med as { pillsRemaining?: number }).pillsRemaining;
        if (remaining != null && remaining <= REFILL_THRESHOLD) {
          await scheduleMedicationRefillReminder(med.id, med.name ?? "Medication");
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
  } catch (e) {
    console.warn("syncAllFromSettings failed", e);
  }
}
