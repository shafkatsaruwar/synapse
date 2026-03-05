/**
 * Expo app config (single source of truth).
 *
 * Production (EAS Build): set in EAS project environment variables or .env when running `eas build`:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
module.exports = {
  expo: {
    name: "Synapse",
    slug: "synapse",
    version: "1.7",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/icon.png",
      resizeMode: "contain",
      backgroundColor: "#FDF1E5",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.mohammedsaruwar.synapse",
      buildNumber: "5",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.myapp",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
    },
    web: {
      favicon: "./assets/images/favicon.png",
      output: "static",
    },
    plugins: [
      "./plugins/withXcodeFix",
      "./plugins/withPodfileNewArchDisabled",
      ["expo-router", { origin: "https://replit.com/" }],
      "expo-font",
      "expo-web-browser",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: { origin: "https://replit.com/" },
      eas: { projectId: "2ae7d5f4-1514-408d-b1ec-250da7c8ccfa" },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    },
    owner: "mohammedsaruwars-organization",
  },
};
