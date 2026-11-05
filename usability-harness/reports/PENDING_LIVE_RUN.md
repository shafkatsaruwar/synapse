# Synapse Usability Report

**Session:** `pending-live-simulator-run`  
**Status:** Harness scaffolded — **no live iOS Simulator evidence yet**

> This AI/simulator usability session does **not** replace testing with real people. Observed failures are separated from AI speculation. No UX changes should be implemented automatically from this report.

## Method

An AI agent with a **first-time / low-confidence** persona will choose taps from **screenshots only**. A separate Maestro controller executes actions. The agent is instructed not to use app source, nav keys, accessibility IDs, or hidden state.

## Observed blockers (this environment)

| Observation | Evidence |
|---|---|
| Cannot execute Simulator automation here | Host OS is Linux; no Xcode / `simctl` / Maestro |
| Paid vision APIs not called | Explicit requirement to ask before using paid AI APIs |
| npm / Maestro not installed yet | Explicit requirement to ask before installing dependencies |

## Task results

| Task | Status | Elapsed | Taps | Nav steps | Retries | Assistance |
|---|---|---:|---:|---:|---:|---|
| Complete onboarding | not_run | 0s | 0 | 0 | 0 | yes |
| Add a sample medication and reminder | not_run | 0s | 0 | 0 | 0 | yes |
| Add a doctor's appointment | not_run | 0s | 0 | 0 | 0 | yes |
| Find the Emergency Card | not_run | 0s | 0 | 0 | 0 | yes |
| Locate and use Sick Mode | not_run | 0s | 0 | 0 | 0 | yes |
| Find health records and identify Plus restrictions | not_run | 0s | 0 | 0 | 0 | yes |
| Recover from an incorrect tap | not_run | 0s | 0 | 0 | 0 | yes |
| Locate subscription pricing and restore purchases | not_run | 0s | 0 | 0 | 0 | yes |

## Findings (severity-ranked)

### [NOTE] Live usability run not executed

- **Kind:** Observed
- **Evidence:**
  - Cloud Agent host is Linux without Xcode/iOS Simulator
  - Approval required before installing dependencies or calling paid AI APIs
- **Suggested improvement:** Approve a Mac runner (e.g. Mo’s MacBook Pro worker), Maestro install, harness `npm install`, and one vision provider; then re-run and replace this placeholder with evidence-backed findings.

## What is ready

- Separate package: `usability-harness/`
- Vision-vs-controller split + import guard
- Eight task definitions + fictional fixtures
- Safety blocks for purchases / messages / real accounts / notification opt-in
- Markdown report generator with observed vs speculation separation
- Dry-run / mock provider path

## Limits

- Simulator + AI persona ≠ real users.
- No UX changes will be implemented until you approve findings from a live run.
