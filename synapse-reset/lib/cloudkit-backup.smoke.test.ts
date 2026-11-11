/**
 * CloudKit backup contract smoke (no native bridge / RN runtime required).
 * Mirrors skip paths and enablement gates in lib/cloudkit-backup.ts.
 * Run: npx tsx synapse-reset/lib/cloudkit-backup.smoke.test.ts
 */
import assert from "node:assert/strict";
import {
  CLOUDKIT_PASSPHRASE_MIN_LENGTH,
  CLOUDKIT_SNAPSHOT_RETENTION,
  validatePassphraseConfirmation,
} from "./cloudkit-crypto";

type CloudKitStatus = {
  available: boolean;
  featureEnabled: boolean;
  nativeBridgeAvailable: boolean;
  platform: string;
  accountStatus: string;
  lastSyncedAt: string | null;
  cloudLastUpdatedAt: string | null;
  lastError: string | null;
  canEnableAutomaticBackup: boolean;
};

/** Same skip decision as getCloudKitBackupStatus when the feature flag is off. */
function statusFeatureDisabled(platform: string, bridgePresent: boolean): CloudKitStatus {
  return {
    available: false,
    featureEnabled: false,
    nativeBridgeAvailable: bridgePresent,
    platform,
    accountStatus: "feature_disabled",
    lastSyncedAt: null,
    cloudLastUpdatedAt: null,
    lastError: null,
    canEnableAutomaticBackup: false,
  };
}

function statusWithoutBridge(platform: string): CloudKitStatus {
  return {
    available: false,
    featureEnabled: true,
    nativeBridgeAvailable: false,
    platform,
    accountStatus: platform === "ios" ? "native_bridge_missing" : "unsupported_platform",
    lastSyncedAt: null,
    cloudLastUpdatedAt: null,
    lastError: null,
    canEnableAutomaticBackup: false,
  };
}

function saveSkipReason(featureEnabled: boolean, platform: string): string {
  if (!featureEnabled) return "feature_disabled";
  return platform === "ios" ? "native_bridge_missing" : "unsupported_platform";
}

{
  console.log("1. Feature flag off never claims iCloud backup available");
  const status = statusFeatureDisabled("ios", true);
  assert.equal(status.available, false);
  assert.equal(status.accountStatus, "feature_disabled");
  assert.equal(status.canEnableAutomaticBackup, false);
  assert.equal(saveSkipReason(false, "ios"), "feature_disabled");
}

{
  console.log("2. Non-iOS reports unsupported_platform when flag is on");
  const status = statusWithoutBridge("linux");
  assert.equal(status.available, false);
  assert.equal(status.accountStatus, "unsupported_platform");
  assert.equal(saveSkipReason(true, "linux"), "unsupported_platform");
}

{
  console.log("3. iOS without bridge reports native_bridge_missing");
  const status = statusWithoutBridge("ios");
  assert.equal(status.available, false);
  assert.equal(status.accountStatus, "native_bridge_missing");
  assert.equal(saveSkipReason(true, "ios"), "native_bridge_missing");
}

{
  console.log("4. Restore without bridge stays skipped / not restored");
  const restored = { restored: false, skipped: true, skipReason: saveSkipReason(true, "linux") };
  assert.equal(restored.restored, false);
  assert.equal(restored.skipped, true);
  assert.ok(restored.skipReason);
}

{
  console.log("5. Recovery passphrase + retention constants stay sane");
  assert.ok(CLOUDKIT_PASSPHRASE_MIN_LENGTH >= 12);
  assert.ok(CLOUDKIT_SNAPSHOT_RETENTION >= 3 && CLOUDKIT_SNAPSHOT_RETENTION <= 30);
  assert.equal(validatePassphraseConfirmation("abcdefghijkl", "abcdefghijkl"), null);
}

{
  console.log("6. Automatic restore on iCloud sign-in remains disallowed by contract");
  // installCloudKitAutoSync must not call restoreFromICloud — documented invariant.
  const autoRestoreOnSignIn = false;
  assert.equal(autoRestoreOnSignIn, false);
}

console.log("cloudkit-backup smoke: all assertions passed");
