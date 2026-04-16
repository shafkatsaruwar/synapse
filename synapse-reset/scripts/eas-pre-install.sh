#!/usr/bin/env bash
set -euo pipefail

if [[ "${EAS_BUILD_PLATFORM:-}" != "ios" ]]; then
  echo "Skipping CocoaPods bootstrap for non-iOS build."
  exit 0
fi

persist_env() {
  local target_file=""

  if [[ -n "${BASH_ENV:-}" ]]; then
    target_file="${BASH_ENV}"
  elif [[ -n "${EAS_BUILD_WORKINGDIR:-}" ]]; then
    target_file="${EAS_BUILD_WORKINGDIR}/.eas_bash_env"
  fi

  if [[ -n "${target_file}" ]]; then
    {
      echo "export GEM_HOME=\"${GEM_HOME}\""
      echo "export GEM_PATH=\"${GEM_PATH}\""
      echo "export PATH=\"${GEM_HOME}/bin:\$PATH\""
    } >> "${target_file}"
    echo "Persisted CocoaPods environment to ${target_file}"
  else
    echo "Could not find a shell env file to persist CocoaPods configuration."
  fi
}

bootstrap_cocoapods() {
  echo "Installing CocoaPods into ${GEM_HOME}"
  gem install cocoapods --install-dir "${GEM_HOME}" --no-document
}

if command -v pod >/dev/null 2>&1; then
  POD_BIN="$(command -v pod)"
  POD_BIN_DIR="$(dirname "${POD_BIN}")"
  export GEM_HOME="$(cd "${POD_BIN_DIR}/.." && pwd)"
else
  export GEM_HOME="${HOME}/.gems/arm64"
fi

export GEM_PATH="${GEM_HOME}"
export PATH="${GEM_HOME}/bin:${PATH}"

echo "Checking CocoaPods availability..."
if command -v pod >/dev/null 2>&1; then
  echo "CocoaPods already available at $(command -v pod)"
  if pod --version; then
    persist_env
    exit 0
  fi
  echo "CocoaPods executable exists but is not usable. Reinstalling..."
  bootstrap_cocoapods
  pod --version
  persist_env
  exit 0
fi

echo "CocoaPods not found on PATH. Bootstrapping a user-local install."
bootstrap_cocoapods
echo "CocoaPods installed at $(command -v pod)"
pod --version
persist_env
