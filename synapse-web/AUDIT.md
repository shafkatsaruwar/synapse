# Synapse Web 2.0 — audit and plan

This marketing site is a Next.js app in `synapse-web/`. It does not replace the iOS app.

## What this repository is

This is the Synapse source. The active product is `synapse-reset/` (Expo 54, expo-router, Supabase). https://synapse-health.vercel.app now serves this marketing site. The Vercel project root directory is `synapse-web`, and `synapse-web/vercel.json` sets the Next.js install and build. The old root `vercel.json` pointed every git deploy at `cd synapse-reset && npm install` even after that root directory change, so it was removed. The Expo web export is retired. There is no Resend / send-email API on this site.

## What was not changed

No edits under `synapse-reset/ios`, `synapse-reset/android`, `synapse-reset/app`, screens, `eas.json`, or `app.config.js`. The app was read for facts, colors, and the logo files copied into `synapse-web/public/brand/`.

## Brand

- In-app accent / tint, in `synapse-reset/themes/light.ts` and `constants/colors.ts`: **#A30D24** burgundy. Emergency card header in the app uses `#800020`.
- Warm paper backgrounds in the app are around `#F7F8FA` and `#F5F1EA`. This site uses `#F6F3EE`.
- App icon files (`assets/icon.png`, `assets/images/synapse-logo-light.png`) are a blue-violet S on a warm ground, not a burgundy tile. The site uses that mark as shipped and uses burgundy for type, rules, and buttons. Notification tint in `app.config.js` is `#2B5FBF`; the product UI accent is still burgundy, and that is what this site follows.
- Type in the app is the system font. The marketing site uses Fraunces and Figtree. It does not reuse Apple artwork.

## Legal, support, store

| Need | Where it actually lives |
| --- | --- |
| App Store | https://apps.apple.com/us/app/synapse-health-companion/id6759972036 — also `synapse-reset/eas.json` `ascAppId` `6759972036` and the root README |
| Privacy policy URL | None in the repo. The product statement is the in-app `PrivacyScreen` (`synapse-reset/screens/PrivacyScreen.tsx`). Engineering notes are `synapse-reset/SECURITY.md`. `/privacy` restates those, and says so. |
| Terms | None in the repo or the app. `/terms` says that and links the App Store listing and `/privacy`. It does not invent terms. |
| Support email | None. `FeedbackScreen` writes to on-device `feedbackStorage`. `/support` says that and links the App Store. |
| Analytics | The app stores a few on-device milestones (`synapse-reset/docs/RETENTION_MEASUREMENT.md`) and does not ship a third-party SDK. This site’s `lib/analytics.ts` sends nothing unless `NEXT_PUBLIC_ANALYTICS_ENDPOINT` is set and the visitor has granted consent. No health fields. |

## Feature claims that were checked

Verified in `synapse-reset/FEATURES.md`, the screens, and the libs named there:

- Medications: scheduled and PRN, dose logging, daily / weekly / biweekly / custom reminders, local notifications with mark-taken and a 10-minute snooze (`lib/notification-manager.ts`), route / pharmacy / refill fields.
- Appointments: create, status, repeat, notes, Apple Calendar import, `.ics` preview, iPhone leave-by travel estimate when a location exists.
- Records: lab values and notes, imaging entries, conditions, allergies, timeline. No provider sync. Document scanner flag `documentScannerEnabled` is **false**.
- Daily log: overall feeling, fatigue, energy, mood, sleep, notes. Symptoms are a separate log. Not a diagnosis.
- Sick Mode: calmer surface, temperature / hydration / food / rest, gentle check-ins, a recovering pause, logs kept when it ends. It tells the person to seek care themselves. It does not diagnose, treat, or call anyone.
- Emergency card fields and a user-written protocol. A saved number can open the dialer. No automatic emergency-service contact.
- Local-first storage, file export / restore, delete-all. Optional Supabase sign-in and optional cloud copy. Face ID app lock on device. Apple Health read-only import. Calendar read for import.
- Automatic iCloud backup: **off** (`cloudKitBackupEnabled: false`), even though native CloudKit files exist.
- Not HIPAA, not medical advice, not AES / end-to-end encryption. `lib/encryption.ts` warns that it is not AES.

Not claimed, because they are not true in this tree: Android availability (the folder exists; the root README says Android is in progress), Synapse Plus, any price, working iCloud backup, provider sync, encryption, HIPAA compliance.

Meet the Founder names Mohammed Shafkat Saruwar and includes a short note. `/story` uses that and does not add a biography. The in-app line “No accounts” is corrected on the story page: an account is optional.

Screenshots on this site are HTML recreations of the information architecture with fictional data (Alex Rivera and sample doses). React Native screens cannot be mounted inside Next.js. They are not the owner’s records.

## Plan that was built

1. New app, new routes, shared tokens, one feature-content module.
2. Scroll choreography as pure functions (`lib/animation/scene-sample.ts`) with tests for a 2-panel subset and the 5-panel scene: no intersections before the merge, strings released before the fall, reversible camera steps, the scripted lines.
3. A lazy WebGL studio (phone, five glass panels, strings, staggered stack, align, merge, Today texture). Reduced motion shows the ending immediately. Very small devices get a static storyboard.
4. Editorial feature pages, privacy, story, support, terms.
5. SEO files, and analytics that stay off.

## Known limits

- The 3D phone and panels are procedural geometry, not a scanned GLB.
- Glass transmission is desktop-only. Narrow viewports use a simpler material and a different camera.
- Sway and the stack orbit use time, so a paused scroll still breathes. Poses are otherwise a function of scroll progress. `?phase=STACK` (and the other phase names) locks progress for screenshots.
- Canonical URLs use `NEXT_PUBLIC_SITE_URL` or, if unset, `https://synapse-health.vercel.app`, which today serves the Expo app. Set the env var when this site has its own host.
- No production deploy was made.
