import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  requiresPlus,
  requiresPlusGate,
  ALWAYS_FREE_NAV_KEYS,
  HEALTH_HUB_PLUS_ITEM_KEYS,
} from "./features";

describe("plus feature gating", () => {
  it("keeps medications, appointments, sick mode, emergency free", () => {
    for (const key of ["medications", "appointments", "sickmode", "emergencyhub", "dashboard"]) {
      assert.equal(requiresPlus(key), false, key);
      assert.equal(requiresPlusGate(key), false, key);
    }
  });

  it("gates Plus child features but allows hub discovery", () => {
    assert.equal(requiresPlus("feelinghub"), true);
    assert.equal(requiresPlusGate("feelinghub"), false);
    assert.equal(requiresPlusGate("log"), true);
    assert.equal(requiresPlusGate("healthdata"), true);
    assert.equal(requiresPlusGate("checkin"), true);
    assert.equal(requiresPlusGate("doctors"), true);
  });

  it("does not gate account privacy or allergy", () => {
    assert.equal(requiresPlusGate("privacy"), false);
    assert.equal(requiresPlusGate("allergy"), false);
    assert.equal(ALWAYS_FREE_NAV_KEYS.has("allergy"), true);
  });

  it("marks Health hub Plus destinations", () => {
    assert.equal(HEALTH_HUB_PLUS_ITEM_KEYS.has("feelinghub"), true);
    assert.equal(HEALTH_HUB_PLUS_ITEM_KEYS.has("medications"), false);
    assert.equal(HEALTH_HUB_PLUS_ITEM_KEYS.has("appointments"), false);
  });
});
