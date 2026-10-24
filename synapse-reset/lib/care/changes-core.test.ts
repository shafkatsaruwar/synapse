/** Run: npx tsx --test lib/care/changes-core.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import { conflictingFields, describeChange, describeFieldChanges, sanitizeChangeSet, timeOfDayFor, MAX_CHANGES } from "./changes-core";

const wrap = (changes: unknown[]) => ({ schema: 1, kind: "changes", senderName: "Sarah", senderTimeZone: "America/New_York", changes });

test("valid proposals survive; junk, unknown categories, and bad dates are dropped", () => {
  const s = sanitizeChangeSet(
    wrap([
      { id: "1", category: "med_schedule", op: "add", after: { name: "Vitamin D", amount: "1000", unit: "IU", times: ["08:00", "25:00", "bad"] }, evil: "x" },
      { id: "2", category: "med_schedule", op: "add", after: { name: "No times" } },
      { id: "3", category: "med_schedule", op: "update", key: "m1", before: { times: ["08:00"] }, after: { times: ["09:00"] } },
      { id: "4", category: "med_schedule", op: "stop", key: "m2", before: { name: "Old" } },
      { id: "5", category: "upcoming_appointments", op: "add", after: { date: "2030-02-30", time: "10:00" } },
      { id: "6", category: "upcoming_appointments", op: "add", after: { date: "2030-03-01", time: "10:00", doctorName: "Dr. Lee" } },
      { id: "7", category: "upcoming_appointments", op: "cancel", key: "a1", before: { date: "2030-03-02" } },
      { id: "8", category: "med_confirmations", op: "confirm", after: { medicationKey: "m1", date: "2030-03-03", doseIndex: 0, medicationName: "X" } },
      { id: "9", category: "emergency_info", op: "add", after: {} },
      { id: "10", category: "med_schedule", op: "delete", key: "m1" },
      { id: "1", category: "med_schedule", op: "stop", key: "dupe", before: {} },
      "nonsense",
    ]),
  )!;
  assert.deepEqual(s.changes.map((c) => c.id), ["1", "3", "4", "6", "7", "8"]);
  const first = s.changes[0] as { after: { times: string[] } };
  assert.deepEqual(first.after.times, ["08:00"]);
  assert.ok(!("evil" in s.changes[0]));
});

test("wrong schema, wrong kind, and oversized sets are handled", () => {
  assert.equal(sanitizeChangeSet({ schema: 2, kind: "changes", changes: [] }), null);
  assert.equal(sanitizeChangeSet({ schema: 1, changes: [] }), null);
  assert.equal(sanitizeChangeSet("x"), null);
  const many = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, category: "med_schedule", op: "stop", key: `m${i}`, before: {} }));
  assert.equal(sanitizeChangeSet(wrap(many))!.changes.length, MAX_CHANGES);
});

test("descriptions are plain and never accusatory", () => {
  assert.equal(describeChange({ id: "1", category: "med_schedule", op: "stop", key: "m", before: { name: "Aspirin" } }), "Stop Aspirin");
  assert.equal(describeChange({ id: "2", category: "upcoming_appointments", op: "cancel", key: "a", before: { date: "2030-01-01" } }), "Cancel appointment on 2030-01-01");
  assert.deepEqual(describeFieldChanges({ times: ["08:00"] }, { times: ["09:00", "21:00"] }), [{ field: "Times", from: "08:00", to: "09:00, 21:00" }]);
});

test("conflict detection spots records that changed since the proposer looked", () => {
  assert.deepEqual(conflictingFields({ name: "A", times: ["08:00"] }, { name: "A", times: ["09:00"] }), ["times"]);
  assert.deepEqual(conflictingFields({ name: "A" }, { name: "A", extra: 1 }), []);
});

test("time of day buckets", () => {
  assert.equal(timeOfDayFor("08:00"), "Morning");
  assert.equal(timeOfDayFor("13:30"), "Afternoon");
  assert.equal(timeOfDayFor("18:00"), "Evening");
  assert.equal(timeOfDayFor("23:00"), "Night");
});
