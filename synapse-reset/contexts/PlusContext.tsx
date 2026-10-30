import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import { emptyEntitlement, resolvePlusEntitlement } from "@/lib/plus/entitlement";
import {
  ensureLegacyMigrationEvaluated,
  getActiveLegacyTransitionUntil,
  getLegacyMigrationState,
  markLegacyIntroSeen,
} from "@/lib/plus/legacy-migration";
import { hasRedeemedPromoLifetime, redeemPromoCode as redeemPromoOffer } from "@/lib/plus/promo";
import { SYNAPSE_LEGAL_URLS } from "@/lib/plus/legal";
import {
  PlusContext,
  type PlusContextValue,
} from "./plus-context-shared";

export type { PlusContextValue, StoreProductLike, PurchaseBusyState } from "./plus-context-shared";

const MONETIZATION_ENABLED = Platform.OS === "ios";

function PlusProviderStub({ children }: { children: React.ReactNode }) {
  const [entitlement, setEntitlement] = useState(() => emptyEntitlement());
  const [legacy, setLegacy] = useState<PlusContextValue["legacy"]>(null);
  const [showLegacyIntro, setShowLegacyIntro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeatureKey, setPaywallFeatureKey] = useState<string | null>(null);
  const [devUnlock, setDevUnlock] = useState(false);
  const legacyUntilRef = useRef<string | null>(null);

  const apply = useCallback(
    async (legacyUntil: string | null) => {
      const promoLifetimeRedeemed = await hasRedeemedPromoLifetime();
      const next = resolvePlusEntitlement({
        activeSubscriptions: [],
        availablePurchases: [],
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
      await apply(until);
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  useEffect(() => {
    void apply(legacyUntilRef.current);
  }, [apply]);

  const value = useMemo<PlusContextValue>(
    () => ({
      entitlement,
      // Android / web: Plus IAP not configured yet — do not lock features.
      hasPlus: true,
      monetizationEnabled: false,
      storeConnected: false,
      storeAvailable: false,
      loadingProducts: false,
      productsError: null,
      subscriptions: [],
      lifetimeProduct: null,
      purchaseBusy: "idle",
      lastPurchaseError: null,
      legacy,
      showLegacyIntro,
      paywallVisible,
      paywallFeatureKey,
      openPaywall: (featureKey?: string) => {
        setPaywallFeatureKey(featureKey ?? null);
        setPaywallVisible(true);
      },
      closePaywall: () => {
        setPaywallVisible(false);
        setPaywallFeatureKey(null);
      },
      dismissLegacyIntro: () => {
        setShowLegacyIntro(false);
        void markLegacyIntroSeen();
        void getLegacyMigrationState().then(setLegacy);
      },
      refreshEntitlement: async () => apply(legacyUntilRef.current),
      purchasePlan: async () => false,
      restorePurchases: async () => false,
      redeemPromoCode: async (code: string) => {
        const result = await redeemPromoOffer(code);
        if (result.ok) {
          await apply(legacyUntilRef.current);
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
      manageSubscriptions: async () => {
        await Linking.openURL(SYNAPSE_LEGAL_URLS.manageSubscriptions);
      },
      openLegalUrl: (kind) => {
        const url =
          kind === "privacy"
            ? SYNAPSE_LEGAL_URLS.privacy
            : kind === "terms"
              ? SYNAPSE_LEGAL_URLS.appleStandardEula
              : SYNAPSE_LEGAL_URLS.support;
        Linking.openURL(url).catch(() => {});
      },
      canAccess: () => true,
      setDevUnlock,
    }),
    [entitlement, legacy, showLegacyIntro, paywallVisible, paywallFeatureKey, apply]
  );

  return <PlusContext.Provider value={value}>{children}</PlusContext.Provider>;
}

export function PlusProvider({ children }: { children: React.ReactNode }) {
  if (MONETIZATION_ENABLED) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlusProviderIOS } = require("./PlusProviderIOS") as typeof import("./PlusProviderIOS");
    return <PlusProviderIOS>{children}</PlusProviderIOS>;
  }
  return <PlusProviderStub>{children}</PlusProviderStub>;
}

export function usePlus(): PlusContextValue {
  const ctx = useContext(PlusContext);
  if (!ctx) throw new Error("usePlus must be used within PlusProvider");
  return ctx;
}

export function usePlusOptional(): PlusContextValue | null {
  return useContext(PlusContext);
}
