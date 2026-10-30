import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Linking } from "react-native";
import {
  createPurchaseFlow,
  confirmOnDeviceIOS,
  deepLinkToSubscriptions,
  ErrorCode,
  fetchProducts as fetchProductsApi,
  getActiveSubscriptions as getActiveSubscriptionsApi,
  getAvailablePurchases as getAvailablePurchasesApi,
  isUserCancelledError,
  restorePurchases as restorePurchasesApi,
  showManageSubscriptionsIOS,
  useIAP,
  type Product,
  type ProductSubscription,
} from "expo-iap";
import {
  emptyEntitlement,
  resolvePlusEntitlement,
  type PlusEntitlementSnapshot,
} from "@/lib/plus/entitlement";
import {
  isPlusLifetimeId,
  isPlusSubscriptionId,
  PLUS_PRODUCT_IDS,
  PLUS_SUBSCRIPTION_IDS,
  type PlusProductId,
} from "@/lib/plus/products";
import {
  ensureLegacyMigrationEvaluated,
  getActiveLegacyTransitionUntil,
  getLegacyMigrationState,
  markLegacyIntroSeen,
  type LegacyMigrationState,
} from "@/lib/plus/legacy-migration";
import { hasRedeemedPromoLifetime, redeemPromoCode as redeemPromoOffer } from "@/lib/plus/promo";
import { SYNAPSE_LEGAL_URLS } from "@/lib/plus/legal";
import { requiresPlusGate } from "@/lib/plus/features";
import {
  PlusContext,
  type PlusContextValue,
  type PurchaseBusyState,
  type StoreProductLike,
} from "./plus-context-shared";

function toStoreProduct(p: Product | ProductSubscription): StoreProductLike {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    displayPrice: p.displayPrice,
    price: p.price,
    type: p.type,
    introductoryPriceIOS:
      "introductoryPriceIOS" in p ? (p.introductoryPriceIOS ?? null) : null,
    introductoryPriceAsAmountIOS:
      "introductoryPriceAsAmountIOS" in p
        ? (p.introductoryPriceAsAmountIOS ?? null)
        : null,
    introductoryPricePaymentModeIOS:
      "introductoryPricePaymentModeIOS" in p
        ? String(p.introductoryPricePaymentModeIOS ?? "")
        : null,
    introductoryPriceNumberOfPeriodsIOS:
      "introductoryPriceNumberOfPeriodsIOS" in p
        ? (p.introductoryPriceNumberOfPeriodsIOS ?? null)
        : null,
    introductoryPriceSubscriptionPeriodIOS:
      "introductoryPriceSubscriptionPeriodIOS" in p
        ? (p.introductoryPriceSubscriptionPeriodIOS
            ? String(p.introductoryPriceSubscriptionPeriodIOS)
            : null)
        : null,
    subscriptionPeriodUnitIOS:
      "subscriptionPeriodUnitIOS" in p
        ? (p.subscriptionPeriodUnitIOS ? String(p.subscriptionPeriodUnitIOS) : null)
        : null,
    subscriptionGroupIdIOS:
      "subscriptionGroupIdIOS" in p ? (p.subscriptionGroupIdIOS ?? null) : null,
  };
}

