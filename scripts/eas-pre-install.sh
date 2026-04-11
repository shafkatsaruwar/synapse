#!/usr/bin/env bash
set -euo pipefail

if [[ "${EAS_BUILD_PLATFORM:-}" != "ios" ]]; then
  echo "Skipping CocoaPods bootstrap for non-iOS build."
  exit 0
fi

echo "Checking CocoaPods availability..."
if command -v pod >/dev/null 2>&1; then
  echo "CocoaPods already available at $(command -v pod)"
  pod --version
  exit 0
fi

echo "CocoaPods not found on PATH. Bootstrapping a user-local install."
export GEM_HOME="${HOME}/.gem"
export GEM_PATH="${GEM_HOME}"
export PATH="${GEM_HOME}/bin:${PATH}"

gem install cocoapods --no-document

echo "CocoaPods installed at $(command -v pod)"
pod --version
