/**
 * Check-In store and local reminders. Everything is scheduled on THIS phone from a saved medication
 * schedule (a care profile's, or the last shared update from a connection). Nothing is sent anywhere,
 * and a reminder never claims to know whether a dose was taken.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import * as SMS from "expo-sms";
import { Linking, Platform, Share } from "react-native";
import { getStoresForProfile } from "@/lib/storage";
import { loadConnections, isTrusted } from "./connections";
import { loadSharedData } from "./sharing";
import { CARE_KEY_PREFIX, loadRegistry } from "./profiles";
import { DEFAULT_CHECKIN_DELAY_MINUTES, clampDelayMinutes, planUpcomingCheckIns, type ScheduledDoseTime } from "./checkin-schedule";
import { reminderBody, reminderTitle } from "./checkin-core";
import { deviceTimeZone, isValidTimeZone } from "./time-zone";
import type { CheckInContact, CheckInEvent, CheckInEventType, CheckInReminderRecord, CheckInSettings, PersonCheckInPrefs } from "./types";

export const CHECKIN_STATE_KEY = `${CARE_KEY_PREFIX}checkin_v1`;
export const CHECKIN_CATEGORY = "CHECKIN";
export const CHECKIN_ID_PREFIX = "checkin-";
const MAX_SCHEDULED_TOTAL = 24;
const MAX_EVENTS = 300;
const LATER_MINUTES = 30;

type State = {
  schemaVersion: 1;
  settings: CheckInSettings;
  prefs: Record<string, PersonCheckInPrefs>;
  contacts: CheckInContact[];
  reminders: CheckInReminderRecord[];
  events: CheckInEvent[];
};

export const DEFAULT_SETTINGS = (): CheckInSettings => ({
  followDeviceTimeZone: true,
  homeTimeZone: deviceTimeZone(),
  quietHours: { start: "22:00", end: "07:00" },
  defaultDelayMinutes: DEFAULT_CHECKIN_DELAY_MINUTES,
});

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<State> {
  const base: State = { schemaVersion: 1, settings: DEFAULT_SETTINGS(), prefs: {}, contacts: [], reminders: [], events: [] };
  try {
    const raw = await AsyncStorage.getItem(CHECKIN_STATE_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<State>;
    const s = { ...base.settings, ...(p.settings ?? {}) };
    if (!isValidTimeZone(s.homeTimeZone)) s.homeTimeZone = deviceTimeZone();
    s.defaultDelayMinutes = clampDelayMinutes(s.defaultDelayMinutes);
    return {
      schemaVersion: 1,
      settings: s,
      prefs: p.prefs && typeof p.prefs === "object" ? p.prefs : {},
      contacts: Array.isArray(p.contacts) ? p.contacts : [],
      reminders: Array.isArray(p.reminders) ? p.reminders : [],
      events: Array.isArray(p.events) ? p.events : [],
    };
  } catch {
    return base;
  }
}

function modify<T>(fn: (s: State) => T): Promise<T> {
  return serial(async () => {
    const s = await read();
    const result = fn(s);
    await AsyncStorage.setItem(CHECKIN_STATE_KEY, JSON.stringify(s));
    return result;
  });
}

export const loadCheckInState = read;

export function saveSettings(patch: Partial<CheckInSettings>): Promise<CheckInSettings> {
  return modify((s) => {
    s.settings = { ...s.settings, ...patch };
    if (patch.defaultDelayMinutes !== undefined) s.settings.defaultDelayMinutes = clampDelayMinutes(patch.defaultDelayMinutes);
    if (patch.homeTimeZone !== undefined && !isValidTimeZone(patch.homeTimeZone)) s.settings.homeTimeZone = deviceTimeZone();
    return s.settings;
  });
}

export function savePersonPrefs(personId: string, patch: Partial<PersonCheckInPrefs>): Promise<PersonCheckInPrefs> {
  return modify((s) => {
    const current = s.prefs[personId] ?? { personId, delayMinutes: s.settings.defaultDelayMinutes, remindersEnabled: false, weekdays: [] };
    const next = { ...current, ...patch, personId };
    next.delayMinutes = clampDelayMinutes(next.delayMinutes);
    s.prefs[personId] = next;
    return next;
  });
}

export function addContact(input: Omit<CheckInContact, "id" | "contactHours"> & { contactHours?: CheckInContact["contactHours"] }): Promise<CheckInContact> {
  return modify((s) => {
    const contact: CheckInContact = {
      id: `c_${Crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      name: input.name.trim().slice(0, 60) || "Someone",
      phone: input.phone?.trim() || undefined,
      timeZone: isValidTimeZone(input.timeZone) ? input.timeZone : deviceTimeZone(),
      relationship: input.relationship?.trim() || undefined,
      contactHours: input.contactHours ?? null,
    };
    s.contacts.push(contact);
    return contact;
  });
}

export function updateContact(id: string, patch: Partial<Omit<CheckInContact, "id">>): Promise<void> {
  return modify((s) => {
    s.contacts = s.contacts.map((c) => (c.id === id ? { ...c, ...patch, timeZone: patch.timeZone && isValidTimeZone(patch.timeZone) ? patch.timeZone : c.timeZone } : c));
  });
}

export function deleteContact(id: string): Promise<void> {
  return modify((s) => {
    s.contacts = s.contacts.filter((c) => c.id !== id);
    delete s.prefs[id];
    s.events = s.events.filter((e) => e.profileId !== id);
    s.reminders = s.reminders.filter((r) => r.profileId !== id);
  }).then(async () => {
    await syncCheckInReminders();
  });
}

// ---------- history ----------

export function recordEvent(profileId: string, type: CheckInEventType, extra: Partial<Pick<CheckInEvent, "label" | "channel">> = {}): Promise<void> {
  return modify((s) => {
    s.events.push({ id: Crypto.randomUUID(), profileId, type, at: new Date().toISOString(), ...extra });
    if (s.events.length > MAX_EVENTS) s.events = s.events.slice(-MAX_EVENTS);
  });
}

/** Deletes history for one person, or everyone when no id is given. */
export function deleteHistory(personId?: string): Promise<void> {
  return modify((s) => {
    s.events = personId ? s.events.filter((e) => e.profileId !== personId) : [];
  });
}

