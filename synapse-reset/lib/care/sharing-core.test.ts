/** Run: npx tsx --test lib/care/sharing-core.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import { diffKeys, freshnessLabel, sanitizePayload } from "./sharing-core";

test("sanitizePayload keeps known fields, drops junk, caps lengths, rejects wrong schema", () => {
  assert.equal(sanitizePayload({ schema: 2 }), null);
  assert.equal(sanitizePayload("x"), null);
  const p = sanitizePayload({
    schema: 1,
    senderName: "Jason",
    senderTimeZone: "Europe/London",
    __proto__: { polluted: true },
    med_schedule: [
      { key: "m1", name: "Levothyroxine", dose: "200 mcg", times: ["08:00", "bad", "25:99x"], weekdays: [1, 9, "x"], evil: "<script>" },
      { name: "no key" },
      42,
    ],
    upcoming_appointments: [{ key: "a1", date: "2026-02-03", time: "10:00", doctorName: "Dr. Lee" }, { key: "a2", date: "not-a-date" }],
    selected_records: [{ key: "k", kind: "condition", label: "Asthma" }, { key: "k2", kind: "other", label: "x" }],
  })!;
  assert.deepEqual(p.med_schedule, [{ key: "m1", name: "Levothyroxine", dose: "200 mcg", times: ["08:00"], weekdays: [1] }]);
  assert.equal(p.upcoming_appointments?.length, 1);
  assert.deepEqual(p.selected_records, [{ key: "k", kind: "condition", label: "Asthma" }]);
  assert.ok(!("evil" in (p.med_schedule![0] as object)));
});

test("diffKeys separates new, updated, unchanged and removed", () => {
  const before = [{ key: "a", v: 1 }, { key: "b", v: 1 }, { key: "c", v: 1 }];
  const after = [{ key: "a", v: 1 }, { key: "b", v: 2 }, { key: "d", v: 1 }];
  assert.deepEqual(diffKeys(before, after), { added: 1, updated: 1, unchanged: 1, removed: 1 });
  assert.deepEqual(diffKeys(undefined, after), { added: 3, updated: 0, unchanged: 0, removed: 0 });
});

test("freshness label says shared, never live", () => {
  const now = new Date("2026-01-16T20:00:00Z");
  assert.equal(freshnessLabel(undefined, now, "UTC"), "Nothing shared yet");
  assert.equal(freshnessLabel("2026-01-15T18:42:00Z", now, "UTC"), "Last shared update: Yesterday at 6:42 PM");
  assert.equal(freshnessLabel("2026-01-16T09:05:00Z", now, "UTC"), "Last shared update: Today at 9:05 AM");
  assert.match(freshnessLabel("2025-12-01T09:05:00Z", now, "UTC"), /^Last shared update: Dec 1 at 9:05 AM$/);
});
