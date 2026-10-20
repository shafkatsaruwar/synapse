import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import {
  CONTEXTUAL_TIP_COPY,
  TIP_BLOCKED_SCREENS,
  dismissTip,
  isTipDismissed,
  tipIdForScreen,
  type ContextualTipId,
} from "@/lib/contextual-tips-storage";
import { recordMilestone } from "@/lib/product-milestones";

interface ContextualTipProps {
  screen: string;
  /** When true (e.g. sick mode / emergency overlays), never show tips. */
  blocked?: boolean;
}

/**
 * Lightweight, dismissible first-use guidance.
 * Does not block interaction; respects dismissed tips; never shows over emergency screens.
 */
export default function ContextualTip({ screen, blocked }: ContextualTipProps) {
  const { colors: C } = useTheme();
  const [tipId, setTipId] = useState<ContextualTipId | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVisible(false);
    setTipId(null);

    if (blocked || TIP_BLOCKED_SCREENS.has(screen)) return;

    const id = tipIdForScreen(screen);
    if (!id) return;

    (async () => {
      const dismissed = await isTipDismissed(id);
      if (!cancelled && !dismissed) {
        setTipId(id);
        setVisible(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, blocked]);

  if (!visible || !tipId) return null;

  const copy = CONTEXTUAL_TIP_COPY[tipId];

  const handleDismiss = async () => {
    Haptics.selectionAsync().catch(() => {});
    await dismissTip(tipId);
    await recordMilestone("contextual_help_dismissed");
    setVisible(false);
  };

  return (
    <View
      style={[styles.wrap, { backgroundColor: C.surface, borderColor: C.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${copy.title}. ${copy.body}`}
    >
      <View style={styles.body}>
        <Text style={[styles.title, { color: C.text }]}>{copy.title}</Text>
        <Text style={[styles.text, { color: C.textSecondary }]}>{copy.body}</Text>
      </View>
      <Pressable
        onPress={() => void handleDismiss()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
        style={styles.close}
      >
        <Ionicons name="close" size={18} color={C.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: "600" },
  text: { fontSize: 14, lineHeight: 20 },
  close: { padding: 2 },
});
