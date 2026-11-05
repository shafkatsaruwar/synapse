import type {
  AgentAction,
  CompletionStatus,
  FailedAction,
  TaskId,
  TaskMetrics,
  UsabilityTask,
} from "../types.js";

export function startTaskMetrics(task: UsabilityTask): TaskMetrics & { _t0: number } {
  const now = new Date();
  return {
    taskId: task.id,
    title: task.title,
    startedAt: now.toISOString(),
    endedAt: now.toISOString(),
    elapsedMs: 0,
    taps: 0,
    navigationSteps: 0,
    typeActions: 0,
    scrolls: 0,
    failedActions: [],
    retries: 0,
    assistanceNeeded: false,
    completionStatus: "not_run",
    confusingScreenshotPaths: [],
    firstPersonObservations: [],
    observedFailures: [],
    speculation: [],
    _t0: Date.now(),
  };
}

export function recordAction(
  metrics: TaskMetrics & { _t0?: number },
  action: AgentAction,
): void {
  if (action.type === "tap") {
    metrics.taps += 1;
    metrics.navigationSteps += 1;
  } else if (action.type === "back") {
    metrics.navigationSteps += 1;
  } else if (action.type === "type_text") {
    metrics.typeActions += 1;
  } else if (action.type === "scroll") {
    metrics.scrolls += 1;
    metrics.navigationSteps += 1;
  }
}

export function recordFailure(
  metrics: TaskMetrics,
  step: number,
  action: AgentAction,
  error: string,
  retried: boolean,
): void {
  const fail: FailedAction = { step, action, error, retried };
  metrics.failedActions.push(fail);
  metrics.observedFailures.push(`Step ${step}: ${error}`);
  if (retried) metrics.retries += 1;
}

export function finishTaskMetrics(
  metrics: TaskMetrics & { _t0?: number },
  status: CompletionStatus,
): TaskMetrics {
  const ended = new Date();
  const t0 = metrics._t0 ?? Date.parse(metrics.startedAt);
  const { _t0: _, ...rest } = metrics as TaskMetrics & { _t0?: number };
  return {
    ...rest,
    endedAt: ended.toISOString(),
    elapsedMs: ended.getTime() - t0,
    completionStatus: status,
  };
}

export function blankTaskMetrics(taskId: TaskId, title: string): TaskMetrics {
  const now = new Date().toISOString();
  return {
    taskId,
    title,
    startedAt: now,
    endedAt: now,
    elapsedMs: 0,
    taps: 0,
    navigationSteps: 0,
    typeActions: 0,
    scrolls: 0,
    failedActions: [],
    retries: 0,
    assistanceNeeded: false,
    completionStatus: "not_run",
    confusingScreenshotPaths: [],
    firstPersonObservations: [],
    observedFailures: [],
    speculation: [],
  };
}
