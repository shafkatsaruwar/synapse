/**
 * Synapse Plus StoreKit product catalog.
 * Prices and currency must be read from StoreKit at runtime — never hardcode
 * live checkout amounts. The USD figures below are App Store Connect targets only.
 */

export const SYNAPSE_PLUS_ENTITLEMENT = "synapse_plus" as const;

/** Suggested App Store subscription group name / reference. */
export const SYNAPSE_PLUS_SUBSCRIPTION_GROUP_REF = "synapse_plus";

export const PLUS_PRODUCT_IDS = {
  monthly: "com.synapse.monthly",
  annual: "com.synapse.yearly",
  lifetime: "com.synapse.plus.lifetime",
} as const;

export type PlusPlanId = keyof typeof PLUS_PRODUCT_IDS;
export type PlusProductId = (typeof PLUS_PRODUCT_IDS)[PlusPlanId];

export const PLUS_SUBSCRIPTION_IDS: PlusProductId[] = [
  PLUS_PRODUCT_IDS.monthly,
  PLUS_PRODUCT_IDS.annual,
];

export const PLUS_LIFETIME_IDS: PlusProductId[] = [PLUS_PRODUCT_IDS.lifetime];

export const ALL_PLUS_PRODUCT_IDS: PlusProductId[] = [
  ...PLUS_SUBSCRIPTION_IDS,
  ...PLUS_LIFETIME_IDS,
];

export type PlusPlanKind = "subscription" | "lifetime";

export type PlusPlanMeta = {
  id: PlusPlanId;
  productId: PlusProductId;
  kind: PlusPlanKind;
  /** App Store Connect list price target (USD). Display uses StoreKit. */
  usdListPrice: number;
  /** Human label when StoreKit title is unavailable. */
  fallbackTitle: string;
  /** Billing interval copy when StoreKit period is unavailable. */
  fallbackIntervalLabel: string;
  offersTrial: boolean;
  /** Visual emphasis on the paywall (annual recommended). */
  emphasized?: boolean;
};

export const PLUS_PLANS: PlusPlanMeta[] = [
  {
    id: "monthly",
    productId: PLUS_PRODUCT_IDS.monthly,
    kind: "subscription",
    usdListPrice: 4.99,
    fallbackTitle: "Monthly",
    fallbackIntervalLabel: "month",
    offersTrial: true,
  },
  {
    id: "annual",
    productId: PLUS_PRODUCT_IDS.annual,
    kind: "subscription",
    usdListPrice: 49.99,
    fallbackTitle: "Annual",
    fallbackIntervalLabel: "year",
    offersTrial: true,
    emphasized: true,
  },
  {
    id: "lifetime",
    productId: PLUS_PRODUCT_IDS.lifetime,
    kind: "lifetime",
    usdListPrice: 129.99,
    fallbackTitle: "Lifetime",
    fallbackIntervalLabel: "one-time",
    offersTrial: false,
  },
];

export function planMetaForProductId(productId: string): PlusPlanMeta | undefined {
  return PLUS_PLANS.find((p) => p.productId === productId);
}

export function isPlusSubscriptionId(productId: string): boolean {
  return (PLUS_SUBSCRIPTION_IDS as string[]).includes(productId);
}

export function isPlusLifetimeId(productId: string): boolean {
  return (PLUS_LIFETIME_IDS as string[]).includes(productId);
}

export function isPlusProductId(productId: string): boolean {
  return (ALL_PLUS_PRODUCT_IDS as string[]).includes(productId);
}
