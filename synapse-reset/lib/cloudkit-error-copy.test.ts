/**
 * Run: npx tsx synapse-reset/lib/cloudkit-error-copy.test.ts
 * Verifies the "production schema not deployed" CloudKit error maps to the
 * friendly, no-action message, while other errors keep their raw detail.
 */
import { friendlyCloudKitBackupError } from "./cloudkit-error-copy";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  FAIL: " + msg);
  }
}

// Exact on-device message (from the reported screenshots).
const deviceSave =
  "Could not save iCloud backup: Error saving record <CKRecordID: 0x7869c21da0; recordName=current-user-data, zoneID=_defaultZone:__defaultOwner__> to server: Cannot create new type UserData in production schema [CKErrorDomain 12]";
const deviceRestore =
  "Could not restore iCloud backup: Error fetching record: Cannot create new type UserData in production schema [CKErrorDomain 12]";
const offline = "Could not save iCloud backup: The Internet connection appears to be offline. [NSURLErrorDomain -1009]";
const quota = "Could not save iCloud backup: quota exceeded [CKErrorDomain 25]";

const a = friendlyCloudKitBackupError(deviceSave);
assert(a !== null, "device save schema error is recognized");
assert(a?.title === "iCloud backup not ready yet", "friendly title used");
assert(!!a && /saved on this device/i.test(a.message), "reassures data is local");
assert(!!a && !/CKErrorDomain|CKRecordID|UserData/.test(a.message), "friendly message hides raw CloudKit internals");

assert(friendlyCloudKitBackupError(deviceRestore) !== null, "device restore schema error is recognized");
assert(friendlyCloudKitBackupError(offline) === null, "offline error is NOT masked (raw shown)");
assert(friendlyCloudKitBackupError(quota) === null, "quota error is NOT masked (raw shown)");
assert(friendlyCloudKitBackupError("") === null, "empty message -> null");
assert(friendlyCloudKitBackupError(undefined) === null, "undefined message -> null");

console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed, ${failed} failed)`);
process.exit(failed === 0 ? 0 : 1);
