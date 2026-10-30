import { createContext } from "react";
import type { PlusEntitlementSnapshot } from "@/lib/plus/entitlement";
import type { LegacyMigrationState } from "@/lib/plus/legacy-migration";
import type { PlusProductId } from "@/lib/plus/products";

export type PurchaseBusyState = "idle" | "purchasing" | "restoring" | "refreshing";

export type StoreProductLike = {
  id: string;
  title: string;
  description?: string;
  displayPrice: string;
  price?: number | null;
  type?: string;
  introductoryPriceIOS?: string | null;
  introductoryPriceAsAmountIOS?: string | null;
  introductoryPricePaymentModeIOS?: string | null;
  introductoryPriceNumberOfPeriodsIOS?: string | null;
  introductoryPriceSubscriptionPeriodIOS?: string | null;
  subscriptionPeriodUnitIOS?: string | null;
  subscriptionGroupIdIOS?: string | null;
};

export type PlusContextValue = {
  entitlement: PlusEntitlementSnapshot;
  hasPlus: boolean;
  monetizationEnabled: boolean;
  storeConnected: boolean;
  storeAvailable: boolean;
  loadingProducts: boolean;
  productsError: string | null;
  subscriptions: StoreProductLike[];
  lifetimeProduct: StoreProductLike | null;
  purchaseBusy: PurchaseBusyState;
  lastPurchaseError: string | null;
  legacy: LegacyMigrationState | null;
  showLegacyIntro: boolean;
  paywallVisible: boolean;
  paywallFeatureKey: string | null;
  openPaywall: (featureKey?: string) => void;
  closePaywall: () => void;
  dismissLegacyIntro: () => void;
  refreshEntitlement: () => Promise<PlusEntitlementSnapshot>;
  purchasePlan: (productId: PlusProductId) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  redeemPromoCode: (code: string) => Promise<{ ok: boolean; message: string }>;
  manageSubscriptions: () => Promise<void>;
  openLegalUrl: (kind: "privacy" | "terms" | "support") => void;
  canAccess: (navKey: string) => boolean;
  setDevUnlock: (enabled: boolean) => void;
};

export const PlusContext = createContext<PlusContextValue | null>(null);
