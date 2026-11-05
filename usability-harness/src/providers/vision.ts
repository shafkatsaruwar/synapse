import { readFile } from "node:fs/promises";
import { VisionDecisionSchema, type VisionDecision, type UsabilityTask } from "../types.js";
import { personaSystemPrompt } from "../persona.js";
import { BridgeVisionProvider } from "./bridge.js";

export interface VisionProvider {
  readonly name: string;
  decide(input: {
    screenshotPath: string;
    task: UsabilityTask;
    step: number;
    recentObservations: string[];
  }): Promise<VisionDecision>;
}

function userPrompt(task: UsabilityTask, step: number, recent: string[]): string {
  return [
    `Task: ${task.title}`,
    `Goal: ${task.goal}`,
    `Success looks like: ${task.successCriteria.join("; ")}`,
    `Step number: ${step + 1} of max ${task.maxSteps}`,
    recent.length
      ? `Recent first-person notes:\n${recent.slice(-5).map((o) => `- ${o}`).join("\n")}`
      : "No prior notes.",
    "",
    "Choose exactly one next action. If the goal is already met on this screen, use type=done.",
    "If you are stuck after careful looking, use type=give_up with needsAssistance=true.",
  ].join("\n");
}

/** Deterministic mock — no paid API. Used for dry-run and CI scaffolding. */
export class MockVisionProvider implements VisionProvider {
  readonly name = "mock";

  async decide(input: {
    screenshotPath: string;
    task: UsabilityTask;
    step: number;
    recentObservations: string[];
  }): Promise<VisionDecision> {
    const { task, step } = input;
    // Scripted cautious exploration path — not a claim about real UX.
    if (step === 0) {
      return VisionDecisionSchema.parse({
        visibleSummary: `Mock provider: no live screenshot analysis (file=${input.screenshotPath}).`,
        firstPersonObservation:
          "I'm not sure where to start — I'd look for a big Continue or Get Started button.",
        confusion: true,
        confusionReason: "Mock mode cannot see the real UI.",
        taskProgress: "not_started",
        chosenAction: { type: "wait", ms: 500 },
        confidence: 0.2,
        speculation:
          "A live vision model would tap the most prominent primary CTA on the onboarding screen.",
      });
    }
    if (step >= Math.min(3, task.maxSteps - 1)) {
      return VisionDecisionSchema.parse({
        visibleSummary: "Mock provider ending task early.",
        firstPersonObservation:
          "In mock mode I cannot finish this for real — marking blocked.",
        confusion: true,
        taskProgress: "blocked",
        chosenAction: {
          type: "give_up",
          reason: "Mock vision provider cannot complete real simulator tasks.",
          needsAssistance: true,
        },
        confidence: 1,
        speculation: "Replace mock with openai/anthropic/gemini for a real run.",
      });
    }
    return VisionDecisionSchema.parse({
      visibleSummary: "Mock exploratory tap near lower center.",
      firstPersonObservation: "I'd try tapping something that looks like a main button.",
      confusion: true,
      taskProgress: "in_progress",
      chosenAction: {
        type: "tap",
        x: 0.5,
        y: 0.78,
        labelGuess: "primary CTA guess (mock)",
      },
      confidence: 0.25,
    });
  }
}

export class OpenAIVisionProvider implements VisionProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o",
  ) {}

  async decide(input: {
    screenshotPath: string;
    task: UsabilityTask;
    step: number;
    recentObservations: string[];
  }): Promise<VisionDecision> {
    const openai = await import("openai");
    const client = new openai.default({ apiKey: this.apiKey });
    const bytes = await readFile(input.screenshotPath);
    const b64 = bytes.toString("base64");
    const ext = input.screenshotPath.toLowerCase().endsWith(".jpg") ? "jpeg" : "png";

    const response = await client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: personaSystemPrompt() },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt(input.task, input.step, input.recentObservations) },
            {
              type: "text",
              text: `Return JSON with keys: visibleSummary, firstPersonObservation, confusion, confusionReason, taskProgress, chosenAction, confidence, speculation. chosenAction.type is one of tap|type_text|scroll|back|wait|done|give_up.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/${ext};base64,${b64}` },
            },
          ],
        },
      ],
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    return VisionDecisionSchema.parse(JSON.parse(raw));
  }
}

/**
 * Anthropic Messages API via fetch — avoids hard dependency until approved install.
 */
export class AnthropicVisionProvider implements VisionProvider {
  readonly name = "anthropic";
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "claude-sonnet-4-20250514",
  ) {}

  async decide(input: {
    screenshotPath: string;
    task: UsabilityTask;
    step: number;
    recentObservations: string[];
  }): Promise<VisionDecision> {
    const bytes = await readFile(input.screenshotPath);
    const b64 = bytes.toString("base64");
    const mediaType = input.screenshotPath.toLowerCase().endsWith(".jpg")
      ? "image/jpeg"
      : "image/png";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1200,
        system: personaSystemPrompt(),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: b64 },
              },
              {
                type: "text",
                text:
                  userPrompt(input.task, input.step, input.recentObservations) +
                  "\nRespond with ONLY a JSON object matching the schema.",
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic vision failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = data.content.find((c) => c.type === "text")?.text ?? "{}";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const sliced =
      jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
    return VisionDecisionSchema.parse(JSON.parse(sliced));
  }
}

export class GeminiVisionProvider implements VisionProvider {
  readonly name = "gemini";
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gemini-2.0-flash",
  ) {}

  async decide(input: {
    screenshotPath: string;
    task: UsabilityTask;
    step: number;
    recentObservations: string[];
  }): Promise<VisionDecision> {
    const bytes = await readFile(input.screenshotPath);
    const b64 = bytes.toString("base64");
    const mime = input.screenshotPath.toLowerCase().endsWith(".jpg")
      ? "image/jpeg"
      : "image/png";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: personaSystemPrompt() },
              { text: userPrompt(input.task, input.step, input.recentObservations) },
              { text: "Respond with ONLY JSON for the decision schema." },
              { inline_data: { mime_type: mime, data: b64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini vision failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return VisionDecisionSchema.parse(JSON.parse(text));
  }
}

export function createVisionProvider(opts: {
  provider: "openai" | "anthropic" | "gemini" | "mock" | "bridge";
  model?: string;
  dryRun?: boolean;
  bridgeDir?: string;
}): VisionProvider {
  if (opts.dryRun || opts.provider === "mock") {
    return new MockVisionProvider();
  }
  if (opts.provider === "bridge") {
    const dir = opts.bridgeDir || process.env.USABILITY_BRIDGE_DIR || "./reports/bridge";
    return new BridgeVisionProvider(dir);
  }
  if (opts.provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY required (ask before using paid APIs).");
    return new OpenAIVisionProvider(key, opts.model);
  }
  if (opts.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY required (ask before using paid APIs).");
    return new AnthropicVisionProvider(key, opts.model);
  }
  if (opts.provider === "gemini") {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("GOOGLE_API_KEY required (ask before using paid APIs).");
    return new GeminiVisionProvider(key, opts.model);
  }
  throw new Error(`Unknown vision provider: ${opts.provider}`);
}
