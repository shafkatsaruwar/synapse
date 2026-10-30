import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyEntitlement, resolvePlusEntitlement } from "./entitlement";
import { PLUS_PRODUCT_IDS } from "./products";

describe("resolvePlusEntitlement", () => {
  it("returns inactive free by default", () => {
    const snap = emptyEntitlement(1_700_000_000_000);
    assert.equal(snap.isActive, false);
    assert.equal(snap.source, "none");
    assert.equal(snap.entitlementId, "synapse_plus");
  });

  it("grants lifetime from non-revoked purchase", () => {
    const snap = resolvePlusEntitlement({
      activeSubscriptions: [],
      availablePurchases: [
        {
          productId: PLUS_PRODUCT_IDS.lifetime,
          purchaseState: "purchased",
        },
      ],
      nowMs: 1_700_000_000_000,
    });
    assert.equal(snap.isActive, true);
    assert.equal(snap.source, "lifetime");
    assert.equal(snap.productId, PLUS_PRODUCT_IDS.lifetime);
  });

  it("ignores revoked lifetime", () => {
    const snap = resolvePlusEntitlement({
      activeSubscriptions: [],
      availablePurchases: [
        {
          productId: PLUS_PRODUCT_IDS.lifetime,
          purchaseState: "purchased",
          revocationDateIOS: 1_600_000_000_000,
        },
      ],
      nowMs: 1_700_000_000_000,
    });
    assert.equal(snap.isActive, false);
  });

  it("grants active subscription", () => {
    const snap = resolvePlusEntitlement({
      activeSubscriptions: [
        {
          productId: PLUS_PRODUCT_IDS.annual,
          isActive: true,
          expirationDateIOS: 1_800_000_000_000,
          renewalInfoIOS: { willAutoRenew: true },
        },
      ],
      availablePurchases: [],
      nowMs: 1_700_000_000_000,
    });
    assert.equal(snap.isActive, true);
    assert.equal(snap.source, "subscription");
    assert.equal(snap.willAutoRenew, true);
    assert.ok(snap.expiresAt);
  });

  it("ignores inactive subscription product ids", () => {
    const snap = resolvePlusEntitlement({
      activeSubscriptions: [
        { productId: PLUS_PRODUCT_IDS.monthly, isActive: false },
        { productId: "other.product", isActive: true },
      ],
      availablePurchases: [],
      nowMs: 1_700_000_000_000,
    });
    assert.equal(snap.isActive, false);
  });

  it("prefers lifetime over subscription", () => {
    const snap = resolvePlusEntitlement({
      activeSubscriptions: [
        { productId: PLUS_PRODUCT_IDS.monthly, isActive: true },
      ],
      availablePurchases: [
        { productId: PLUS_PRODUCT_IDS.lifetime, purchaseState: "purchased" },
      ],
      nowMs: 1_700_000_000_000,
    });
    assert.equal(snap.source, "lifetime");
  });

  it("grants legacy transition only while unexpired", () => {
    const active = resolvePlusEntitlement({
      activeSubscriptions: [],
      availablePurchases: [],
      legacyTransitionUntilIso: new Date(1_800_000_000_000).toISOString(),
      nowMs: 1_700_000_000_000,
    });
    assert.equal(active.source, "legacy_transition");
    assert.equal(active.isActive, true);

    const expired = resolvePlusEntitlement({
      activeSubscriptions: [],
      availablePurchases: [],
      legacyTransitionUntilIso: new Date(1_600_000_000_000).toISOString(),
      nowMs: 1_700_000_000_000,
    });
    assert.equal(expired.isActive, false);
  });

  it("does not treat local boolean alone as permanent access", () => {
    const snap = resolvePlusEntitlement({
      activeSubscriptions: [],
      availablePurchases: [],
      nowMs: 1_700_000_000_000,
    });
    assert.equal(snap.isActive, false);
    assert.equal(snap.source, "none");
  });

  it("grants lifetime when a promotional offer was redeemed", () => {
    const snap = resolvePlusEntitlement({
      activeSubscriptions: [],
      availablePurchases: [],
      promoLifetimeRedeemed: true,
      nowMs: 1_700_000_000_000,
    });
    assert.equal(snap.isActive, true);
    assert.equal(snap.source, "promo_lifetime");
  });

  it("prefers StoreKit lifetime over promotional lifetime", () => {
    const snap = resolvePlusEntitlement({
      activeSubscriptions: [],
      availablePurchases: [
        { productId: PLUS_PRODUCT_IDS.lifetime, purchaseState: "purchased" },
      ],
      promoLifetimeRedeemed: true,
      nowMs: 1_700_000_000_000,
    });
    assert.equal(snap.source, "lifetime");
  });
});