export async function wipeCheckInData(): Promise<void> {
  await cancelAllCheckInNotifications();
  await AsyncStorage.removeItem(CHECKIN_STATE_KEY);
}

// ---------- people ----------

export type CheckInPerson = {
  id: string;
  kind: "profile" | "connection" | "contact";
  name: string;
  subtitle: string;
  phone?: string;
  /** Where the person lives (for contact-hour hints). */
  timeZone: string;
  /** Zone their medication times are written in. */
  scheduleTimeZone: string;
  contactHours: CheckInContact["contactHours"];
  doses: ScheduledDoseTime[];
  /** "Saved schedule" or "Last shared update", so the UI never implies live data. */
  doseSource: "saved_schedule" | "shared_update" | "none";
  sharedAt?: string;
};

function asDoseTimes(meds: { id: string; name: string; times: string[]; weekdays?: number[] }[]): ScheduledDoseTime[] {
  const out: ScheduledDoseTime[] = [];
  for (const m of meds) {
    m.times.forEach((time, i) => out.push({ id: `${m.id}:${i}`, label: m.name, time, weekdays: m.weekdays }));
  }
  return out;
}

export async function loadPeople(): Promise<CheckInPerson[]> {
  const [registry, connections, state] = await Promise.all([loadRegistry(), loadConnections(), read()]);
  const people: CheckInPerson[] = [];

  for (const p of registry.profiles) {
    if (p.type !== "caregiver_managed") continue;
    const meds = (await getStoresForProfile(p.id).medicationStorage.getAll()).filter((m) => m.active !== false && m.medicationType !== "prn");
    const doses = asDoseTimes(
      meds.map((m) => ({
        id: m.id,
        name: m.name,
        times: (m.doses ?? []).map((d) => d.reminderTime).filter((t): t is string => !!t && /^\d{1,2}:\d{2}$/.test(t)),
        weekdays: m.reminderCadence === "weekly" && typeof m.reminderWeekday === "number" ? [m.reminderWeekday] : [],
      })),
    );
    people.push({
      id: p.id,
      kind: "profile",
      name: p.displayName,
      subtitle: p.relationship ? `${p.relationship} · on this iPhone` : "On this iPhone",
      timeZone: p.travelTimeZone ?? p.timeZone,
      scheduleTimeZone: p.medScheduleTimeZone,
      contactHours: p.contactHours,
      doses,
      doseSource: doses.length ? "saved_schedule" : "none",
    });
  }

  for (const c of connections) {
    if (!isTrusted(c)) continue;
    const shared = await loadSharedData(c.id);
    const meds = shared?.med_schedule?.items ?? [];
    const doses = asDoseTimes(meds.map((m) => ({ id: m.key, name: m.name, times: m.times, weekdays: m.weekdays })));
    const tz = shared?.timeZone ?? c.peerTimeZone ?? deviceTimeZone();
    people.push({
      id: c.id,
      kind: "connection",
      name: c.peerName,
      subtitle: "Care connection",
      timeZone: tz,
      scheduleTimeZone: tz,
      contactHours: null,
      doses,
      doseSource: doses.length ? "shared_update" : "none",
      sharedAt: shared?.med_schedule?.provenance.importedAt,
    });
  }

  for (const c of state.contacts) {
    people.push({
      id: c.id,
      kind: "contact",
      name: c.name,
      subtitle: c.relationship ?? "Trusted contact",
      phone: c.phone,
      timeZone: c.timeZone,
      scheduleTimeZone: c.timeZone,
      contactHours: c.contactHours,
      doses: [],
      doseSource: "none",
    });
  }
  return people;
}

