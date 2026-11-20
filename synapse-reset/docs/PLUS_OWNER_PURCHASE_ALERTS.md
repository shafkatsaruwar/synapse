# Owner-only Synapse Plus purchase alerts

When a **real** customer buys Synapse Plus, Apple sends an App Store Server Notification V2 to a Supabase Edge Function. After signature verification and dedupe, Expo Push notifies your registered iPhone:

- **Title:** 🎉 New Synapse Plus Purchase!
- **Body:** Someone just purchased Synapse Plus! Your app is growing. 🌱

No customer identity or health information is included.

**This repo change does not deploy anything.** You must apply SQL, set secrets, deploy functions, and configure App Store Connect yourself.

## What was added

| Piece | Path |
| --- | --- |
| SQL (owner devices + event dedupe) | `supabase/plus_owner_alerts_v1.sql` |
| ASSN V2 webhook | `supabase/functions/app-store-notifications/` |
| Register owner device | `supabase/functions/register-owner-device/` |
| Secure test push | `supabase/functions/owner-test-notification/` |
| Policy (new buy vs renewal) | `supabase/functions/_shared/purchase-alert-policy.ts` |
| Apple JWS verify | `supabase/functions/_shared/apple-assn.ts` (`@apple/app-store-server-library`) |
| In-app founder tools | Synapse Plus settings → **Founder tools** |

Purchase / entitlement / pricing code is **unchanged**.

### Alerts that fire
- `SUBSCRIBED` + `INITIAL_BUY` or `RESUBSCRIBE` for `com.synapse.monthly` / `com.synapse.yearly`
- `ONE_TIME_CHARGE` for `com.synapse.plus.lifetime`

### Alerts that do **not** fire
- Renewals (`DID_RENEW`), refunds, status changes, non-Plus products
- Duplicate `notificationUUID` / already-alerted `transactionId`
- **Sandbox / TestFlight** by default (`OWNER_NOTIFY_SANDBOX` must be `true` to push those; they still get recorded)

---

## 1. Supabase (do this first)

### A. Run SQL
Supabase Dashboard → **SQL** → paste and run:

`synapse-reset/supabase/plus_owner_alerts_v1.sql`

Creates:
- `owner_push_devices`
- `plus_purchase_notification_events`  
Both deny `anon` / `authenticated` (service role only).

### B. Function secrets
Project **Settings → Edge Functions → Secrets** (or CLI):

| Secret | Purpose |
| --- | --- |
| `OWNER_ALERTS_SECRET` | Long random string you invent. Used to register devices + send tests. **Never commit.** |
| `APP_BUNDLE_ID` | `com.mohammedsaruwar.synapse` (optional; this is the default) |
| `APP_APPLE_ID` | `6759972036` (optional; default matches `eas.json`) |
| `OWNER_NOTIFY_SANDBOX` | `false` (default). Set `true` only if you want Sandbox/TestFlight pushes too. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to functions.

### C. Deploy functions (when you approve)
From `synapse-reset/`:

```bash
npx supabase functions deploy app-store-notifications --no-verify-jwt
npx supabase functions deploy register-owner-device --no-verify-jwt
npx supabase functions deploy owner-test-notification --no-verify-jwt
```

`--no-verify-jwt` is required for Apple’s webhook (Apple does not send a Supabase JWT). Owner endpoints are protected by `OWNER_ALERTS_SECRET` instead.

Webhook URL (replace project ref):

`https://<PROJECT_REF>.supabase.co/functions/v1/app-store-notifications`

---

## 2. App Store Connect

1. Open the Synapse app (`6759972036`).
2. **App Store Server Notifications** (or **General → App Information** → Server Notifications, depending on ASC UI).
3. Set **Production Server URL** to the webhook above.
4. Set **Sandbox Server URL** to the **same** URL (the function separates environments; Sandbox pushes stay off unless you set `OWNER_NOTIFY_SANDBOX=true`).
5. Version: **Version 2** notifications.
6. Save. Optionally send Apple’s test notification once the function is deployed.

---

## 3. Your iPhone

1. Install a build that includes this code (TestFlight / native).
2. Allow notifications for Synapse.
3. Open **You → Synapse Plus → Founder tools**.
4. Enter `OWNER_ALERTS_SECRET` → **Register this iPhone**.
5. Tap **Send test notification** — you should see the celebration (with a `[Test]` body prefix).

Or via curl (after you have an `ExponentPushToken[…]` from the device logs / registration):

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/register-owner-device" \
  -H "Authorization: Bearer $OWNER_ALERTS_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"expoPushToken":"ExponentPushToken[…]","label":"Mohammed iPhone"}'

curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/owner-test-notification" \
  -H "Authorization: Bearer $OWNER_ALERTS_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"environment":"Production"}'
```

---

## Retries & failures

| Case | Behavior |
| --- | --- |
| Apple retries same `notificationUUID` | `200` + no second push |
| Same `transactionId` already alerted | Skipped as duplicate |
| Expo `DeviceNotRegistered` | Token disabled in `owner_push_devices` |
| All Expo sends fail | `500` so Apple retries |
| Intentional skip (renewal / sandbox) | `200` so Apple stops |
| Bad signature | `500` (misconfig) until fixed |

---

## Local checks (no deploy)

```bash
cd synapse-reset
npm run test:owner-alerts
```

---

## Privacy

- Push title/body are fixed marketing copy only.
- DB stores notification metadata (UUID, type, product id, transaction ids) — **not** names, emails, or health data.
- Do not put PHI into Expo `data` payloads.
