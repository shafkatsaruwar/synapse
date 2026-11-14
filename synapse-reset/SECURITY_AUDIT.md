# Synapse Security Audit — Project Shield

**Mode:** Read-only defensive audit (no code or production changes performed during inspection).  
**Scope:** Synapse Health Companion (`synapse-reset/`), plus shared `server/`, `supabase/`, and `mcp/` as used by the app.  
**Date:** 2026-11-14  
**App context:** Expo / React Native iOS health companion; local-first storage; optional Supabase, Apple auth, CloudKit, StoreKit.

> Synapse is a personal consumer wellness app — **not** a HIPAA covered entity and **not** a medical device. This audit does **not** claim compliance certifications. Passing automated scans does **not** mean the app is “secure.”

---

## 1. Attack surface map

### 1.1 Health information storage

| Location | What | Protection | Verified |
| --- | --- | --- | --- |
| AsyncStorage (`lib/storage.ts` keys `fir_*`, emergency card, care profiles, etc.) | Primary PHI: meds, logs, labs, appointments, allergies, profiles | **Unencrypted** JSON | Yes |
| `lib/secure-storage.ts` / `lib/encryption.ts` | Misleading “secure” helpers (base64 / hash, not AES) | **Not real encryption** | Yes |
| SecureStore | CloudKit DEK, Care Connection identity secrets, Plus promo flag | Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY` for DEK/identity) | Yes |
| App Group `group.com.mohammedsaruwar.synapse` | Widget snapshot (med names, symptoms, etc.) | Shared container; not app-sandbox-only | Yes |
| Manual / Files / share JSON backups | Full `ExportPayload` | **Unencrypted** | Yes |
| Supabase `user_backups.data` (jsonb) | Full export for SIWA cloud backup | RLS owner-only; **plaintext at rest** | Yes (schema/client) |
| CloudKit private DB `UserData` | Encrypted AES-256-GCM envelopes + passphrase wrap | Strong when flag/schema/recovery OK | Code yes; live Production schema **Not verified** |
| Apple Health → `fir_vitals` | Imported vitals | Same as AsyncStorage | Yes |
| SQLite | — | Not used in `synapse-reset/` | Yes |
| Supabase Storage buckets | — | None found | Yes |

### 1.2 Network / API endpoints

| Endpoint / system | Auth | Notes | Verified |
| --- | --- | --- | --- |
| `POST /api/analyze-document`, `/api/health-insights`, `/api/compare-medications` | Shared `API_SHARED_SECRET` (`X-API-Key` / Bearer) | Sends selected PHI → OpenAI | Yes |
| Supabase Auth + REST | User session / anon | Auth, `user_backups`, doctors, appointments, caregiver tables | Yes |
| Edge `delete-account` | Bearer → `auth.getUser()` | Deletes caller’s auth + caregiver rows | Yes |
| Edge `send-caregiver-event`, `send-caregiver-reminder` | **No in-function auth** | Service role + Expo Push | Yes |
| Expo Push `exp.host/--/api/v2/push/send` | Platform | Caregiver (and owner-alerts on PR branch) | Yes |
| MCP `/mcp` | `SYNAPSE_MCP_TOKEN` or user JWT | Read-only health connector | Yes |
| StoreKit / SIWA / HealthKit / CloudKit | Apple native | On-device | Yes |
| EAS Update `u.expo.dev` | Channel + runtime | OTA JS | Yes |
| Live Supabase project config (providers, JWT verify flags, applied migrations) | — | — | **Not verified** |
| Whether Replit integration routes are mounted in production | — | Present under `server/replit_integrations/` | **Not verified** |

### 1.3 Authentication & authorization

- Email/password + Sign in with Apple → Supabase session (AsyncStorage-persisted).
- App Lock: local biometrics (`BiometricGate`); web skips lock.
- PHI AI APIs: extractable client shared secret (documented limitation).
- Plus entitlement: **on-device StoreKit confirmation only** (no App Store Server API gate).
- Care Connection: local crypto; no Synapse server.
- Caregiver cloud tables: SQL deny for anon/authenticated (if v2 applied).
- Owner purchase alerts (PR `#102`, may not be on `main`): ASSN JWS verify + `OWNER_ALERTS_SECRET` for register/test.

