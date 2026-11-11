import type { Finding, SessionResult, TaskMetrics } from "../types.js";

function fmtMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function severityRank(s: Finding["severity"]): number {
  switch (s) {
    case "critical":
      return 0;
    case "major":
      return 1;
    case "minor":
      return 2;
    case "positive":
      return 3;
    default:
      return 4;
  }
}

export function renderReport(session: SessionResult): string {
  const lines: string[] = [];
  lines.push(`# Synapse Usability Report`);
  lines.push("");
  lines.push(`**Session:** \`${session.sessionId}\``);
  lines.push(`**Started (UTC):** ${session.startedAt}`);
  lines.push(`**Ended (UTC):** ${session.endedAt}`);
  lines.push(`**Vision provider:** ${session.config.visionProvider}${session.config.dryRun ? " (dry-run)" : ""}`);
  lines.push("");
  lines.push(`> ${session.disclaimer}`);
  lines.push("");
  lines.push(`## Method`);
  lines.push("");
  lines.push(
    "An AI agent with a **first-time / low-confidence** persona chose taps from **screenshots only**. A separate Maestro controller executed actions. The agent was instructed not to use app source, nav keys, accessibility IDs, or hidden state. This harness **does not replace** usability testing with real people.",
  );
  lines.push("");
  lines.push("## Task results");
  lines.push("");
  lines.push(
    "| Task | Status | Elapsed | Taps | Nav steps | Retries | Assistance |",
  );
  lines.push("|---|---|---:|---:|---:|---:|---|");
  for (const t of session.tasks) {
    lines.push(
      `| ${t.title} | ${t.completionStatus} | ${fmtMs(t.elapsedMs)} | ${t.taps} | ${t.navigationSteps} | ${t.retries} | ${t.assistanceNeeded ? "yes" : "no"} |`,
    );
  }
  lines.push("");

  for (const t of session.tasks) {
    lines.push(`### ${t.title}`);
    lines.push("");
    lines.push(`- **Completion:** ${t.completionStatus}`);
    lines.push(`- **Wall clock:** ${t.startedAt} → ${t.endedAt} (${fmtMs(t.elapsedMs)})`);
    lines.push(
      `- **Actions:** ${t.taps} taps, ${t.navigationSteps} navigation steps, ${t.typeActions} text entries, ${t.scrolls} scrolls`,
    );
    lines.push(`- **Failed actions / retries:** ${t.failedActions.length} / ${t.retries}`);
    lines.push(`- **Assistance needed:** ${t.assistanceNeeded ? "yes" : "no"}`);
    if (t.confusingScreenshotPaths.length) {
      lines.push(`- **Confusing-state screenshots:**`);
      for (const p of t.confusingScreenshotPaths) lines.push(`  - \`${p}\``);
    }
    if (t.firstPersonObservations.length) {
      lines.push(`- **First-person observations (visible UI):**`);
      for (const o of t.firstPersonObservations.slice(0, 8)) {
        lines.push(`  - “${o}”`);
      }
    }
    if (t.observedFailures.length) {
      lines.push(`- **Observed failures:**`);
      for (const f of t.observedFailures) lines.push(`  - ${f}`);
    }
    if (t.speculation.length) {
      lines.push(`- **AI speculation (not observed):**`);
      for (const s of t.speculation) lines.push(`  - ${s}`);
    }
    lines.push("");
  }

  lines.push(`## Findings (severity-ranked)`);
  lines.push("");
  const findings = [...session.findings].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );
  if (!findings.length) {
    lines.push("_No findings recorded yet. Run the harness on a disposable iOS Simulator._");
    lines.push("");
  }
  for (const f of findings) {
    lines.push(`### [${f.severity.toUpperCase()}] ${f.title}`);
    lines.push("");
    lines.push(`- **Kind:** ${f.kind === "observed" ? "Observed" : "AI speculation"}`);
    if (f.taskId) lines.push(`- **Task:** ${f.taskId}`);
    lines.push(`- **Evidence:**`);
    for (const e of f.evidence) lines.push(`  - ${e}`);
    lines.push(`- **Suggested improvement:** ${f.suggestedImprovement}`);
    lines.push("");
  }

  lines.push(`## Limits`);
  lines.push("");
  lines.push(
    "- Simulator + AI persona ≠ real users (age, motor ability, health context, trust).",
  );
  lines.push("- Vision models misread UI and invent rationales; speculation is labeled separately.");
  lines.push("- Safety mode blocks real purchases, messaging, and account creation.");
  lines.push("- Do not ship UX changes from this report without human review and approval.");
  lines.push("");

  return lines.join("\n");
}

/** Heuristic finding extraction from metrics — conservative, prefers observed. */
export function deriveFindings(tasks: TaskMetrics[]): Finding[] {
  const findings: Finding[] = [];
  let n = 1;
  for (const t of tasks) {
    if (t.assistanceNeeded) {
      findings.push({
        id: `F${n++}`,
        severity: "major",
        title: `Assistance needed: ${t.title}`,
        evidence: [
          `completion=${t.completionStatus}`,
          ...t.observedFailures.slice(0, 3),
          ...t.firstPersonObservations.slice(0, 2).map((o) => `Observation: ${o}`),
        ],
        suggestedImprovement:
          "Review this flow for clearer labels, progressive disclosure, and an obvious escape hatch.",
        kind: "observed",
        taskId: t.taskId,
      });
    }
    if (t.confusingScreenshotPaths.length >= 2) {
      findings.push({
        id: `F${n++}`,
        severity: "minor",
        title: `Multiple confusing states during: ${t.title}`,
        evidence: t.confusingScreenshotPaths.map((p) => `Screenshot: ${p}`),
        suggestedImprovement:
          "Tighten information hierarchy on the screens captured as confusing.",
        kind: "observed",
        taskId: t.taskId,
      });
    }
    for (const s of t.speculation) {
      findings.push({
        id: `F${n++}`,
        severity: "note",
        title: `Speculation during ${t.title}`,
        evidence: [s],
        suggestedImprovement: "Validate with a real participant before acting.",
        kind: "speculation",
        taskId: t.taskId,
      });
    }
    if (t.completionStatus === "completed" && t.retries === 0 && !t.assistanceNeeded) {
      findings.push({
        id: `F${n++}`,
        severity: "positive",
        title: `Completed without assistance: ${t.title}`,
        evidence: [`elapsed=${fmtMs(t.elapsedMs)}`, `taps=${t.taps}`],
        suggestedImprovement: "Keep this path stable; avoid burying the entry point.",
        kind: "observed",
        taskId: t.taskId,
      });
    }
  }
  return findings;
}
