# Synapse reset — incremental migration

This folder is a **minimal Expo (SDK 54) app** with the same bundle ID and name as Synapse, so you can ship it to TestFlight and confirm the stack works before adding your full app back.

## Step 1: Confirm minimal build works

1. From this directory (`synapse-reset/`), build for TestFlight:
   ```bash
   npx eas build -p ios --profile production
   ```
2. Submit to TestFlight and install on a device.
3. Open the app. You should see **"Hello Synapse"** and the subtitle.
4. **If it runs** → the toolchain (Expo 54, RN 0.81, Xcode 16.4 image) is fine; the crash was likely from a dependency or from your app code. Continue to Step 2.
5. **If it still crashes** → the issue is in the base stack or EAS image; try a different `ios.image` in `eas.json` or a different Expo/RN version.

## Step 2: Add code back in stages

Add dependencies and app code in small batches, then build and test on TestFlight after each batch.

### Batch A — Core UI (no auth, no API)

- Copy from main project:
  - `constants/` (e.g. `colors`)
  - `components/ErrorBoundary.tsx`, `ErrorFallback.tsx`
  - `lib/query-client.ts` only if you need it for this batch (or skip and add with TanStack later)
- In `app/_layout.tsx`: wrap with `ErrorBoundary`, keep a single screen that renders a simple list or placeholder.
- **Build → TestFlight → test.** If it crashes, the culprit is in this batch.

### Batch B — Navigation and one real screen

- Add `app/(tabs)/_layout.tsx` and one real screen (e.g. dashboard stub).
- Add only the deps that screen needs (e.g. `react-native-screens`, `react-native-safe-area-context` are already there).
- **Build → TestFlight → test.**

### Batch C — Auth and storage

- Add `@react-native-async-storage/async-storage`, `@supabase/supabase-js`.
- Copy `contexts/AuthContext.tsx`, `lib/supabase.ts`, `lib/storage.ts`.
- Wire `AuthProvider` in root layout and a minimal auth gate.
- **Build → TestFlight → test.**

### Batch D — TanStack Query and API

- Add `@tanstack/react-query`, copy `lib/query-client.ts` and API helpers.
- Wrap app with `QueryClientProvider`.
- **Build → TestFlight → test.**

### Batch E — Rest of app

- Add remaining deps: `expo-image`, `expo-image-picker`, `react-native-reanimated`, etc.
- Copy remaining screens, components, and libs.
- **Important:** Add `react-native-reanimated` only after the above batches pass; it pulls in Folly and the Podfile plugin is already in place for it.

## Current minimal setup

- **No** `react-native-reanimated` (avoids Folly issues until we add it back).
- **No** auth, Supabase, TanStack Query, or AsyncStorage in the first build.
- **Same** `bundleIdentifier`, app name, EAS project, and iOS build image as the main app so you can replace the TestFlight build.

## If you want to replace the main project

After the minimal app runs on TestFlight and you’ve added back what you need:

1. From the **main** Synapse repo, back up any unique changes (e.g. env, server, patches).
2. Replace the main project’s `app/`, `components/`, `contexts/`, `lib/`, etc. with the working state from `synapse-reset/` (or copy `synapse-reset` on top of the main app and restore server/backend).
3. Re-run `npm install` and `npx expo prebuild --clean` in the main project, then build again.

This way you keep one codebase that you know works on TestFlight and migrate the rest in stages.
