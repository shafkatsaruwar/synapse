/**
 * Increments the iOS buildNumber in app.config.js by 1.
 * Used by the pre-commit hook so each commit gets a new build number.
 * Run from repo root: node synapse-reset/scripts/bump-build.js
 * Or from synapse-reset: node scripts/bump-build.js
 */
const path = require("path");
const fs = require("fs");

const appConfigPath = path.join(__dirname, "..", "app.config.js");
let content = fs.readFileSync(appConfigPath, "utf8");

const match = content.match(/buildNumber:\s*"(\d+)"/);
if (!match) {
  console.warn("bump-build: buildNumber not found in app.config.js");
  process.exit(0);
  return;
}

const current = parseInt(match[1], 10);
const next = current + 1;
content = content.replace(/buildNumber:\s*"\d+"/, `buildNumber: "${next}"`);
fs.writeFileSync(appConfigPath, content, "utf8");
console.log(`bump-build: iOS buildNumber ${current} → ${next}`);
