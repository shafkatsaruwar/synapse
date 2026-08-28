import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getBackupJsonPath,
  getOwnerAccessToken,
  getOwnerUserId,
  getServiceRoleKey,
  getSupabaseAnonKey,
  getSupabaseUrl,
  type AuthSuccess,
} from "./auth";
import { mcpLog } from "./logging";
import { snapshotFromUnknown } from "./sanitize";
import { EMPTY_SNAPSHOT, type HealthSnapshot, type JsonRecord } from "./types";

function rowToAppointment(row: JsonRecord): JsonRecord {
  return {
    id: row.id,
    doctor_id: row.doctor_id,
    doctorName: row.doctor_name ?? row.doctorName,
    specialty: row.specialty ?? "",
    date: row.date,
    time: row.time ?? "09:00",
    location: row.location ?? "",
    notes: row.notes ?? "",
    is_recurring: row.is_recurring ?? false,
    status: row.status,
  };
}

async function fetchAppointments(client: SupabaseClient, userId: string): Promise<JsonRecord[]> {
  const { data, error } = await client
    .from("appointments")
    .select("id, doctor_id, doctor_name, specialty, date, time, location, notes, is_recurring, status")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => rowToAppointment(row as JsonRecord));
}

async function loadBackupWithClient(
  client: SupabaseClient,
  userId: string,
  sourceLabel: HealthSnapshot["source"]
): Promise<HealthSnapshot> {
  const { data, error } = await client
    .from("user_backups")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    mcpLog("backup lookup failed");
    throw new Error("Unable to load owner backup");
  }

  const appointments = await fetchAppointments(client, userId);
  if (!data?.data) {
    const empty = { ...EMPTY_SNAPSHOT, source: sourceLabel, ownerUserId: userId, appointments };
    return empty;
  }

  const snapshot = snapshotFromUnknown(data.data, {
    source: sourceLabel,
    ownerUserId: userId,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
  });
  if ((snapshot.appointments?.length ?? 0) === 0 && appointments.length > 0) {
    snapshot.appointments = appointments;
  }
  return snapshot;
}

function userScopedClient(accessToken: string): SupabaseClient {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) {
    throw new Error("Supabase is not configured");
  }
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function verifyJwtUser(accessToken: string): Promise<string> {
  const client = userScopedClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return data.user.id;
}

async function loadFromServiceRole(ownerUserId: string): Promise<HealthSnapshot> {
  const url = getSupabaseUrl();
  const serviceKey = getServiceRoleKey();
  if (!url || !serviceKey) {
    throw new Error("Service role is not configured");
  }
  if (!ownerUserId) {
    throw new Error("SYNAPSE_OWNER_USER_ID is required when using the service role");
  }
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return loadBackupWithClient(client, ownerUserId, "supabase_backup");
}

async function loadFromOwnerJwt(accessToken: string): Promise<HealthSnapshot> {
  const userId = await verifyJwtUser(accessToken);
  const owner = getOwnerUserId();
  if (owner && owner !== userId) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  const client = userScopedClient(accessToken);
  return loadBackupWithClient(client, userId, "supabase_backup");
}

export async function loadFromBackupFile(filePath: string): Promise<HealthSnapshot> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return snapshotFromUnknown(parsed, { source: "local_json", updatedAt: new Date().toISOString() });
}

export async function loadOwnerSnapshot(auth: AuthSuccess): Promise<HealthSnapshot> {
  const filePath = getBackupJsonPath();

  if (auth.method === "supabase_jwt") {
    const token = auth.accessToken;
    if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    return loadFromOwnerJwt(token);
  }

  // Personal MCP token: owner-only data sources, in order.
  if (filePath) {
    return loadFromBackupFile(filePath);
  }

  const ownerJwt = getOwnerAccessToken();
  if (ownerJwt) {
    return loadFromOwnerJwt(ownerJwt);
  }

  const ownerId = getOwnerUserId();
  if (getServiceRoleKey() && ownerId) {
    return loadFromServiceRole(ownerId);
  }

  throw new Error(
    "No owner data source configured. Set SYNAPSE_BACKUP_JSON, or SYNAPSE_OWNER_ACCESS_TOKEN, or SUPABASE_SERVICE_ROLE_KEY plus SYNAPSE_OWNER_USER_ID."
  );
}
