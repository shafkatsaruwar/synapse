import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getSupabase } from "@/lib/supabase";
import { getToday } from "@/lib/date-utils";
import {
  appointmentStorage,
  healthLogStorage,
  medicationLogStorage,
  settingsStorage,
  sickModeStorage,
  symptomStorage,
  type Appointment,
} from "@/lib/storage";

const INSTALL_USER_ID_KEY = "synapse_linking_install_user_id";
const REPORTED_EVENT_KEYS = "synapse_linking_reported_events";
const LINK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type CaregiverLinkRole = "patient" | "caregiver";
export type CaregiverAccountabilityEventType =
  | "missed_medication"
  | "missed_appointment"
  | "sick_mode_activated"
  | "no_activity"
  | "no_logs_today"
  | "recovery_mode_active"
  | "caregiver_reminder";

export type CaregiverLinkState = {
  userId: string;
  linkedUsers: string[];
  pendingCode?: string;
  pendingCodeExpiresAt?: string;
};

export type MissedMedicationEventInput = {
  patientName?: string;
  medicationId: string;
  medicationName: string;
  doseIndex: number;
  doseLabel?: string;
  missedAt: string;
};

export type CaregiverAccountabilityEvent = {
  id: string;
  patientUserId: string;
  caregiverUserId: string;
  type: CaregiverAccountabilityEventType;
  eventKey: string;
  payload: {
    patientName?: string;
    message?: string;
    medicationName?: string;
    doseLabel?: string;
    occurredAt?: string;
    [key: string]: unknown;
  };
  acknowledgedAt?: string | null;
  createdAt: string;
};

function formatTimeLabel(value?: string) {
  if (!value) return undefined;
  const [hourRaw, minuteRaw] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return value;
  const hour = hourRaw % 12 || 12;
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  return minuteRaw === 0 ? `${hour} ${suffix}` : `${hour}:${String(minuteRaw).padStart(2, "0")} ${suffix}`;
}

function appointmentDateTime(appointment: Appointment) {
  return new Date(`${appointment.date}T${appointment.time || "23:59"}:00`);
}

function isAfterIso(value: string | undefined, sinceMs: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= sinceMs;
}

function isNative() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const easProjectId = Constants.easConfig?.projectId;
  const extraProjectId = extra?.eas && typeof extra.eas === "object" ? (extra.eas as Record<string, unknown>).projectId : undefined;
  return easProjectId ?? (typeof extraProjectId === "string" ? extraProjectId : undefined);
}

async function getDeviceToken(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return null;
    const projectId = getProjectId();
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch (error) {
    console.warn("Caregiver linking push token unavailable", error);
    return null;
  }
}

export async function getLinkingUserId(authUserId?: string | null): Promise<string> {
  if (authUserId) return authUserId;
  const existing = await AsyncStorage.getItem(INSTALL_USER_ID_KEY);
  if (existing) return existing;
  const next = `local_${Crypto.randomUUID()}`;
  await AsyncStorage.setItem(INSTALL_USER_ID_KEY, next);
  return next;
}

function makeLinkCode(): string {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += LINK_CODE_ALPHABET[Math.floor(Math.random() * LINK_CODE_ALPHABET.length)];
  }
  return code;
}

