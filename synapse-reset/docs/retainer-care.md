# Retainer Care (personal)

Local-only bedtime retainer check with Level 2 Firm Enforcement.

## Gates

- Compile-time: `featureFlags.retainerCareEnabled`
- Runtime: `RetainerSettings.enabled`
- Both required. No marketing, onboarding, CloudKit export, caregiver sharing, or medication badges.

## Behavior

- Night-keyed occurrence (`night:YYYY-MM-DD`) that can cross midnight.
- Completion only after in-app **Yes, confirmed**. Banner open / dismiss never completes.
- Bounded follow-ups (default 4) then `expired` (still visibly pending, no more notifications).
- **Removed for snack** reopens the same night and schedules a snack follow-up.
- Pain / don’t fit → `pain_stopped` (stops enforcement).

## Storage

- `synapse_retainer_care_settings_v1`
- `synapse_retainer_care_occurrences_v1`
- Cleared by Reset App; excluded from `exportAllData` / CloudKit.

## Notifications

Category `RETAINER_CARE`. Reconciled via `reconcileRetainerCare()` inside `syncAllFromSettings` and on app active.
