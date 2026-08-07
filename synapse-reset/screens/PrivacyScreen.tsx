import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, useWindowDimensions, Alert, Share, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { raised } from "@/constants/raised";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { exportAllData, clearAllData } from "@/lib/storage";
import { getBiometricLockEnabled, setBiometricLockEnabled } from "@/lib/biometric-storage";

export default function PrivacyScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [exporting, setExporting] = useState(false);
  const [biometricLock, setBiometricLock] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      getBiometricLockEnabled().then(setBiometricLock);
    }
  }, []);

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    setBiometricLock(value);
    await setBiometricLockEnabled(value);
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const data = await exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      await Share.share({
        message: jsonStr,
        title: "Synapse Health Data Export",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
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
      paddingTop: isWide ? 28 : (Platform.OS === "web" ? 40 : 14),
      paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
    }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Privacy & Data</Text>
      <Text style={styles.subtitle}>Personal wellness tracker — you control what leaves this device</Text>

      {(Platform.OS === "ios" || Platform.OS === "android") && (
        <View style={styles.card}>
          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: C.tintLight }]}>
              <Ionicons name="finger-print" size={20} color={C.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>App Lock (Face ID / Touch ID)</Text>
              <Text style={styles.featureDesc}>Require biometric or device passcode when opening the app on this device. App Lock is not available on web.</Text>
            </View>
            <Switch
              value={biometricLock}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: C.border, true: C.tintLight }}
              thumbColor={biometricLock ? C.tint : "#f4f3f4"}
              accessibilityLabel="Toggle app lock with Face ID or Touch ID"
            />
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.greenLight }]}>
            <Ionicons name="phone-portrait-outline" size={20} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>Local-First Storage</Text>
            <Text style={styles.featureDesc}>
              Health logs are stored on this device by default (device storage). Optional features you turn on — such as iCloud backup, Apple Health import, caregiver tools, or signed-in cloud sync — may copy or import data when you use them.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.pinkLight }]}>
            <Ionicons name="heart-circle-outline" size={20} color={C.pink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>Apple Health (Optional)</Text>
            <Text style={styles.featureDesc}>
              On iOS you can connect Apple Health to import selected vitals into Synapse. This is read-only and only runs when you connect or sync. Synapse is not HIPAA compliant and does not provide medical advice.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.tintLight }]}>
            <Ionicons name="sparkles-outline" size={20} color={C.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>AI Features (Optional)</Text>
            <Text style={styles.featureDesc}>
              Document scan and insights only run when you request them. That request sends the relevant health data to our API and a third-party AI provider (for example OpenAI) to process the response. Do not use AI features with data you are not comfortable sharing with those processors.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.purpleLight }]}>
            <Ionicons name="share-outline" size={20} color={C.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>Sharing & Export</Text>
            <Text style={styles.featureDesc}>
              Synapse does not sell your health data to advertisers. When you export, share, email, or enable caregiver/cloud features, you choose who receives a copy. Exports are unencrypted JSON — treat them like medical records.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.featureRow}>
          <View style={[styles.featureIcon, { backgroundColor: C.cyanLight }]}>
            <Ionicons name="medkit-outline" size={20} color={C.cyan} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>Not Medical Care / Not HIPAA</Text>
            <Text style={styles.featureDesc}>
              Synapse is a personal wellness and organization app, not a medical device, not a healthcare provider, and not a HIPAA covered entity or business associate product. It does not provide medical advice. Always follow your clinician’s guidance.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Data Management</Text>

      <Pressable style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={handleExport} disabled={exporting} accessibilityRole="button" accessibilityLabel="Export all data" accessibilityHint="Downloads a JSON file with all your health data">
        <View style={[styles.actionIcon, { backgroundColor: C.tintLight }]}>
          <Ionicons name="download-outline" size={20} color={C.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Export All Data</Text>
          <Text style={styles.actionDesc}>Download a JSON file with all your health data</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
      </Pressable>

      <Pressable style={({ pressed }) => [styles.actionBtn, styles.dangerAction, { opacity: pressed ? 0.85 : 1 }]} onPress={handleClear} accessibilityRole="button" accessibilityLabel="Delete all data" accessibilityHint="Permanently deletes all data from this device">
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
          Local data stays on this device unless you use optional cloud backup, caregiver linking, AI, email, or export. Review Settings for iCloud and account options. For the security posture of this project, see SECURITY.md in the repository.
        </Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5 },
    subtitle: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginTop: 4, marginBottom: 24 },
    card: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: C.border, ...raised("md", "#55718F") },
    featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
    featureIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    featureTitle: { fontWeight: "600", fontSize: 14, color: C.text, marginBottom: 4 },
    featureDesc: { fontWeight: "400", fontSize: 12, color: C.textSecondary, lineHeight: 17 },
    divider: { height: 1, backgroundColor: C.border, marginVertical: 20 },
    sectionTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 14 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, ...raised("sm", "#55718F") },
    dangerAction: { borderColor: "rgba(255,69,58,0.2)" },
    actionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    actionTitle: { fontWeight: "600", fontSize: 14, color: C.text },
    actionDesc: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2 },
    backupMeta: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
    backupMetaLabel: { fontWeight: "600", fontSize: 12, color: C.textSecondary, marginBottom: 4 },
    backupMetaValue: { fontWeight: "600", fontSize: 14, color: C.text },
    backupMetaFile: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 4 },
    infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 16, marginTop: 16, ...raised("sm", "#6A7BA0") },
    infoText: { fontWeight: "400", fontSize: 12, color: C.textTertiary, flex: 1, lineHeight: 17 },
  });
}
