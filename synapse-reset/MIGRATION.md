# Synapse reset — incremental migration

This folder is a **minimal Expo (SDK 54) app** with the same bundle ID and name as Synapse, so you can ship it to TestFlight and confirm the stack works before adding your full app back.

## Version scheme (pinpoint failures on TestFlight)

- **Build numbers**: Keep auto-incrementing via EAS (`autoIncrement: true` in production profile).
- **App version** is bumped per batch so you can see exactly which batch is on TestFlight:
  - **1.8.0** — Minimal (Hello Synapse) — already working ✓
  - **1.8.1** — Batch A (Core UI)
  - **1.8.2** — Batch B (One real screen)
  - **1.8.3** — Batch C (Auth + storage)
  - **1.8.4** — Batch D (TanStack Query + API)
  - **1.8.5** — Batch E (Rest: screens, reanimated, etc.)

Before each batch: set `version` in `app.config.js` to the next number (e.g. `"1.8.1"` for Batch A). Build, submit to TestFlight, test. If it crashes, the version on the build (e.g. 1.8.2) tells you Batch B broke it.

## Step 1: Confirm minimal build works (1.8.0)

1. From this directory (`synapse-reset/`), build for TestFlight (version in app.config should be `1.8` or `1.8.0`).
2. Submit to TestFlight and install on a device.
3. Open the app. You should see **"Hello Synapse"** and the subtitle.
4. **If it runs** → continue to Step 2. **If it still crashes** → try a different `ios.image` in `eas.json` or Expo/RN version.

## Step 2: Add code back in stages (1.8.1 → 1.8.5)

Add dependencies and app code in small batches. **Before each batch:** set `version` in `app.config.js` to the batch version above. Build → submit to TestFlight → test. If it fails, you know the batch from the version number.

### Batch A — 1.8.1 — Core UI (no auth, no API)

- Copy from main project:
  - `constants/` (e.g. `colors`)
  - `components/ErrorBoundary.tsx`, `ErrorFallback.tsx`
- In `app/_layout.tsx`: wrap with `ErrorBoundary`, keep a single screen that renders a simple list or placeholder.
- Set `version: "1.8.1"` in `app.config.js`. **Build → TestFlight → test.**

### Batch B — 1.8.2 — One real screen

- Add one real screen (e.g. dashboard stub) and only the deps that screen needs.
- Set `version: "1.8.2"` in `app.config.js`. **Build → TestFlight → test.**

### Batch C — 1.8.3 — Auth and storage

- Add `@react-native-async-storage/async-storage`, `@supabase/supabase-js`.
- Copy `contexts/AuthContext.tsx`, `lib/supabase.ts`, `lib/storage.ts`. Wire `AuthProvider` and a minimal auth gate.
- Set `version: "1.8.3"` in `app.config.js`. **Build → TestFlight → test.**

### Batch D — 1.8.4 — TanStack Query and API

- Add `@tanstack/react-query`, copy `lib/query-client.ts` and API helpers. Wrap app with `QueryClientProvider`.
- Set `version: "1.8.4"` in `app.config.js`. **Build → TestFlight → test.**

### Batch E — 1.8.5 — Rest of app

- Add remaining deps (e.g. `expo-image`, `expo-image-picker`, `react-native-reanimated`), copy remaining screens, components, libs. Add Reanimated last; re-enable Podfile plugin if needed.
- Set `version: "1.8.5"` in `app.config.js`. **Build → TestFlight → test.**

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
