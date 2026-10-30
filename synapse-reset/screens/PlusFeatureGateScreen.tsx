import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { usePlus } from "@/contexts/PlusContext";
import { getPlusFeatureInfo } from "@/lib/plus/features";
import { softCardSurface } from "@/constants/soft-card";
import PlusBadge from "@/components/plus/PlusBadge";

type Props = {
  featureKey: string;
  onBack?: () => void;
};

/**
 * Shown when a free user opens a Plus feature.
 * Explains the feature, offers a limited preview description, and upgrade CTA.
 */
export default function PlusFeatureGateScreen({ featureKey, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { openPaywall } = usePlus();
  const info = getPlusFeatureInfo(featureKey);

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
        <Text style={styles.title}>{info.title}</Text>
        <PlusBadge />
      </View>
      <Text style={styles.subtitle}>{info.summary}</Text>

      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>What you can do with Plus</Text>
        {info.benefits.map((b) => (
          <View key={b} style={styles.benefitRow}>
            <Ionicons name="leaf-outline" size={18} color={C.tint} />
            <Text style={styles.benefitText}>{b}</Text>
          </View>
        ))}
        <Text style={styles.previewNote}>
          Your existing data stays on this device. Upgrading unlocks these tools — nothing is deleted if
          Plus later expires.
        </Text>
      </View>

      <Pressable
        style={styles.cta}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          openPaywall(featureKey);
        }}
        accessibilityRole="button"
        accessibilityLabel="Upgrade to Synapse Plus"
      >
        <Text style={styles.ctaText}>Try Synapse Plus free for 7 days</Text>
      </Pressable>

      {onBack ? (
        <Pressable
          style={styles.secondary}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.secondaryText}>Not now</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 20 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
      flexWrap: "wrap",
    },
    title: { fontSize: 28, fontWeight: "700", color: C.text },
    subtitle: { fontSize: 15, lineHeight: 22, color: C.textSecondary, marginBottom: 18 },
    previewCard: {
      ...softCardSurface({ backgroundColor: C.surface, borderRadius: 18 }),
      padding: 16,
      gap: 10,
      marginBottom: 20,
    },
    previewLabel: { fontSize: 13, fontWeight: "700", color: C.tint, marginBottom: 4 },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    benefitText: { flex: 1, fontSize: 15, lineHeight: 21, color: C.text },
    previewNote: { marginTop: 6, fontSize: 13, lineHeight: 18, color: C.textSecondary },
    cta: {
      backgroundColor: C.tint,
      borderRadius: 14,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    ctaText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    secondary: { alignItems: "center", paddingVertical: 16 },
    secondaryText: { fontSize: 15, fontWeight: "600", color: C.textSecondary },
  });
}
