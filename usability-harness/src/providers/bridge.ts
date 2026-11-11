import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import {
  VisionDecisionSchema,
  type VisionDecision,
  type UsabilityTask,
} from "../types.js";
import type { VisionProvider } from "./vision.js";

/**
 * File-bridge vision provider: writes a decision request + waits for a response.
 * Allows a parent Cursor agent (with image vision via Read) to fulfill decisions
 * without a separate paid OpenAI/Anthropic key in this process.
 */
export class BridgeVisionProvider implements VisionProvider {
  readonly name = "bridge";
  constructor(
    private readonly bridgeDir: string,
    private readonly timeoutMs = 180_000,
    private readonly pollMs = 1000,
  ) {}

  async decide(input: {
    screenshotPath: string;
    task: UsabilityTask;
    step: number;
    recentObservations: string[];
  }): Promise<VisionDecision> {
    await mkdir(this.bridgeDir, { recursive: true });
    const id = `${input.task.id}-${String(input.step).padStart(3, "0")}-${Date.now()}`;
    const reqPath = join(this.bridgeDir, `${id}.request.json`);
    const resPath = join(this.bridgeDir, `${id}.response.json`);

    await writeFile(
      reqPath,
      JSON.stringify(
        {
          id,
          screenshotPath: input.screenshotPath,
          task: {
            id: input.task.id,
            title: input.task.title,
            goal: input.task.goal,
            successCriteria: input.task.successCriteria,
          },
          step: input.step,
          recentObservations: input.recentObservations.slice(-5),
          responsePath: resPath,
          schemaHint:
            "Write VisionDecision JSON to responsePath: visibleSummary, firstPersonObservation, confusion, confusionReason?, taskProgress, chosenAction, confidence, speculation?",
        },
        null,
        2,
      ),
    );

    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      try {
        await access(resPath);
        const raw = await readFile(resPath, "utf8");
        return VisionDecisionSchema.parse(JSON.parse(raw));
      } catch {
        await new Promise((r) => setTimeout(r, this.pollMs));
      }
    }

    return VisionDecisionSchema.parse({
      visibleSummary: "Bridge vision timed out waiting for a decision file.",
      firstPersonObservation:
        "I waited too long without guidance and feel stuck.",
      confusion: true,
      confusionReason: "No bridge response",
      taskProgress: "blocked",
      chosenAction: {
        type: "give_up",
        reason: `Bridge timeout after ${this.timeoutMs}ms for ${id}`,
        needsAssistance: true,
      },
      confidence: 1,
    });
  }
}
