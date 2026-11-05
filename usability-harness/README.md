# Synapse usability harness (separate package)

AI-driven **first-time user** usability testing for Synapse on the **iOS Simulator**.

This package is **not** production app code. It lives beside `synapse-reset/` and must not modify app sources to run.

## What it does

1. Boots a disposable Simulator session (macOS + Xcode).
2. Captures screenshots via **Maestro** (or `simctl` fallback).
3. Asks a **vision model** what a low-confidence first-time user would do next — from the screenshot + task goal only.
4. A separate **controller** executes taps/typing/scrolls (coordinate taps preferred; optional label fallback).
5. Records timing, taps, retries, confusing screenshots, assistance flags, and first-person notes.
6. Writes a Markdown report with **severity-ranked findings**, separating **observed** failures from **AI speculation**.

It does **not** replace testing with real people. Do **not** auto-implement UX changes from a run — present findings for approval first.

## Tasks covered

| Id | Goal |
|---|---|
| `onboarding` | Complete onboarding |
| `add_medication` | Add fictional med + reminder |
| `add_appointment` | Add fictional doctor visit |
| `find_emergency_card` | Find Emergency Card |
| `use_sick_mode` | Locate and use Sick Mode |
| `health_records_plus` | Find health records / Plus cues |
| `recover_wrong_tap` | Recover from a wrong tap |
| `subscription_pricing` | Find pricing + Restore Purchases (no buy) |

Fictional fixtures: `fixtures/fictional-data.json`.

## Architecture (agent vs controller)

```
┌──────────────────────────┐     screenshot only      ┌─────────────────────┐
│ Vision agent (persona)   │◄────────────────────────│ Maestro controller  │
│ No app source / a11y IDs │                         │ May use selectors   │
│ No nav keys / hidden     │──── action JSON ───────►│ to execute taps     │
└──────────────────────────┘                         └─────────────────────┘
```

`scripts/guard-no-app-imports.mjs` fails CI-style checks if vision/task/persona modules reference `synapse-reset` or test IDs.

## Safety defaults

- No real purchases / subscription confirms  
- No real notification opt-in when Skip is available  
- No caregiver messaging / SMS / email sends  
- No real account sign-in  
- Fictional health data only  
- App state cleared on launch (`clearState: true`)

Live vision API calls also require `USABILITY_API_APPROVED=1` after human approval.

## Requirements (macOS host)

- Xcode + iOS Simulator  
- Synapse debug/dev build installed (`com.mohammedsaruwar.synapse`)  
- Maestro (install only after approval)  
- Node 20+  
- Optional: OpenAI / Anthropic / Gemini API key (paid — ask first)

This Linux Cloud Agent environment **cannot** run the iOS Simulator. Use a Mac (local or self-hosted worker).

## Setup (after approval)

```bash
cd usability-harness

# A) deps only (no paid APIs yet)
npm install

# B) Maestro on macOS (explicit)
./scripts/bootstrap-simulator.sh --install-maestro --install-npm

# C) copy env and choose provider
cp .env.example .env
# set USABILITY_VISION_PROVIDER=openai|anthropic|gemini
# set the matching API key via your secret store — do not paste into chat
```

## Run

```bash
# Free dry-run (mock vision, no simulator automation required for report scaffolding)
npm run dry-run

# Live simulator run (after Maestro + build + API approval)
USABILITY_API_APPROVED=1 npm start -- run --provider openai

# Subset of tasks
USABILITY_API_APPROVED=1 npm start -- run --provider openai --tasks onboarding,add_medication
```

Reports land in `reports/<session-id>/usability-report.md` with screenshots and `session.json`.

## Outputs per task

- Start / end timestamps and wall-clock elapsed  
- Tap count and navigation steps  
- Screenshots of confusing states  
- Failed actions and retries  
- Assistance needed flag  
- Completion status  
- Short first-person observations grounded in visible UI  

## Approval checklist before a live run

Please confirm before we install or spend:

1. **Install harness npm dependencies** (`zod`, `tsx`, `typescript`; optional `openai`)?  
2. **Install Maestro** on the Mac runner?  
3. **Which vision API** (OpenAI / Anthropic / Gemini) and may we bind/use that secret?  
4. **Run on** Mo’s MacBook Pro self-hosted worker (or another Mac with Simulator + Synapse build)?  

Until those are approved, only `--dry-run` / mock mode should be used.

## Repo hygiene

- Do not import this package from `synapse-reset`.  
- Do not add production accessibility IDs solely for this harness without a separate product decision.  
- Commit harness code; leave `reports/*` session artifacts untracked (see `.gitignore`).
