import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.dark;

/**
 * Batch E (1.8.5) — Minimal auth gate placeholder.
 * Shown when not signed in. Set EXPO_PUBLIC_SUPABASE_* in EAS to use real sign-in.
 */
export default function AuthStub() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Batch E (1.8.5) — Reanimated removed (was crashing); rest of stack only</Text>
      <Text style={styles.body}>
        Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in EAS (or .env) to enable sign-in.
        Until then, auth is disabled and this screen is shown when there is no session.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
