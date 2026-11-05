#!/usr/bin/env bash
# One-shot live usability run for macOS + Simulator.
# Prerequisites (approved installs): Xcode, Maestro, Node 20+, Synapse build, vision API key.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Refusing: live iOS Simulator run requires macOS."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_ID="${USABILITY_APP_ID:-com.mohammedsaruwar.synapse}"
DEVICE="${USABILITY_DEVICE:-iPhone 16}"
PROVIDER="${USABILITY_VISION_PROVIDER:-openai}"

if [[ "${USABILITY_API_APPROVED:-}" != "1" && "$PROVIDER" != "mock" && "$PROVIDER" != "bridge" ]]; then
  echo "Set USABILITY_API_APPROVED=1 after approving paid vision API use."
  exit 2
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro not found. Install with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

echo "Booting $DEVICE..."
xcrun simctl boot "$DEVICE" 2>/dev/null || true
xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl uninstall booted "$APP_ID" 2>/dev/null || true

if ! xcrun simctl get_app_container booted "$APP_ID" data >/dev/null 2>&1; then
  echo "App $APP_ID is not installed on the booted simulator."
  echo "Build/install Synapse from synapse-reset (Expo/ios) first, then re-run."
  exit 1
fi

export USABILITY_APP_ID="$APP_ID"
export USABILITY_DEVICE="$DEVICE"
export USABILITY_VISION_PROVIDER="$PROVIDER"

npx tsx src/cli.ts run --provider "$PROVIDER" --out ./reports "$@"
