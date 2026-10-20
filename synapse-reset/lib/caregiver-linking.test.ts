/**
 * Caregiver linking helpers (pure validation).
 * Run: npx tsx synapse-reset/lib/caregiver-linking.test.ts
 */
import assert from "node:assert/strict";
import {
  CAREGIVER_LINK_CODE_LENGTH,
  isValidCaregiverLinkCode,
  normalizeCaregiverLinkCode,
} from "./caregiver-link-code";

{
  console.log("1. Normalize strips spaces and punctuation, uppercases");
  assert.equal(normalizeCaregiverLinkCode(" ab-12cd "), "AB12CD");
  assert.equal(normalizeCaregiverLinkCode("ghjk12"), "GHJK12");
}

{
  console.log("2. Valid codes require exactly 6 alphanumeric characters");
  assert.equal(CAREGIVER_LINK_CODE_LENGTH, 6);
  assert.equal(isValidCaregiverLinkCode("AB12CD"), true);
  assert.equal(isValidCaregiverLinkCode("ab-12-cd"), true);
  assert.equal(isValidCaregiverLinkCode("ABC"), false);
  assert.equal(isValidCaregiverLinkCode(""), false);
  assert.equal(isValidCaregiverLinkCode("ABCDEFG"), false);
}

console.log("caregiver-linking: all assertions passed");
