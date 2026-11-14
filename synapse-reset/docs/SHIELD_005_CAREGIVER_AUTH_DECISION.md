# SHIELD-005 — Caregiver Edge Auth

**Decision: Option B chosen (2026-11-14)** — disable cloud caregiver push until auth-bound migration.

## Why Option A was not implemented yet

Cloud caregiver rows are keyed by `local_<uuid>` install IDs from AsyncStorage (`getLinkingUserId`). Accountability reports in `notification-manager.ts` omit Supabase `authUserId`. A verified JWT `sub` cannot equal `local_*` without an insecure client mapping.

## Option B implementation (this repo)

| Control | Status |
| --- | --- |
| `featureFlags.cloudCaregiverPushEnabled` | `false` |
| Client cloud link / report / reminder / invoke | Gated in `lib/caregiver-linking.ts` via `lib/caregiver-cloud-gate.ts` |
| Edge Function source | Fail closed **503** (`CLOUD_CAREGIVER_PUSH_DISABLED`) — **not deployed by this PR** |
| On-device caregiver + Care Connections | Unchanged |
| Caregiver table data | Not deleted |
| Production Supabase | Not edited by this PR |

## Ops checklist (human — staging/production)

These steps are **outside** this PR and require explicit approval:

1. In Supabase Dashboard → Edge Functions: confirm whether `send-caregiver-event` / `send-caregiver-reminder` are deployed.
2. If deployed: **disable or delete** them (or deploy the fail-closed 503 sources to staging first, then production after approval).
3. Confirm caregiver RLS lockdown (`caregiver_linking_v2_lockdown.sql`) is applied (SHIELD-S1).
4. Do not rotate credentials as part of this change.

## Option A (future — after approval)

Require SIWA/`auth.uid()` for all cloud caregiver rows; JWT + link ownership in Edge Functions; template-only notification text; wire `authUserId` through `notification-manager`; migrate or abandon `local_*` cloud rows.

## Staging plan for fail-closed function deploy (when approved)

1. Deploy 503 sources to **staging** only.  
2. Invoke without/with JWT → expect **503** and no Expo push.  
3. Confirm app with `cloudCaregiverPushEnabled: false` never calls the functions.  
4. Only then consider production function disable/deploy.  
5. **This agent stops before any deploy.**
