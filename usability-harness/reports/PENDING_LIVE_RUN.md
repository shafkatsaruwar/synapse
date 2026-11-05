# Synapse Usability Report

**Session:** `pending-live-simulator-run`  
**Updated:** 2026-11-05 (America/New_York)  
**Status:** Harness installed + dry-run verified — **live iOS Simulator still blocked**

> This AI/simulator usability session does **not** replace testing with real people. Observed failures are separated from AI speculation. No UX changes should be implemented automatically from this report.

## Observed progress

| Item | Status |
|---|---|
| Separate harness package | Done (`usability-harness/`) |
| npm deps installed in this agent | Done (`zod`, `tsx`, `typescript`, optional `openai`) |
| Dry-run (`npm run dry-run`) | Passed — mock vision, 8 tasks scaffolded |
| Production app unmodified | Confirmed |
| Live iOS Simulator session | **Blocked** |
| Paid vision API call | **Not yet** — key missing; secret request filed |

## Observed blockers (live run)

1. **No iOS Simulator on this Cloud Agent host** (Linux).
2. **Self-hosted Mac worker is registered for `lifeos` only**, not `synapse`. Subagents launched from this run show `usePrivateWorker: false` / `privateWorkerId: null`, so they stay on Linux cloud VMs.
3. **No vision API key** in the agent environment (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` missing). A secrets request was filed for `OPENAI_API_KEY` (required) and `ANTHROPIC_API_KEY` (optional).

## What to approve / do next (host side)

1. Add Synapse to the Mac self-hosted worker (or start `agent worker` from the Synapse checkout on Mo’s MacBook Pro).
2. Confirm the OpenAI (or Anthropic) secret in Cursor dashboard / agent secrets.
3. On the Mac:

```bash
cd usability-harness
./scripts/bootstrap-simulator.sh --install-maestro   # if Maestro missing
# install Synapse debug build on Simulator
USABILITY_API_APPROVED=1 ./scripts/run-live-macos.sh --provider openai
```

## Dry-run note (not live evidence)

A mock dry-run completed under `reports/usability-2026-11-05T18-14-25-960Z-0a3c1a57/`. All eight tasks are marked **blocked** by design in mock mode. That output is **not** a usability finding about Synapse UI.

## Limits

- No UX changes will be implemented until you approve findings from a **live** Simulator run.
- This harness does not replace testing with real people.
