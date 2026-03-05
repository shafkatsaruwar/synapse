/**
 * Expo config plugin: Xcode 17 / iOS 26 compatibility.
 * Sets SWIFT_ENABLE_EXPLICIT_MODULES = "NO" in all iOS build configurations
 * to avoid SIGABRT on physical devices.
 */
const { withXcodeProject } = require("expo/config-plugins");

function withXcodeFix(config) {
  return withXcodeProject(config, async (config) => {
    try {
      const project = config.modResults;
      if (!project || typeof project.pbxXCBuildConfigurationSection !== "function") {
        return config;
      }
      const configurations = project.pbxXCBuildConfigurationSection();
      if (!configurations || typeof configurations !== "object") return config;
      for (const key of Object.keys(configurations)) {
        if (key.startsWith("__")) continue;
        const configuration = configurations[key];
        if (configuration?.buildSettings) {
          configuration.buildSettings.SWIFT_ENABLE_EXPLICIT_MODULES = "NO";
        }
      }
    } catch (e) {
      console.warn("withXcodeFix: skipped (non-fatal)", e?.message ?? e);
    }
    return config;
  });
}

module.exports = withXcodeFix;