// ---------- reminders ----------

async function cancelAllCheckInNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((n) => n.identifier.startsWith(CHECKIN_ID_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // Best effort.
  }
}

async function ensureCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY, [
      { identifier: "CHECKIN_OPEN", buttonTitle: "Open Check-In", options: { opensAppToForeground: true } },
      { identifier: "CHECKIN_LATER", buttonTitle: "Later", options: { opensAppToForeground: false } },
      { identifier: "CHECKIN_DISMISS", buttonTitle: "Dismiss", options: { opensAppToForeground: false } },
    ]);
  } catch {
    // Categories are optional; the reminder still works without action buttons.
  }
}

export type PlannedReminderRow = {
  personId: string;
  personName: string;
  doseLabel: string;
  fireInstant: number;
  scheduleInstant: number;
  postponedFrom?: number;
};

/** Rebuilds every pending Check-In reminder from current schedules. Safe to call often. */
export async function syncCheckInReminders(now = Date.now()): Promise<PlannedReminderRow[]> {
  if (Platform.OS === "web") return [];
  const [people, state] = await Promise.all([loadPeople(), read()]);
  const callerZone = state.settings.followDeviceTimeZone ? deviceTimeZone() : state.settings.homeTimeZone;

  const planned: (PlannedReminderRow & { id: string })[] = [];
  for (const person of people) {
    const prefs = state.prefs[person.id];
    if (!prefs?.remindersEnabled || person.doses.length === 0) continue;
    const plan = planUpcomingCheckIns({
      now,
      doses: person.doses.map((d) => ({ ...d, weekdays: d.weekdays && d.weekdays.length ? d.weekdays : prefs.weekdays })),
      scheduleTimeZone: person.scheduleTimeZone,
      delayMinutes: prefs.delayMinutes,
      caregiverTimeZone: callerZone,
      quietHours: state.settings.quietHours,
      recipientTimeZone: person.timeZone,
      recipientContactWindow: person.contactHours,
      daysAhead: 7,
      limit: 12,
    });
    for (const item of plan) {
      const dayKey = `${item.scheduleDate.year}${String(item.scheduleDate.month).padStart(2, "0")}${String(item.scheduleDate.day).padStart(2, "0")}`;
      planned.push({
        id: `${CHECKIN_ID_PREFIX}${person.id}-${item.doseId.replace(/[^A-Za-z0-9:_-]/g, "")}-${dayKey}`,
        personId: person.id,
        personName: person.name,
        doseLabel: item.doseLabel,
        fireInstant: item.fireInstant,
        scheduleInstant: item.scheduleInstant,
        postponedFrom: item.postponed?.originalInstant,
      });
    }
  }
  planned.sort((a, b) => a.fireInstant - b.fireInstant);
  // One reminder per person per moment is plenty; several meds at the same time collapse together.
  const seen = new Set<string>();
  const unique = planned.filter((p) => {
    const k = `${p.personId}@${p.fireInstant}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const chosen = unique.slice(0, MAX_SCHEDULED_TOTAL);

  await cancelAllCheckInNotifications();
  const records: CheckInReminderRecord[] = [];
  const previousIds = new Set(state.reminders.map((r) => r.id));
  if (chosen.length) {
    await ensureCategory();
    for (const item of chosen) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: item.id,
          content: {
            title: reminderTitle(item.personName),
            body: reminderBody(item.personName, "medication", item.postponedFrom ? { reason: "quiet_hours", originalInstant: item.postponedFrom } : null),
            categoryIdentifier: CHECKIN_CATEGORY,
            data: { widgetTarget: "checkin", notificationType: "check-in", personId: item.personId, reminderId: item.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.fireInstant) },
        });
        records.push({
          id: item.id,
          profileId: item.personId,
          notificationId: item.id,
          doseLabel: item.doseLabel,
          scheduleInstant: item.scheduleInstant,
          fireInstant: item.fireInstant,
          postponedFrom: item.postponedFrom,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("check-in schedule failed", e);
      }
    }
  }
  await modify((s) => {
    s.reminders = records;
    for (const r of records) {
      if (!previousIds.has(r.id)) s.events.push({ id: Crypto.randomUUID(), profileId: r.profileId, type: "reminder_scheduled", at: new Date().toISOString(), label: r.doseLabel });
    }
    if (s.events.length > MAX_EVENTS) s.events = s.events.slice(-MAX_EVENTS);
  });
  return chosen;
}

export async function pendingReminders(): Promise<CheckInReminderRecord[]> {
  const s = await read();
  return s.reminders.filter((r) => r.fireInstant > Date.now()).sort((a, b) => a.fireInstant - b.fireInstant);
}

/** Notification button handling. Returns true when the tap should also open the Check-In screen. */
export async function handleCheckInNotificationResponse(
  actionId: string,
  data: { personId?: string; reminderId?: string },
  titleForLater?: { title: string; body: string },
): Promise<boolean> {
  const personId = data.personId ?? "unknown";
  if (actionId === "CHECKIN_DISMISS") {
    await recordEvent(personId, "reminder_dismissed");
    return false;
  }
  if (actionId === "CHECKIN_LATER") {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${CHECKIN_ID_PREFIX}later-${personId}-${Date.now()}`,
        content: {
          title: titleForLater?.title ?? "A little check-in?",
          body: titleForLater?.body ?? "Here's your reminder from earlier.",
          categoryIdentifier: CHECKIN_CATEGORY,
          data: { widgetTarget: "checkin", notificationType: "check-in", personId },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: LATER_MINUTES * 60 },
      });
    } catch {
      // Rescheduling is best effort.
    }
    await recordEvent(personId, "reminder_rescheduled");
    return false;
  }
  await recordEvent(personId, "reminder_opened");
  return true;
}

