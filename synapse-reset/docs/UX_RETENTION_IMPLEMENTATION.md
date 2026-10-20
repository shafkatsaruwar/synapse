# Synapse UX simplification & retention — implementation notes

## Summary of changes

Coordinated UX pass inside `synapse-reset/` (no rewrite). Goals: simpler first run, no mandatory walkthrough, clearer Today / Health / You navigation, progressive personalization, consolidated journeys, calmer dashboard, local-only product milestones.

## Modified / added files

### Added
- `lib/contextual-tips-storage.ts` — dismissible first-use tip state
- `lib/product-milestones.ts` — local non-PHI product milestones
- `components/ContextualTip.tsx` — lightweight tip banner
- `screens/FeatureHubScreen.tsx` — Health / Feeling / Records / Wellbeing / Care / You hubs
- `docs/RETENTION_MEASUREMENT.md` — Day 1/7/28 + consent model
- `docs/UX_RETENTION_IMPLEMENTATION.md` — this file

### Modified
- `screens/OnboardingScreen.tsx` — 3-stage onboarding
- `screens/DashboardScreen.tsx` — greeting, today’s essentials, quick actions
- `screens/SettingsScreen.tsx` — App Tour copy
- `screens/MedicationsScreen.tsx` / `AppointmentsScreen.tsx` / `DailyLogScreen.tsx` — milestone hooks
- `components/SidebarLayout.tsx` / `TabletSidebar.tsx` — Today / Health / You IA
- `app/(tabs)/index.tsx` — hubs, no auto-walkthrough, first-action routing, tips

## Features moved from primary nav → secondary

Still fully accessible via Health / You hubs, More drawer, or tablet sidebar:

| Former primary / drawer emphasis | New location |
|----------------------------------|--------------|
| Daily Log, Symptoms, Monthly check-in | Health → How I’m Feeling |
| Vitals, Lab Work, Imaging, Timeline, Reports | Health → Health Records |
| Eating, Mental health, Comfort, Goals, Cycle, Ramadan | Health → Wellbeing |
| Doctors, Pharmacies, Caregiver tools | Health → Care & Support |
| Health profile, Conditions, Allergies, Emergency, Privacy, Backup, Feedback | You |
| Theme / App Mode / Modules / Biometrics during onboarding | Settings / Privacy (unchanged screens) |
| Full guided walkthrough after onboarding | Settings → App Tour (manual) |

**Existing route keys preserved** (`medications`, `appointments`, `log`, `symptoms`, `emergencycard`, etc.). Deep links, widgets, and sick-mode remapping unchanged.

## Compatibility

- No storage schema migrations.
- Existing `onboardingCompleted`, `appMode`, `enabledSections`, theme preference, biometric lock preserved.
- New users: system appearance default; app mode remains `full` with simplified 3-tab presentation; all sections enabled for discovery.
- Feature flags remain off: `documentScannerEnabled`, `medicationEnforcementEnabled`.
- Rollback checkpoint: git commit `7823add` (pre-branch `main`).

## Journeys

### First-run (after)
1. Welcome — purpose + local-by-default note  
2. Preferred name (optional)  
3. First useful action (meds / appointment / feeling) or explore  
→ Dashboard (or launched workflow). No theme/mode/modules/biometrics/walkthrough forced.

### Returning user (after)
- Soft greeting without “You” placeholders or guilt about missed logs  
- Today’s essentials + quick actions  
- Contextual tips only once per area, never over emergency/sick mode  
- No automatic onboarding restart

## Outstanding / human review

1. Native iOS simulator/device verification not run in this environment.  
2. Whether Simple Mode should eventually collapse to Today / Health / You only (currently keeps Meds / Visits / Feeling for reachability).  
3. Opt-in cloud aggregate analytics — documented only; not deployed.  
4. Full-mode appointment save path (non-simple modal) could also call `first_appointment_added` if desired for parity.
