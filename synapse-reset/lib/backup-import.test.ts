/**
 * Run: npx tsx synapse-reset/lib/backup-import.test.ts
 * Ensures a valid Synapse export is accepted and non-exports are rejected BEFORE
 * any destructive import can run.
 */
import { formatRestorePreview, parseSynapseExport } from "./backup-import";
import { MANUAL_BACKUP_SCHEMA_VERSION } from "./manual-backup-status";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  FAIL: " + msg);
  }
}

// A realistic export (shape produced by exportAllData()) — public 1.10 style (no schemaVersion).
const validExport = JSON.stringify({
  exportDate: "2026-09-21T02:00:00.000Z",
  appVersion: "1.10",
  profile: { name: "Test", conditions: [] },
  healthLogs: [],
  medications: [{ id: "m1", name: "Vitamin D" }],
  medicationLogs: [],
  appointments: [{ id: "a1" }],
});
const r1 = parseSynapseExport(validExport);
assert(r1.ok, "valid export accepted");
assert(r1.ok && Array.isArray((r1.payload as { medications?: unknown[] }).medications), "payload preserved");
assert(r1.ok && r1.summary.appVersion === "1.10", "1.10 appVersion preserved in summary");
assert(r1.ok && r1.summary.medicationCount === 1, "medication count");
assert(r1.ok && r1.summary.appointmentCount === 1, "appointment count");

// Minimal but valid (only exportDate).
assert(parseSynapseExport(JSON.stringify({ exportDate: "x" })).ok, "minimal export with exportDate accepted");
// Only medications array is enough of a signal.
assert(parseSynapseExport(JSON.stringify({ medications: [] })).ok, "medications-only accepted");

// Current schema version accepted.
assert(
  parseSynapseExport(
    JSON.stringify({
      exportDate: "2026-10-21T00:00:00.000Z",
      appVersion: "1.15",
      schemaVersion: MANUAL_BACKUP_SCHEMA_VERSION,
      medications: [],
    }),
  ).ok,
  "current schemaVersion accepted",
);

// Future schema rejected so we never wipe data with an unsupported file.
const future = parseSynapseExport(
  JSON.stringify({
    exportDate: "2027-01-01T00:00:00.000Z",
    schemaVersion: MANUAL_BACKUP_SCHEMA_VERSION + 1,
    medications: [],
  }),
);
assert(!future.ok, "future schemaVersion rejected");
assert(!future.ok && future.reason.toLowerCase().includes("newer"), "future schema explains update needed");

// Rejections — none of these may pass (would otherwise wipe data on import).
assert(!parseSynapseExport("not json at all {{{").ok, "invalid JSON rejected");
assert(!parseSynapseExport(JSON.stringify([1, 2, 3])).ok, "top-level array rejected");
assert(!parseSynapseExport(JSON.stringify("a string")).ok, "top-level string rejected");
assert(!parseSynapseExport(JSON.stringify(null)).ok, "null rejected");
assert(!parseSynapseExport(JSON.stringify({ foo: "bar", unrelated: true })).ok, "foreign object rejected");
assert(!parseSynapseExport("").ok, "empty string rejected");

const bad = parseSynapseExport("{ broken");
assert(!bad.ok && typeof (bad as { reason: string }).reason === "string", "rejection carries a human reason");

if (r1.ok) {
  const preview = formatRestorePreview(r1.summary);
  assert(preview.includes("Backup created:"), "preview includes creation date label");
  assert(preview.includes("1.10"), "preview mentions app version");
  assert(preview.includes("medication"), "preview explains medications");
}

console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed, ${failed} failed)`);
process.exit(failed === 0 ? 0 : 1);
