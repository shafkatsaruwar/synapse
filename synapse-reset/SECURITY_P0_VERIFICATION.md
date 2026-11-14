# Project Shield — P0 Verification Report

**Mode:** Read-only (no code, policy, credential, or production changes; no production authorization tests).  
**Date:** 2026-11-14  
**Statuses used:** `CONFIRMED` | `NOT CONFIRMED` | `REQUIRES PRODUCTION VERIFICATION`

---

## Summary

| Finding | Status | Health data exposure? | Block App Store release? |
| --- | --- | --- | --- |
| SHIELD-005 Caregiver Edge auth | **CONFIRMED** (missing in-function auth); live exploitability **REQUIRES PRODUCTION VERIFICATION** | Push bodies can include med names / custom messages | **Yes, until** functions are confirmed JWT-gated or disabled |
| SHIELD-S1 Caregiver RLS | **REQUIRES PRODUCTION VERIFICATION** | Yes, if v1 open policies still live | **Yes, until** lockdown confirmed or cloud caregiver unused |
| SHIELD-006 AI endpoint auth | **CONFIRMED** | Yes — user-selected PHI → OpenAI | **Yes** if AI features ship without per-user auth (shared secret alone is insufficient) |
| SHIELD-004 SIWA backup confidentiality | **CONFIRMED** (plaintext at rest in app design) | Yes — full export in `user_backups.data` | **No** if UI keeps “not E2E encrypted” disclosure; **Yes** if marketed as encrypted/secure cloud |
| Privacy / encryption claims | **NOT CONFIRMED** as false SIWA/HIPAA marketing; **CONFIRMED** doc/flag drift on CloudKit | N/A (trust/copy) | **No** for current in-app SIWA/HIPAA copy; fix `SECURITY.md` flag text before review |

---

## SHIELD-005 — Caregiver Edge Function authentication

**Status:** CONFIRMED (source). Production invoke path: REQUIRES PRODUCTION VERIFICATION.

### Affected source
- `synapse-reset/supabase/functions/send-caregiver-event/index.ts` — `Deno.serve` handler
- `synapse-reset/supabase/functions/send-caregiver-reminder/index.ts` — `Deno.serve` handler
- Call sites: `synapse-reset/lib/caregiver-linking.ts` (`functions.invoke`)

### Control present / missing
| Control | Present? |
| --- | --- |
| Verify caller JWT / identity in function body | **Missing** (both) |
| Shared secret / signed request | **Missing** |
| Service role DB access | Present (bypasses RLS) |
| Link ownership check | Reminder only: `linked_users.includes(caregiverUserId)` |
| Authorship that caller *is* that caregiver/patient | **Missing** |
| Gateway `verify_jwt` | **Not in repo** (no `config.toml`) |

### Repo vs production
- **Repo:** Functions accept JSON body and proceed with service role; no `auth.getUser()`.
- **Production:** Whether functions are deployed, and whether Supabase JWT verification is enabled at the gateway, was **not inspected**.

### Realistic attack scenario (not executed)
1. Attacker discovers function URL (standard Supabase pattern) and that JWT verify is off **or** obtains any valid project JWT.
2. `send-caregiver-reminder`: POST `{ patientUserId, caregiverUserId, message }` → if IDs are linked, patient’s Expo push token receives attacker-chosen text.
3. `send-caregiver-event`: POST `{ patientUserId, eventKey }` → if matching `caregiver_events` rows exist, caregivers receive push that may include medication names from stored payload.

### Health data exposure
Yes — medication / appointment context in event payloads; arbitrary message text on reminder.

### Smallest safe fix
1. Ops: confirm deploy + JWT settings; if unclear, **disable** both functions.
2. Code: require verified user JWT; authorize `auth.uid()` against patient/caregiver link before push; stop trusting client `message` blindly (template server-side).

### Blocks release?
**Yes**, until production verification shows functions are unavailable or JWT-gated, or they are disabled.

---

## SHIELD-S1 — Production caregiver RLS

**Status:** REQUIRES PRODUCTION VERIFICATION

### Affected source (repository configuration only)
- `synapse-reset/supabase/caregiver_linking_v1.sql` — now embeds deny policies + warning (no live `USING (true)` policy text)
- `synapse-reset/supabase/caregiver_linking_v2_lockdown.sql` — `using (false)` for `anon, authenticated` on `caregiver_users`, `caregiver_link_codes`, `caregiver_events`

### Control present / missing
- **Repo:** Intended lockdown SQL exists.
- **Production:** Whether lockdown was applied on the live project is **unknown**. Historical risk: open v1 policies.

### Repo vs production
| Layer | Status |
| --- | --- |
| SQL in git | Lockdown present |
| Applied migrations on live Supabase | **Not verified** (read-only audit; no prod queries) |

### Realistic attack scenario
If production still has permissive client policies, anyone with the public anon key could read/write caregiver tables (tokens, links, event PHI). **Not tested.**

### Health data exposure
Yes, if open policies remain.

### Smallest safe fix
Operator checklist on staging then production: list policies; if not deny-all for client roles, apply `caregiver_linking_v2_lockdown.sql` with approval. Do not change policies without a backup.

### Blocks release?
**Yes**, until an operator confirms lockdown (or confirms caregiver cloud tables unused / empty and functions off).

---

## SHIELD-006 — AI endpoint authentication

**Status:** CONFIRMED

