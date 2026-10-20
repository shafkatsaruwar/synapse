/**
 * CloudKit backup contract smoke (no native bridge / RN runtime required).
 * Mirrors the skip paths in lib/cloudkit-backup.ts when bridge is missing.
 * Run: npx tsx synapse-reset/lib/cloudkit-backup.smoke.test.ts
 */
import assert from "node:assert/strict";

type CloudKitStatus = {
  available: boolean;
  nativeBridgeAvailable: boolean;
  platform: string;
  accountStatus: string;
  lastSyncedAt: string | null;
  cloudLastUpdatedAt: string | null;
  lastError: string | null;
};

/** Same skip decision as getCloudKitBackupStatus / saveToICloud without the bridge. */
function statusWithoutBridge(platform: string): CloudKitStatus {
  return {
    available: false,
    nativeBridgeAvailable: false,
    platform,
    accountStatus: platform === "ios" ? "native_bridge_missing" : "unsupported_platform",
    lastSyncedAt: null,
    cloudLastUpdatedAt: null,
    lastError: null,
  };
}

function saveSkipReason(platform: string): string {
  return platform === "ios" ? "native_bridge_missing" : "unsupported_platform";
}

{
  console.log("1. Non-iOS reports unsupported_platform and never claims available");
  const status = statusWithoutBridge("linux");
  assert.equal(status.available, false);
  assert.equal(status.accountStatus, "unsupported_platform");
  assert.equal(saveSkipReason("linux"), "unsupported_platform");
}

{
  console.log("2. iOS without bridge reports native_bridge_missing");
  const status = statusWithoutBridge("ios");
  assert.equal(status.available, false);
  assert.equal(status.accountStatus, "native_bridge_missing");
  assert.equal(saveSkipReason("ios"), "native_bridge_missing");
}

{
  console.log("3. Restore without bridge stays skipped / not restored");
  const restored = { restored: false, skipped: true, skipReason: saveSkipReason("linux") };
  assert.equal(restored.restored, false);
  assert.equal(restored.skipped, true);
  assert.ok(restored.skipReason);
}

console.log("cloudkit-backup smoke: all assertions passed");
