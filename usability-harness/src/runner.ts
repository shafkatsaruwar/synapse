import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { MaestroController } from "./controller/maestro.js";
import {
  finishTaskMetrics,
  recordAction,
  recordFailure,
  startTaskMetrics,
} from "./metrics/session.js";
import { createVisionProvider } from "./providers/vision.js";
import { deriveFindings, renderReport } from "./report/markdown.js";
import { reviewAction, SAFETY_BANNER } from "./safety/guards.js";
import { getTask } from "./tasks.js";
import type {
  CompletionStatus,
  SessionConfig,
  SessionResult,
  TaskMetrics,
} from "./types.js";

const DISCLAIMER =
  "This AI/simulator usability session does **not** replace testing with real people. Observed failures are separated from AI speculation. No UX changes should be implemented automatically from this report.";

export async function runSession(config: SessionConfig): Promise<SessionResult> {
  const sessionId = `usability-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const workDir = join(config.outputDir, sessionId);
  await mkdir(workDir, { recursive: true });

  console.log(SAFETY_BANNER);
  console.log(`Session ${sessionId}`);
  console.log(`Output: ${workDir}`);
  if (config.dryRun) console.log("DRY-RUN: no simulator / no paid API calls.");

  const vision = createVisionProvider({
    provider: config.visionProvider,
    model: config.visionModel,
    dryRun: config.dryRun || config.visionProvider === "mock",
  });
  const controller = new MaestroController(config, workDir);
  await controller.ensureReady();

  if (!config.dryRun) {
    await controller.launchApp();
  }

  const startedAt = new Date().toISOString();
  const taskResults: TaskMetrics[] = [];

  for (const taskId of config.tasks) {
    const task = getTask(taskId);
    console.log(`\n=== Task: ${task.title} ===`);
    const metrics = startTaskMetrics(task);
    let status: CompletionStatus = "failed";
    let step = 0;

    try {
      while (step < Math.min(task.maxSteps, config.maxStepsPerTask)) {
        const shot = await controller.screenshot(`${task.id}-step-${String(step).padStart(2, "0")}`);
        const decision = await vision.decide({
          screenshotPath: shot,
          task,
          step,
          recentObservations: metrics.firstPersonObservations,
        });

        metrics.firstPersonObservations.push(decision.firstPersonObservation);
        if (decision.speculation) metrics.speculation.push(decision.speculation);
        if (decision.confusion) {
          const evidence = await controller.copyEvidence(
            shot,
            `${task.id}-confused-${String(step).padStart(2, "0")}.png`,
          );
          metrics.confusingScreenshotPaths.push(evidence);
        }

        let action = decision.chosenAction;
        const safety = reviewAction(
          action,
          config,
          action.type === "tap" ? action.labelGuess : undefined,
        );
        if (!safety.allowed) {
          metrics.observedFailures.push(safety.reason ?? "Blocked by safety");
          if (safety.rewritten) {
            action = safety.rewritten;
          } else {
            status = "blocked";
            break;
          }
        }

        if (action.type === "done") {
          status = "completed";
          break;
        }
        if (action.type === "give_up") {
          metrics.assistanceNeeded = true;
          status = "blocked";
          metrics.observedFailures.push(action.reason);
          break;
        }

        recordAction(metrics, action);
        const exec = await controller.execute(action, `${task.id}-${step}`);
        if (!exec.ok) {
          recordFailure(metrics, step, action, exec.error ?? "execute failed", true);
          // One retry with a short wait.
          await controller.execute({ type: "wait", ms: 800 }, `${task.id}-${step}-wait`);
          const retry = await controller.execute(action, `${task.id}-${step}-retry`);
          if (!retry.ok) {
            recordFailure(metrics, step, action, retry.error ?? "retry failed", false);
          }
        }

        step += 1;
      }

      if (status === "failed" && step >= Math.min(task.maxSteps, config.maxStepsPerTask)) {
        status = metrics.assistanceNeeded ? "blocked" : "partial";
        metrics.assistanceNeeded = true;
        metrics.observedFailures.push("Hit max steps without a done action.");
      }
    } catch (err) {
      status = "failed";
      metrics.assistanceNeeded = true;
      metrics.observedFailures.push(String(err));
    }

    const finished = finishTaskMetrics(metrics, status);
    taskResults.push(finished);
    await writeFile(
      join(workDir, `${task.id}.metrics.json`),
      JSON.stringify(finished, null, 2),
    );
  }

  const endedAt = new Date().toISOString();
  const findings = deriveFindings(taskResults);
  const result: SessionResult = {
    sessionId,
    startedAt,
    endedAt,
    config,
    tasks: taskResults,
    findings,
    disclaimer: DISCLAIMER,
  };

  await writeFile(join(workDir, "session.json"), JSON.stringify(result, null, 2));
  const md = renderReport(result);
  const reportPath = join(workDir, "usability-report.md");
  await writeFile(reportPath, md);
  console.log(`\nReport written: ${reportPath}`);
  return result;
}