### Affected source
- `server/api-auth.ts` — `requireApiAuth`
- `server/routes.ts` — `POST /api/analyze-document`, `/api/health-insights`, `/api/compare-medications`
- `synapse-reset/lib/api.ts` — `getAuthHeaders()` reads `EXPO_PUBLIC_API_SHARED_SECRET`

### Control present / missing
| Control | Present? |
| --- | --- |
| Shared secret comparison | Yes |
| Fail closed if secret unset (503) | Yes |
| Per-user JWT verification on server | **Missing** |
| Binding request to a Supabase user | **Missing** |
| Rate limiting | **Missing** (not wired) |
| Client secret extractability | Inherent (`EXPO_PUBLIC_*`) |

Client prefers `X-API-Key` over session bearer (`lib/api.ts`); server accepts the shared secret as Bearer as well — so a user session is never required when the baked secret is present.

### Repo vs production
- **Repo architecture:** Confirmed.
- **Production:** Whether `API_SHARED_SECRET` is set on Vercel and whether AI features are enabled in shipping builds — **Not verified** (no secret values inspected).

### Realistic attack scenario
Extract `EXPO_PUBLIC_API_SHARED_SECRET` from the IPA/JS bundle → call health AI routes with arbitrary payloads → cost abuse and third-party processing of attacker- or victim-supplied health content. No need to steal a user password.

### Health data exposure
Yes — document images, meds, logs, vitals sent in request bodies to OpenAI via the server.

### Smallest safe fix
Verify Supabase (or Apple) user JWT on the server for these three routes; keep shared secret only as an optional secondary gate in staging; add per-user/IP rate limits. Do not rewrite the AI pipelines themselves.

### Blocks release?
**Yes** if optional AI features remain enabled for App Store users without per-user auth. **No** if AI is feature-flagged off until JWT auth ships.

---

## SHIELD-004 — SIWA cloud backup confidentiality

**Status:** CONFIRMED

### Affected source
- `synapse-reset/lib/backup.ts` — `backupNow()` / `restoreFromCloud()`
- `supabase/migrations/002_user_backups_jsonb.sql` — `data jsonb` + owner RLS
- UI disclosure: `BackupRestoreScreen.tsx` (“not end-to-end encrypted”)
- Docs: `docs/SIGN_IN_WITH_APPLE.md`

### Control present / missing
| Control | Present? |
| --- | --- |
| Client-side encryption before upload | **Missing** |
| Owner RLS (`auth.uid() = user_id`) in migration | Present |
| Service-role / DB-admin readability of plaintext | By design (jsonb) |
| Honest in-app disclosure | Present |

`backupNow` calls `exportAllData()` and upserts the object as `data` with no encrypt step.

### Repo vs production
- **Repo:** Plaintext design confirmed.
- **Production:** Whether users have uploaded rows, and whether RLS matches migration — **Not verified**.

### Realistic attack scenario
Compromised service role, insider DB access, or misconfigured RLS → full health export JSON for affected users. Cross-user client access should fail **if** owner RLS is applied (staging test recommended later).

### Health data exposure
Yes — full backup payload (meds, logs, etc.).

### Smallest safe fix
Keep disclosure; do not claim encryption. Optional smallest product fix: feature-flag SIWA upload off until client-side encryption ships. Encryption itself is larger (migration) — not “smallest” unless product requires it.

### Blocks release?
**No**, given current honest UI/docs, unless App Store / marketing claims encrypted SIWA cloud storage. Then **Yes**.

---

## Privacy and encryption claims

**Status:** NOT CONFIRMED as deceptive SIWA/HIPAA in-app claims. **CONFIRMED** documentation drift on CloudKit enablement.

### Checked surfaces
| Surface | Observation |
| --- | --- |
| `PrivacyScreen.tsx` | States not HIPAA; AI third-party disclosure; exports unencrypted |
| `BackupRestoreScreen.tsx` | SIWA: “not end-to-end encrypted”; CloudKit: AES-256-GCM (matches `cloudkit-crypto.ts`) |
| `SECURITY.md` / `SECURITY_QUICKSTART.md` | Explicitly forbid HIPAA / fake AES marketing |
| `constants/feature-flags.ts` | `cloudKitBackupEnabled: true` |
| `SECURITY.md` line on CloudKit | Still says flag “stays off until Production schema deploy” — **stale** |
| `docs/SIGN_IN_WITH_APPLE.md` | Still says CloudKit flag remains off — **stale** vs flag |
| App Store Connect privacy nutrition labels / review notes | **Not verified** |

### Health data exposure
Claim issues are trust/compliance, not a new storage hole.

### Smallest safe fix
Update `SECURITY.md` / SIWA doc flag wording to match `cloudKitBackupEnabled: true`. Confirm App Store privacy answers match (SIWA optional cloud copy; CloudKit encrypted when used; not HIPAA).

### Blocks release?
**No** for verified in-app SIWA/HIPAA honesty. **Yes** only if App Store listing claims AES/HIPAA for AsyncStorage or SIWA jsonb (listing not verified here).

---

## What was not done (by design)

- No production HTTP invokes, RLS queries, or credential reads  
- No dependency installs  
- No policy or function deploys  
- No authorization tests against real user data  

## Recommended next step (awaiting approval)

1. Operator: verify caregiver RLS + Edge Function JWT/deploy status (checklist only).  
2. Approve smallest code fixes in order: **disable/auth Edge functions → AI JWT + rate limit → doc flag sync**.  
3. Defer SIWA encryption unless product wants to market encrypted cloud backup.

*Stop here — no fixes implemented.*
