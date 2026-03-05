# Get Synapse on TestFlight

## Prerequisites

- **Apple Developer account** (paid, $99/year) – [developer.apple.com](https://developer.apple.com)
- **EAS CLI** – `npm install -g eas-cli` then `eas login` with your Expo account
- **App in App Store Connect** – Create the app at [appstoreconnect.apple.com](https://appstoreconnect.apple.com) with bundle ID `com.mohammedsaruwar.synapse` (must match `app.config.js`)

## 1. Configure EAS (one-time)

```bash
# Link project to EAS (uses expo.extra.eas.projectId from app.config.js)
eas build:configure
```

## 2. Set environment variables for the build

Production builds need Supabase (and any other) env vars. Set them in EAS:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --scope project
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --scope project
```

Or use a `.env` that’s loaded when you run `eas build` (do not commit real keys).

## 3. Build for iOS (production)

From the project root:

```bash
eas build --platform ios --profile production
```

This runs the build in the cloud. When it finishes, EAS gives you a link to the build and (optionally) to submit.

## 4. Submit to TestFlight

**Option A – Right after the build (recommended)**  
When the build completes, EAS can submit for you. Or run:

```bash
eas submit --platform ios --profile production
```

You’ll be prompted for:

- **Apple ID** – Your Apple Developer account email  
- **App-specific password** – Create at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords  
- **Asc App ID** – From App Store Connect: My Apps → Synapse → App Information → “Apple ID” (numeric, e.g. `1234567890`)

**Option B – Submit a previous build**

```bash
eas submit --platform ios --profile production --latest
```

## 5. In App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com) → Your app → **TestFlight**.
2. After processing (often 5–15 minutes), the build appears under **iOS Builds**.
3. Add **Internal** or **External** testers and send the TestFlight invite.

## Troubleshooting

- **“No builds found”** – Run `eas build --platform ios --profile production` first.
- **Invalid bundle ID** – Ensure the app in App Store Connect uses `com.mohammedsaruwar.synapse`.
- **Missing credentials** – Use `eas credentials` to manage signing and provisioning.
- **Build fails** – Check the build log in the EAS dashboard; ensure all EAS secrets (e.g. Supabase) are set.
- **"Install pods" failed** – Open the build log on expo.dev, expand the "Install pods" step, and read the exact error (e.g. CocoaPods version, a specific pod failing). Then run `npx expo install --check` locally to fix dependency mismatches and try the build again.

## Quick reference

| Step              | Command |
|-------------------|--------|
| Build iOS         | `eas build --platform ios --profile production` |
| Submit to TestFlight | `eas submit --platform ios --profile production --latest` |
| View builds       | [expo.dev](https://expo.dev) → your project → Builds |
