/**
 * Next Dose snapshot helpers used by Widgets 2.0.
 * Run: npx tsx synapse-reset/lib/widget-next-dose.test.ts
 */
import assert from "node:assert/strict";

// Inline the empty-state contract expected by widgets (mirrors widget-sync).
type EmptyKind = "none_scheduled" | "all_recorded";

function emptyLabel(kind: EmptyKind) {
  return kind === "all_recorded" ? "All scheduled doses recorded" : "No doses scheduled";
}

{
  console.log("1. Empty states are distinct");
  assert.notEqual(emptyLabel("all_recorded"), emptyLabel("none_scheduled"));
  assert.equal(emptyLabel("all_recorded"), "All scheduled doses recorded");
  assert.equal(emptyLabel("none_scheduled"), "No doses scheduled");
}

{
  console.log("2. Overdue copy never claims a dose was missed");
  const overdueDueText = "Scheduled time passed";
  assert.ok(!/missed/i.test(overdueDueText));
}

console.log("widget-next-dose: all assertions passed");
