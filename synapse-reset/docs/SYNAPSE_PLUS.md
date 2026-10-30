# Synapse Plus — Implementation & App Store Connect

## Status

Code for Synapse Plus monetization is implemented in `synapse-reset` using **StoreKit 2 via `expo-iap`**.

**Purchases are not claimed working until sandbox / StoreKit testing on a Mac + device (or StoreKit Configuration in Xcode) is completed.** This Linux CI environment cannot run StoreKit.

## Product IDs

Entitlement: `synapse_plus` (app-level; all three products unlock the same features)

| Plan | Product ID | Type | ASC price target | Trial |
|---|---|---|---|---|
| Monthly | `com.synapse.monthly` | Auto-renewable subscription | $4.99 / month | 7-day free intro |
| Annual | `com.synapse.yearly` | Auto-renewable subscription | $49.99 / year | 7-day free intro |
| Lifetime | `com.synapse.plus.lifetime` | Non-consumable | $129.99 | None |

Local StoreKit Configuration: `ios/SynapsePlus.storekit`

## App Store Connect setup

1. **Agreements**: Paid Apps Agreement + banking + tax must be Active.
2. **Subscription group**: Create group named **Synapse Plus**. Put monthly + annual in the **same** group so intro eligibility is shared.
3. **Monthly** (`com.synapse.monthly`):
   - Duration: 1 month
   - Introductory offer: Free, 7 days, one per subscription group
4. **Annual** (`com.synapse.yearly`):
   - Duration: 1 year
   - Same 7-day free introductory offer
5. **Lifetime** (`com.synapse.plus.lifetime`): Non-Consumable. No intro offer.
6. Localization: clear display names/descriptions; do not advertise a trial on Lifetime.
7. Submit IAPs with the app version (or attach to the release).
8. Metadata URLs:
   - Privacy: `https://synapse-health.vercel.app/privacy`
   - Support: `https://synapse-health.vercel.app/support`
   - Terms of Use (EULA): Apple Standard EULA `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` (also linked in-app) or custom Terms at `https://synapse-health.vercel.app/terms`

## Architecture

- `contexts/PlusProviderIOS.tsx` — StoreKit connection, purchase flow (`createPurchaseFlow` + `confirmOnDeviceIOS`), restore, manage subscriptions
- `lib/plus/entitlement.ts` — resolves `synapse_plus` from verified active subscriptions + lifetime purchase (never from a lone local boolean)
- `lib/plus/features.ts` — free vs Plus route map
- `lib/plus/legacy-migration.ts` — 30-day transition for existing local installs
- Paywall: `screens/SynapsePlusPaywallScreen.tsx`
- Settings: `screens/SynapsePlusSettingsScreen.tsx` + Preferences / You & Settings hub

No Stripe / web checkout for digital Plus features. No new backend required for v1 (on-device StoreKit confirmation).

### Promotional codes

The paywall and Synapse Plus settings include a **promo code** field for holiday / special offers. Accepted offers are stored only as salted digests in app code (never as plaintext). A valid redemption unlocks **lifetime** Synapse Plus on that device via SecureStore. Offer codes are distributed out-of-band (email, social, etc.) and must not be committed to the repository.

## Free vs Plus

**Always free:** Medications, Appointments, Sick Mode, basic Emergency Card (view + essential edit), You & Settings essentials (profile, allergy, privacy, backup, preferences).

**Synapse Plus:** How I’m Feeling, Health Records (vitals/labs/imaging/timeline/reports), Wellbeing, Check-In, Care & Support, advanced Emergency Card export/save helpers.

Health hub keeps Plus destinations visible with subtle Plus badges for free users.

## Existing users

Local signals (walkthrough seen, milestones, existing meds/appointments) grant a **30-day Plus transition**. Soft intro modal only — no blocking paywall on launch.

**Limitation:** Users who delete the app and reinstall with empty storage cannot be identified as prior Synapse users.

## Native build

`expo-iap` requires a new native build (`runtimeVersion` / app version **1.17.0**). After pulling:

```bash
cd synapse-reset
npm install
# On macOS:
npx pod-install
# Attach ios/SynapsePlus.storekit to the Xcode scheme for local StoreKit testing
eas build -p ios --profile production
```

Enable **In-App Purchase** capability on the Synapse target if Xcode does not add it automatically after pods install.

## Testing checklist (Mac / device)

- [ ] Products load with localized prices
- [ ] Eligible intro trial (monthly + annual)
- [ ] Ineligible intro (already used trial in group)
- [ ] Lifetime purchase
- [ ] Restore Purchases
- [ ] Cancel / expire subscription (access until period end; data retained)
- [ ] Purchase cancel & failure paths
- [ ] Offline entitlement after prior sync
- [ ] App restart
- [ ] Legacy transition
- [ ] Free features remain open
- [ ] Dynamic Type / VoiceOver / small phones on paywall

## Related: Sign in with Apple / backups

Optional Sign in with Apple for cloud backup is separate from Plus IAP. See `docs/SIGN_IN_WITH_APPLE.md`. Manual file backup remains free and does not require an account or Plus.

## Review notes

See `docs/APP_REVIEW_NOTES_PLUS.md`.