export function PlusProviderIOS({ children }: { children: ReactNode }) {
  const [entitlement, setEntitlement] = useState<PlusEntitlementSnapshot>(() => emptyEntitlement());
  const [legacy, setLegacy] = useState<LegacyMigrationState | null>(null);
  const [showLegacyIntro, setShowLegacyIntro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeatureKey, setPaywallFeatureKey] = useState<string | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState<PurchaseBusyState>("idle");
  const [lastPurchaseError, setLastPurchaseError] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<StoreProductLike[]>([]);
  const [lifetimeProduct, setLifetimeProduct] = useState<StoreProductLike | null>(null);
  const [devUnlock, setDevUnlock] = useState(false);
  const [storeAvailable, setStoreAvailable] = useState(true);
  const legacyUntilRef = useRef<string | null>(null);

  const applyResolved = useCallback(
    async (opts?: {
      activeSubscriptions?: Awaited<ReturnType<typeof getActiveSubscriptionsApi>>;
      availablePurchases?: Awaited<ReturnType<typeof getAvailablePurchasesApi>>;
      legacyUntil?: string | null;
    }) => {
      const legacyUntil =
        opts?.legacyUntil !== undefined
          ? opts.legacyUntil
          : await getActiveLegacyTransitionUntil();

      let activeSubscriptions = opts?.activeSubscriptions;
      let availablePurchasesRaw = opts?.availablePurchases;

      if (activeSubscriptions == null) {
        try {
          activeSubscriptions = await getActiveSubscriptionsApi([...PLUS_SUBSCRIPTION_IDS]);
        } catch {
          activeSubscriptions = [];
        }
      }
      if (availablePurchasesRaw == null) {
        try {
          availablePurchasesRaw = await getAvailablePurchasesApi({
            onlyIncludeActiveItemsIOS: true,
          });
        } catch {
          availablePurchasesRaw = [];
        }
      }

      const availablePurchases = (availablePurchasesRaw ?? []).map((p) => ({
        productId: p.productId,
        purchaseState: String(p.purchaseState ?? ""),
        revocationDateIOS:
          "revocationDateIOS" in p
            ? ((p as { revocationDateIOS?: number | null }).revocationDateIOS ?? null)
            : null,
      }));

      const promoLifetimeRedeemed = await hasRedeemedPromoLifetime();
      const next = resolvePlusEntitlement({
        activeSubscriptions: activeSubscriptions ?? [],
        availablePurchases,
        legacyTransitionUntilIso: legacyUntil,
        promoLifetimeRedeemed,
        devUnlock,
        allowDevUnlock: __DEV__,
      });
      setEntitlement(next);
      return next;
    },
    [devUnlock]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await ensureLegacyMigrationEvaluated();
      if (cancelled) return;
      setLegacy(state);
      const until = await getActiveLegacyTransitionUntil();
      legacyUntilRef.current = until;
      if (state.isLegacyInstall && !state.introSeen && state.transitionUntilIso) {
        setShowLegacyIntro(true);
      }
      await applyResolved({ legacyUntil: until });
    })();
    return () => {
      cancelled = true;
    };
  }, [applyResolved]);

  const purchaseFlow = useMemo(
    () =>
      createPurchaseFlow({
        // Lifetime + subscriptions are non-consumable.
        isConsumable: () => false,
        confirmWithBackend: confirmOnDeviceIOS(),
      }),
    []
  );

  const {
    connected,
    fetchProducts,
    requestPurchase,
    getAvailablePurchases,
    getActiveSubscriptions,
    restorePurchases: restorePurchasesHook,
    availablePurchases,
    activeSubscriptions,
  } = useIAP({
    purchaseFlow,
    onPurchaseFlowOutcome: async () => {
      await applyResolved({ legacyUntil: legacyUntilRef.current });
      setPurchaseBusy("idle");
      setPaywallVisible(false);
    },
    onPurchaseSuccess: async () => {
      // purchaseFlow finishes transactions; refresh entitlement either way.
      await applyResolved({ legacyUntil: legacyUntilRef.current });
      setPurchaseBusy("idle");
      setPaywallVisible(false);
    },
    onPurchaseError: (error) => {
      setPurchaseBusy("idle");
      if (isUserCancelledError(error) || error.code === ErrorCode.UserCancelled) {
        setLastPurchaseError(null);
        return;
      }
      setLastPurchaseError(error.message || "Purchase could not be completed.");
    },
    onError: (error) => {
      setProductsError(error.message || "Store error");
    },
  });

  const refreshEntitlement = useCallback(async () => {
    setPurchaseBusy((b) => (b === "idle" ? "refreshing" : b));
    try {
      if (connected) {
        await getActiveSubscriptions([...PLUS_SUBSCRIPTION_IDS]);
        await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      }
      return await applyResolved({ legacyUntil: legacyUntilRef.current });
    } finally {
      setPurchaseBusy((b) => (b === "refreshing" ? "idle" : b));
    }
  }, [applyResolved, connected, getActiveSubscriptions, getAvailablePurchases]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductsError(null);
    try {
      await fetchProducts({ skus: [...PLUS_SUBSCRIPTION_IDS], type: "subs" });
      await fetchProducts({ skus: [PLUS_PRODUCT_IDS.lifetime], type: "in-app" });
      const subs = (await fetchProductsApi({
        skus: [...PLUS_SUBSCRIPTION_IDS],
        type: "subs",
      })) as ProductSubscription[] | null;
      const lifetime = (await fetchProductsApi({
        skus: [PLUS_PRODUCT_IDS.lifetime],
        type: "in-app",
      })) as Product[] | null;
      setSubscriptions(Array.isArray(subs) ? subs.map(toStoreProduct) : []);
      setLifetimeProduct(
        Array.isArray(lifetime) && lifetime[0] ? toStoreProduct(lifetime[0]) : null
      );
      if ((!subs || subs.length === 0) && (!lifetime || lifetime.length === 0)) {
        setProductsError(
          "Products are not available yet. Configure them in App Store Connect and try again."
        );
      }
      setStoreAvailable(true);
    } catch (e) {
      setProductsError(e instanceof Error ? e.message : "Could not load products");
      setStoreAvailable(false);
    } finally {
      setLoadingProducts(false);
    }
  }, [fetchProducts]);

  useEffect(() => {
    if (!connected) return;
    void loadProducts();
    void refreshEntitlement();
  }, [connected, loadProducts, refreshEntitlement]);

  useEffect(() => {
    void applyResolved({
      activeSubscriptions,
      availablePurchases,
      legacyUntil: legacyUntilRef.current,
    });
  }, [activeSubscriptions, availablePurchases, applyResolved]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshEntitlement();
    });
    return () => sub.remove();
  }, [refreshEntitlement]);

  const purchasePlan = useCallback(
    async (productId: PlusProductId) => {
      if (!connected) {
        setLastPurchaseError("Store connection is not ready. Try again in a moment.");
        return false;
      }
      setLastPurchaseError(null);
      setPurchaseBusy("purchasing");
      try {
        if (isPlusSubscriptionId(productId)) {
          await requestPurchase({
            request: { apple: { sku: productId }, google: { skus: [productId] } },
            type: "subs",
          });
        } else if (isPlusLifetimeId(productId)) {
          await requestPurchase({
            request: { apple: { sku: productId }, google: { skus: [productId] } },
            type: "in-app",
          });
        } else {
          setPurchaseBusy("idle");
          return false;
        }
        return true;
      } catch (e) {
        setPurchaseBusy("idle");
        if (e && typeof e === "object" && isUserCancelledError(e as never)) return false;
        setLastPurchaseError(e instanceof Error ? e.message : "Purchase failed");
        return false;
      }
    },
    [connected, requestPurchase]
  );

  const restorePurchases = useCallback(async () => {
    setLastPurchaseError(null);
    setPurchaseBusy("restoring");
    try {
      await restorePurchasesHook({ onlyIncludeActiveItemsIOS: true });
      try {
        await restorePurchasesApi();
      } catch {
        // Hook restore is primary; direct call is best-effort sync.
      }
      const snap = await refreshEntitlement();
      setPurchaseBusy("idle");
      if (
        !snap.isActive ||
        snap.source === "legacy_transition" ||
        snap.source === "dev_unlock" ||
        snap.source === "promo_lifetime"
      ) {
        setLastPurchaseError("No previous Synapse Plus purchase was found for this Apple ID.");
        return false;
      }
      setPaywallVisible(false);
      return true;
    } catch (e) {
      setPurchaseBusy("idle");
      setLastPurchaseError(e instanceof Error ? e.message : "Restore failed");
      return false;
    }
  }, [refreshEntitlement, restorePurchasesHook]);

  const redeemPromoCode = useCallback(
    async (code: string) => {
      const result = await redeemPromoOffer(code);
      if (result.ok) {
        await applyResolved({ legacyUntil: legacyUntilRef.current });
        setPaywallVisible(false);
        return {
          ok: true,
          message: result.alreadyRedeemed
            ? "Lifetime access is already unlocked on this device."
            : "Lifetime access unlocked. Enjoy Synapse Plus.",
        };
      }
      if (result.reason === "empty") {
        return { ok: false, message: "Enter a promotional code." };
      }
      if (result.reason === "storage") {
        return { ok: false, message: "Could not save this offer. Try again." };
      }
      return { ok: false, message: "That code isn’t valid." };
    },
    [applyResolved]
  );

  const manageSubscriptions = useCallback(async () => {
    try {
      await showManageSubscriptionsIOS();
    } catch {
      try {
        await deepLinkToSubscriptions({
          skuAndroid: PLUS_PRODUCT_IDS.annual,
          packageNameAndroid: "com.mohammedsaruwar.synapse",
        });
      } catch {
        await Linking.openURL(SYNAPSE_LEGAL_URLS.manageSubscriptions);
      }
    }
  }, []);

  const openLegalUrl = useCallback((kind: "privacy" | "terms" | "support") => {
    const url =
      kind === "privacy"
        ? SYNAPSE_LEGAL_URLS.privacy
        : kind === "terms"
          ? SYNAPSE_LEGAL_URLS.appleStandardEula
          : SYNAPSE_LEGAL_URLS.support;
    Linking.openURL(url).catch(() => {});
  }, []);

  const openPaywall = useCallback((featureKey?: string) => {
    setPaywallFeatureKey(featureKey ?? null);
    setPaywallVisible(true);
    setLastPurchaseError(null);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallFeatureKey(null);
  }, []);

  const dismissLegacyIntro = useCallback(() => {
    setShowLegacyIntro(false);
    void markLegacyIntroSeen();
    void getLegacyMigrationState().then(setLegacy);
  }, []);

  const hasPlus = entitlement.isActive;

  const canAccess = useCallback(
    (navKey: string) => {
      if (!requiresPlusGate(navKey)) return true;
      return hasPlus;
    },
    [hasPlus]
  );

  const value = useMemo<PlusContextValue>(
    () => ({
      entitlement,
      hasPlus,
      monetizationEnabled: true,
      storeConnected: connected,
      storeAvailable,
      loadingProducts,
      productsError,
      subscriptions,
      lifetimeProduct,
      purchaseBusy,
      lastPurchaseError,
      legacy,
      showLegacyIntro,
      paywallVisible,
      paywallFeatureKey,
      openPaywall,
      closePaywall,
      dismissLegacyIntro,
      refreshEntitlement,
      purchasePlan,
      restorePurchases,
      redeemPromoCode,
      manageSubscriptions,
      openLegalUrl,
      canAccess,
      setDevUnlock,
    }),
    [
      entitlement,
      hasPlus,
      connected,
      storeAvailable,
      loadingProducts,
      productsError,
      subscriptions,
      lifetimeProduct,
      purchaseBusy,
      lastPurchaseError,
      legacy,
      showLegacyIntro,
      paywallVisible,
      paywallFeatureKey,
      openPaywall,
      closePaywall,
      dismissLegacyIntro,
      refreshEntitlement,
      purchasePlan,
      restorePurchases,
      redeemPromoCode,
      manageSubscriptions,
      openLegalUrl,
      canAccess,
    ]
  );

  return <PlusContext.Provider value={value}>{children}</PlusContext.Provider>;
}
