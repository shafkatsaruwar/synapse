# SHIELD-005 — Caregiver Edge Auth: Stop Decision

**Date:** 2026-11-14  
**Branch:** `cursor/shield-005-caregiver-auth-099f`  
**Mode:** Design decision only. **No Edge Function auth shipped.** No deploy. No production Supabase edits. No credential rotation. No dependency installs. No data deletion.

---

## Verdict

**Stopped before implementing JWT authentication in `send-caregiver-event` / `send-caregiver-reminder`.**

Cloud caregiver identities today are primarily **`local_<uuid>` install IDs** stored in AsyncStorage. Those IDs **cannot be securely proven** with a Supabase user JWT. Inventing a client-supplied mapping (`local_*` ↔ `auth.uid()`) would reintroduce spoofing and violate the SHIELD-005 requirements.

Until a migration binds caregiver rows to `auth.users.id`, adding “JWT auth” either:

1. **Breaks** legitimate cloud caregiver push for the common unsigned-in path, or  
2. **Fakes** authorization by trusting body/local IDs (insecure).

Neither is acceptable.

---

## Inspection summary

### Edge Functions (current)

| File | Auth today | Authz today | Trusts body |
| --- | --- | --- | --- |
| `supabase/functions/send-caregiver-event/index.ts` | None | Looks up events by `patientUserId` + `eventKey` via **service role** | `patientUserId`, `eventKey`, optional `type`/`payload` |
| `supabase/functions/send-caregiver-reminder/index.ts` | None | Checks `linked_users` includes body `caregiverUserId` | `patientUserId`, `caregiverUserId`, **`message`** |

Neither calls `auth.getUser()` / JWT verification. Neither proves the **caller** is the patient or caregiver.

### Client identity (`lib/caregiver-linking.ts`)

```ts
export async function getLinkingUserId(authUserId?: string | null): Promise<string> {
  if (authUserId) return authUserId;
  const existing = await AsyncStorage.getItem(INSTALL_USER_ID_KEY);
  if (existing) return existing;
  const next = `local_${Crypto.randomUUID()}`;
  await AsyncStorage.setItem(INSTALL_USER_ID_KEY, next);
  return next;
}
```

| Path | Linking ID used |
| --- | --- |
| Settings / Caregiver Dashboard when SIWA session exists | Supabase `user.id` (UUID) |
| Settings / Dashboard when signed out | `local_*` |
| `notification-manager.ts` accountability reports | **Always** `getLinkingUserId()` with **no** `authUserId` → **`local_*`** |

Call sites for Edge invokes:

- `reportAccountabilityEventIfNeeded` → `functions.invoke("send-caregiver-event", { patientUserId, eventKey, type, payload })`
- `sendCaregiverReminder` → `functions.invoke("send-caregiver-reminder", { patientUserId, caregiverUserId, message })`

### Why JWT cannot authorize `local_*`

| Requirement | `local_*` reality |
| --- | --- |
| Verified Supabase user JWT | Install ID is not an `auth.users` subject |
| Do not trust body user IDs | Caller cannot present a JWT whose `sub` equals `local_*` |
| Do not use anon/publishable key as identity | Anon key is already public; proves nothing |
| Server-side link ownership | Rows keyed by `local_*` have no FK to `auth.uid()` |

A header like `X-Local-User-Id: local_…` is forgeable. Hashing the install ID into a “token” without a server-held secret still allows replay/theft from device storage and does not meet “verified Supabase user JWT.”

### Related: RLS lockdown vs client writes

Repo SQL (`caregiver_linking_v2_lockdown.sql`) denies `anon`/`authenticated` access to caregiver tables. Client upserts of events/users therefore fail when lockdown is applied; Edge Functions still bypass RLS via service role. That means push can still be abused if functions are publicly invokable, while **honest clients** may already be unable to write cloud caregiver rows. Production apply status remains **Not verified** (SHIELD-S1).

---

## Required migration / design decision (choose one)

### Option A — Auth-bound cloud caregiver (recommended)

**Goal:** Cloud caregiver linking + push only for signed-in Supabase users.

