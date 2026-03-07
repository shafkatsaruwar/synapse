/**
 * Web only: copy Supabase config from Expo config to window so getEnv() in supabase.ts
 * can read it even when process.env.EXPO_PUBLIC_* is not inlined (known Expo web issue).
 * Import this first in _layout so it runs before AuthProvider/supabase.
 * Wrapped in try/catch so a missing Constants or extra never causes a white screen.
 */
import Constants from "expo-constants";

try {
  if (typeof window !== "undefined") {
    const extra = Constants?.expoConfig?.extra as Record<string, unknown> | undefined;
    if (extra && typeof extra === "object") {
      const url = extra.EXPO_PUBLIC_SUPABASE_URL;
      const anon = extra.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (url != null || anon != null) {
        (window as unknown as Record<string, unknown>).__EXPO_PUBLIC_SUPABASE_URL__ =
          typeof url === "string" ? url : String(url ?? "");
        (window as unknown as Record<string, unknown>).__EXPO_PUBLIC_SUPABASE_ANON_KEY__ =
          typeof anon === "string" ? anon : String(anon ?? "");
      }
    }
  }
} catch (_) {
  // Avoid breaking app load on web (e.g. production build or missing Constants)
}
