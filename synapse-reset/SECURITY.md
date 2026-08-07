# Synapse Security & Privacy

> **Important:** Synapse is a **personal consumer wellness / health-organization app**.
> It is **not** a HIPAA covered entity, **not** a business associate offering, and **not** a certified medical device.
> Do not market Synapse as “HIPAA compliant.” That claim is inaccurate for this product’s current architecture.

This document describes the **actual** security posture so engineers and operators avoid overclaiming.

## What the app actually does with data

| Path | Reality |
|------|---------|
| Default health logs | Stored on-device (AsyncStorage / local persistence). Not marketed as AES-256 encrypted. |
| Optional iCloud / CloudKit | User-initiated or settings-driven backup to the user’s Apple iCloud container when enabled. |
| Optional Supabase | Used for auth/sync features when configured; RLS must never be `USING (true)`. |
| Optional AI (document scan / insights) | Sends user-selected health data to the Synapse API → third-party AI provider. Requires `API_SHARED_SECRET`. |
| Optional email | Authenticated API only; not an open relay. |
| Export / Share | Unencrypted JSON the user chooses to share. |
| On-device caregiver mode | Local profile on the same device. |
| Cloud caregiver linking tables | Client (anon) access is **denied** after `caregiver_linking_v2_lockdown.sql`. Re-enable only with Auth-bound RLS or Edge Functions + service role. |

## Authentication for PHI APIs

Server routes under `/api/analyze-document`, `/api/health-insights`, `/api/compare-medications`, and `/api/send-email` require:

- Server env: `API_SHARED_SECRET`
- Client env (baked into the app): `EXPO_PUBLIC_API_SHARED_SECRET` (same value)

Requests must send header `X-API-Key: <secret>` (or `Authorization: Bearer <secret>`).

If `API_SHARED_SECRET` is unset, these routes return **503** (fail closed).

> Note: An `EXPO_PUBLIC_*` secret can be extracted from the app binary. It blocks casual open-internet abuse; long-term prefer per-user auth (Supabase JWT verification on the server).

## App Lock

`BiometricGate` uses `expo-local-authentication`. Cancel / dismiss must **not** unlock. Web builds do not enforce App Lock.

## Operator checklist (do this in production)

1. Set `API_SHARED_SECRET` on the API host and matching `EXPO_PUBLIC_API_SHARED_SECRET` for app builds.
2. Run `synapse-reset/supabase/caregiver_linking_v2_lockdown.sql` on any project that previously applied the permissive v1 policies.
3. Never claim AES-256 / SecureStore / HIPAA in App Store copy, Privacy screen, or docs unless independently true.
4. Prefer not logging request/response bodies for health/AI routes (server logging is method/path/status only).
5. Keep Privacy & Data UI aligned with real optional cloud / AI / export behavior.
6. Consult a qualified healthcare/privacy attorney before handling data for clinics, employers, or other covered entities.

## Related files

- `server/api-auth.ts`, `server/routes.ts`, `api/send-email.ts`
- `synapse-reset/screens/PrivacyScreen.tsx`
- `synapse-reset/components/BiometricGate.tsx`
- `synapse-reset/supabase/caregiver_linking_v2_lockdown.sql`
- `synapse-reset/lib/secure-storage.ts`, `synapse-reset/lib/encryption.ts` (legacy; not AES)

## References (education, not a claim of compliance)

- [HIPAA overview (HHS)](https://www.hhs.gov/hipaa/)
- [FTC health privacy guidance](https://www.ftc.gov/business-guidance/privacy-security)
