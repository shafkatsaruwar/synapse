/** Run: npx tsx --test lib/care/checkin-core.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import { checkInTemplate, FORBIDDEN_WORDING, postponementExplanation, reminderBody, reminderTitle } from "./checkin-core";

test("every template, reminder, and explanation avoids accusatory or status-claiming words", () => {
  const texts: string[] = [];
  for (const dir of ["send", "check_on"] as const)
    for (const topic of ["medication", "appointment", "wellness"] as const) texts.push(checkInTemplate(dir, topic));
  for (const topic of ["medication", "appointment", "wellness"] as const) {
    texts.push(reminderBody("Jason", topic, null));
    texts.push(reminderBody("Jason", topic, { reason: "quiet_hours", originalInstant: 0 }));
  }
  texts.push(reminderTitle("Jason"), postponementExplanation("Jason"));
  for (const t of texts) assert.ok(!FORBIDDEN_WORDING.test(t), `forbidden wording in: ${t}`);
});

test("the guard actually catches the phrases it exists for", () => {
  for (const bad of ["Jason missed his medication", "Jason didn't take his dose", "He failed to confirm", "overdue"]) {
    assert.ok(FORBIDDEN_WORDING.test(bad), bad);
  }
});

test("templates match the product copy", () => {
  assert.equal(checkInTemplate("send", "medication"), "Hey! Just letting you know I've taken my medication. All good.");
  assert.equal(checkInTemplate("check_on", "appointment"), "Hey! How did your appointment go?");
});

test("medication reminder reads as a gentle prompt tied to the schedule", () => {
  assert.equal(reminderTitle("Jason"), "A little check-in with Jason?");
  assert.equal(reminderBody("Jason", "medication", null), "It's around the time Jason usually takes medication. Would you like to check in?");
});
