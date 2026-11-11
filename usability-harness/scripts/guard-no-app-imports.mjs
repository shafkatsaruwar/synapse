#!/usr/bin/env node
/**
 * Fails if vision/agent decision code imports production app modules.
 * Controllers may live alongside but must not leak app source into the agent.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const banned = [
  "synapse-reset/",
  "../synapse-reset",
  "../../synapse-reset",
  "screens/",
  "lib/storage",
  "accessibilityLabel",
  "testID",
];

const checkDirs = ["src/providers", "src/persona.ts", "src/tasks.ts"].map((p) =>
  join(root, p),
);

async function walk(path) {
  const out = [];
  try {
    const entries = await readdir(path, { withFileTypes: true });
    for (const e of entries) {
      const full = join(path, e.name);
      if (e.isDirectory()) out.push(...(await walk(full)));
      else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(full);
    }
  } catch {
    // file path
    out.push(path);
  }
  return out;
}

const files = (await Promise.all(checkDirs.map(walk))).flat();
let failed = false;
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const b of banned) {
    if (text.includes(b)) {
      console.error(`Banned reference "${b}" in ${relative(root, file)}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("Vision/agent code must not read production app source or selectors.");
  process.exit(1);
}
console.log("guard-no-app-imports: ok");
