# Security quick start (honest)

Synapse is a **local-first consumer wellness app**. Follow these steps so deploys are not accidentally open or overclaimed.

## 1. Protect AI / email APIs

```bash
# On the API server (Express / Vercel)
export API_SHARED_SECRET="$(openssl rand -hex 32)"

# In synapse-reset/.env (and EAS env) — must match
EXPO_PUBLIC_API_SHARED_SECRET=<same value>
```

Restart the API after setting the secret. Without it, PHI routes return 503.

## 2. Lock down caregiver tables

If you ever ran the old permissive caregiver SQL, run:

`synapse-reset/supabase/caregiver_linking_v2_lockdown.sql`

in the Supabase SQL editor. This denies anon/authenticated client access. On-device caregiver mode still works locally.

## 3. Do not claim encryption or HIPAA

- Health data on device uses ordinary local storage unless you add real crypto later.
- `lib/encryption.ts` / `lib/secure-storage.ts` are **not** AES-256 and must not be described as such.
- Do not check “HIPAA compliant” in store listings, investor decks, or in-app copy.

## 4. Privacy copy

In-app Privacy & Data must disclose optional iCloud, AI processors, export, and that Synapse is not medical care / not a HIPAA CE product.

## 5. App Lock

Enable App Lock in Privacy on iOS/Android. Unlock requires successful biometric/passcode auth — there is no Cancel-to-skip path.
