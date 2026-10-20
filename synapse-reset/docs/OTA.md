# Synapse OTA (EAS Update)

LifeOS-style JS delivery: merge to `main` → GitHub Action publishes → installed builds pick it up on next cold start.

## Flow

1. Merge JS/UI changes to `main` (paths under `synapse-reset/**`).
2. `.github/workflows/eas-update.yml` runs `eas update --channel production`.
3. On next cold start, a binary on the same channel + `runtimeVersion` downloads the update.

## Requirements

| Piece | Value |
|-------|--------|
| Channel | `production` (preview builds use `preview`) |
| Runtime | `1.15` (fixed string; bare workflow) |
| Update URL | `https://u.expo.dev/2ae7d5f4-1514-408d-b1ec-250da7c8ccfa` |
| GitHub secrets | `EXPO_TOKEN` (required), optional `EAS_PROJECT_ID` UUID, optional `EXPO_PUBLIC_*` |

## Which installs can receive OTA

- **TestFlight / store builds that embed Updates** for runtime `1.15` (build **9+** after this release).
- Builds on runtime `1.14` (e.g. build **8**) only receive OTAs published for runtime `1.14`.
- Builds **≤7** (Updates disabled / no module) **cannot** receive OTA — they need a new native install.

## OTA-safe vs needs native build

**OTA is fine for:** screens, styles, copy, most React/TS logic, Firebase/Supabase client usage that doesn’t need new native modules.

**Needs a new TestFlight build (and usually a `runtimeVersion` bump):** new native modules, entitlement/Info.plist changes, Expo.plist / update URL / runtime changes, native crash fixes.

When bumping runtime, update **both** `app.config.js` `runtimeVersion` and `ios/Synapse/Supporting/Expo.plist` `EXUpdatesRuntimeVersion`.

## Manual publish

```bash
cd synapse-reset
npx eas-cli@latest update --channel production --message "manual@…" --non-interactive
```

Or run the **EAS Update (OTA)** workflow via `workflow_dispatch` in GitHub Actions.
