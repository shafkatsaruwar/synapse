import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme, type Theme } from "@/contexts/ThemeContext";

type PlusBadgeProps = {
  compact?: boolean;
};

/** Subtle Synapse Plus indicator matching Soft Evergreen green. */
export default function PlusBadge({ compact = false }: PlusBadgeProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View
      style={[styles.badge, compact && styles.badgeCompact]}
      accessibilityLabel="Synapse Plus"
      accessibilityRole="text"
    >
      <Text style={[styles.text, compact && styles.textCompact]}>Plus</Text>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: C.tintLight,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.tint,
    },
    badgeCompact: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    text: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      color: C.tint,
      letterSpacing: 0.2,
    },
    textCompact: {
      fontSize: 10,
      lineHeight: 12,
    },
  });
}
