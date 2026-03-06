/**
 * Minimal Synapse reset app — same bundle ID / name for TestFlight replacement.
 * Version = batch: 1.8.0–1.8.5; 1.8.6 = full migration (all screens, no Reanimated). See MIGRATION.md.
 * Loads .env from this directory so EXPO_PUBLIC_* are available (local dev or EAS if .env is in repo).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

module.exports = {
  expo: {
    name: "Synapse",
    slug: "synapse",
    version: "1.8.6",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FDF1E5",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.mohammedsaruwar.synapse",
      buildNumber: "1",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.myapp",
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
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    },
    // Env from .env or EAS is baked into extra above; Metro inlines EXPO_PUBLIC_* at bundle time.
    owner: "mohammedsaruwars-organization",
  },
};
