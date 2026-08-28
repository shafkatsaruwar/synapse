import { timingSafeEqual } from "node:crypto";
import { mcpLog } from "./logging";

export type AuthMethod = "mcp_token" | "supabase_jwt";

export interface AuthSuccess {
  ok: true;
  method: AuthMethod;
  userId?: string;
  accessToken?: string;
}

export interface AuthFailure {
  ok: false;
  status: 401 | 503;
  error: string;
}

export type AuthResult = AuthSuccess | AuthFailure;

function readEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

export function getConfiguredMcpToken(): string {
  return readEnv("SYNAPSE_MCP_TOKEN");
}

export function getSupabaseUrl(): string {
  return readEnv("SYNAPSE_SUPABASE_URL") || readEnv("SUPABASE_URL") || readEnv("EXPO_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return (
    readEnv("SYNAPSE_SUPABASE_ANON_KEY") ||
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function getServiceRoleKey(): string {
  return readEnv("SUPABASE_SERVICE_ROLE_KEY") || readEnv("SYNAPSE_SUPABASE_SERVICE_ROLE_KEY");
}

export function getOwnerUserId(): string {
  return readEnv("SYNAPSE_OWNER_USER_ID");
}

export function getOwnerAccessToken(): string {
  return readEnv("SYNAPSE_OWNER_ACCESS_TOKEN") || readEnv("SYNAPSE_ACCESS_TOKEN");
}

export function getBackupJsonPath(): string {
  return readEnv("SYNAPSE_BACKUP_JSON");
}

export function isAuthConfigured(): boolean {
  if (getConfiguredMcpToken()) return true;
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function extractBearerToken(headers: Record<string, unknown> | undefined): string {
  if (!headers) return "";
  const lower: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    lower[key.toLowerCase()] = value;
  }
  const rawHeader = lower["authorization"] ?? lower["x-synapse-mcp-token"] ?? lower["x-api-key"];
  const raw = Array.isArray(rawHeader) ? String(rawHeader[0] ?? "") : String(rawHeader ?? "");
  return raw.replace(/^Bearer\s+/i, "").trim();
}

/**
 * Fail closed: no token, no data.
 * Prefer a long-lived SYNAPSE_MCP_TOKEN for Cursor connectors.
 * A Supabase user JWT is also accepted so the owner can read only their own backup.
 */
export function authenticateRequest(providedToken: string): AuthResult {
  const token = providedToken.trim();
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const mcpToken = getConfiguredMcpToken();
  if (mcpToken && safeEqual(token, mcpToken)) {
    return { ok: true, method: "mcp_token" };
  }

  const looksLikeJwt = token.split(".").length === 3;
  if (looksLikeJwt && getSupabaseUrl() && getSupabaseAnonKey()) {
    return { ok: true, method: "supabase_jwt", accessToken: token };
  }

  if (mcpToken || looksLikeJwt) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  mcpLog("auth not configured");
  return {
    ok: false,
    status: 503,
    error: "MCP authentication is not configured. Set SYNAPSE_MCP_TOKEN or Supabase URL/anon key.",
  };
}

export async function authenticateRequestAsync(providedToken: string): Promise<AuthResult> {
  const basic = authenticateRequest(providedToken);
  if (!basic.ok) return basic;
  if (basic.method === "mcp_token") return basic;
  const token = basic.accessToken;
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = getSupabaseUrl();
    const anon = getSupabaseAnonKey();
    if (!url || !anon) {
      return { ok: false, status: 503, error: "Supabase is not configured" };
    }
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.id) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    const owner = getOwnerUserId();
    if (owner && owner !== data.user.id) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    return { ...basic, userId: data.user.id };
  } catch {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
}

export function authenticateStdioEnv(): AuthResult {
  const mcpToken = getConfiguredMcpToken();
  const jwt = getOwnerAccessToken();
  if (mcpToken) {
    return { ok: true, method: "mcp_token" };
  }
  if (jwt && getSupabaseUrl() && getSupabaseAnonKey()) {
    return { ok: true, method: "supabase_jwt", accessToken: jwt };
  }
  if (getBackupJsonPath() && !mcpToken) {
    return {
      ok: false,
      status: 503,
      error: "Local JSON mode requires SYNAPSE_MCP_TOKEN so the export is never served unauthenticated.",
    };
  }
  return {
    ok: false,
    status: 503,
    error: "Set SYNAPSE_MCP_TOKEN, or SYNAPSE_ACCESS_TOKEN plus Supabase URL/anon key.",
  };
}