### 1.4 Secrets & build configuration (names only)

**Client / EAS:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_SHARED_SECRET`  
**Server:** `API_SHARED_SECRET`, OpenAI keys, `DATABASE_URL`  
**MCP / Edge:** `SYNAPSE_MCP_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNAPSE_OWNER_USER_ID`, `OWNER_ALERTS_SECRET` (alerts PR)  
**Repo:** `synapse-reset/.env` is **git-tracked** and contains Supabase URL + anon key names (anon is public-by-design). No `service_role` found committed in `.env` (names-only check).

### 1.5 Push infrastructure

- Local: `expo-notifications` (meds, appointments, check-ins) — bodies often include medication / doctor details.
- Remote caregiver: Edge → Expo Push (token in `caregiver_users`).
- Owner Plus alerts: designed on PR branch; not confirmed deployed.

### 1.6 Dependency audit (safe, local)

`npm audit` in `synapse-reset` (approx.): **78** reported issues including **2 critical** (`shell-quote`, `tar` via tooling chains) and **18 high** (includes `ws`, `zod`, others). Many are transitive / Expo toolchain. **Does not prove runtime exploitability** in the shipping iOS binary.

---

## 2. Confirmed findings

### SHIELD-001 — Unencrypted local PHI (AsyncStorage)

| Field | Detail |
| --- | --- |
| **Severity** | High |
| **Component** | `lib/storage.ts`, emergency card, related AsyncStorage keys |
| **Evidence** | Health records persisted as plain JSON; `SECURITY.md` already states this |
| **Exploit conditions** | Unencrypted device backup, forensic extraction, compromised device filesystem |
| **Impact** | Full local medical snapshot disclosure |
| **Confidence** | High |
| **Recommended fix** | Prefer Secure Enclave / Keychain-wrapped DEK for sensitive fields or document clearly; short-term: enable device passcode + App Lock messaging; avoid overclaiming encryption |
| **Regression test** | Unit/integration asserting sensitive exports never log plaintext; privacy copy matches reality |
| **Blocks release?** | No if marketing stays honest; **Yes** if App Store / Privacy copy claims AES/HIPAA |

### SHIELD-002 — Misleading “encryption” modules

| Field | Detail |
| --- | --- |
| **Severity** | High (if relied on); Medium (legacy naming) |
| **Component** | `lib/encryption.ts`, `lib/secure-storage.ts` |
| **Evidence** | Headers admit non-AES; “encrypt” uses base64 + hash; decrypt ignores MAC; `deriveEncryptionKey` uses fresh UUID |
| **Exploit conditions** | Developer or operator assumes data is protected |
| **Impact** | False sense of security; possible misuse for new PHI fields |
| **Confidence** | High |
| **Recommended fix** | Rename / quarantine; ban new call sites; add lint or comment gates |
| **Regression test** | Grep CI fails on new imports of these modules for PHI |
| **Blocks release?** | No if unused for primary PHI and copy is accurate |

### SHIELD-003 — Auth session tokens in AsyncStorage

| Field | Detail |
| --- | --- |
| **Severity** | High |
| **Component** | `lib/supabase.ts` (persistSession + AsyncStorage adapter) |
| **Evidence** | Session stored alongside PHI store |
| **Exploit conditions** | Same as SHIELD-001 |
| **Impact** | Session theft → cloud `user_backups` / account actions as that user |
| **Confidence** | High |
| **Recommended fix** | Persist Supabase session via SecureStore adapter (with migration) |
| **Regression test** | Session round-trip after relaunch; SecureStore-only location check in tests/mocks |
| **Blocks release?** | Prefer P0 for cloud-backup users; not hard block if SIWA optional and disclosed |

### SHIELD-004 — Plaintext Supabase `user_backups`

| Field | Detail |
| --- | --- |
| **Severity** | High |
| **Component** | `lib/backup.ts`, `supabase/migrations/002_user_backups_jsonb.sql` |
| **Evidence** | Full `exportAllData()` upserted as jsonb; RLS is owner-scoped only |
| **Exploit conditions** | Service role leak, mis-set RLS, insider/DB access |
| **Impact** | Cloud disclosure of full health export |
| **Confidence** | High |
| **Recommended fix** | Client-side encrypt before upload (user key / SIWA-bound key) or stop uploading full PHI; keep RLS |
| **Regression test** | Staging: second user cannot SELECT; ciphertext not parseable as JSON health fields |
| **Blocks release?** | **P0** if SIWA cloud backup is marketed as secure/encrypted |

### SHIELD-005 — Caregiver Edge Functions lack caller authentication

| Field | Detail |
| --- | --- |
| **Severity** | High (if functions deployed + any caregiver rows); Medium if unused |
| **Component** | `supabase/functions/send-caregiver-event`, `send-caregiver-reminder` |
| **Evidence** | No `auth.getUser` / shared secret; uses service role; reminder body includes attacker-supplied `message` |
| **Exploit conditions** | Function URL reachable without JWT verify; known/guessable user ids; linked rows exist |
| **Impact** | Unauthorized push to registered devices; phishing/spam; med names in alerts |
| **Confidence** | High (code); deploy JWT setting **Not verified** |
| **Recommended fix** | Require verified user JWT **and** authorize against link; or disable/delete functions; never trust client `message` blindly |
| **Regression test** | Staging: unauthenticated invoke → 401; cross-user invoke → 403 |
| **Blocks release?** | **P0** until deploy auth confirmed or functions disabled |

### SHIELD-006 — Client-extractable API shared secret for PHI AI routes

| Field | Detail |
| --- | --- |
| **Severity** | High |
| **Component** | `EXPO_PUBLIC_API_SHARED_SECRET`, `lib/api.ts`, `server/api-auth.ts`, `server/routes.ts` |
| **Evidence** | Public env baked into binary; gates all health AI POSTs |
| **Exploit conditions** | Extract secret from IPA / JS bundle |
| **Impact** | Unlimited AI abuse; PHI submitted to third-party AI; cost DoS |
| **Confidence** | High |
| **Recommended fix** | Verify Supabase (or Apple) user JWT on server; rate limit; drop shared secret as sole gate |
| **Regression test** | Request without user JWT fails; rate limit returns 429 |
| **Blocks release?** | **P0** if AI features ship to production without per-user auth |

### SHIELD-007 — No server rate limiting / weak server validation on PHI APIs

| Field | Detail |
| --- | --- |
| **Severity** | Medium–High |
| **Component** | `server/` (rate-limit unused; 20mb JSON body) |
| **Evidence** | `express-rate-limit` present in lockfile but not wired; client Zod not re-applied server-side |
| **Exploit conditions** | Possession of API secret (SHIELD-006) |
| **Impact** | Cost/DoS; malformed payload handling risk |
| **Confidence** | High |
| **Recommended fix** | Rate limit per IP + per user; Zod on server; size caps |
| **Regression test** | Burst requests → 429; oversized body rejected |
| **Blocks release?** | P1 (P0 if AI is heavily promoted) |

### SHIELD-008 — StoreKit entitlement client-only (spoofable)

| Field | Detail |
| --- | --- |
| **Severity** | Medium (revenue / feature abuse) |
| **Component** | `PlusProviderIOS.tsx`, `lib/plus/entitlement.ts`, `lib/plus/promo.ts` |
| **Evidence** | `confirmOnDeviceIOS` only; promo lifetime flag forgeable in SecureStore/AsyncStorage |
| **Exploit conditions** | Jailbreak / patched client / local flag write |
| **Impact** | Free Synapse Plus features; not a confidentiality break |
| **Confidence** | High |
| **Recommended fix** | Optional App Store Server API verification for gated premium if spoofing matters |
| **Regression test** | Sandbox purchase still unlocks; forged local flag alone insufficient if server gate added |
| **Blocks release?** | No for confidentiality; business decision for IAP |

### SHIELD-009 — Lock screen / widget PHI exposure

| Field | Detail |
| --- | --- |
| **Severity** | Medium |
| **Component** | `lib/notification-manager.ts`, `lib/widget-sync.ts` |
| **Evidence** | Notification bodies include medication names/doses; widgets write rich App Group snapshots |
| **Exploit conditions** | Visible lock screen, screenshots, shared device |
| **Impact** | Sensitive health disclosure without unlocking app |
| **Confidence** | High |
| **Recommended fix** | Default generic notification bodies; user opt-in to show names; minimize widget fields |
| **Regression test** | Default schedule content excludes med names |
| **Blocks release?** | No; strong P1 for privacy |

### SHIELD-010 — App Lock preference bypass via AsyncStorage

| Field | Detail |
| --- | --- |
| **Severity** | Medium |
| **Component** | `lib/biometric-storage.ts`, `BiometricGate.tsx` |
| **Evidence** | Enable flag in AsyncStorage; web always unlocked |
| **Exploit conditions** | Local storage write without biometrics |
| **Impact** | Skip App Lock on compromised device |
| **Confidence** | High |
| **Recommended fix** | Store lock-enabled in SecureStore; treat missing SecureStore as locked if previously enabled |
| **Regression test** | Flipping AsyncStorage alone does not disable lock |
| **Blocks release?** | No |

### SHIELD-011 — Caregiver link codes use `Math.random()`

| Field | Detail |
| --- | --- |
| **Severity** | Low–Medium |
| **Component** | `lib/caregiver-linking.ts` |
| **Evidence** | Non-CSPRNG for 6-character codes |
| **Exploit conditions** | Cloud linking active with guessable codes |
| **Impact** | Link hijack if cloud path live |
| **Confidence** | High |
| **Recommended fix** | `expo-crypto.getRandomBytes` |
| **Regression test** | Code generator unit test uses mocked CSPRNG |
| **Blocks release?** | No if cloud linking locked down |

### SHIELD-012 — CloudKit wrap accepts attacker-controlled scrypt params

| Field | Detail |
| --- | --- |
| **Severity** | Low–Medium |
| **Component** | `lib/cloudkit-crypto.ts` `unwrapDek` |
| **Evidence** | Uses `wrap.N/r/p` from envelope without upper bounds |
| **Exploit conditions** | Malicious/corrupt CloudKit payload opened on device |
| **Impact** | CPU DoS or weakened KDF if extreme params accepted |
| **Confidence** | Medium–High |
| **Recommended fix** | Clamp to known-good param set; reject others |
| **Regression test** | Huge `N` rejected |
| **Blocks release?** | No |

### SHIELD-013 — Docs / flag inconsistency on CloudKit enablement

| Field | Detail |
| --- | --- |
| **Severity** | Low (process / trust) |
| **Component** | `constants/feature-flags.ts` (`cloudKitBackupEnabled: true`) vs `SECURITY.md` text still saying flag off |
| **Evidence** | Conflicting operator guidance |
| **Impact** | Misconfigured expectations; incomplete Production schema → user-facing failures |
| **Confidence** | High |
| **Recommended fix** | Align docs with flag; verify Production CloudKit schema |
| **Regression test** | Doc lint / checklist |
| **Blocks release?** | No |

### SHIELD-014 — Dependency vulnerabilities (toolchain)

| Field | Detail |
| --- | --- |
| **Severity** | Mixed (Critical/High in audit DB; often transitive) |
| **Component** | `npm audit` (`shell-quote`, `tar`, `ws`, `zod`, …) |
| **Evidence** | Local `npm audit` ~78 issues |
| **Exploit conditions** | Varies; many require tooling/dev paths |
| **Impact** | Supply-chain / tooling DoS; assess case-by-case |
| **Confidence** | Medium (presence); Low–Medium (mobile runtime exploit) |
| **Recommended fix** | Prioritize runtime deps; avoid blind `npm audit fix --force` |
| **Regression test** | CI `npm audit --omit=dev` with allowlist |
| **Blocks release?** | Not solely; triage Critical/High runtime paths |

---

## 3. Suspected risks (not confirmed on live systems)

| ID | Risk | Severity if true | Confidence | How to verify (staging only) |
| --- | --- | --- | --- | --- |
| SHIELD-S1 | Production caregiver RLS still `USING (true)` | Critical | Medium | Staging/prod SQL policy inspection with operator approval |
| SHIELD-S2 | Caregiver Edge Functions deployed with JWT verify off | High | Medium | Function settings check; unauthenticated invoke on **staging** |
| SHIELD-S3 | MCP allows any valid user JWT when `SYNAPSE_OWNER_USER_ID` unset | Medium–High | Medium | Staging MCP with non-owner JWT |
| SHIELD-S4 | Wrong Supabase host baked into TestFlight (observed historically as unreachable host) | High (availability/auth) | Medium | Compare EAS secrets to live project ref |
| SHIELD-S5 | Replit chat/image routes mounted without auth in some deploys | High | Low | Inspect production server entrypoints |
| SHIELD-S6 | Owner-alerts functions deployed without secrets / with open JWT | Medium | Low | Only after approved deploy of PR `#102` |

