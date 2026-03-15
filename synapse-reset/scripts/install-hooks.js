/**
 * Installs the pre-commit hook from scripts/git-hooks/pre-commit.
 * Build number is set manually in app.config.js — no auto-increment.
 * Run: npm run install-hooks (or node scripts/install-hooks.js from synapse-reset).
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const scriptDir = __dirname;
const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const hooksDir = path.join(repoRoot, ".git", "hooks");
const hookPath = path.join(hooksDir, "pre-commit");
const sourcePath = path.join(scriptDir, "git-hooks", "pre-commit");

if (!fs.existsSync(path.join(repoRoot, ".git"))) {
  console.error("install-hooks: .git not found. Run from inside the repo.");
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error("install-hooks: git-hooks/pre-commit not found.");
  process.exit(1);
}

fs.mkdirSync(hooksDir, { recursive: true });
fs.copyFileSync(sourcePath, hookPath);
fs.chmodSync(hookPath, 0o755);
console.log("install-hooks: pre-commit hook installed at", hookPath);
