/**
 * Pure query/sanitize tests. Run with: npx tsx mcp/query.test.ts
 * Fixtures are synthetic and contain no real PHI.
 */
import { snapshotFromUnknown } from "./sanitize";
import { authenticateRequest, extractBearerToken } from "./auth";
import {
  getHealthProfile,
  getHealthSummary,
  listMedications,
  listUpcomingAppointments,
  queryHealthData,
  todayISODate,
} from "./query";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log("  FAIL: " + msg);
  }
}

function section(name: string) {
  console.log("\n=== " + name + " ===");
}

const fixture = snapshotFromUnknown(
  {
    exportDate: "2026-08-20T12:00:00.000Z",
    profile: { name: "Alex", ramadanMode: false, email: "secret@example.com", profileImageUri: "file://photo.png" },
    healthProfile: { age: 34, recoveryTrackingEnabled: true, recoveryFocus: "sleep" },
    allergy: { hasAllergies: true, allergyName: "penicillin" },
    conditions: [{ id: "c1", name: "POTS" }],
    healthLogs: [
      { id: "h1", date: "2026-08-18", energy: 3, mood: 4, sleep: 5 },
      { id: "h2", date: "2026-08-19", energy: 2, mood: 2, sleep: 3 },
    ],
    symptoms: [
      { id: "s1", date: "2026-08-19", name: "dizziness", severity: 4 },
      { id: "s2", date: "2026-08-01", name: "headache", severity: 2 },
    ],
    medications: [
      {
        id: "m1",
        name: "Fludrocortisone",
        active: true,
        frequency: "daily",
        doses: [{ id: "d1", amount: "0.1", unit: "mg", timeOfDay: "Morning" }],
      },
    ],
    medicationLogs: [
      { id: "l1", medicationId: "m1", date: "2026-08-18", taken: true },
      { id: "l2", medicationId: "m1", date: "2026-08-19", taken: false },
    ],
    appointments: [
      { id: "a1", doctorName: "Dr. Lee", date: "2099-01-15", time: "09:00", status: "completed" },
      { id: "a2", doctorName: "Dr. Patel", date: "2099-02-01", time: "14:00", status: "cancelled" },
      { id: "a3", doctorName: "Dr. Kim", date: "2099-01-20", time: "11:00" },
    ],
    vitals: [{ id: "v1", date: "2026-08-19", type: "heart_rate", value: "72", unit: "bpm" }],
    labWork: [{ id: "lab1", date: "2026-08-10", testName: "CBC", results: [{ name: "WBC", value: "6.1", unit: "K/uL" }] }],
  },
  { source: "local_json", updatedAt: "2026-08-20T12:00:00.000Z" }
);

section("sanitize");
assert(!("email" in (fixture.profile ?? {})), "email stripped from profile");
assert(!("profileImageUri" in (fixture.profile ?? {})), "profile image URI stripped");
assert(fixture.profile?.name === "Alex", "name preserved");

section("profile");
const profile = getHealthProfile(fixture);
assert(profile.allergy.hasAllergies === true, "allergy flag");
assert(Array.isArray(profile.conditions) && profile.conditions.length === 1, "conditions present");

section("appointments");
const upcoming = listUpcomingAppointments(fixture, { from: "2099-01-01" });
assert(upcoming.length === 2, "cancelled excluded, past-status completed still listed if date is future");
assert(upcoming[0].doctorName === "Dr. Lee", "sorted by date then time");
assert(upcoming.every((a) => a.status !== "cancelled"), "no cancelled");

section("medications");
const meds = listMedications(fixture, { from: "2026-08-01", to: "2026-08-31" });
assert(meds.length === 1, "one active med");
assert(meds[0].adherence.taken === 1, "one taken");
assert(meds[0].adherence.skipped === 1, "one skipped");
assert(meds[0].adherence.takenPercent === 50, "50% of recorded logs taken");

section("summary");
const originalToday = todayISODate();
const summary = getHealthSummary(fixture, 30);
assert(summary.symptoms.count >= 1, "summary includes symptoms in lookback");
assert(summary.profile.conditionNames.includes("POTS"), "condition names");
assert(typeof originalToday === "string" && originalToday.length === 10, "today helper");

section("dated query");
const queried = queryHealthData(fixture, { from: "2026-08-18", to: "2026-08-19", collections: ["symptoms", "checkins"] });
assert(queried.result.symptoms?.length === 1, "symptoms in range");
assert(queried.result.checkins?.length === 2, "check-ins in range");
assert(!queried.result.labs, "unrequested collections omitted");

section("auth helpers");
process.env.SYNAPSE_MCP_TOKEN = "test-token-value-32chars-minimum";
assert(extractBearerToken({ authorization: "Bearer test-token-value-32chars-minimum" }) === "test-token-value-32chars-minimum", "bearer parse");
const ok = authenticateRequest("test-token-value-32chars-minimum");
assert(ok.ok === true && ok.method === "mcp_token", "mcp token accepted");
const bad = authenticateRequest("nope");
assert(bad.ok === false, "wrong token rejected");
const missing = authenticateRequest("");
assert(missing.ok === false && missing.status === 401, "empty token is 401");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
