import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";

/**
 * Minimal auth gate placeholder. Shown when not signed in (if used by a route).
 */
export default function AuthStub() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Sign in to back up and sync your data</Text>
      <Text style={styles.body}>
        Accounts have been removed. All data now stays locally on your device.
      </Text>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
      paddingHorizontal: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: C.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: C.textSecondary,
      marginBottom: 16,
    },
    body: {
      fontSize: 15,
      color: C.textSecondary,
      lineHeight: 22,
    },
  });
}
