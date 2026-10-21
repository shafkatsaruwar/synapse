/**
 * Run: npx tsx synapse-reset/lib/manual-backup-status.test.ts
 */
import assert from "node:assert/strict";
import {
  BACKUP_STALE_AFTER_MS,
  describeBackupStatus,
  shouldShowBackupReminder,
  type ManualBackupStatus,
} from "./manual-backup-status";

let passed = 0;
let failed = 0;
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  FAIL: " + msg);
  }
}

const empty: ManualBackupStatus = {
  lastExportedAt: null,
  lastConfirmedAt: null,
  lastFileName: null,
};

const none = describeBackupStatus(empty);
check(none.kind === "none", "empty status is not yet confirmed");
check(none.title === "Not yet confirmed", "none title");

const exported = describeBackupStatus({
  ...empty,
  lastExportedAt: "2026-10-01T12:00:00.000Z",
  lastFileName: "synapse-backup.json",
});
check(exported.kind === "exported", "exported-only uses Backup exported label");
check(exported.title.includes("Backup exported"), "exported title mentions exported not saved");

const freshConfirmed = describeBackupStatus({
  lastExportedAt: "2026-10-01T12:00:00.000Z",
  lastConfirmedAt: new Date().toISOString(),
  lastFileName: "synapse-backup.json",
});
check(freshConfirmed.kind === "confirmed", "confirmed status");
check(freshConfirmed.kind === "confirmed" && freshConfirmed.stale === false, "fresh confirmed is not stale");

const staleConfirmed = describeBackupStatus({
  lastExportedAt: "2026-01-01T12:00:00.000Z",
  lastConfirmedAt: new Date(Date.now() - BACKUP_STALE_AFTER_MS - 1000).toISOString(),
  lastFileName: "old.json",
});
check(staleConfirmed.kind === "confirmed" && staleConfirmed.stale === true, "old confirmed is stale");

check(
  shouldShowBackupReminder({ status: empty, hasMeaningfulData: false, reminderDismissedAt: null }) === false,
  "no reminder without meaningful data",
);
check(
  shouldShowBackupReminder({ status: empty, hasMeaningfulData: true, reminderDismissedAt: null }) === true,
  "reminder when data exists and never backed up",
);
check(
  shouldShowBackupReminder({
    status: empty,
    hasMeaningfulData: true,
    reminderDismissedAt: new Date().toISOString(),
  }) === false,
  "dismissed reminder stays quiet for 30 days",
);
check(
  shouldShowBackupReminder({
    status: {
      lastExportedAt: new Date().toISOString(),
      lastConfirmedAt: new Date().toISOString(),
      lastFileName: "x.json",
    },
    hasMeaningfulData: true,
    reminderDismissedAt: null,
  }) === false,
  "recent confirmed backup suppresses reminder",
);
check(
  shouldShowBackupReminder({
    status: {
      lastExportedAt: "2026-01-01T00:00:00.000Z",
      lastConfirmedAt: new Date(Date.now() - BACKUP_STALE_AFTER_MS - 1000).toISOString(),
      lastFileName: "x.json",
    },
    hasMeaningfulData: true,
    reminderDismissedAt: null,
  }) === true,
  "stale confirmed backup shows reminder",
);

// describeBackupStatus must never claim "saved" from export-only metadata
assert.doesNotMatch(exported.detail, /saved somewhere safe/i);

console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed, ${failed} failed)`);
process.exit(failed === 0 ? 0 : 1);
