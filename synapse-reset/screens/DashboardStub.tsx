import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.dark;

/**
 * Batch E (1.8.5) — Dashboard stub with full stack (Reanimated, Podfile plugin).
 */
export default function DashboardStub() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Batch E (1.8.5) — Rest: Reanimated + native plugins (signed in)</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today</Text>
        <Text style={styles.cardBody}>Placeholder for daily summary. No storage yet.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick actions</Text>
        <Text style={styles.cardBody}>Placeholder for shortcuts. Auth + storage in Batch C.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: {
    flexGrow: 1,
    backgroundColor: C.background,
    paddingHorizontal: 20,
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
    marginBottom: 24,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: C.text,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
  },
});
