import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getEnv(): { url: string; anonKey: string } | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

/**
 * Lazy-initialized Supabase client. Returns null if env vars are missing (no throw).
 * Ensures no module-level createClient() runs at import time.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== null) {
    return client;
  }
  const env = getEnv();
  if (!env) {
    console.warn("Supabase env missing: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY not set");
    return null;
  }
  try {
    client = createClient(env.url, env.anonKey);
    return client;
  } catch (e) {
    console.error("Supabase initialization error", e);
    return null;
  }
}
