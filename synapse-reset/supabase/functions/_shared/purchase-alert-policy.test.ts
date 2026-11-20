/** Run: npx tsx --test supabase/functions/_shared/purchase-alert-policy.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import {
  OWNER_PURCHASE_ALERT_BODY,
  OWNER_PURCHASE_ALERT_TITLE,
  PLUS_PRODUCT_IDS,
  alertCopyForEnvironment,
  decidePurchaseAlert,
} from "./purchase-alert-policy.ts";

test("alerts on new monthly INITIAL_BUY in Production", () => {
  const d = decidePurchaseAlert({
    notificationType: "SUBSCRIBED",
    subtype: "INITIAL_BUY",
    productId: PLUS_PRODUCT_IDS.monthly,
    environment: "Production",
  });
  assert.equal(d.alert, true);
  if (d.alert) assert.equal(d.reason, "new_subscription");
});

test("alerts on annual RESUBSCRIBE in Production", () => {
  const d = decidePurchaseAlert({
    notificationType: "SUBSCRIBED",
    subtype: "RESUBSCRIBE",
    productId: PLUS_PRODUCT_IDS.annual,
    environment: "Production",
  });
  assert.equal(d.alert, true);
});

test("alerts on lifetime ONE_TIME_CHARGE", () => {
  const d = decidePurchaseAlert({
    notificationType: "ONE_TIME_CHARGE",
    productId: PLUS_PRODUCT_IDS.lifetime,
    environment: "Production",
  });
  assert.equal(d.alert, true);
  if (d.alert) assert.equal(d.reason, "lifetime_purchase");
});

test("skips renewals and unrelated types", () => {
  assert.equal(
    decidePurchaseAlert({
      notificationType: "DID_RENEW",
      productId: PLUS_PRODUCT_IDS.monthly,
      environment: "Production",
    }).alert,
    false,
  );
  assert.equal(
    decidePurchaseAlert({
      notificationType: "SUBSCRIBED",
      subtype: "INITIAL_BUY",
      productId: "com.other.app.premium",
      environment: "Production",
    }).alert,
    false,
  );
  assert.equal(
    decidePurchaseAlert({
      notificationType: "REFUND",
      productId: PLUS_PRODUCT_IDS.lifetime,
      environment: "Production",
    }).alert,
    false,
  );
});

test("suppresses Sandbox unless notifySandbox is true", () => {
  const suppressed = decidePurchaseAlert({
    notificationType: "SUBSCRIBED",
    subtype: "INITIAL_BUY",
    productId: PLUS_PRODUCT_IDS.monthly,
    environment: "Sandbox",
  });
  assert.equal(suppressed.alert, false);
  if (!suppressed.alert) assert.equal(suppressed.reason, "sandbox_suppressed");

  const allowed = decidePurchaseAlert({
    notificationType: "SUBSCRIBED",
    subtype: "INITIAL_BUY",
    productId: PLUS_PRODUCT_IDS.monthly,
    environment: "Sandbox",
    notifySandbox: true,
  });
  assert.equal(allowed.alert, true);
});

test("production celebration copy has no PHI placeholders", () => {
  const copy = alertCopyForEnvironment("Production");
  assert.equal(copy.title, OWNER_PURCHASE_ALERT_TITLE);
  assert.equal(copy.body, OWNER_PURCHASE_ALERT_BODY);
  assert.ok(!/transaction|email|user|customer|health/i.test(copy.body));
});
