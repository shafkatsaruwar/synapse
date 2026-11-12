import type { PlusPlanMeta } from "./products";
import type { StoreProductLike } from "@/contexts/plus-context-shared";

function periodLabel(unit?: string | null): string {
  const u = (unit ?? "").toLowerCase();
  if (u.includes("year") || u === "year") return "year";
  if (u.includes("month") || u === "month") return "month";
  if (u.includes("week") || u === "week") return "week";
  return "";
}

/** Build trial / price disclosure from StoreKit product fields when present. */
export function subscriptionOfferCopy(
  product: StoreProductLike | undefined,
  meta: PlusPlanMeta
): { priceLine: string; trialLine: string | null; cta: string } {
  const price = product?.displayPrice?.trim() || `$${meta.usdListPrice.toFixed(2)}`;
  const interval =
    periodLabel(product?.subscriptionPeriodUnitIOS) || meta.fallbackIntervalLabel;

  const introMode = (product?.introductoryPricePaymentModeIOS ?? "").toLowerCase();
  // Only claim a free trial when StoreKit shows free intro pricing, or when
  // products have not loaded yet and ASC metadata says the plan offers one.
  // Never promise a trial for a loaded product that has no free intro fields.
  const storeKitShowsFreeIntro =
    introMode.includes("free") ||
    introMode === "freemium" ||
    product?.introductoryPriceIOS === "Free" ||
    product?.introductoryPriceAsAmountIOS === "0" ||
    product?.introductoryPriceIOS === "$0.00";
  const hasFreeTrial = meta.offersTrial && (storeKitShowsFreeIntro || (!product && meta.offersTrial));

  // Prefer StoreKit period count when available; default 7-day intro from ASC plan.
  const periods = product?.introductoryPriceNumberOfPeriodsIOS;
  const introUnit = periodLabel(product?.introductoryPriceSubscriptionPeriodIOS) || "day";
  let trialLength = "7 days";
  if (periods && introUnit) {
    const n = Number(periods);
    if (Number.isFinite(n) && n > 0) {
      trialLength = `${n} ${introUnit}${n === 1 ? "" : "s"}`;
    }
  }

  if (meta.kind === "lifetime") {
    return {
      priceLine: `${price} one-time`,
      trialLine: null,
      cta: "Unlock Lifetime Access",
    };
  }

  if (hasFreeTrial) {
    return {
      priceLine: `${price}/${interval}`,
      trialLine: `${trialLength} free, then ${price}/${interval}. Cancel anytime.`,
      cta: "Start Free Trial",
    };
  }

  return {
    priceLine: `${price}/${interval}`,
    trialLine: `Billed ${price}/${interval}. Cancel anytime.`,
    cta: `Subscribe ${meta.fallbackTitle}`,
  };
}
