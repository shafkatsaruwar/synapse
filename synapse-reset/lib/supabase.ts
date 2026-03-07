import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY_URL = "supabase_url";
const STORAGE_KEY_ANON = "supabase_anon_key";

let client: SupabaseClient | null = null;

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

/** Prefer baked-in extra (from app.config.js + .env at build time), then process.env. */
function getEnv(): { url: string; anonKey: string } | null {
  const url =
    strFromExtra("EXPO_PUBLIC_SUPABASE_URL") ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const anonKey =
    strFromExtra("EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

function setClientFromEnv(env: { url: string; anonKey: string }): void {
  try {
    client = createClient(env.url, env.anonKey);
  } catch (e) {
    console.error("Supabase initialization error", e);
    client = null;
  }
}

/**
 * Call once at app startup (e.g. in AuthProvider). Loads Supabase URL/anon key from
 * AsyncStorage first; if missing, uses env/extra. Initializes the client so getSupabase() works.
 */
export async function initSupabaseFromStorage(): Promise<void> {
  if (client !== null) return;
  console.log("Supabase ENV URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
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
  if (env) setClientFromEnv(env);
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