// ---------- reaching out (always user-initiated) ----------

export type ReachResult = "composer_opened" | "unavailable" | "cancelled";

/**
 * Opens the system Messages composer with the text pre-filled. The user presses Send. We cannot
 * know if it was sent, delivered, or read, so we only record that a message was prepared.
 */
export async function prepareMessage(personId: string, phone: string | undefined, body: string, label?: string): Promise<ReachResult> {
  try {
    if (await SMS.isAvailableAsync()) {
      await recordEvent(personId, "message_prepared", { channel: "messages", label });
      await SMS.sendSMSAsync(phone ? [phone] : [], body);
      return "composer_opened";
    }
  } catch {
    // Fall through to the share sheet.
  }
  return shareMessage(personId, body, label);
}

export async function shareMessage(personId: string, body: string, label?: string): Promise<ReachResult> {
  try {
    const r = await Share.share({ message: body });
    if (r.action === Share.dismissedAction) return "cancelled";
    await recordEvent(personId, "message_prepared", { channel: "share", label });
    return "composer_opened";
  } catch {
    return "unavailable";
  }
}

export async function startCall(personId: string, phone: string | undefined): Promise<ReachResult> {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (!digits) return "unavailable";
  try {
    await Linking.openURL(`tel:${digits}`);
    await recordEvent(personId, "message_prepared", { channel: "call", label: "Call" });
    return "composer_opened";
  } catch {
    return "unavailable";
  }
}

export function markComplete(personId: string, label?: string): Promise<void> {
  return recordEvent(personId, "marked_complete", { label });
}

export function recordWellnessUpdate(personId: string, label?: string): Promise<void> {
  return recordEvent(personId, "wellness_update", { label });
}
