import { z } from "zod";

/** Actions the vision agent may propose from a screenshot alone. */
export const AgentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tap"),
    /** Normalized 0–1 coordinates relative to screenshot size. */
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    labelGuess: z.string().optional(),
  }),
  z.object({
    type: z.literal("type_text"),
    text: z.string(),
    replace: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("scroll"),
    direction: z.enum(["up", "down", "left", "right"]),
    amount: z.enum(["small", "medium", "large"]).default("medium"),
  }),
  z.object({
    type: z.literal("back"),
  }),
  z.object({
    type: z.literal("wait"),
    ms: z.number().int().min(200).max(15000),
  }),
  z.object({
    type: z.literal("done"),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("give_up"),
    reason: z.string(),
    needsAssistance: z.literal(true),
  }),
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;

export const VisionDecisionSchema = z.object({
  visibleSummary: z
    .string()
    .describe("What is visibly on screen, in plain language"),
  firstPersonObservation: z
    .string()
    .describe("Short first-person note as a low-confidence first-time user"),
  confusion: z.boolean(),
  confusionReason: z.string().optional(),
  taskProgress: z.enum([
    "not_started",
    "in_progress",
    "blocked",
    "completed",
    "failed",
  ]),
  chosenAction: AgentActionSchema,
  confidence: z.number().min(0).max(1),
  /** Speculative only — must be labeled as such in reports. */
  speculation: z.string().optional(),
});

export type VisionDecision = z.infer<typeof VisionDecisionSchema>;

export type TaskId =
  | "onboarding"
  | "add_medication"
  | "add_appointment"
  | "find_emergency_card"
  | "use_sick_mode"
  | "health_records_plus"
  | "recover_wrong_tap"
  | "subscription_pricing";

export interface UsabilityTask {
  id: TaskId;
  title: string;
  goal: string;
  successCriteria: string[];
  maxSteps: number;
  /** Fictional field values the controller may type when the agent asks to type. */
  fictionalInputs?: Record<string, string>;
  notesForController?: string[];
}

export type CompletionStatus =
  | "completed"
  | "partial"
  | "failed"
  | "blocked"
  | "skipped"
  | "not_run";

export interface FailedAction {
  step: number;
  action: AgentAction;
  error: string;
  retried: boolean;
}

export interface TaskMetrics {
  taskId: TaskId;
  title: string;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  taps: number;
  navigationSteps: number;
  typeActions: number;
  scrolls: number;
  failedActions: FailedAction[];
  retries: number;
  assistanceNeeded: boolean;
  completionStatus: CompletionStatus;
  confusingScreenshotPaths: string[];
  firstPersonObservations: string[];
  /** Observed failures only — grounded in automation / screenshots. */
  observedFailures: string[];
  /** AI speculation — never mixed into observedFailures. */
  speculation: string[];
}

export interface Finding {
  id: string;
  severity: "critical" | "major" | "minor" | "positive" | "note";
  title: string;
  evidence: string[];
  suggestedImprovement: string;
  kind: "observed" | "speculation";
  taskId?: TaskId;
}

export interface SessionConfig {
  dryRun: boolean;
  appId: string;
  deviceName: string;
  outputDir: string;
  visionProvider: "openai" | "anthropic" | "gemini" | "mock";
  visionModel?: string;
  maxStepsPerTask: number;
  allowPurchases: boolean;
  allowNotifications: boolean;
  allowMessages: boolean;
  allowRealAccounts: boolean;
  tasks: TaskId[];
}

export interface SessionResult {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  config: SessionConfig;
  tasks: TaskMetrics[];
  findings: Finding[];
  disclaimer: string;
}
