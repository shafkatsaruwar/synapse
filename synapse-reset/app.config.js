/**
 * Minimal Synapse reset app — same bundle ID / name for TestFlight replacement.
 * Version = batch: 1.8.0–1.8.5; 1.8.6 = full migration (all screens, no Reanimated). See MIGRATION.md.
 * Loads .env so EXPO_PUBLIC_* are available (local dev or EAS if .env is committed).
 */
const path = require("path");
const dotenv = require("dotenv");
// Try synapse-reset/.env first, then repo root .env (for EAS when cwd may vary)
dotenv.config({ path: path.join(__dirname, ".env") });
if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
}
// Optional: load app URL and API URL for redirects and backend
if (!process.env.EXPO_PUBLIC_APP_URL || !process.env.EXPO_PUBLIC_API_URL) {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
}

module.exports = {
  expo: {
    name: "Synapse",
    slug: "synapse",
    version: "1.9.5",
    orientation: "default",
    icon: "./assets/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FDF1E5",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mohammedsaruwar.synapse",
      buildNumber: "4",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSExceptionDomains: {
            "supabase.co": {
              NSIncludesSubdomains: true,
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSExceptionRequiresForwardSecrecy: false,
            },
            localhost: {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
            "127.0.0.1": {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        },
      },
    },
    android: {
      package: "com.mohammedsaruwar.synapse",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
    },
    web: { favicon: "./assets/favicon.png" },
    plugins: [
      "expo-router",
    ],
    experiments: { typedRoutes: true },
    extra: {
      eas: { projectId: "2ae7d5f4-1514-408d-b1ec-250da7c8ccfa" },
      // Hardcoded Supabase project config so EAS/TestFlight builds always have a URL/anon key,
      // even if .env is missing at build time.
      supabaseUrl: "https://rzorszhxnavzrgramzja.supabase.co",
      supabaseAnonKey:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6b3Jzemh4bmF2enJncmFtemphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDU2MTAsImV4cCI6MjA4NzYyMTYxMH0.eKrR7ND2DcbrHEfRAanTWvvEUm8Zn9W-x-OQ8yav4GE",
      apiUrl: (process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_APP_URL || "https://synapse-health.vercel.app").replace(/\/$/, ""),
      EXPO_PUBLIC_SUPABASE_URL: "https://rzorszhxnavzrgramzja.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6b3Jzemh4bmF2enJncmFtemphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDU2MTAsImV4cCI6MjA4NzYyMTYxMH0.eKrR7ND2DcbrHEfRAanTWvvEUm8Zn9W-x-OQ8yav4GE",
      EXPO_PUBLIC_APP_URL: (process.env.EXPO_PUBLIC_APP_URL ?? "https://synapse-health.vercel.app").replace(/\/$/, ""),
      EXPO_PUBLIC_API_URL: (process.env.EXPO_PUBLIC_API_URL ?? "https://synapse-health.vercel.app").replace(/\/$/, ""),
      EXPO_PUBLIC_DOMAIN: process.env.EXPO_PUBLIC_DOMAIN ?? "",
    },
    // Env from .env or EAS is baked into extra above; production fallback for apiUrl so native builds never use localhost.
    owner: "mohammedsaruwars-organization",
  },
};
