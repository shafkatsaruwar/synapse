/**
 * Fix Folly/Reanimated build: force New Arch off and set Folly flags so
 * folly/Expected.h does not include the missing folly/coro/Coroutine.h.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs").promises;
const path = require("path");

const ENV_LINE = "ENV['RCT_NEW_ARCH_ENABLED'] = '0' # forced by withPodfileNewArchDisabled\n";

const FOLLY_CORO_FIX = `
  # Fix 'folly/coro/Coroutine.h' file not found (RN/Reanimated + Folly)
  installer.pods_project.build_configurations.each do |config|
    config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(inherited)']
    config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-DFOLLY_CFG_NO_COROUTINES=1' unless config.build_settings['OTHER_CPLUSPLUSFLAGS'].to_s.include?('FOLLY_CFG_NO_COROUTINES')
    config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
  end
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(inherited)']
      config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-DFOLLY_CFG_NO_COROUTINES=1' unless config.build_settings['OTHER_CPLUSPLUSFLAGS'].to_s.include?('FOLLY_CFG_NO_COROUTINES')
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_HAS_COROUTINES=0' unless config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'].to_s.include?('FOLLY_HAS_COROUTINES')
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
`;

function withPodfileNewArchDisabled(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      try {
        let contents = await fs.readFile(podfilePath, "utf8");

        if (!contents.includes("ENV['RCT_NEW_ARCH_ENABLED'] = '0'")) {
          contents = ENV_LINE + contents;
        }

        if (!contents.includes("FOLLY_CFG_NO_COROUTINES=1")) {
          const postInstallMatch = contents.match(/post_install\s+do\s+\|installer\|/);
          if (postInstallMatch) {
            const insertAt = postInstallMatch.index + postInstallMatch[0].length;
            contents = contents.slice(0, insertAt) + FOLLY_CORO_FIX + contents.slice(insertAt);
          } else {
            contents =
              contents.trimEnd() +
              "\n\npost_install do |installer|\n" +
              FOLLY_CORO_FIX.trim() +
              "\nend\n";
          }
        }

        await fs.writeFile(podfilePath, contents);
      } catch (e) {
        console.warn("withPodfileNewArchDisabled: could not modify Podfile", e?.message ?? e);
      }
      return config;
    },
  ]);
}

module.exports = withPodfileNewArchDisabled;