async function upsertLinkingUser(userId: string, role: CaregiverLinkRole, linkedUsers?: string[]) {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const deviceToken = await getDeviceToken();
  const payload: Record<string, unknown> = {
    user_id: userId,
    role,
    updated_at: new Date().toISOString(),
  };
  if (deviceToken) payload.device_token = deviceToken;
  if (linkedUsers) payload.linked_users = linkedUsers;
  try {
    const { error } = await supabase.from("caregiver_users").upsert(payload, { onConflict: "user_id" });
    return { error: error ? new Error(error.message) : null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Network request failed") };
  }
}

async function getLinkedUsers(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("caregiver_users").select("linked_users").eq("user_id", userId).maybeSingle();
  return Array.isArray(data?.linked_users) ? data.linked_users.filter((id): id is string => typeof id === "string") : [];
}

async function setLinkedUsers(userId: string, role: CaregiverLinkRole, linkedUsers: string[]) {
  const unique = Array.from(new Set(linkedUsers.filter(Boolean)));
  return upsertLinkingUser(userId, role, unique);
}

export async function getCaregiverLinkState(authUserId?: string | null): Promise<CaregiverLinkState> {
  const userId = await getLinkingUserId(authUserId);
  const supabase = getSupabase();
  if (!supabase) return { userId, linkedUsers: [] };
  const [{ data: userRow }, { data: codeRow }] = await Promise.all([
    supabase.from("caregiver_users").select("linked_users").eq("user_id", userId).maybeSingle(),
    supabase
      .from("caregiver_link_codes")
      .select("code, expires_at")
      .eq("patient_user_id", userId)
      .is("claimed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    userId,
    linkedUsers: Array.isArray(userRow?.linked_users) ? userRow.linked_users : [],
    pendingCode: typeof codeRow?.code === "string" ? codeRow.code : undefined,
    pendingCodeExpiresAt: typeof codeRow?.expires_at === "string" ? codeRow.expires_at : undefined,
  };
}

export async function generatePatientLinkCode(authUserId?: string | null): Promise<{ code?: string; expiresAt?: string; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const patientUserId = await getLinkingUserId(authUserId);
  const upsert = await upsertLinkingUser(patientUserId, "patient");
  if (upsert.error) return { error: upsert.error };

  const { error: invalidateError } = await supabase
    .from("caregiver_link_codes")
    .update({ claimed_at: new Date().toISOString() })
    .eq("patient_user_id", patientUserId)
    .is("claimed_at", null);
  if (invalidateError) return { error: new Error(invalidateError.message) };

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = makeLinkCode();
    const { error } = await supabase.from("caregiver_link_codes").insert({
      code,
      patient_user_id: patientUserId,
      expires_at: expiresAt,
    });
    if (!error) return { code, expiresAt, error: null };
    if (!error.message.toLowerCase().includes("duplicate")) return { error: new Error(error.message) };
  }
  return { error: new Error("Could not create a unique link code. Try again.") };
}

export async function linkCaregiverWithCode(codeInput: string, authUserId?: string | null): Promise<{ patientUserId?: string; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const code = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) return { error: new Error("Enter the 6-character code.") };
  const caregiverUserId = await getLinkingUserId(authUserId);

  let codeRow: { id: string; patient_user_id: string } | null = null;
  try {
    const { data, error: codeError } = await supabase
      .from("caregiver_link_codes")
      .select("id, patient_user_id, expires_at, claimed_at")
      .eq("code", code)
      .is("claimed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (codeError) return { error: new Error(codeError.message) };
    codeRow = data as { id: string; patient_user_id: string } | null;
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Network request failed") };
  }
  if (!codeRow?.patient_user_id) return { error: new Error("That code is expired or invalid.") };
  if (codeRow.patient_user_id === caregiverUserId) return { error: new Error("Use a second device or account to link as caregiver.") };

  const caregiverUpsert = await upsertLinkingUser(caregiverUserId, "caregiver");
  if (caregiverUpsert.error) return { error: caregiverUpsert.error };

  const patientUserId = codeRow.patient_user_id as string;
  try {
    const patientLinks = await getLinkedUsers(patientUserId);
    const caregiverLinks = await getLinkedUsers(caregiverUserId);
    const patientUpdate = await setLinkedUsers(patientUserId, "patient", [...patientLinks, caregiverUserId]);
    if (patientUpdate.error) return { error: patientUpdate.error };
    const caregiverUpdate = await setLinkedUsers(caregiverUserId, "caregiver", [...caregiverLinks, patientUserId]);
    if (caregiverUpdate.error) return { error: caregiverUpdate.error };
    const { error: claimError } = await supabase
      .from("caregiver_link_codes")
      .update({ claimed_by_user_id: caregiverUserId, claimed_at: new Date().toISOString() })
      .eq("id", codeRow.id);
    return { patientUserId, error: claimError ? new Error(claimError.message) : null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Network request failed") };
  }
}

export async function unlinkCaregiverUser(targetUserId: string, authUserId?: string | null): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const userId = await getLinkingUserId(authUserId);
  const [myLinks, targetLinks] = await Promise.all([getLinkedUsers(userId), getLinkedUsers(targetUserId)]);
  const [mine, theirs] = await Promise.all([
    supabase.from("caregiver_users").update({ linked_users: myLinks.filter((id) => id !== targetUserId), updated_at: new Date().toISOString() }).eq("user_id", userId),
    supabase.from("caregiver_users").update({ linked_users: targetLinks.filter((id) => id !== userId), updated_at: new Date().toISOString() }).eq("user_id", targetUserId),
  ]);
  const error = mine.error ?? theirs.error;
  return { error: error ? new Error(error.message) : null };
}

async function wasEventReported(eventKey: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(REPORTED_EVENT_KEYS);
    const parsed = raw ? JSON.parse(raw) : {};
    return Boolean(parsed[eventKey]);
  } catch {
    return false;
  }
}

async function markEventReported(eventKey: string) {
  try {
    const raw = await AsyncStorage.getItem(REPORTED_EVENT_KEYS);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[eventKey] = new Date().toISOString();
    await AsyncStorage.setItem(REPORTED_EVENT_KEYS, JSON.stringify(parsed));
  } catch {}
}

async function reportAccountabilityEventIfNeeded(params: {
  patientUserId: string;
  type: CaregiverAccountabilityEventType;
  eventKey: string;
  payload: Record<string, unknown>;
}): Promise<{ reported: boolean; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { reported: false, error: null };
  if (await wasEventReported(params.eventKey)) return { reported: false, error: null };
  const linkedUsers = await getLinkedUsers(params.patientUserId);
  if (linkedUsers.length === 0) return { reported: false, error: null };

  const rows = linkedUsers.map((caregiverUserId) => ({
    patient_user_id: params.patientUserId,
    caregiver_user_id: caregiverUserId,
    type: params.type,
    event_key: params.eventKey,
    payload: params.payload,
  }));
  const { error } = await supabase.from("caregiver_events").upsert(rows, { onConflict: "patient_user_id,caregiver_user_id,event_key" });
  if (error) return { reported: false, error: new Error(error.message) };
  await markEventReported(params.eventKey);
  await supabase.functions.invoke("send-caregiver-event", {
    body: {
      eventKey: params.eventKey,
      patientUserId: params.patientUserId,
      type: params.type,
      payload: params.payload,
    },
  }).catch(() => {});
  return { reported: true, error: null };
}

export async function reportMissedMedicationIfNeeded(
  input: MissedMedicationEventInput,
  authUserId?: string | null
): Promise<{ reported: boolean; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { reported: false, error: null };
  const patientUserId = await getLinkingUserId(authUserId);
  const eventKey = `missed_medication:${input.missedAt.slice(0, 10)}:${input.medicationId}:${input.doseIndex}`;

  const payload = {
    patientName: input.patientName?.trim() || "Someone",
    medicationId: input.medicationId,
    medicationName: input.medicationName,
    doseIndex: input.doseIndex,
    doseLabel: input.doseLabel,
    missedAt: input.missedAt,
    occurredAt: input.missedAt,
    message: `${input.patientName?.trim() || "Someone"} missed ${input.medicationName}${input.doseLabel ? ` at ${input.doseLabel}` : ""}`,
  };
  return reportAccountabilityEventIfNeeded({
    patientUserId,
    type: "missed_medication",
    eventKey,
    payload,
  });
}

export async function reportNoLogsTodayIfNeeded(authUserId?: string | null): Promise<{ reported: boolean; error: Error | null }> {
  return reportNoActivityIfNeeded(authUserId);
}

export async function reportNoActivityIfNeeded(authUserId?: string | null): Promise<{ reported: boolean; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { reported: false, error: null };
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (currentMinutes < 20 * 60) return { reported: false, error: null };
  const today = getToday();
  const sinceMs = now.getTime() - 24 * 60 * 60 * 1000;
  const [settings, healthLogs, medLogs, symptoms] = await Promise.all([
    settingsStorage.get(),
    healthLogStorage.getAll(),
    medicationLogStorage.getAll(),
    symptomStorage.getAll(),
  ]);
  const hasRecentActivity =
    healthLogs.some((log) => isAfterIso(log.recordedAt ?? `${log.date}T12:00:00`, sinceMs)) ||
    medLogs.some((log) => isAfterIso(log.recordedAt ?? (log.taken ? `${log.date}T12:00:00` : undefined), sinceMs)) ||
    symptoms.some((symptom) => isAfterIso(symptom.recordedAt ?? `${symptom.date}T12:00:00`, sinceMs));
  if (hasRecentActivity) return { reported: false, error: null };
  const patientUserId = await getLinkingUserId(authUserId);
  const patientName = settings.name?.trim() || "Someone";
  return reportAccountabilityEventIfNeeded({
    patientUserId,
    type: "no_activity",
    eventKey: `no_activity:${today}`,
    payload: {
      patientName,
      occurredAt: now.toISOString(),
      message: `${patientName} hasn't logged anything today`,
    },
  });
}

export async function reportRecoveryModeActiveIfNeeded(authUserId?: string | null): Promise<{ reported: boolean; error: Error | null }> {
  return reportSickModeActivatedIfNeeded(authUserId);
}

export async function reportSickModeActivatedIfNeeded(authUserId?: string | null): Promise<{ reported: boolean; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { reported: false, error: null };
  const [settings, sickMode] = await Promise.all([settingsStorage.get(), sickModeStorage.get()]);
  if (!settings.sickMode && !sickMode.active && !sickMode.recoveryMode) return { reported: false, error: null };
  const today = getToday();
  const patientUserId = await getLinkingUserId(authUserId);
  const patientName = settings.name?.trim() || "Someone";
  const occurredAt = sickMode.startedAt || new Date().toISOString();
  return reportAccountabilityEventIfNeeded({
    patientUserId,
    type: "sick_mode_activated",
    eventKey: `sick_mode_activated:${occurredAt.slice(0, 10) || today}`,
    payload: {
      patientName,
      occurredAt,
      message: `${patientName} activated Sick Mode`,
    },
  });
}

export async function reportMissedAppointmentIfNeeded(authUserId?: string | null): Promise<{ reported: boolean; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { reported: false, error: null };
  const now = new Date();
  const [settings, appointments] = await Promise.all([settingsStorage.get(), appointmentStorage.getAll()]);
  const missed = appointments
    .filter((appointment) => !appointment.status || appointment.status === undefined)
    .filter((appointment) => appointmentDateTime(appointment).getTime() < now.getTime())
    .sort((a, b) => appointmentDateTime(b).getTime() - appointmentDateTime(a).getTime())[0];
  if (!missed) return { reported: false, error: null };

  const patientUserId = await getLinkingUserId(authUserId);
  const patientName = settings.name?.trim() || "Someone";
  const missedAt = appointmentDateTime(missed).toISOString();
  return reportAccountabilityEventIfNeeded({
    patientUserId,
    type: "missed_appointment",
    eventKey: `missed_appointment:${missed.id}:${missed.date}`,
    payload: {
      patientName,
      appointmentId: missed.id,
      appointmentDate: missed.date,
      appointmentTime: missed.time,
      occurredAt: missedAt,
      message: `${patientName} missed an appointment${missed.date === getToday() ? " today" : ""}`,
      timeLabel: formatTimeLabel(missed.time),
    },
  });
}

export async function sendCaregiverReminder(patientUserId: string, message = "Don't forget your medication", authUserId?: string | null) {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const caregiverUserId = await getLinkingUserId(authUserId);
  const { error } = await supabase.from("caregiver_events").insert({
    patient_user_id: patientUserId,
    caregiver_user_id: caregiverUserId,
    type: "caregiver_reminder",
    event_key: `reminder:${caregiverUserId}:${Date.now()}`,
    payload: { message },
  });
  if (error) return { error: new Error(error.message) };
  await supabase.functions.invoke("send-caregiver-reminder", { body: { patientUserId, caregiverUserId, message } }).catch(() => {});
  return { error: null };
}

function mapCaregiverEvent(row: Record<string, unknown>): CaregiverAccountabilityEvent {
  const payload = typeof row.payload === "object" && row.payload !== null ? row.payload as CaregiverAccountabilityEvent["payload"] : {};
  return {
    id: String(row.id),
    patientUserId: String(row.patient_user_id),
    caregiverUserId: String(row.caregiver_user_id),
    type: row.type as CaregiverAccountabilityEventType,
    eventKey: String(row.event_key),
    payload,
    acknowledgedAt: typeof row.acknowledged_at === "string" ? row.acknowledged_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
  };
}

export async function fetchCaregiverAccountabilityEvents(
  authUserId?: string | null,
  limit = 12
): Promise<{ events: CaregiverAccountabilityEvent[]; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { events: [], error: null };
  const caregiverUserId = await getLinkingUserId(authUserId);
  const { data, error } = await supabase
    .from("caregiver_events")
    .select("id, patient_user_id, caregiver_user_id, type, event_key, payload, acknowledged_at, created_at")
    .eq("caregiver_user_id", caregiverUserId)
    .neq("type", "caregiver_reminder")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { events: [], error: new Error(error.message) };
  return { events: (data ?? []).map((row) => mapCaregiverEvent(row as Record<string, unknown>)), error: null };
}

export async function acknowledgeCaregiverEvent(eventId: string, authUserId?: string | null): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: new Error("Supabase not configured") };
  const caregiverUserId = await getLinkingUserId(authUserId);
  const { error } = await supabase
    .from("caregiver_events")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by_user_id: caregiverUserId })
    .eq("id", eventId)
    .eq("caregiver_user_id", caregiverUserId);
  return { error: error ? new Error(error.message) : null };
}