1. Require SIWA (or email) session before any cloud link/code/event/reminder.
2. Persist `caregiver_users.user_id = auth.uid()` only (UUID text / uuid type). Reject / never create `local_*` for cloud tables.
3. Migrate or abandon existing `local_*` rows (see data note below).
4. Edge Functions:
   - Extract `Authorization: Bearer <access_token>`.
   - `createClient(url, anonKey, { global: { headers: { Authorization } } })` then `auth.getUser()` — **or** service-role admin `getUser(jwt)`.
   - **401** if missing/invalid JWT (never treat anon key alone as identity).
   - Resolve actor = `user.id`.
   - **Event:** authorize `actor === patient_user_id` for the event row loaded by trusted `eventKey`+patient scoped to actor; load notification copy from **DB payload / server templates only** (ignore body `message`/`payload`).
   - **Reminder:** authorize `actor` is linked caregiver for patient; body may carry `patientUserId` only as a hint then re-check `linked_users` server-side; use **fixed templates** (no client `message`).
   - **403** if JWT valid but not linked / not owner.
5. Client: pass session JWT on `functions.invoke`; pass `authUserId` into all `report*` paths from AuthContext (fix notification-manager).
6. Keep on-device caregiver mode (Care Connections / local profiles) **unchanged** and server-free.

**Complexity:** Medium. **Data-loss risk:** Medium if wiping `local_*` cloud rows without user notice. **Feature break:** Cloud push for unsigned-in installs stops (correct).

### Option B — Disable cloud caregiver push until Option A

1. Do not deploy auth half-measures.
2. Remove or hard-disable Edge Function deploys; document “cloud caregiver linking unavailable.”
3. Rely on on-device caregiver / Care Connections.
4. Leave tables + RLS lockdown as-is.

**Complexity:** Small (ops). **Safest interim for App Store.**

### Option C — Rejected: map `local_*` ↔ auth later via client claim

Any scheme where the client asserts “I am `local_X`” (even after sign-in) without a prior server-issued binding ceremony is **rejected** for SHIELD-005.

A secure binding would require a **new** protocol (e.g. signed-in user creates a one-time bind of install ID under JWT, stored server-side, then all future rows use `auth.uid()`). That is still a migration (Option A variant), not a one-line Edge fix.

---

## What was intentionally not implemented

- JWT checks inside the two Edge Functions  
- Client invoke header changes  
- Tests for 401/403/authorized paths (blocked on identity model)  
- Production/staging deploys  
- RLS policy edits  
- Credential rotation  
- Deletion of `local_*` rows  

---

## Tests (status)

| Case | Result |
| --- | --- |
| No token / anon only / invalid JWT / unrelated user / authorized / malformed | **Not implemented** — blocked on design decision |
| Static analysis of identity coupling | **Pass** — `local_*` path confirmed; notification-manager omits `authUserId` |

---

## Risks if we had forced JWT-only auth without migration

| Risk | Impact |
| --- | --- |
| All `notification-manager` reports stay on `local_*` → always 401/403 | Silent loss of missed-med caregiver alerts |
| Mixed UUID + `local_*` links in DB | Authorized SIWA users cannot match linked partners |
| Trusting body `patientUserId` after JWT | Cross-patient push if only “has some JWT” checked |
| Keeping body `message` | Phishing push text |

---

## Staging deployment plan (after Option A is approved and coded)

1. **Staging Supabase only:** deploy function revisions with JWT + link checks; keep production untouched.  
2. Create two staging auth users (patient + caregiver); link via code while signed in.  
3. Automated/manual cases: no token → 401; anon key only → 401; invalid JWT → 401; valid unrelated user → 403; linked patient triggers event → 200 + push; linked caregiver reminder → 200 with template body; malformed JSON → 400.  
4. Confirm notification text cannot be overridden by request `message`.  
5. Verify unsigned-in client does not create new `local_*` cloud rows.  
6. Only then schedule production deploy + App Store build that passes session into report paths.  
7. **Stop gate:** no production deploy from this branch until Option A (or B) is explicitly approved.

---

## Operator interim recommendation (no code required)

Until Option A ships:

1. Confirm whether `send-caregiver-event` / `send-caregiver-reminder` are deployed.  
2. If deployed and JWT gateway verify is off → **disable** the functions.  
3. Confirm SHIELD-S1 RLS lockdown is applied.  
4. Prefer on-device caregiver / Care Connections in product copy.

---

## Decision needed from product/engineering

Reply with one of:

- **A** — Proceed with auth-bound cloud caregiver migration + Edge JWT/authz + client session wiring (new implementation PR).  
- **B** — Disable / document cloud caregiver push; defer migration.  
- **Other** — Specify constraints (must keep unsigned-in cloud linking) knowing that conflicts with SHIELD-005 JWT requirements.

*No application or Edge Function code was changed in this stop decision.*
