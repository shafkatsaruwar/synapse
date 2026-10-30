# Sign in with Apple — Optional Cloud Backup

## What it does

Synapse stays **local-first**. Manual Backup & Restore (JSON file) never requires an account.

**Sign in with Apple** is an optional path on iOS:

1. User taps **Sign in with Apple** on Backup & Restore.
2. Native Apple sheet → identity token → Supabase `signInWithIdToken` (`provider: "apple"`).
3. Signed-in users can **Upload Cloud Backup** / **Restore From Cloud** via the existing `user_backups` table.

This is **not** automatic iCloud / CloudKit backup (`cloudKitBackupEnabled` remains off). CloudKit and SIWA cloud backup are separate.

## Can Apple sign-in power backups?

**Yes, for optional Synapse account backups:**

| Path | Account | Where data goes |
|---|---|---|
| Manual file backup | None | File the user saves (Files / iCloud Drive folder they pick) |
| Sign in with Apple → Upload Cloud Backup | Apple ID → Supabase user | `user_backups` row for that user |
| Automatic CloudKit backup | Apple iCloud | Disabled in this build |

Cloud backup JSON is stored with the Synapse backend account (not end-to-end encrypted). Manual file export remains the offline / user-controlled option.

## App code

- `expo-apple-authentication` plugin + `ios.usesAppleSignIn` + entitlement `com.apple.developer.applesignin`
- `lib/apple-auth.ts` — availability + native sign-in + Supabase exchange
- `contexts/AuthContext.tsx` — `signInWithApple` / `signOut`
- `screens/BackupRestoreScreen.tsx` — SIWA button + cloud upload/restore UI
- `lib/backup.ts` — `backupNow` / `restoreFromCloud` / `getBackupStatus`

Requires a **new native build** after enabling the entitlement/plugin (same cadence as other native capability changes).

## App Store Connect / Apple Developer

1. Certificates, Identifiers & Profiles → App ID `com.mohammedsaruwar.synapse` → enable **Sign In with Apple**.
2. Confirm the capability is on the provisioning profile used by EAS / Xcode.
3. App Store Connect → app → App Privacy / review notes: optional Sign in with Apple for cloud backup only; core app works without an account.

## Supabase

1. Authentication → Providers → **Apple** → enable.
2. Configure with the Services ID / key / team ID from Apple Developer (Secret Key JWT as required by Supabase).
3. Ensure RLS on `user_backups` allows only `auth.uid() = user_id` for select/insert/update/delete.
4. Client env: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the build.

Without the Apple provider enabled in Supabase, the native sheet may succeed but token exchange will fail — surface that error to the user; do not claim cloud backup works until both Apple and Supabase are configured.

## Review / privacy copy

- Manual backup: free, no sign-in.
- SIWA: optional; used to attach a backup to a Synapse account.
- Do not claim HIPAA, E2E encryption, or automatic iCloud sync for this path.
