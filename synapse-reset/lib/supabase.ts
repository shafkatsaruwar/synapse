import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setupURLPolyfill } from "react-native-url-polyfill";

// Install URL polyfill without touching fetch, then capture the native fetch.
setupURLPolyfill();
const nativeFetch = global.fetch.bind(global);

const STORAGE_KEY_URL = "supabase_url";
const STORAGE_KEY_ANON = "supabase_anon_key";

let client: SupabaseClient | null = null;
let lastUsedUrl: string | null = null;

const TEST_SUPABASE_URL = "https://rzorszxknavzrgramzja.supabase.co/rest/v1/";

/** Temporary network test: confirm the device can reach Supabase (outside auth flow). Call once at app start. */
export async function testSupabaseConnection(): Promise<void> {
  console.log("SUPABASE TEST URL:", TEST_SUPABASE_URL);
  try {
    const res = await nativeFetch(TEST_SUPABASE_URL);
    console.log("SUPABASE STATUS:", res.status);
    const text = await res.text();
    console.log("SUPABASE RESPONSE:", text);
  } catch (e) {
    console.error("SUPABASE FETCH ERROR:", e);
  }
}

function strFromExtra(key: string): string {
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    (Constants.manifest?.extra as Record<string, unknown> | undefined) ??
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

/** Primary: Constants.expoConfig.extra.supabaseUrl / supabaseAnonKey; fallback: EXPO_PUBLIC_* and process.env. */
function getEnv(): { url: string; anonKey: string } | null {
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    (Constants.manifest?.extra as Record<string, unknown> | undefined) ??
    (Constants.manifest2?.extra as Record<string, unknown> | undefined);
  const fromExtra = (key: string) =>
    (extra && typeof extra[key] === "string" ? (extra[key] as string).trim() : "") || strFromExtra(key) || process.env[key]?.trim() || "";
  let url = fromExtra("supabaseUrl") || fromExtra("EXPO_PUBLIC_SUPABASE_URL") || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || "";
  let anonKey = fromExtra("supabaseAnonKey") || fromExtra("EXPO_PUBLIC_SUPABASE_ANON_KEY") || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if ((!url || !anonKey) && typeof window !== "undefined") {
    const webExtra = getExtraForWeb();
    if (webExtra) {
      const u = webExtra.EXPO_PUBLIC_SUPABASE_URL ?? (webExtra as Record<string, unknown>).supabaseUrl;
      const k = webExtra.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (webExtra as Record<string, unknown>).supabaseAnonKey;
      url = url || (typeof u === "string" ? u.trim() : "");
      anonKey = anonKey || (typeof k === "string" ? k.trim() : "");
    }
  }
  console.log("SUPABASE URL FROM EXTRA:", strFromExtra("EXPO_PUBLIC_SUPABASE_URL"));
  console.log("SUPABASE KEY FROM EXTRA:", strFromExtra("EXPO_PUBLIC_SUPABASE_ANON_KEY"));
  console.log("SUPABASE URL FROM PROCESS ENV:", process.env.EXPO_PUBLIC_SUPABASE_URL);
  console.log("SUPABASE KEY FROM PROCESS ENV:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
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
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return nativeFetch(input, {
    ...init,
    signal: init?.signal ?? controller.signal,
  })
    .then((res) => {
      clearTimeout(timeoutId);
      if (!res.ok && url.includes("/auth/")) {
        console.warn("Supabase auth request failed:", res.status, url);
      }
      return res;
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      console.warn("Supabase fetch error:", err?.message ?? err, url);
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
 * AsyncStorage first; if missing, uses env/extra. Initializes the client so getSupabase() works.
 */
export async function initSupabaseFromStorage(): Promise<void> {
  if (client !== null) {
    console.log("Supabase client already initialized; skipping initSupabaseFromStorage");
    return;
  }
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const fromExtra = strFromExtra("EXPO_PUBLIC_SUPABASE_URL");
  console.log("Supabase init: process.env URL:", fromEnv ? `${fromEnv.slice(0, 30)}...` : "(missing)");
  console.log("Supabase init: extra URL:", fromExtra ? `${fromExtra.slice(0, 30)}...` : "(missing)");
  try {
    const [storedUrl, storedKey] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_URL),
      AsyncStorage.getItem(STORAGE_KEY_ANON),
    ]);
    const url = storedUrl?.trim();
    const anonKey = storedKey?.trim();
    if (url && anonKey) {
      setClientFromEnv({ url, anonKey });
      return;
    }
  } catch (e) {
    console.warn("Supabase storage read failed", e);
  }
  const env = getEnv();
  if (env) {
    console.log("SUPABASE URL FROM ENV:", env?.url);
    console.log("SUPABASE KEY PRESENT:", !!env?.anonKey);
    setClientFromEnv(env);
  }
  else console.warn("Supabase env missing: set in EAS or use in-app config.");
}

/**
 * Save Supabase URL and anon key in the app (e.g. from Auth screen). Lets users sign in
 * without rebuilding. Call after user enters URL and key.
 */
export async function setSupabaseConfig(url: string, anonKey: string): Promise<void> {
  const u = url?.trim();
  const k = anonKey?.trim();
  if (!u || !k) return;
  await AsyncStorage.setItem(STORAGE_KEY_URL, u);
  await AsyncStorage.setItem(STORAGE_KEY_ANON, k);
  setClientFromEnv({ url: u, anonKey: k });
}

/**
 * Lazy-initialized Supabase client. Returns null if not configured (env/extra or in-app config).
 * Ensure initSupabaseFromStorage() has run at startup before relying on this.
 */
export function getSupabase(): SupabaseClient | null {
  return client;
}