---

## 4. Positive controls observed

- Care Connections use real `@noble` crypto; keys in SecureStore.
- CloudKit path: AES-256-GCM + scrypt wrap; no automatic restore on iCloud sign-in.
- `user_backups` / doctors / appointments RLS uses `auth.uid() = user_id` in repo SQL.
- Caregiver lockdown SQL denies client roles.
- `delete-account` verifies the caller JWT.
- Medication enforcer entitlements are not client-writable.
- Server request logging avoids bodies.
- Existing `SECURITY.md` already rejects HIPAA / fake AES marketing claims.

---

## 5. Safe checks performed

| Check | Result |
| --- | --- |
| Static code review (storage, auth, RLS SQL, edge functions, Plus, backups) | Completed |
| Secret-like pattern scan (paths/names only; no secret values printed) | No private keys / service_role values found committed in `.env` |
| `USING (true)` in SQL | Only mentioned in comments (legacy warning) |
| `npm audit` | ~78 issues; 2 critical transitive (`shell-quote`, `tar`) |
| Live Supabase / ASC / EAS secret values | **Not verified** (by design) |
| Destructive / exploit / production policy changes | **Not run** |

---

## 6. Release blockers (judgment)

Treat as **release blockers** until cleared:

1. **SHIELD-005** — Caregiver push functions unauthenticated (or prove JWT verify + no data).  
2. **SHIELD-S1** — Confirm production caregiver RLS lockdown applied.  
3. **SHIELD-006** — If AI features are live, shared-secret-only auth is insufficient for production trust.  
4. Marketing claims — any “encrypted / HIPAA / AES” language for AsyncStorage or SIWA jsonb backups.

Non-blockers but required soon: SHIELD-003, SHIELD-004 encryption, SHIELD-009 lock-screen privacy.

---

## 7. Staging authorization test plan (proposed — do not run against production users)

Use **dedicated test accounts** A and B on a **staging** Supabase project:

1. A uploads `user_backups` → B cannot SELECT.  
2. Unauthenticated `POST` to caregiver edge functions → expect 401/403.  
3. A invokes caregiver push for B without link → 403.  
4. Expired/forged JWT against `delete-account` → 401; A cannot delete B.  
5. Extractable shared API secret still works today (document as known); after fix, only A’s JWT can call AI routes.  

---

*End of audit report. Remediation ordering: see `SECURITY_ROADMAP.md`.*
