/**
 * Pure entitlement resolution for Synapse Plus.
 * Purchase truth comes from StoreKit-verified active transactions / lifetime ownership.
 * Local flags never permanently grant Plus by themselves.
 */

import {
  isPlusLifetimeId,
  isPlusSubscriptionId,
  planMetaForProductId,
  type PlusProductId,
  PLUS_PRODUCT_IDS,
} from "./products";

export type PlusAccessSource =
  | "none"
  | "subscription"
  | "lifetime"
  | "promo_lifetime"
  | "legacy_transition"
  | "dev_unlock";

export type PlusEntitlementSnapshot = {
  /** Unified premium entitlement id. */
  entitlementId: "synapse_plus";
  isActive: boolean;
  source: PlusAccessSource;
  /** Active product id when known (monthly / annual / lifetime). */
  productId?: PlusProductId | string;
  /** Plan label for settings UI. */
  planLabel?: string;
  /** ISO timestamp when access ends (subscriptions / legacy). Omit for lifetime. */
  expiresAt?: string;
  /** True while StoreKit reports an active intro / free trial period when detectable. */
  isInTrial?: boolean;
  /** True when auto-renew will continue (subscriptions only, when known). */
  willAutoRenew?: boolean;
  /** Last time this snapshot was derived from the store (ISO). */
  verifiedAt: string;
  /** Human-readable status for settings; never invent renewal dates. */
  statusLabel: string;
};

export type StoreEntitlementInput = {
  /** Active subscriptions from getActiveSubscriptions (isActive === true). */
  activeSubscriptions: Array<{
    productId: string;
    isActive: boolean;
    expirationDateIOS?: number | null;
    daysUntilExpirationIOS?: number | null;
    renewalInfoIOS?: { willAutoRenew?: boolean | null } | null;
    autoRenewingAndroid?: boolean | null;
  }>;
  /** Non-consumable / unfinished purchases that include lifetime. */
  availablePurchases: Array<{
    productId: string;
    purchaseState?: string;
    revocationDateIOS?: number | null;
  }>;
  nowMs?: number;
  /** Optional time-bounded transition for existing installs. */
  legacyTransitionUntilIso?: string | null;
  /** Dev-only unlock; ignored unless allowDevUnlock. */
  devUnlock?: boolean;
  allowDevUnlock?: boolean;
  /**
   * Device-local promotional lifetime unlock (validated via hashed offer digest).
   * Not a StoreKit purchase; still an explicit redeemed offer, not a free boolean toggle.
   */
  promoLifetimeRedeemed?: boolean;
};

function isoFromMs(ms: number | null | undefined): string | undefined {
  if (ms == null || !Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString();
}

function statusForActive(source: PlusAccessSource, isInTrial?: boolean): string {
  if (source === "lifetime" || source === "promo_lifetime") return "Lifetime access";
  if (source === "legacy_transition") return "Transition access";
  if (source === "dev_unlock") return "Developer unlock";
  if (isInTrial) return "Free trial";
  return "Active";
}

/**
 * Resolve synapse_plus from verified store state (+ optional legacy window).
 * Lifetime wins over subscriptions. Expired / revoked purchases do not grant access.
 */
export function resolvePlusEntitlement(input: StoreEntitlementInput): PlusEntitlementSnapshot {
  const now = input.nowMs ?? Date.now();
  const verifiedAt = new Date(now).toISOString();
  const base = {
    entitlementId: "synapse_plus" as const,
    verifiedAt,
  };

  if (input.allowDevUnlock && input.devUnlock) {
    return {
      ...base,
      isActive: true,
      source: "dev_unlock",
      planLabel: "Developer",
      statusLabel: statusForActive("dev_unlock"),
    };
  }

  const lifetime = input.availablePurchases.find((p) => {
    if (!isPlusLifetimeId(p.productId)) return false;
    if (p.revocationDateIOS) return false;
    const state = (p.purchaseState ?? "").toLowerCase();
    if (state && state !== "purchased" && state !== "restored") return false;
    return true;
  });

  if (lifetime) {
    return {
      ...base,
      isActive: true,
      source: "lifetime",
      productId: lifetime.productId,
      planLabel: planMetaForProductId(lifetime.productId)?.fallbackTitle ?? "Lifetime",
      statusLabel: statusForActive("lifetime"),
    };
  }

  if (input.promoLifetimeRedeemed) {
    return {
      ...base,
      isActive: true,
      source: "promo_lifetime",
      planLabel: "Lifetime (promotional)",
      statusLabel: statusForActive("promo_lifetime"),
    };
  }

  const activeSub = input.activeSubscriptions.find(
    (s) => s.isActive && isPlusSubscriptionId(s.productId)
  );

  if (activeSub) {
    const expiresAt = isoFromMs(activeSub.expirationDateIOS ?? undefined);
    const willAutoRenew =
      activeSub.renewalInfoIOS?.willAutoRenew ??
      activeSub.autoRenewingAndroid ??
      undefined;
    const meta = planMetaForProductId(activeSub.productId);
    // StoreKit does not always expose "in trial" on ActiveSubscription; UI may
    // refine this from purchase offer metadata when available.
    return {
      ...base,
      isActive: true,
      source: "subscription",
      productId: activeSub.productId,
      planLabel: meta?.fallbackTitle,
      expiresAt,
      willAutoRenew: typeof willAutoRenew === "boolean" ? willAutoRenew : undefined,
      statusLabel: statusForActive("subscription"),
    };
  }

  if (input.legacyTransitionUntilIso) {
    const until = Date.parse(input.legacyTransitionUntilIso);
    if (Number.isFinite(until) && until > now) {
      return {
        ...base,
        isActive: true,
        source: "legacy_transition",
        expiresAt: input.legacyTransitionUntilIso,
        planLabel: "Existing member transition",
        statusLabel: statusForActive("legacy_transition"),
      };
    }
  }

  return {
    ...base,
    isActive: false,
    source: "none",
    statusLabel: "Free",
  };
}

export function emptyEntitlement(nowMs = Date.now()): PlusEntitlementSnapshot {
  return resolvePlusEntitlement({
    activeSubscriptions: [],
    availablePurchases: [],
    nowMs,
  });
}

/** Prefer annual → monthly → lifetime for display when multiple could apply. */
export function preferredPlanProductId(
  snapshot: PlusEntitlementSnapshot
): string | undefined {
  if (snapshot.productId) return snapshot.productId;
  if (snapshot.source === "lifetime" || snapshot.source === "promo_lifetime") {
    return PLUS_PRODUCT_IDS.lifetime;
  }
  return undefined;
}
