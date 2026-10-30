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
  const hasFreeTrial =
    meta.offersTrial &&
    (introMode.includes("free") ||
      introMode === "freemium" ||
      // When StoreKit hasn't loaded intro metadata yet, still disclose intended trial.
      (!product && meta.offersTrial) ||
      (product?.introductoryPriceIOS === "Free" ||
        product?.introductoryPriceAsAmountIOS === "0" ||
        product?.introductoryPriceIOS === "$0.00"));

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
