import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { usePlus } from "@/contexts/PlusContext";
import { PLUS_PLANS, type PlusProductId } from "@/lib/plus/products";
import { getPlusFeatureInfo } from "@/lib/plus/features";
import { subscriptionOfferCopy } from "@/lib/plus/pricing-copy";
import { softCardSurface } from "@/constants/soft-card";
import PlusPromoCodeField from "@/components/plus/PlusPromoCodeField";

const BENEFITS = [
  "How I’m Feeling — daily log, symptoms, monthly check-in",
  "Health Records — vitals, labs, imaging, timeline, reports",
  "Wellbeing tools — eating, comfort, goals, and more",
  "Check-In and Care & Support",
  "Advanced Emergency Card helpers",
];

type Props = {
  visible: boolean;
  onClose: () => void;
  featureKey?: string | null;
};

export default function SynapsePlusPaywallScreen({ visible, onClose, featureKey }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const {
    subscriptions,
    lifetimeProduct,
    purchasePlan,
    restorePurchases,
    openLegalUrl,
    purchaseBusy,
    lastPurchaseError,
    loadingProducts,
    productsError,
    storeConnected,
    monetizationEnabled,
    hasPlus,
  } = usePlus();

  const [selectedId, setSelectedId] = useState<PlusProductId>("synapse.plus.annual");
  const feature = featureKey ? getPlusFeatureInfo(featureKey) : null;
  const busy = purchaseBusy === "purchasing" || purchaseBusy === "restoring";

  const productFor = (productId: string) => {
    if (productId === "synapse.plus.lifetime") return lifetimeProduct ?? undefined;
    return subscriptions.find((s) => s.id === productId);
  };

  const onBuy = async () => {
    Haptics.selectionAsync().catch(() => {});
    await purchasePlan(selectedId);
  };

  const onRestore = async () => {
    Haptics.selectionAsync().catch(() => {});
    await restorePurchases();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Platform.OS === "ios" ? 12 : insets.top + 8 }]}>
        <View style={styles.handleRow}>
          <View style={styles.handle} accessibilityElementsHidden />
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close Synapse Plus"
          >
            <Ionicons name="close" size={22} color={C.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 28, maxWidth: Math.min(width, 560), alignSelf: "center", width: "100%" },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.brand}>Synapse Plus</Text>
          <Text style={styles.headline} accessibilityRole="header">
            Your health, all together.
          </Text>
          <Text style={styles.subhead}>Try Synapse Plus free for 7 days.</Text>

          {feature ? (
            <View style={styles.featureCard}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureBody}>{feature.summary}</Text>
            </View>
          ) : null}

          <View style={styles.benefits}>
            {BENEFITS.map((line) => (
              <View key={line} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={20} color={C.tint} />
                <Text style={styles.benefitText}>{line}</Text>
              </View>
            ))}
          </View>

          {loadingProducts ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.tint} />
              <Text style={styles.loadingText}>Loading plans…</Text>
            </View>
          ) : null}

          {productsError ? <Text style={styles.errorText}>{productsError}</Text> : null}

          <View style={styles.plans}>
            {PLUS_PLANS.map((plan) => {
              const product = productFor(plan.productId);
              const copy = subscriptionOfferCopy(product, plan);
              const selected = selectedId === plan.productId;
              return (
                <Pressable
                  key={plan.productId}
                  style={[
                    styles.planCard,
                    plan.emphasized && styles.planCardEmphasized,
                    selected && styles.planCardSelected,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedId(plan.productId);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${plan.fallbackTitle} plan, ${copy.priceLine}`}
                >
                  {plan.emphasized ? (
                    <Text style={styles.bestValue}>Best value</Text>
                  ) : null}
                  <View style={styles.planTop}>
                    <Text style={styles.planTitle}>{product?.title || plan.fallbackTitle}</Text>
                    <View
                      style={[styles.radio, selected && styles.radioSelected]}
                      accessibilityElementsHidden
                    >
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </View>
                  <Text style={styles.planPrice}>{copy.priceLine}</Text>
                  {copy.trialLine ? (
                    <Text style={styles.planTrial}>{copy.trialLine}</Text>
                  ) : (
                    <Text style={styles.planTrial}>One-time purchase. No free trial.</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {lastPurchaseError ? <Text style={styles.errorText}>{lastPurchaseError}</Text> : null}

          {!monetizationEnabled ? (
            <Text style={styles.hint}>
              Synapse Plus purchases are available in the iOS App Store build.
            </Text>
          ) : null}

          {hasPlus ? (
            <Text style={styles.hint}>You already have Synapse Plus on this Apple ID.</Text>
          ) : null}

          <Pressable
            style={[styles.cta, (busy || !storeConnected) && styles.ctaDisabled]}
            onPress={onBuy}
            disabled={busy || (monetizationEnabled && !storeConnected)}
            accessibilityRole="button"
            accessibilityLabel={
              selectedId === "synapse.plus.lifetime"
                ? "Unlock Lifetime Access"
                : subscriptionOfferCopy(productFor(selectedId), PLUS_PLANS.find((p) => p.productId === selectedId)!)
                    .cta
            }
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>
                {selectedId === "synapse.plus.lifetime"
                  ? "Unlock Lifetime Access"
                  : subscriptionOfferCopy(
                      productFor(selectedId),
                      PLUS_PLANS.find((p) => p.productId === selectedId)!
                    ).cta}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.restoreBtn}
            onPress={onRestore}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
          >
            <Text style={styles.restoreText}>
              {purchaseBusy === "restoring" ? "Restoring…" : "Restore Purchases"}
            </Text>
          </Pressable>

          <PlusPromoCodeField />

          <Text style={styles.legal}>
            Payment will be charged to your Apple ID. Subscriptions renew automatically unless canceled at
            least 24 hours before the end of the current period. Manage or cancel in Account Settings →
            Subscriptions.
          </Text>

          <View style={styles.links}>
            <Pressable onPress={() => openLegalUrl("terms")} accessibilityRole="link">
              <Text style={styles.link}>Terms of Use</Text>
            </Pressable>
            <Text style={styles.linkDot}>·</Text>
            <Pressable onPress={() => openLegalUrl("privacy")} accessibilityRole="link">
              <Text style={styles.link}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.linkDot}>·</Text>
            <Pressable onPress={() => openLegalUrl("support")} accessibilityRole="link">
              <Text style={styles.link}>Support</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    handleRow: {
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 4,
      minHeight: 36,
    },
    handle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: C.border,
    },
    closeBtn: {
      position: "absolute",
      right: 16,
      top: 0,
      width: 40,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    content: { paddingHorizontal: 20, paddingTop: 8 },
    brand: {
      fontSize: 14,
      fontWeight: "700",
      color: C.tint,
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    headline: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "700",
      color: C.text,
      marginBottom: 8,
    },
    subhead: {
      fontSize: 16,
      lineHeight: 22,
      color: C.textSecondary,
      marginBottom: 18,
    },
    featureCard: {
      ...softCardSurface({ backgroundColor: C.surface, borderRadius: 16 }),
      padding: 14,
      marginBottom: 16,
    },
    featureTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 4 },
    featureBody: { fontSize: 14, lineHeight: 20, color: C.textSecondary },
    benefits: { gap: 10, marginBottom: 18 },
    benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    benefitText: { flex: 1, fontSize: 14, lineHeight: 20, color: C.text },
    loadingBox: { alignItems: "center", gap: 8, marginBottom: 12 },
    loadingText: { fontSize: 13, color: C.textSecondary },
    plans: { gap: 10, marginBottom: 16 },
    planCard: {
      ...softCardSurface({ backgroundColor: C.surface, borderRadius: 16 }),
      padding: 14,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    planCardEmphasized: {
      borderColor: C.tint,
      backgroundColor: C.surface,
    },
    planCardSelected: {
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    bestValue: {
      alignSelf: "flex-start",
      fontSize: 11,
      fontWeight: "700",
      color: C.tint,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    planTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    planTitle: { fontSize: 17, fontWeight: "700", color: C.text, flex: 1, paddingRight: 8 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: { borderColor: C.tint },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.tint },
    planPrice: { marginTop: 6, fontSize: 15, fontWeight: "600", color: C.text },
    planTrial: { marginTop: 4, fontSize: 13, lineHeight: 18, color: C.textSecondary },
    cta: {
      backgroundColor: C.tint,
      borderRadius: 14,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    ctaDisabled: { opacity: 0.55 },
    ctaText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
    restoreBtn: { alignItems: "center", paddingVertical: 14 },
    restoreText: { fontSize: 15, fontWeight: "600", color: C.tint },
    legal: {
      fontSize: 12,
      lineHeight: 17,
      color: C.textTertiary,
      marginBottom: 14,
    },
    links: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 8,
    },
    link: { fontSize: 13, fontWeight: "600", color: C.tint, textDecorationLine: "underline" },
    linkDot: { color: C.textTertiary },
    errorText: { color: C.red, fontSize: 13, lineHeight: 18, marginBottom: 10 },
    hint: { fontSize: 13, lineHeight: 18, color: C.textSecondary, marginBottom: 10 },
  });
}
