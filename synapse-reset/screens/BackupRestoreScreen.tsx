import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { exportAllData, importAllDataTransactional } from "@/lib/storage";
import { formatRestorePreview, parseSynapseExport } from "@/lib/backup-import";
import {
  describeBackupStatus,
  getManualBackupStatus,
  markBackupConfirmed,
  markBackupExported,
  type ManualBackupStatus,
} from "@/lib/manual-backup-status";
import { syncAllFromSettings } from "@/lib/notification-manager";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import { featureFlags } from "@/constants/feature-flags";
import { raised } from "@/constants/raised";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ManualBackupStatus | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const refreshStatus = useCallback(async () => {
    setStatus(await getManualBackupStatus());
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const statusLabel = describeBackupStatus(status ?? { lastExportedAt: null, lastConfirmedAt: null, lastFileName: null });

  const handleSaveBackup = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!FileSystem.documentDirectory) {
        Alert.alert("Backup unavailable", "This device can’t create a backup file right now.");
        return;
      }
      const payload = await exportAllData();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `synapse-backup-${stamp}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!(await Sharing.isAvailableAsync())) {
        await markBackupExported(fileName);
        await refreshStatus();
        Alert.alert(
          "Backup exported",
          `A backup file was prepared on this device (${fileName}). Sharing isn’t available here, so Synapse can’t confirm you saved it elsewhere.`,
        );
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Save Synapse backup",
        UTI: "public.json",
      });
      // Opening the share sheet is not proof the user saved the file.
      await markBackupExported(fileName);
      await refreshStatus();

      Alert.alert(
        "Did you save your backup?",
        "Synapse can’t tell whether the file was saved to Files or iCloud Drive. Only confirm if you finished saving it somewhere safe.",
        [
          { text: "Not yet", style: "cancel" },
          {
            text: "Yes, I saved it",
            onPress: async () => {
              await markBackupConfirmed(fileName);
              await refreshStatus();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Backup confirmed",
                "Your backup has been saved. Keep this file somewhere safe — you’ll need it if you ever restore your information.",
              );
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("Backup failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain"],
        copyToCacheDirectory: true,
      });
      if (pick.canceled || !pick.assets?.[0]?.uri) return;

      const uri = pick.assets[0].uri;
      const text =
        Platform.OS === "web" ? await (await fetch(uri)).text() : await FileSystem.readAsStringAsync(uri);
      const parsed = parseSynapseExport(text);
      if (!parsed.ok) {
        Alert.alert("Couldn’t restore", parsed.reason);
        return;
      }

      Alert.alert(
        "Restore From a Backup",
        [
          "Restoring a backup may replace the information currently stored in Synapse. Any changes made since the backup was created may be lost.",
          "",
          formatRestorePreview(parsed.summary),
        ].join("\n"),
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace & Restore",
            style: "destructive",
            onPress: async () => {
              try {
                setBusy(true);
                await importAllDataTransactional(parsed.payload);
                await syncAllFromSettings().catch(() => {});
                await syncWidgetSnapshot().catch(() => {});
                onRestoreComplete?.();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Restore complete", "Your saved Synapse information is back on this device.");
              } catch (e) {
                Alert.alert(
                  "Restore failed",
                  e instanceof Error
                    ? `${e.message} Existing information was kept when possible.`
                    : "Existing information was kept when possible.",
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("Couldn’t open file", e instanceof Error ? e.message : "Could not read the selected file.");
    } finally {
      setBusy(false);
    }
  };

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : 8;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Backup & Restore</Text>
        <Text style={styles.subtitle}>
          Your health information is stored on this device. Save a backup file so you can restore it if you lose, reset, or
          replace your phone.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusEyebrow}>Backup status</Text>
          <Text style={styles.statusTitle}>{statusLabel.title}</Text>
          <Text style={styles.statusDetail}>{statusLabel.detail}</Text>
          {statusLabel.kind === "none" || (statusLabel.kind === "confirmed" && statusLabel.stale) ? (
            <Text style={styles.statusReminder}>
              Your health information is important. Consider saving a backup so you can restore it if you change phones.
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Save Your Information</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create a Backup</Text>
          <Text style={styles.rowBody}>
            Save a copy of your medications, appointments, health records, and other Synapse information. Keep the file
            somewhere safe, such as iCloud Drive.
          </Text>
          <Text style={styles.warning}>
            Backup files are unencrypted JSON. Anyone who obtains the file may be able to read your health information.
            Prefer a private folder you control.
          </Text>
          <Pressable
            style={[styles.primaryBtn, busy && { opacity: 0.5 }]}
            onPress={handleSaveBackup}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Save My Backup"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save My Backup</Text>}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Restore Your Information</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Restore From a Backup</Text>
          <Text style={styles.rowBody}>
            Have a backup file from an earlier installation of Synapse? Select it to bring your saved information back.
          </Text>
          <Pressable
            style={[styles.secondaryBtn, busy && { opacity: 0.5 }]}
            onPress={handleRestore}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Restore My Data"
          >
            <Text style={styles.secondaryBtnText}>Restore My Data</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.guideHeader}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setGuideOpen((open) => !open);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: guideOpen }}
          accessibilityLabel="How to keep your backup safe"
        >
          <Text style={styles.guideTitle}>How to keep your backup safe</Text>
          <Ionicons name={guideOpen ? "chevron-up" : "chevron-down"} size={18} color={C.textSecondary} />
        </Pressable>
        {guideOpen ? (
          <View style={styles.guideBody}>
            <Text style={styles.guideStep}>1. Tap Save My Backup.</Text>
            <Text style={styles.guideStep}>2. Choose Save to Files.</Text>
            <Text style={styles.guideStep}>3. Select iCloud Drive or another secure location.</Text>
            <Text style={styles.guideStep}>4. Tap Save.</Text>
            <Text style={styles.guideStep}>5. Keep the backup file so you can restore it later.</Text>
            <Text style={[styles.rowBody, { marginTop: 10 }]}>
              Saving only to On My iPhone may not protect the file if this device is lost or reset.
            </Text>
            <Text style={[styles.rowBody, { marginTop: 8 }]}>
              iCloud Drive file storage is different from automatic Synapse iCloud backup.
            </Text>
          </View>
        ) : null}

        {!featureFlags.cloudKitBackupEnabled ? (
          <Text style={styles.footnote}>
            Automatic iCloud backup is unavailable. Manual backup is the supported recovery method and does not require
            sign-in.
          </Text>
        ) : null}

        {onNavigate ? (
          <Pressable style={styles.linkBtn} onPress={() => onNavigate("privacy")}>
            <Text style={styles.linkText}>Open Privacy for more data tools</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 20 },
    title: { fontWeight: "800", fontSize: 28, color: C.text, letterSpacing: -0.4, marginBottom: 4 },
    subtitle: { fontWeight: "500", fontSize: 14, color: C.textSecondary, marginBottom: 18, lineHeight: 20 },
    statusCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 18,
      gap: 6,
      ...raised("sm"),
    },
    statusEyebrow: {
      fontWeight: "700",
      fontSize: 11,
      color: C.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    statusTitle: { fontWeight: "800", fontSize: 17, color: C.text, letterSpacing: -0.2 },
    statusDetail: { fontWeight: "500", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    statusReminder: {
      marginTop: 6,
      fontWeight: "600",
      fontSize: 13,
      color: C.text,
      lineHeight: 18,
    },
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
    cardTitle: { fontWeight: "800", fontSize: 17, color: C.text, letterSpacing: -0.2 },
    rowBody: { fontWeight: "500", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    warning: {
      fontWeight: "600",
      fontSize: 13,
      color: C.text,
      lineHeight: 18,
      backgroundColor: C.tintLight,
      borderRadius: 12,
      padding: 12,
    },
    primaryBtn: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: C.tint,
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
    guideHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      marginTop: 4,
    },
    guideTitle: { fontWeight: "800", fontSize: 15, color: C.text },
    guideBody: {
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 16,
      gap: 4,
    },
    guideStep: { fontWeight: "600", fontSize: 13, color: C.text, lineHeight: 20 },
    footnote: {
      fontWeight: "500",
      fontSize: 12,
      color: C.textTertiary,
      lineHeight: 17,
      marginBottom: 12,
    },
    linkBtn: { paddingVertical: 4, marginBottom: 8 },
    linkText: { fontWeight: "700", fontSize: 14, color: C.tint },
  });
}
