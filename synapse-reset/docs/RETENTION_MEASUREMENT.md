# Retention measurement (privacy-conscious)

Synapse evaluates onboarding and retention improvements **without** third-party analytics SDKs and **without** uploading sensitive health events.

## Local milestones

Implemented in `lib/product-milestones.ts`. Events are stored only on-device as milestone IDs + ISO timestamps:

| Milestone | Meaning |
|-----------|---------|
| `onboarding_completed` | User finished the 3-stage onboarding |
| `first_useful_action` | Chose medications, appointment, or check-in during onboarding (activation) |
| `first_medication_configured` | Reserved for first medication save (non-PHI) |
| `first_appointment_added` | Reserved for first appointment save (non-PHI) |
| `first_checkin_completed` | Reserved for first daily/symptom check-in (non-PHI) |
| `contextual_help_dismissed` | User dismissed a contextual tip |
| `return_session` | App opened on a later calendar day after first open |

**Never stored:** diagnoses, medication names, symptom text, notes, or other PHI.

## Activation definition

A user is **activated** when they complete at least one meaningful health-management action:

- Configure a medication, **or**
- Add an appointment, **or**
- Complete a check-in (daily log / feeling), **or**
- Select a first useful action during onboarding (counts as intent-to-act; prefer confirming with a later save milestone when available)

Opening the dashboard alone does **not** count as activation.

## Day 1 / Day 7 / Day 28 retention

Measured locally from `firstOpenDate` and `sessionCount` / `lastSessionDate`:

| Window | Definition |
|--------|------------|
| **Day 1** | A session on a calendar day after `firstOpenDate` (return within ~24–48h window) |
| **Day 7** | At least one session on or after day 7 since first open |
| **Day 28** | At least one session on or after day 28 since first open |

`getLocalMilestoneSummary()` exposes eligibility flags for these windows. Rates should be computed only over users who reached that eligibility day.

## Opt-in vs full population

| Population | What is measured | Consent |
|------------|------------------|---------|
| **Full local population** | On-device milestone flags only; never leaves the device | None required (local product telemetry) |
| **Opt-in analytics (proposed)** | Aggregate, non-PHI milestone counts + retention booleans | Explicit consent in Privacy settings; separate from iCloud backup and assistant sync |

### Proposed opt-in architecture (not deployed)

If a future backend is needed:

1. User enables “Share anonymous product usage” in Privacy (default **off**).
2. Client sends only: install UUID (random), milestone IDs, session day indices, app version—**no health content**.
3. Server stores aggregates for Day 1/7/28 and activation rate.
4. Disabling consent stops uploads; local milestones remain for the user’s own insights.

Do **not** silently create cloud telemetry. Do **not** bundle this with iCloud backup or Supabase assistant sync.

## Contextual tips

Dismissals are recorded via `contextual_help_dismissed`. Tips never appear over emergency / sick-mode workflows (`TIP_BLOCKED_SCREENS`).

## Review prompts

App Store review prompts remain gated by existing `feedback-service` rules (meaningful engagement over multiple days). They must **not** run immediately after onboarding.
