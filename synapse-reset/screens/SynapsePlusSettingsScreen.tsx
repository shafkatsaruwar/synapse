import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { usePlus } from "@/contexts/PlusContext";
import { softCardSurface } from "@/constants/soft-card";
import PlusBadge from "@/components/plus/PlusBadge";
import PlusPromoCodeField from "@/components/plus/PlusPromoCodeField";
import {
  registerOwnerDeviceForPurchaseAlerts,
  sendOwnerTestPurchaseAlert,
} from "@/lib/owner-purchase-alerts";
import { getSupabaseUrl } from "@/lib/supabase";

type Props = {
  onNavigate?: (screen: string) => void;
};

export default function SynapsePlusSettingsScreen({ onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const {
    entitlement,
    hasPlus,
    monetizationEnabled,
    openPaywall,
    restorePurchases,
    manageSubscriptions,
    refreshEntitlement,
    purchaseBusy,
    lastPurchaseError,
    openLegalUrl,
  } = usePlus();
  const [ownerToolsOpen, setOwnerToolsOpen] = useState(false);
  const [ownerSecret, setOwnerSecret] = useState("");
  const [ownerBusy, setOwnerBusy] = useState(false);

  const ownerFunctionsBase = useMemo(() => {
    const url = getSupabaseUrl() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || "";
    return url ? `${url.replace(/\/$/, "")}/functions/v1` : "";
  }, []);

  const runOwnerAction = async (action: "register" | "test") => {
    if (!ownerFunctionsBase) {
      Alert.alert("Unavailable", "Supabase URL is not configured in this build.");
      return;
    }
    setOwnerBusy(true);
    try {
      if (action === "register") {
        await registerOwnerDeviceForPurchaseAlerts({
          secret: ownerSecret,
          label: "Owner iPhone",
          supabaseFunctionsBaseUrl: ownerFunctionsBase,
        });
        setOwnerSecret("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert("Registered", "This iPhone will receive Synapse Plus purchase alerts.");
      } else {
        const result = await sendOwnerTestPurchaseAlert({
          secret: ownerSecret,
          supabaseFunctionsBaseUrl: ownerFunctionsBase,
        });
        setOwnerSecret("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert("Test sent", `Delivered to ${result.sent ?? 0} owner device(s).`);
      }
    } catch (e) {
      Alert.alert("Couldn’t finish", e instanceof Error ? e.message : "Try again.");
    } finally {
      setOwnerBusy(false);
    }
  };

  const expiresLabel =
    entitlement.expiresAt &&
    (entitlement.source === "subscription" || entitlement.source === "legacy_transition")
      ? new Date(entitlement.expiresAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Platform.OS === "web" ? 24 : 8, paddingBottom: insets.bottom + 120 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Synapse Plus</Text>
        {hasPlus ? <PlusBadge /> : null}
      </View>
      <Text style={styles.subtitle}>
        Premium tracking, records, wellbeing, Check-In, and Care & Support.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Status</Text>
        <Text style={styles.cardValue}>{entitlement.statusLabel}</Text>
        {entitlement.planLabel ? (
          <Text style={styles.cardMeta}>Plan: {entitlement.planLabel}</Text>
        ) : null}
        {entitlement.productId ? (
          <Text style={styles.cardMeta}>Product: {entitlement.productId}</Text>
        ) : null}
        {expiresLabel ? (
          <Text style={styles.cardMeta}>
            {entitlement.source === "legacy_transition"
              ? `Transition access through ${expiresLabel}`
              : entitlement.willAutoRenew === false
                ? `Access through ${expiresLabel} (auto-renew off)`
                : `Renews or ends around ${expiresLabel}`}
          </Text>
        ) : null}
        {entitlement.source === "lifetime" ? (
          <Text style={styles.cardMeta}>Lifetime access does not renew.</Text>
        ) : null}
        {entitlement.isInTrial ? <Text style={styles.cardMeta}>Currently in free trial.</Text> : null}
        <Text style={styles.cardFoot}>
          Status comes from verified App Store purchase information
          {entitlement.source === "legacy_transition" ? " or your existing-member transition window" : ""}.
        </Text>
      </View>

      {!hasPlus || entitlement.source === "legacy_transition" ? (
        <Pressable
          style={styles.primary}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            openPaywall();
          }}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to Synapse Plus"
        >
          <Text style={styles.primaryText}>
            {hasPlus ? "View Synapse Plus plans" : "Upgrade to Synapse Plus"}
          </Text>
        </Pressable>
      ) : null}

      {entitlement.source !== "lifetime" ? (
        <View style={styles.card}>
          <PlusPromoCodeField compact />
        </View>
      ) : null}

      <View style={styles.list}>
        <Row
          icon="refresh-outline"
          title="Restore Purchases"
          body="Reload Plus from this Apple ID"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            void restorePurchases();
          }}
          disabled={purchaseBusy === "restoring" || !monetizationEnabled}
          trailing={
            purchaseBusy === "restoring" ? <ActivityIndicator color={C.tint} /> : undefined
          }
          C={C}
          styles={styles}
        />
        <Row
          icon="card-outline"
          title="Manage Subscription"
          body="Open Apple subscription settings"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            void manageSubscriptions();
          }}
          C={C}
          styles={styles}
        />
        <Row
          icon="sync-outline"
          title="Refresh status"
          body="Check the latest verified entitlement"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            void refreshEntitlement();
          }}
          C={C}
          styles={styles}
        />
        <Row
          icon="document-text-outline"
          title="Terms of Use"
          onPress={() => openLegalUrl("terms")}
          C={C}
          styles={styles}
        />
        <Row
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          onPress={() => openLegalUrl("privacy")}
          C={C}
          styles={styles}
        />
        <Row
          icon="help-circle-outline"
          title="Support"
          onPress={() => openLegalUrl("support")}
          C={C}
          styles={styles}
        />
      </View>

      {lastPurchaseError ? <Text style={styles.error}>{lastPurchaseError}</Text> : null}

      {!monetizationEnabled ? (
        <Text style={styles.note}>
          In-app purchases for Synapse Plus are available in the iOS App Store build.
        </Text>
      ) : null}

      <Text style={styles.note}>
        Medications, appointments, Sick Mode, and basic Emergency Card access remain free. Existing health
        data is never erased when Plus access changes.
      </Text>

      {Platform.OS === "ios" ? (
        <View style={styles.card}>
          <Pressable
            onPress={() => setOwnerToolsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel="Owner purchase alerts"
          >
            <Text style={styles.cardLabel}>Founder tools</Text>
            <Text style={styles.cardValue}>Owner purchase alerts</Text>
            <Text style={styles.cardFoot}>
              Register this iPhone to get a private push when a real customer buys Synapse Plus. Uses your
              server secret — never share it.
            </Text>
          </Pressable>
          {ownerToolsOpen ? (
            <View style={{ gap: 10, marginTop: 10 }}>
              <TextInput
                style={styles.secretInput}
                value={ownerSecret}
                onChangeText={setOwnerSecret}
                placeholder="Owner alerts secret"
                placeholderTextColor={C.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!ownerBusy}
                accessibilityLabel="Owner alerts secret"
              />
              <Pressable
                style={[styles.primary, ownerBusy && { opacity: 0.5 }]}
                disabled={ownerBusy}
                onPress={() => {
                  void runOwnerAction("register");
                }}
                accessibilityRole="button"
                accessibilityLabel="Register this iPhone"
              >
                {ownerBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>Register this iPhone</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.secondary, ownerBusy && { opacity: 0.5 }]}
                disabled={ownerBusy}
                onPress={() => {
                  void runOwnerAction("test");
                }}
                accessibilityRole="button"
                accessibilityLabel="Send test purchase alert"
              >
                <Text style={styles.secondaryText}>Send test notification</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {onNavigate ? (
        <Pressable onPress={() => onNavigate("accounthub")} accessibilityRole="button">
          <Text style={styles.backLink}>Back to You & Settings</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  body,
  onPress,
  disabled,
  trailing,
  C,
  styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  onPress: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
  C: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={C.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {body ? <Text style={styles.rowBody}>{body}</Text> : null}
      </View>
      {trailing ?? <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />}
    </Pressable>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 20 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    title: { fontSize: 28, fontWeight: "700", color: C.text },
    subtitle: { fontSize: 15, lineHeight: 22, color: C.textSecondary, marginBottom: 16 },
    card: {
      ...softCardSurface({ backgroundColor: C.surface, borderRadius: 18 }),
      padding: 16,
      marginBottom: 14,
      gap: 4,
    },
    cardLabel: { fontSize: 12, fontWeight: "700", color: C.tint, textTransform: "uppercase" },
    cardValue: { fontSize: 20, fontWeight: "700", color: C.text, marginTop: 2 },
    cardMeta: { fontSize: 13, lineHeight: 18, color: C.textSecondary },
    cardFoot: { marginTop: 8, fontSize: 12, lineHeight: 17, color: C.textTertiary },
    primary: {
      backgroundColor: C.tint,
      borderRadius: 14,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    secondary: {
      backgroundColor: C.surfaceElevated,
      borderRadius: 14,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    secondaryText: { color: C.text, fontSize: 15, fontWeight: "700" },
    secretInput: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      paddingHorizontal: 12,
      color: C.text,
      fontSize: 15,
      fontWeight: "500",
    },
    list: { gap: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: C.tintLight,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: { fontSize: 15, fontWeight: "600", color: C.text },
    rowBody: { fontSize: 12, lineHeight: 16, color: C.textSecondary, marginTop: 2 },
    error: { marginTop: 12, color: C.red, fontSize: 13, lineHeight: 18 },
    note: { marginTop: 16, fontSize: 13, lineHeight: 18, color: C.textSecondary },
    backLink: {
      marginTop: 18,
      fontSize: 15,
      fontWeight: "600",
      color: C.tint,
      textAlign: "center",
    },
  });
}
