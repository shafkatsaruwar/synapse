/**
 * Pure policy: which App Store Server Notification V2 events should alert the owner.
 * No PHI — product IDs and notification metadata only.
 * Keep in sync with lib/plus/products.ts product IDs.
 */

export const PLUS_PRODUCT_IDS = {
  monthly: "com.synapse.monthly",
  annual: "com.synapse.yearly",
  lifetime: "com.synapse.plus.lifetime",
} as const;

export const OWNER_PURCHASE_ALERT_TITLE = "🎉 New Synapse Plus Purchase!";
export const OWNER_PURCHASE_ALERT_BODY =
  "Someone just purchased Synapse Plus! Your app is growing. 🌱";

export const SANDBOX_OWNER_PURCHASE_ALERT_TITLE = "[Sandbox] Synapse Plus purchase";
export const SANDBOX_OWNER_PURCHASE_ALERT_BODY =
  "A Sandbox/TestFlight Synapse Plus purchase was recorded. Production customers are unaffected.";

const PLUS_IDS = new Set<string>(Object.values(PLUS_PRODUCT_IDS));

/** Subscription notification types that mean a new paying period started (not a renewal). */
const NEW_SUBSCRIPTION_SUBTYPES = new Set(["INITIAL_BUY", "RESUBSCRIBE"]);

export type PurchaseAlertDecision =
  | {
      alert: true;
      reason: "new_subscription" | "lifetime_purchase";
      productId: string;
    }
  | {
      alert: false;
      reason:
        | "not_plus_product"
        | "missing_product"
        | "renewal_or_other"
        | "sandbox_suppressed"
        | "duplicate_notification"
        | "duplicate_transaction";
    };

export function isPlusProductId(productId: string | null | undefined): boolean {
  return typeof productId === "string" && PLUS_IDS.has(productId);
}

export function isPlusLifetimeId(productId: string | null | undefined): boolean {
  return productId === PLUS_PRODUCT_IDS.lifetime;
}

/**
 * Decide whether this ASSN V2 notification should trigger an owner push.
 * Renewals (DID_RENEW), status changes, refunds, etc. are ignored.
 */
export function decidePurchaseAlert(input: {
  notificationType: string;
  subtype?: string | null;
  productId?: string | null;
  environment: "Production" | "Sandbox";
  /** When false, Sandbox/TestFlight events are recorded but do not push. */
  notifySandbox?: boolean;
}): PurchaseAlertDecision {
  const productId = input.productId ?? null;
  if (!productId) return { alert: false, reason: "missing_product" };
  if (!isPlusProductId(productId)) return { alert: false, reason: "not_plus_product" };

  const type = input.notificationType.toUpperCase();
  const subtype = (input.subtype ?? "").toUpperCase();

  let matched: PurchaseAlertDecision | null = null;

  if (type === "SUBSCRIBED" && NEW_SUBSCRIPTION_SUBTYPES.has(subtype)) {
    matched = { alert: true, reason: "new_subscription", productId };
  } else if (type === "ONE_TIME_CHARGE" && isPlusLifetimeId(productId)) {
    matched = { alert: true, reason: "lifetime_purchase", productId };
  } else {
    return { alert: false, reason: "renewal_or_other" };
  }

  if (input.environment === "Sandbox" && input.notifySandbox !== true) {
    return { alert: false, reason: "sandbox_suppressed" };
  }

  return matched;
}

export function alertCopyForEnvironment(environment: "Production" | "Sandbox"): {
  title: string;
  body: string;
} {
  if (environment === "Sandbox") {
    return {
      title: SANDBOX_OWNER_PURCHASE_ALERT_TITLE,
      body: SANDBOX_OWNER_PURCHASE_ALERT_BODY,
    };
  }
  return {
    title: OWNER_PURCHASE_ALERT_TITLE,
    body: OWNER_PURCHASE_ALERT_BODY,
  };
}
