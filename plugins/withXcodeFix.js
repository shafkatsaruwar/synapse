/**
 * Expo config plugin: Xcode 17 / iOS 26 compatibility.
 * Sets SWIFT_ENABLE_EXPLICIT_MODULES = "NO" in all iOS build configurations
 * to avoid SIGABRT on physical devices.
 */
const { withXcodeProject } = require("expo/config-plugins");

function withXcodeFix(config) {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      if (key.startsWith("__")) continue; // comment keys
      const configuration = configurations[key];
      if (configuration?.buildSettings) {
        configuration.buildSettings.SWIFT_ENABLE_EXPLICIT_MODULES = "NO";
      }
    }
    return config;
  });
}

module.exports = withXcodeFix;
