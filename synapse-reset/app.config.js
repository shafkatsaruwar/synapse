/**
 * Minimal Synapse reset app — same bundle ID / name for TestFlight replacement.
 * Add plugins and deps back incrementally; see MIGRATION.md.
 */
module.exports = {
  expo: {
    name: "Synapse",
    slug: "synapse",
    version: "1.8",
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
      // No custom native plugins — use Expo defaults to avoid EAS "Install dependencies" failure
      "expo-router",
    ],
    experiments: { typedRoutes: true },
    extra: {
      eas: { projectId: "2ae7d5f4-1514-408d-b1ec-250da7c8ccfa" },
    },
    owner: "mohammedsaruwars-organization",
  },
};
