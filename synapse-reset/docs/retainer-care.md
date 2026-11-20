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

### Setup (in Retainer settings)

- **Set up notifications** — requests OS permission (or opens system Settings if previously denied)
- **Persistent alerts** — schedules with iOS `timeSensitive` / Android max priority + sticky
- **Play sound** — optional sound on each alert
- **Keep notifying until confirmed** — firm follow-up ladder
- **Send test notification** — fires a one-off test in ~3 seconds

### Delivery limits

- iOS Focus breakthrough for persistent alerts needs the **Time Sensitive Notifications** entitlement on the installed binary (`com.apple.developer.usernotifications.time-sensitive`). That requires a **new native build**; the JS setup UI can still ship by OTA.
- Critical Alerts are not used.
- Delivery is never guaranteed (Focus / DND / OS deferral still apply).
