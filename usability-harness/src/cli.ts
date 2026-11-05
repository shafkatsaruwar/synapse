#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { ALL_TASK_IDS } from "./tasks.js";
import { runSession } from "./runner.js";
import { renderReport } from "./report/markdown.js";
import type { SessionConfig, SessionResult, TaskId } from "./types.js";

function usage(): never {
  console.log(`Synapse usability harness (separate from production app)

Usage:
  npx tsx src/cli.ts run [options]
  npx tsx src/cli.ts report --from <session.json>
  npx tsx src/cli.ts tasks

Options for run:
  --dry-run              No simulator, no paid APIs (mock vision)
  --provider <name>      openai | anthropic | gemini | mock | bridge (default: mock)
  --model <id>           Provider model override
  --device <name>        Simulator device name
  --app-id <id>          iOS bundle id (default: com.mohammedsaruwar.synapse)
  --out <dir>            Output directory (default: ./reports)
  --tasks <ids>          Comma-separated task ids (default: all)
  --max-steps <n>        Cap steps per task (default: 40)

Safety (default ON / denied):
  Purchases, real notifications, messaging, and real accounts are blocked.
  Set USABILITY_ALLOW_*=true only for explicitly approved sandbox tests.

IMPORTANT: Ask before installing dependencies or calling paid vision APIs.
`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function envFlag(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

async function cmdRun(argv: string[]) {
  const args = parseArgs(argv);
  const dryRun = Boolean(args.dryRun) || process.env.USABILITY_DRY_RUN === "1";
  const provider = String(
    args.provider ?? process.env.USABILITY_VISION_PROVIDER ?? "mock",
  ) as SessionConfig["visionProvider"];

  if (!dryRun && provider !== "mock" && provider !== "bridge") {
    console.error(
      [
        "",
        "Paid / external vision API requested.",
        "This harness will call the selected provider with screenshots.",
        "Re-run only after explicit approval to use that API and after keys are configured.",
        "For a no-cost pass:  npx tsx src/cli.ts run --dry-run",
        "Or use --provider bridge with a parent agent fulfilling ./reports/bridge/*.response.json",
        "",
      ].join("\n"),
    );
    if (process.env.USABILITY_API_APPROVED !== "1") {
      console.error("Refusing to call paid APIs (set USABILITY_API_APPROVED=1 after approval).");
      process.exit(2);
    }
  }

  const taskList = args.tasks
    ? String(args.tasks)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ALL_TASK_IDS;

  for (const id of taskList) {
    if (!ALL_TASK_IDS.includes(id as TaskId)) {
      console.error(`Unknown task id: ${id}`);
      console.error(`Known: ${ALL_TASK_IDS.join(", ")}`);
      process.exit(1);
    }
  }

  const config: SessionConfig = {
    dryRun,
    appId: String(
      args["app-id"] ?? process.env.USABILITY_APP_ID ?? "com.mohammedsaruwar.synapse",
    ),
    deviceName: String(args.device ?? process.env.USABILITY_DEVICE ?? "iPhone 16"),
    outputDir: resolve(String(args.out ?? process.env.USABILITY_OUTPUT_DIR ?? "./reports")),
    visionProvider: dryRun ? "mock" : provider,
    visionModel: args.model ? String(args.model) : process.env.USABILITY_VISION_MODEL,
    maxStepsPerTask: Number(args["max-steps"] ?? 40),
    allowPurchases: envFlag("USABILITY_ALLOW_PURCHASES", false),
    allowNotifications: envFlag("USABILITY_ALLOW_NOTIFICATIONS", false),
    allowMessages: envFlag("USABILITY_ALLOW_MESSAGES", false),
    allowRealAccounts: envFlag("USABILITY_ALLOW_REAL_ACCOUNTS", false),
    tasks: taskList as TaskId[],
  };

  await mkdir(config.outputDir, { recursive: true });
  const result = await runSession(config);
  console.log(`Completed ${result.tasks.length} tasks. Findings: ${result.findings.length}`);
}

async function cmdReport(argv: string[]) {
  const args = parseArgs(argv);
  const from = args.from ? String(args.from) : "";
  if (!from) usage();
  const raw = await readFile(resolve(from), "utf8");
  const session = JSON.parse(raw) as SessionResult;
  const md = renderReport(session);
  const out = args.out ? resolve(String(args.out)) : resolve(from.replace(/\.json$/i, ".md"));
  await writeFile(out, md);
  console.log(`Wrote ${out}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "-h" || cmd === "--help") usage();
  if (cmd === "tasks") {
    for (const id of ALL_TASK_IDS) console.log(id);
    return;
  }
  if (cmd === "run") return cmdRun(rest);
  if (cmd === "report") return cmdReport(rest);
  usage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
