import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { secureStorage } from "./secure-storage";
import { auditLogger } from "./audit-logger";

const STORAGE_KEY_URL = "supabase_url";
const STORAGE_KEY_ANON = "supabase_anon_key";

let client: SupabaseClient | null = null;
let lastUsedUrl: string | null = null;
let isInitialized = false;

function strFromExtra(key: string): string {
  const legacyManifest = Constants.manifest as { extra?: Record<string, unknown> } | null | undefined;
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    legacyManifest?.extra ??
    (Constants.manifest2?.extra as Record<string, unknown> | undefined);
  if (!extra || typeof extra !== "object") return "";
  const v = extra[key];
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  return s.trim();
}

/** On web, Expo sometimes doesn't inline process.env; try window and __EXPO_CONFIG__ as fallbacks. */
function getExtraForWeb(): Record<string, unknown> | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, unknown>;
  const fromWindow =
    (w.__EXPO_PUBLIC_SUPABASE_URL__ as string | undefined) ? { EXPO_PUBLIC_SUPABASE_URL: w.__EXPO_PUBLIC_SUPABASE_URL__, EXPO_PUBLIC_SUPABASE_ANON_KEY: w.__EXPO_PUBLIC_SUPABASE_ANON_KEY__ } : undefined;
  if (fromWindow && (fromWindow.EXPO_PUBLIC_SUPABASE_URL || fromWindow.EXPO_PUBLIC_SUPABASE_ANON_KEY)) return fromWindow;
  const expoConfig = w.__EXPO_CONFIG__ as { extra?: Record<string, unknown> } | undefined;
  if (expoConfig?.extra && typeof expoConfig.extra === "object") return expoConfig.extra;
  const expo = w.expo as { config?: { extra?: Record<string, unknown> } } | undefined;
  return expo?.config?.extra;
}

/** Primary: EXPO_PUBLIC_* from .env; fallback to Expo extra / stored config. */
function getEnv(): { url: string; anonKey: string } | null {
  const legacyManifest = Constants.manifest as { extra?: Record<string, unknown> } | null | undefined;
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    legacyManifest?.extra ??
    (Constants.manifest2?.extra as Record<string, unknown> | undefined);
  const fromExtra = (key: string) =>
    (extra && typeof extra[key] === "string" ? (extra[key] as string).trim() : "") || strFromExtra(key) || process.env[key]?.trim() || "";
  let url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || fromExtra("EXPO_PUBLIC_SUPABASE_URL") || fromExtra("supabaseUrl") || "";
  let anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || fromExtra("EXPO_PUBLIC_SUPABASE_ANON_KEY") || fromExtra("supabaseAnonKey") || "";
  if ((!url || !anonKey) && typeof window !== "undefined") {
    const webExtra = getExtraForWeb();
    if (webExtra) {
      const u = webExtra.EXPO_PUBLIC_SUPABASE_URL ?? (webExtra as Record<string, unknown>).supabaseUrl;
      const k = webExtra.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (webExtra as Record<string, unknown>).supabaseAnonKey;
      url = url || (typeof u === "string" ? u.trim() : "");
      anonKey = anonKey || (typeof k === "string" ? k.trim() : "");
    }
  }
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function isValidSupabaseUrl(url: string): boolean {
  const u = url.trim();
  return u.startsWith("https://") && u.includes(".supabase.co") && u.length > 20;
}

const supabaseStorage = {
  getItem: async (key: string) => AsyncStorage.getItem(key),
  setItem: async (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: async (key: string) => AsyncStorage.removeItem(key),
};

const FETCH_TIMEOUT_MS = 30000;

function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const isAuthRequest = typeof input === "string" ? input.includes("/auth/") : input instanceof URL ? input.href.includes("/auth/") : false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(input, {
    ...init,
    signal: init?.signal ?? controller.signal,
  })
    .then((res) => {
      clearTimeout(timeoutId);
      if (!res.ok && isAuthRequest) {
        auditLogger.log("AUTH", "user", "failure", {
          errorMessage: `Auth failed with status ${res.status}`,
        });
      }
      return res;
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      auditLogger.log("ERROR", "user", "failure", {
        errorMessage: err?.message ? err.message.substring(0, 100) : "Unknown error",
      }).catch(() => {});
      throw err;
    });
}

function setClientFromEnv(env: { url: string; anonKey: string }): void {
  if (!isValidSupabaseUrl(env.url)) {
    console.warn("Supabase URL invalid or missing, skipping client creation");
    client = null;
    lastUsedUrl = null;
    return;
  }
  try {
    lastUsedUrl = env.url;
    client = createClient(env.url, env.anonKey, {
      global: { fetch: supabaseFetch },
      auth: {
        storage: supabaseStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === "web",
      },
    });
  } catch (e) {
    console.error("Supabase initialization error", e);
    client = null;
    lastUsedUrl = null;
  }
}

/** URL the current Supabase client was created with (for logging). */
export function getSupabaseUrl(): string | null {
  return lastUsedUrl;
}

/**
 * Call once at app startup (e.g. in AuthProvider). Loads Supabase URL/anon key from
 * secure storage first; if missing, uses env/extra. Initializes the client so getSupabase() works.
 */
export async function initSupabaseFromStorage(): Promise<void> {
  if (isInitialized) return;

  const env = getEnv();
  if (env) {
    if (client === null || lastUsedUrl !== env.url) {
      setClientFromEnv(env);
    }
    try {
      await Promise.all([
        secureStorage.setItem(STORAGE_KEY_URL, env.url),
        secureStorage.setItem(STORAGE_KEY_ANON, env.anonKey),
      ]);
    } catch (e) {
      console.warn("Supabase secure storage write failed");
    }
    isInitialized = true;
    return;
  }

  try {
    const [storedUrl, storedKey] = await Promise.all([
      secureStorage.getItem(STORAGE_KEY_URL),
      secureStorage.getItem(STORAGE_KEY_ANON),
    ]);
    const url = storedUrl?.trim();
    const anonKey = storedKey?.trim();
    if (url && anonKey && isValidSupabaseUrl(url)) {
      setClientFromEnv({ url, anonKey });
      isInitialized = true;
      return;
    }
  } catch (e) {
    console.warn("Supabase secure storage read failed");
  }

  console.warn("Supabase env missing: set in EAS or use in-app config.");
  isInitialized = true;
}

/**
 * Save Supabase URL and anon key in the app (e.g. from Auth screen). Uses secure storage.
 * Call after user enters URL and key.
 */
export async function setSupabaseConfig(url: string, anonKey: string): Promise<void> {
  const u = url?.trim();
  const k = anonKey?.trim();
  if (!u || !k) return;

  if (!isValidSupabaseUrl(u)) {
    throw new Error("Invalid Supabase URL format");
  }

  try {
    await secureStorage.setItem(STORAGE_KEY_URL, u);
    await secureStorage.setItem(STORAGE_KEY_ANON, k);
    setClientFromEnv({ url: u, anonKey: k });
    await auditLogger.log("AUTH", "user", "success", {
      details: "Supabase config updated",
    });
  } catch (error) {
    await auditLogger.log("AUTH", "user", "failure", {
      errorMessage: "Failed to save Supabase config",
    });
    throw error;
  }
}

/**
 * Lazy-initialized Supabase client. Returns null if not configured (env/extra or in-app config).
 * Ensure initSupabaseFromStorage() has run at startup before relying on this.
 */
export function getSupabase(): SupabaseClient | null {
  const env = getEnv();
  if (env && (client === null || lastUsedUrl !== env.url)) {
    setClientFromEnv(env);
  }
  return client;
}
