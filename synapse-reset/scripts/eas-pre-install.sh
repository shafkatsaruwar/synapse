#!/usr/bin/env bash
set -euo pipefail

if [[ "${EAS_BUILD_PLATFORM:-}" != "ios" ]]; then
  echo "Skipping CocoaPods bootstrap for non-iOS build."
  exit 0
fi

persist_env() {
  if [[ -n "${BASH_ENV:-}" ]]; then
    {
      echo "export GEM_HOME=\"${GEM_HOME}\""
      echo "export GEM_PATH=\"${GEM_PATH}\""
      echo "export PATH=\"${GEM_HOME}/bin:\$PATH\""
    } >> "${BASH_ENV}"
    echo "Persisted CocoaPods environment to ${BASH_ENV}"
  else
    echo "BASH_ENV is not set; cannot persist PATH for later steps."
  fi
}

export GEM_HOME="${HOME}/.gem"
export GEM_PATH="${GEM_HOME}"
export PATH="${GEM_HOME}/bin:${PATH}"

echo "Checking CocoaPods availability..."
if command -v pod >/dev/null 2>&1; then
  echo "CocoaPods already available at $(command -v pod)"
  persist_env
  pod --version
  exit 0
fi

echo "CocoaPods not found on PATH. Bootstrapping a user-local install."
gem install cocoapods --no-document

echo "CocoaPods installed at $(command -v pod)"
persist_env
pod --version
