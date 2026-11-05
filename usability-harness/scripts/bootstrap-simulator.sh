#!/usr/bin/env bash
# Prepare a disposable iOS Simulator for Synapse usability runs.
# Run on macOS only. Does not install Maestro or npm deps unless you pass flags.
set -euo pipefail

APP_ID="${USABILITY_APP_ID:-com.mohammedsaruwar.synapse}"
DEVICE="${USABILITY_DEVICE:-iPhone 16}"
INSTALL_MAESTRO=0
INSTALL_NPM=0

for arg in "$@"; do
  case "$arg" in
    --install-maestro) INSTALL_MAESTRO=1 ;;
    --install-npm) INSTALL_NPM=1 ;;
    -h|--help)
      echo "Usage: ./scripts/bootstrap-simulator.sh [--install-maestro] [--install-npm]"
      echo "Asks are intentional: dependency installs are opt-in."
      exit 0
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script requires macOS with Xcode Simulator."
  exit 1
fi

echo "Booting disposable simulator: $DEVICE"
xcrun simctl boot "$DEVICE" 2>/dev/null || true
xcrun simctl bootstatus "$DEVICE" -b
# Erase app data by uninstall/reinstall expectation — clear keychain optional
xcrun simctl uninstall booted "$APP_ID" 2>/dev/null || true
echo "Uninstalled $APP_ID from booted simulator (ok if not present)."

if [[ "$INSTALL_MAESTRO" -eq 1 ]]; then
  echo "Installing Maestro (approved flag)..."
  curl -Ls "https://get.maestro.mobile.dev" | bash
else
  echo "Skipping Maestro install (pass --install-maestro after approval)."
fi

if [[ "$INSTALL_NPM" -eq 1 ]]; then
  echo "Installing harness npm deps (approved flag)..."
  cd "$(dirname "$0")/.."
  npm install
else
  echo "Skipping npm install (pass --install-npm after approval)."
fi

echo "Next:"
echo "  1. Install Synapse debug/dev build on the simulator"
echo "  2. Configure .env vision provider AFTER API approval"
echo "  3. USABILITY_API_APPROVED=1 npm start -- run   # or --dry-run"
