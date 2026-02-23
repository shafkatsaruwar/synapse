import React, { useState } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, useWindowDimensions, Alert, Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { exportAllData, clearAllData } from "@/lib/storage";

const C = Colors.dark;

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const data = await exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      await Share.share({
        message: jsonStr,
        title: "Fir Health Data Export",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
    } finally {
      setExporting(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      "Delete All Data",
      "This will permanently remove all your health data, documents, and settings from this device. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Done", "All data has been deleted.");
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, {
      paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
      paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
    }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Privacy & Data</Text>
      <Text style={styles.subtitle}>Your health data stays on your device</Text>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.greenLight }]}>
            <Ionicons name="shield-checkmark" size={20} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>Local-First Storage</Text>
            <Text style={styles.featureDesc}>All data is stored on your device using encrypted local storage. Nothing is sent to external servers without your action.</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.tintLight }]}>
            <Ionicons name="lock-closed" size={20} color={C.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>AI Processing</Text>
            <Text style={styles.featureDesc}>Document analysis and insights use AI only when you explicitly request it. Your data is processed for the request and not stored by the AI service.</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.purpleLight }]}>
            <Ionicons name="eye-off" size={20} color={C.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>No Third-Party Sharing</Text>
            <Text style={styles.featureDesc}>Your health data is never shared with third parties, advertisers, or data brokers. You control who sees your data.</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.cyanLight }]}>
            <Ionicons name="heart" size={20} color={C.cyan} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>HealthKit Ready</Text>
            <Text style={styles.featureDesc}>Data structure is designed for future Apple HealthKit integration. When available, you'll be able to sync vitals automatically.</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Data Management</Text>

      <Pressable style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={handleExport} disabled={exporting}>
        <View style={[styles.actionIcon, { backgroundColor: C.tintLight }]}>
          <Ionicons name="download-outline" size={20} color={C.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Export All Data</Text>
          <Text style={styles.actionDesc}>Download a JSON file with all your health data</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
      </Pressable>

      <Pressable style={({ pressed }) => [styles.actionBtn, styles.dangerAction, { opacity: pressed ? 0.85 : 1 }]} onPress={handleClear}>
        <View style={[styles.actionIcon, { backgroundColor: C.redLight }]}>
          <Ionicons name="trash-outline" size={20} color={C.red} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: C.red }]}>Delete All Data</Text>
          <Text style={styles.actionDesc}>Permanently remove all data from this device</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
      </Pressable>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={16} color={C.textTertiary} />
        <Text style={styles.infoText}>
          Fir is designed with a privacy-first approach. Your health data never leaves your device unless you explicitly export it. AI features only process data when you click the generate button.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 4, marginBottom: 24 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, marginBottom: 4 },
  featureDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 17 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 20 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, marginBottom: 14 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  dangerAction: { borderColor: "rgba(255,69,58,0.2)" },
  actionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  actionDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 16, marginTop: 16 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, flex: 1, lineHeight: 17 },
});
