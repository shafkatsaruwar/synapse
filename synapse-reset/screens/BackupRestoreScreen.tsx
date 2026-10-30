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
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useTheme, isDarkAppearance, type Theme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { exportAllData, importAllDataTransactional } from "@/lib/storage-self";
import { formatRestorePreview, parseSynapseExport } from "@/lib/backup-import";
import {
  describeBackupStatus,
  getManualBackupStatus,
  markBackupConfirmed,
  markBackupExported,
  type ManualBackupStatus,
} from "@/lib/manual-backup-status";
import {
  backupNow,
  getBackupStatus,
  restoreFromCloud,
  type BackupStatus,
} from "@/lib/backup";
import { isAppleAuthAvailable } from "@/lib/apple-auth";
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
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const appleButtonDark = isDarkAppearance(themeId);
  const { user, loading: authLoading, signInWithApple, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ManualBackupStatus | null>(null);
  const [cloudStatus, setCloudStatus] = useState<BackupStatus | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const userId = user?.id ?? null;

  const refreshStatus = useCallback(async () => {
    setStatus(await getManualBackupStatus());
  }, []);

  const refreshCloudStatus = useCallback(async () => {
    if (!userId) {
      setCloudStatus(null);
      return;
    }
    setCloudStatus(await getBackupStatus(userId));
  }, [userId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    void refreshCloudStatus();
  }, [refreshCloudStatus]);

  useEffect(() => {
    void isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  const statusLabel = describeBackupStatus(status ?? { lastExportedAt: null, lastConfirmedAt: null, lastFileName: null });

  const cloudStatusLabel = useMemo(() => {
    if (!userId) return null;
    if (!cloudStatus?.hasBackup) {
      return {
        title: "No cloud backup yet",
        detail: "Sign in with Apple is connected. Upload a backup when you’re ready.",
      };
    }
    const when = cloudStatus.lastSyncedAt
      ? new Date(cloudStatus.lastSyncedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
    return {
      title: "Cloud backup ready",
      detail: when ? `Last uploaded ${when}.` : "A backup is stored with your Apple account.",
    };
  }, [userId, cloudStatus]);

  const handleAppleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await signInWithApple();
      if (result.canceled) return;
      if (result.error) {
        Alert.alert("Sign in failed", result.error.message);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Session update → userId effect refreshes cloud status.
    } catch (e) {
      Alert.alert("Sign in failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleCloudBackup = async () => {
    if (busy || !userId) return;
    setBusy(true);
    try {
      const { error } = await backupNow(userId);
      if (error) {
        Alert.alert("Cloud backup failed", error.message);
        return;
      }
      await refreshCloudStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Cloud backup saved",
        "Your Synapse information was uploaded to your signed-in account. You can restore it on this or another device after signing in with the same Apple ID.",
      );
    } catch (e) {
      Alert.alert("Cloud backup failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleCloudRestore = async () => {
    if (busy || !userId) return;
    if (!cloudStatus?.hasBackup) {
      Alert.alert("No cloud backup", "Upload a backup first, or restore from a file instead.");
      return;
    }
    Alert.alert(
      "Restore From Cloud",
      "Restoring from cloud may replace the information currently stored in Synapse. Any changes made since the backup was uploaded may be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace & Restore",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const { error } = await restoreFromCloud(userId);
              if (error) {
                Alert.alert("Cloud restore failed", error.message);
                return;
              }
              await syncAllFromSettings().catch(() => {});
              await syncWidgetSnapshot().catch(() => {});
              onRestoreComplete?.();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Restore complete", "Your cloud backup is back on this device.");
            } catch (e) {
              Alert.alert(
                "Cloud restore failed",
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
  };

  const handleSignOut = async () => {
    if (busy) return;
    Alert.alert(
      "Sign out?",
      "Signing out stops cloud backup on this device. Your local data and any uploaded cloud backup stay where they are.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await signOut();
              setCloudStatus(null);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

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

        {(appleAvailable || userId) && Platform.OS === "ios" ? (
          <>
            <Text style={styles.sectionLabel}>Optional Cloud Backup</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign in with Apple</Text>
              <Text style={styles.rowBody}>
                Use your Apple ID to upload a backup to Synapse cloud storage and restore it after a reinstall or on
                another iPhone. Manual file backup above still works without an account.
              </Text>
              <Text style={styles.warning}>
                Cloud backups are stored with your Synapse account (not end-to-end encrypted). Prefer Sign in with Apple
                and treat this like any online copy of health information.
              </Text>

              {authLoading ? (
                <ActivityIndicator color={C.tint} />
              ) : userId ? (
                <>
                  {cloudStatusLabel ? (
                    <View style={styles.cloudStatusBox}>
                      <Text style={styles.cloudStatusTitle}>{cloudStatusLabel.title}</Text>
                      <Text style={styles.rowBody}>{cloudStatusLabel.detail}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={[styles.primaryBtn, busy && { opacity: 0.5 }]}
                    onPress={handleCloudBackup}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Upload cloud backup"
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        {cloudStatus?.hasBackup ? "Update Cloud Backup" : "Upload Cloud Backup"}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryBtn, busy && { opacity: 0.5 }]}
                    onPress={handleCloudRestore}
                    disabled={busy || !cloudStatus?.hasBackup}
                    accessibilityRole="button"
                    accessibilityLabel="Restore from cloud"
                  >
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        (!cloudStatus?.hasBackup || busy) && { opacity: 0.45 },
                      ]}
                    >
                      Restore From Cloud
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.linkBtn, { marginBottom: 0 }]}
                    onPress={handleSignOut}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Sign out of Apple account"
                  >
                    <Text style={styles.linkText}>Sign Out</Text>
                  </Pressable>
                </>
              ) : appleAvailable ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={
                    appleButtonDark
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={14}
                  style={styles.appleBtn}
                  onPress={handleAppleSignIn}
                />
              ) : null}
            </View>
          </>
        ) : null}

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
            Automatic iCloud (CloudKit) backup is unavailable. Manual file backup never requires sign-in. Optional Sign
            in with Apple cloud backup uploads to Synapse account storage when you choose it.
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
    appleBtn: { width: "100%", height: 48 },
    cloudStatusBox: {
      borderRadius: 12,
      padding: 12,
      backgroundColor: C.tintLight,
      gap: 4,
    },
    cloudStatusTitle: { fontWeight: "700", fontSize: 14, color: C.text },
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
