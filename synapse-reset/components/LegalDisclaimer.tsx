import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { LEGAL } from "@/constants/legal-disclaimers";

type Variant = "banner" | "ai" | "appointment" | "documents" | "insights";

const COPY: Record<Variant, string> = {
  banner: LEGAL.banner,
  ai: LEGAL.aiScope,
  appointment: LEGAL.appointmentAi,
  documents: LEGAL.documentsAi,
  insights: LEGAL.insightsAi,
};

type Props = {
  variant?: Variant;
  /** Optional override; defaults to the variant copy */
  text?: string;
  style?: object;
};

/**
 * Compact legal notice for screens that show health or AI content.
 */
export default function LegalDisclaimer({ variant = "banner", text, style }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const body = text ?? COPY[variant];

  return (
    <View style={[styles.wrap, style]} accessibilityRole="text" accessibilityLabel={body}>
      <Ionicons name="information-circle-outline" size={16} color={C.textTertiary} style={styles.icon} />
      <Text style={styles.text}>{body}</Text>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: C.surfaceElevated,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 14,
    },
    icon: { marginTop: 1 },
    text: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "500",
      color: C.textTertiary,
    },
  });
}
