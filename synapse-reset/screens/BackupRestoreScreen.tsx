import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { exportAllData, importAllData } from "@/lib/storage";
import { getCloudKitBackupStatus, restoreFromICloud, saveToICloud } from "@/lib/cloudkit-backup";
import { syncAllFromSettings } from "@/lib/notification-manager";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import { raised } from "@/constants/raised";

type CloudKitStatus = Awaited<ReturnType<typeof getCloudKitBackupStatus>>;

type BackupRestoreScreenProps = {
  onRestoreComplete?: () => void;
  onNavigate?: (screen: string) => void;
};

export default function BackupRestoreScreen({ onRestoreComplete, onNavigate }: BackupRestoreScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [cloudStatus, setCloudStatus] = useState<CloudKitStatus | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setCloudStatus(await getCloudKitBackupStatus());
    } catch {
      setCloudStatus(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const cloudKitUnavailableMessage = (accountStatus?: string | null) => {
    if (Platform.OS !== "ios") {
      return "CloudKit backup is available in the iOS app.";
    }
    switch (accountStatus) {
      case "noAccount":
        return "Sign in to iCloud in Settings to use CloudKit backup.";
      case "restricted":
        return "iCloud access is restricted on this device.";
      case "couldNotDetermine":
        return "CloudKit needs a native iOS build. Expo Go cannot access Synapse’s iCloud container.";
      default:
        return "CloudKit is not available right now. Synapse will keep your data local until iCloud is ready.";
    }
  };

  const handleBackupNow = async () => {
    if (cloudBusy) return;
    if (cloudStatus && cloudStatus.accountStatus !== "available") {
      Alert.alert("CloudKit unavailable", cloudKitUnavailableMessage(cloudStatus.accountStatus));
      return;
    }
    setCloudBusy(true);
    try {
      const result = await saveToICloud();
      await refresh();
      if (result.error) {
        Alert.alert("Backup didn’t finish", result.error.message || "Try again in a moment.");
      } else if (result.skipped) {
        Alert.alert("Backup skipped", result.skipReason || "iCloud wasn’t ready.");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Backup saved", "Your Synapse data was backed up to iCloud.");
      }
    } catch (e) {
      Alert.alert("Backup failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setCloudBusy(false);
    }
  };

  const handleRestoreCloudKit = () => {
    if (cloudBusy) return;
    if (cloudStatus && cloudStatus.accountStatus !== "available") {
      Alert.alert("CloudKit unavailable", cloudKitUnavailableMessage(cloudStatus.accountStatus));
      return;
    }
    Alert.alert(
      "Restore from iCloud?",
      "This replaces data on this device with your latest CloudKit backup. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setCloudBusy(true);
            try {
              const result = await restoreFromICloud();
              await refresh();
              if (result.error) {
                Alert.alert("Restore didn’t finish", result.error.message || "Try again.");
              } else if (result.restored) {
                await syncAllFromSettings().catch(() => {});
                await syncWidgetSnapshot().catch(() => {});
                onRestoreComplete?.();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Restore complete", "Your CloudKit backup is on this device.");
              } else {
                Alert.alert("Nothing to restore", result.skipReason || "No newer CloudKit backup was found.");
              }
            } catch (e) {
              Alert.alert("Restore failed", e instanceof Error ? e.message : "Try again.");
            } finally {
              setCloudBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleExportLocal = async () => {
    setLocalBusy(true);
    try {
      const json = await exportAllData();
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Export ready", "Sharing isn’t available on this device.");
        return;
      }
      // Share the JSON string via a temporary approach used elsewhere — write via Sharing of URI if needed.
      // storage export returns string; PrivacyScreen may write a file. Keep simple alert + clipboard-less share:
      Alert.alert(
        "Local export",
        "Use Privacy → Export All Data for a shareable file, or Backup Now for iCloud.",
        [
          { text: "Open Privacy", onPress: () => onNavigate?.("privacy") },
          { text: "OK" },
        ]
      );
      void json;
    } finally {
      setLocalBusy(false);
    }
  };

  const handleImportLocal = async () => {
    setLocalBusy(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (pick.canceled || !pick.assets?.[0]?.uri) return;
      Alert.alert(
        "Restore from file?",
        "This replaces data on this device with the selected backup file.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                const res = await fetch(pick.assets![0].uri);
                const text = await res.text();
                await importAllData(JSON.parse(text));
                await syncAllFromSettings().catch(() => {});
                await syncWidgetSnapshot().catch(() => {});
                onRestoreComplete?.();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Restore complete", "Your file backup is on this device.");
              } catch (e) {
                Alert.alert("Restore failed", e instanceof Error ? e.message : "Invalid backup file.");
              }
            },
          },
        ]
      );
    } finally {
      setLocalBusy(false);
    }
  };

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : 8;
  const lastSync = cloudStatus?.lastSyncedAt
    ? new Date(cloudStatus.lastSyncedAt).toLocaleString()
    : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Backup & Restore</Text>
        <Text style={styles.subtitle}>
          Data stays on this device by default. Optional iCloud or file copies are available when you choose them.
        </Text>

        <Text style={styles.sectionLabel}>iCloud (CloudKit)</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons name="cloud-outline" size={22} color={C.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>CloudKit status</Text>
              <Text style={styles.rowBody}>
                {cloudStatus?.accountStatus === "available"
                  ? "iCloud available"
                  : cloudKitUnavailableMessage(cloudStatus?.accountStatus)}
              </Text>
              {lastSync ? <Text style={styles.meta}>Last backup: {lastSync}</Text> : null}
            </View>
          </View>
          <Pressable
            style={[styles.primaryBtn, cloudBusy && { opacity: 0.5 }]}
            onPress={handleBackupNow}
            disabled={cloudBusy}
            accessibilityRole="button"
            accessibilityLabel="Backup now"
          >
            {cloudBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Backup Now</Text>}
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, cloudBusy && { opacity: 0.5 }]}
            onPress={handleRestoreCloudKit}
            disabled={cloudBusy}
            accessibilityRole="button"
            accessibilityLabel="Restore from iCloud"
          >
            <Text style={styles.secondaryBtnText}>Restore from iCloud</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>On this device</Text>
        <View style={styles.card}>
          <Text style={styles.rowBody}>
            Export a local copy or restore from a file you previously saved. Assistant sync (if signed in) is separate from private CloudKit backup.
          </Text>
          <Pressable
            style={[styles.secondaryBtn, localBusy && { opacity: 0.5 }]}
            onPress={handleExportLocal}
            disabled={localBusy}
          >
            <Text style={styles.secondaryBtnText}>Export guidance</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, localBusy && { opacity: 0.5 }]}
            onPress={handleImportLocal}
            disabled={localBusy}
          >
            <Text style={styles.secondaryBtnText}>Restore from file</Text>
          </Pressable>
          {onNavigate ? (
            <Pressable style={styles.linkBtn} onPress={() => onNavigate("privacy")}>
              <Text style={styles.linkText}>Open Privacy for full export tools</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 20 },
    title: { fontWeight: "800", fontSize: 28, color: C.text, letterSpacing: -0.4, marginBottom: 4 },
    subtitle: { fontWeight: "500", fontSize: 14, color: C.textSecondary, marginBottom: 20, lineHeight: 20 },
    sectionLabel: {
      fontWeight: "700",
      fontSize: 12,
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 4,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
      gap: 12,
      ...raised("sm"),
    },
    statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    rowTitle: { fontWeight: "700", fontSize: 16, color: C.text },
    rowBody: { fontWeight: "500", fontSize: 13, color: C.textSecondary, lineHeight: 18, marginTop: 2 },
    meta: { fontWeight: "500", fontSize: 12, color: C.textTertiary, marginTop: 6 },
    primaryBtn: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: C.text,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: { fontWeight: "700", fontSize: 15, color: "#fff" },
    secondaryBtn: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryBtnText: { fontWeight: "700", fontSize: 15, color: C.text },
    linkBtn: { paddingVertical: 4 },
    linkText: { fontWeight: "700", fontSize: 14, color: C.tint },
  });
}
