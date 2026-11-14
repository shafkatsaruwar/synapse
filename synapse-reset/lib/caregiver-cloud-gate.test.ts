/**
 * SHIELD-005 Option B — cloud caregiver kill switch.
 * Run: npx tsx --test lib/caregiver-cloud-gate.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { featureFlags } from "../constants/feature-flags";
import {
  CLOUD_CAREGIVER_DISABLED_MESSAGE,
  cloudCaregiverDisabledError,
  isCloudCaregiverPushEnabled,
} from "./caregiver-cloud-gate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("cloud caregiver push flag is off (Option B)", () => {
  assert.equal(featureFlags.cloudCaregiverPushEnabled, false);
  assert.equal(isCloudCaregiverPushEnabled(), false);
});

test("disabled error message is stable and actionable", () => {
  const error = cloudCaregiverDisabledError();
  assert.equal(error.message, CLOUD_CAREGIVER_DISABLED_MESSAGE);
  assert.match(error.message, /on-device caregiver|Care Connections/i);
});

test("send-caregiver-event source fails closed with 503", () => {
  const source = readFileSync(join(root, "supabase/functions/send-caregiver-event/index.ts"), "utf8");
  assert.match(source, /status:\s*503/);
  assert.match(source, /CLOUD_CAREGIVER_PUSH_DISABLED/);
  assert.doesNotMatch(source, /EXPO_PUSH_URL/);
  assert.doesNotMatch(source, /serviceRoleKey/);
});

test("send-caregiver-reminder source fails closed with 503", () => {
  const source = readFileSync(join(root, "supabase/functions/send-caregiver-reminder/index.ts"), "utf8");
  assert.match(source, /status:\s*503/);
  assert.match(source, /CLOUD_CAREGIVER_PUSH_DISABLED/);
  assert.doesNotMatch(source, /EXPO_PUSH_URL/);
  assert.doesNotMatch(source, /body\.message/);
});
