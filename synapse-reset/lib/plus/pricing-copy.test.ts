/** Run: npx tsx --test lib/plus/pricing-copy.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import { PLUS_PLANS } from "./products";
import { subscriptionOfferCopy } from "./pricing-copy";

const monthly = PLUS_PLANS.find((p) => p.id === "monthly")!;
const lifetime = PLUS_PLANS.find((p) => p.id === "lifetime")!;

test("does not promise a free trial for a loaded product without StoreKit intro", () => {
  const copy = subscriptionOfferCopy(
    {
      id: monthly.productId,
      title: "Monthly",
      displayPrice: "$4.99",
      subscriptionPeriodUnitIOS: "MONTH",
    },
    monthly,
  );
  assert.equal(copy.trialLine?.includes("free"), false);
  assert.match(copy.cta, /Subscribe/i);
});

test("discloses free trial when StoreKit reports free intro pricing", () => {
  const copy = subscriptionOfferCopy(
    {
      id: monthly.productId,
      title: "Monthly",
      displayPrice: "$4.99",
      subscriptionPeriodUnitIOS: "MONTH",
      introductoryPricePaymentModeIOS: "free",
      introductoryPriceNumberOfPeriodsIOS: "7",
      introductoryPriceSubscriptionPeriodIOS: "DAY",
    },
    monthly,
  );
  assert.match(copy.trialLine ?? "", /7 days free/i);
  assert.equal(copy.cta, "Start Free Trial");
});

test("lifetime never claims a free trial", () => {
  const copy = subscriptionOfferCopy(
    { id: lifetime.productId, title: "Lifetime", displayPrice: "$129.99" },
    lifetime,
  );
  assert.equal(copy.trialLine, null);
  assert.match(copy.cta, /Lifetime/i);
});
