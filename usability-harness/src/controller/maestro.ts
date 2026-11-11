import { mkdir, writeFile, copyFile, access } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { AgentAction, SessionConfig } from "../types.js";

export interface ControllerResult {
  ok: boolean;
  error?: string;
  screenshotPath?: string;
  usedSelectorFallback: boolean;
}

function run(cmd: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (err) =>
      resolve({ code: 1, stdout, stderr: String(err) }),
    );
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Executes vision-chosen actions on the iOS Simulator via Maestro.
 * May use point taps (preferred) or optional label text from the agent's guess.
 * Must not feed accessibility trees back into the vision agent.
 */
export class MaestroController {
  constructor(
    private readonly config: SessionConfig,
    private readonly workDir: string,
  ) {}

  async ensureReady(): Promise<void> {
    await mkdir(this.workDir, { recursive: true });
    await mkdir(join(this.workDir, "screenshots"), { recursive: true });
    await mkdir(join(this.workDir, "flows"), { recursive: true });

    if (this.config.dryRun) return;

    const bin = process.env.MAESTRO_BIN || "maestro";
    const probe = await run(bin, ["--version"]);
    if (probe.code !== 0) {
      throw new Error(
        `Maestro not available (${bin}). Install on macOS after approval: curl -Ls "https://get.maestro.mobile.dev" | bash`,
      );
    }
  }

  async launchApp(): Promise<void> {
    if (this.config.dryRun) return;
    const flow = join(this.workDir, "flows", "launch.yaml");
    await writeFile(
      flow,
      [
        `appId: ${this.config.appId}`,
        "---",
        "- launchApp:",
        "    clearState: true",
        "    clearKeychain: false",
      ].join("\n") + "\n",
    );
    const bin = process.env.MAESTRO_BIN || "maestro";
    const res = await run(bin, ["test", flow]);
    if (res.code !== 0) {
      throw new Error(`Failed to launch app: ${res.stderr || res.stdout}`);
    }
  }

  async screenshot(name: string): Promise<string> {
    const dest = join(this.workDir, "screenshots", `${name}.png`);
    if (this.config.dryRun) {
      // 1x1 PNG placeholder so the mock provider has a file path.
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      );
      await writeFile(dest, png);
      return dest;
    }

    const bin = process.env.MAESTRO_BIN || "maestro";
    const flow = join(this.workDir, "flows", `shot-${name}.yaml`);
    await writeFile(
      flow,
      [`appId: ${this.config.appId}`, "---", `- takeScreenshot: ${dest}`].join("\n") + "\n",
    );
    const res = await run(bin, ["test", flow]);
    if (res.code !== 0 || !(await exists(dest))) {
      // Fallback: xcrun simctl
      const sim = await run("xcrun", ["simctl", "io", "booted", "screenshot", dest]);
      if (sim.code !== 0) {
        throw new Error(`Screenshot failed: ${res.stderr || sim.stderr}`);
      }
    }
    return dest;
  }

  async execute(action: AgentAction, stepTag: string): Promise<ControllerResult> {
    if (this.config.dryRun) {
      return { ok: true, usedSelectorFallback: false };
    }

    const bin = process.env.MAESTRO_BIN || "maestro";
    const flow = join(this.workDir, "flows", `step-${stepTag}.yaml`);
    const lines = [`appId: ${this.config.appId}`, "---"];

    let usedSelectorFallback = false;

    switch (action.type) {
      case "tap": {
        // Maestro point format: "x%,y%" of screen.
        const xPct = Math.round(action.x * 100);
        const yPct = Math.round(action.y * 100);
        lines.push(`- tapOn:`, `    point: "${xPct}%,${yPct}%"`);
        break;
      }
      case "type_text":
        lines.push(`- inputText: ${JSON.stringify(action.text)}`);
        break;
      case "scroll":
        lines.push(
          `- scroll:`,
          `    direction: ${action.direction === "up" ? "UP" : action.direction === "down" ? "DOWN" : action.direction === "left" ? "LEFT" : "RIGHT"}`,
        );
        break;
      case "back":
        // Prefer visible back; Maestro back is Android-oriented — use swipe/escape heuristics on iOS.
        lines.push(`- back`);
        usedSelectorFallback = true;
        break;
      case "wait":
        lines.push("- waitForAnimationToEnd");
        // Maestro has no arbitrary sleep; animation wait + optional second pass is enough.
        if (action.ms >= 1000) {
          lines.push("- waitForAnimationToEnd");
        }
        break;
      case "done":
      case "give_up":
        return { ok: true, usedSelectorFallback: false };
      default:
        return { ok: false, error: `Unsupported action`, usedSelectorFallback: false };
    }

    await writeFile(flow, lines.join("\n") + "\n");
    const res = await run(bin, ["test", flow]);
    if (res.code !== 0) {
      // Optional controller-only fallback: try label text if the agent guessed one.
      if (action.type === "tap" && action.labelGuess) {
        usedSelectorFallback = true;
        const fallback = join(this.workDir, "flows", `step-${stepTag}-fallback.yaml`);
        await writeFile(
          fallback,
          [
            `appId: ${this.config.appId}`,
            "---",
            `- tapOn: ${JSON.stringify(action.labelGuess)}`,
          ].join("\n") + "\n",
        );
        const fb = await run(bin, ["test", fallback]);
        if (fb.code === 0) {
          return { ok: true, usedSelectorFallback: true };
        }
        return {
          ok: false,
          error: res.stderr || res.stdout || fb.stderr,
          usedSelectorFallback: true,
        };
      }
      return { ok: false, error: res.stderr || res.stdout, usedSelectorFallback };
    }
    return { ok: true, usedSelectorFallback };
  }

  async copyEvidence(src: string, destName: string): Promise<string> {
    const dest = join(this.workDir, "screenshots", destName);
    await copyFile(src, dest);
    return dest;
  }
}
