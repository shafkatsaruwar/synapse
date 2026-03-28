const { withEntitlementsPlist } = require("expo/config-plugins");

function withScreenTimeCapabilities(config) {
  return withEntitlementsPlist(config, (config) => {
    config.modResults["com.apple.developer.family-controls"] = true;
    return config;
  });
}

module.exports = withScreenTimeCapabilities;
