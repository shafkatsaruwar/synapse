/**
 * Run: npx tsx synapse-reset/lib/backup-import.test.ts
 * Ensures a valid Synapse export is accepted and non-exports are rejected BEFORE
 * any destructive import can run.
 */
import { parseSynapseExport } from "./backup-import";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  FAIL: " + msg);
  }
}

// A realistic export (shape produced by exportAllData()).
const validExport = JSON.stringify({
  exportDate: "2026-09-21T02:00:00.000Z",
  appVersion: "1.0",
  profile: { name: "Test", conditions: [] },
  healthLogs: [],
  medications: [{ id: "m1", name: "Vitamin D" }],
  medicationLogs: [],
});
const r1 = parseSynapseExport(validExport);
assert(r1.ok, "valid export accepted");
assert(r1.ok && Array.isArray((r1.payload as { medications?: unknown[] }).medications), "payload preserved");

// Minimal but valid (only exportDate).
assert(parseSynapseExport(JSON.stringify({ exportDate: "x" })).ok, "minimal export with exportDate accepted");
// Only medications array is enough of a signal.
assert(parseSynapseExport(JSON.stringify({ medications: [] })).ok, "medications-only accepted");

// Rejections — none of these may pass (would otherwise wipe data on import).
assert(!parseSynapseExport("not json at all {{{").ok, "invalid JSON rejected");
assert(!parseSynapseExport(JSON.stringify([1, 2, 3])).ok, "top-level array rejected");
assert(!parseSynapseExport(JSON.stringify("a string")).ok, "top-level string rejected");
assert(!parseSynapseExport(JSON.stringify(null)).ok, "null rejected");
assert(!parseSynapseExport(JSON.stringify({ foo: "bar", unrelated: true })).ok, "foreign object rejected");
assert(!parseSynapseExport("").ok, "empty string rejected");

const bad = parseSynapseExport("{ broken");
assert(!bad.ok && typeof (bad as { reason: string }).reason === "string", "rejection carries a human reason");

console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed, ${failed} failed)`);
process.exit(failed === 0 ? 0 : 1);
