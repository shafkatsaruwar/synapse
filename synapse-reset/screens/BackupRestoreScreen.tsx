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
  Switch,
  TextInput,
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
import {
  enableAutomaticICloudBackup,
  getCloudKitBackupStatus,
  listICloudSnapshots,
  previewICloudRestore,
  restoreFromICloud,
  saveToICloud,
  type CloudKitSnapshotInfo,
} from "@/lib/cloudkit-backup";
import { setupCloudKitRecoveryPassphrase } from "@/lib/cloudkit-keys";
import { CLOUDKIT_PASSPHRASE_MIN_LENGTH } from "@/lib/cloudkit-crypto";
import {
  describeCloudKitAccountStatus,
  describeCloudKitRestoreError,
  describeCloudKitSaveError,
} from "@/lib/cloudkit-error-copy";
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

type BackupSegment = "cloud" | "file";

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
  const [segment, setSegment] = useState<BackupSegment>("file");
  const [segmentInitialized, setSegmentInitialized] = useState(false);
  const [iCloudStatus, setICloudStatus] = useState<Awaited<ReturnType<typeof getCloudKitBackupStatus>> | null>(
    null,
  );
  const [iCloudSnapshots, setICloudSnapshots] = useState<CloudKitSnapshotInfo[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const userId = user?.id ?? null;
  const cloudSectionAvailable = Platform.OS === "ios" && (appleAvailable || Boolean(userId));
  const showICloudSection = Platform.OS === "ios";

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

  const refreshICloudStatus = useCallback(async () => {
    if (!showICloudSection) {
      setICloudStatus(null);
      setICloudSnapshots([]);
      return;
    }
    const next = await getCloudKitBackupStatus();
    setICloudStatus(next);
    if (next.featureEnabled && next.available) {
      const listed = await listICloudSnapshots();
      setICloudSnapshots(listed.snapshots);
    } else {
      setICloudSnapshots([]);
    }
  }, [showICloudSection]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    void refreshCloudStatus();
  }, [refreshCloudStatus]);

  useEffect(() => {
    void refreshICloudStatus();
  }, [refreshICloudStatus]);

  useEffect(() => {
    void isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  useEffect(() => {
    if (segmentInitialized) return;
    if (!cloudSectionAvailable) {
      setSegment("file");
      setSegmentInitialized(true);
      return;
    }
    if (userId) {
      setSegment("cloud");
      setSegmentInitialized(true);
    } else if (appleAvailable || !authLoading) {
      setSegmentInitialized(true);
    }
  }, [segmentInitialized, cloudSectionAvailable, userId, appleAvailable, authLoading]);

  useEffect(() => {
    if (!cloudSectionAvailable && segment === "cloud") setSegment("file");
  }, [cloudSectionAvailable, segment]);

  const statusLabel = describeBackupStatus(status ?? { lastExportedAt: null, lastConfirmedAt: null, lastFileName: null });

  const cloudStatusLabel = useMemo(() => {
    if (!userId) return null;
    if (!cloudStatus?.hasBackup) {
      return {
        title: "No cloud backup yet",
        detail: "Synapse Cloud is connected with Apple. Upload a backup when you’re ready.",
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
      detail: when ? `Last uploaded ${when}.` : "A backup is stored with your Synapse account.",
    };
  }, [userId, cloudStatus]);

  const activeStatus = useMemo(() => {
    if (segment === "cloud" && userId && cloudStatusLabel) {
      return {
        eyebrow: "Cloud status",
        title: cloudStatusLabel.title,
        detail: cloudStatusLabel.detail,
        reminder: null as string | null,
      };
    }
    if (segment === "cloud" && !userId) {
      return {
        eyebrow: "Cloud status",
        title: "Not signed in",
        detail: "Sign in with Apple to use Synapse Cloud backup on this iPhone.",
        reminder: null as string | null,
      };
    }
    return {
      eyebrow: "File backup status",
      title: statusLabel.title,
      detail: statusLabel.detail,
      reminder:
        statusLabel.kind === "none" || (statusLabel.kind === "confirmed" && statusLabel.stale)
          ? "Consider saving a backup file so you can restore if you change phones."
          : null,
    };
  }, [segment, userId, cloudStatusLabel, statusLabel]);

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

  const selectSegment = (next: BackupSegment) => {
    if (next === segment) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSegment(next);
    void Haptics.selectionAsync().catch(() => {});
  };

  const formatWhen = (iso: string | null | undefined) => {
    if (!iso) return null;
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return null;
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleSetupRecoveryPassphrase = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await setupCloudKitRecoveryPassphrase(passphrase, passphraseConfirm);
      if (!result.ok) {
        Alert.alert("Couldn’t set passphrase", result.message);
        return;
      }
      setPassphrase("");
      setPassphraseConfirm("");
      await refreshICloudStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Recovery passphrase saved",
        "Remember this passphrase. You’ll need it to restore encrypted iCloud backups after reinstalling Synapse or on a new iPhone. Synapse never stores the passphrase itself.",
      );
    } catch (e) {
      Alert.alert("Couldn’t set passphrase", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAutoICloud = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await enableAutomaticICloudBackup(enabled);
      if (!result.ok) {
        Alert.alert(
          "Couldn’t update automatic backup",
          result.reason === "recovery_not_configured"
            ? "Set a recovery passphrase first."
            : describeCloudKitAccountStatus(result.reason),
        );
        await refreshICloudStatus();
        return;
      }
      await refreshICloudStatus();
      Haptics.selectionAsync().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const handleICloudBackupNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await saveToICloud();
      if (result.skipped) {
        Alert.alert(
          "Backup skipped",
          result.skipReason === "recovery_not_configured"
            ? "Set a recovery passphrase before backing up to iCloud."
            : describeCloudKitAccountStatus(result.skipReason),
        );
        return;
      }
      if (result.error) {
        Alert.alert("iCloud backup failed", describeCloudKitSaveError(result.error.message));
        await refreshICloudStatus();
        return;
      }
      await refreshICloudStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("iCloud backup saved", "CloudKit confirmed the encrypted backup upload.");
    } catch (e) {
      Alert.alert("iCloud backup failed", describeCloudKitSaveError(e instanceof Error ? e.message : null));
    } finally {
      setBusy(false);
    }
  };

  const confirmAndRestoreICloud = async (recordName?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const preview = await previewICloudRestore({
        recordName,
        passphrase: restorePassphrase || undefined,
      });
      if (!preview.ok) {
        if (preview.needsPassphrase) {
          Alert.alert(
            "Recovery passphrase needed",
            "Enter the recovery passphrase used when this backup was created, then try Restore again.",
          );
        } else {
          Alert.alert("Couldn’t restore", preview.reason);
        }
        return;
      }

      Alert.alert(
        "Restore From iCloud",
        [
          "Restoring may replace information currently stored in Synapse. Newer local changes may be lost.",
          "",
          preview.preview.summaryText,
          "",
          "Synapse will keep a rollback copy on this device and only report success after the restore verifies.",
        ].join("\n"),
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace & Restore",
            style: "destructive",
            onPress: async () => {
              setBusy(true);
              try {
                const result = await restoreFromICloud({
                  recordName,
                  passphrase: restorePassphrase || undefined,
                });
                if (!result.restored) {
                  Alert.alert(
                    "Restore failed",
                    result.needsPassphrase
                      ? "Enter your recovery passphrase and try again."
                      : describeCloudKitRestoreError(result.error?.message || result.skipReason),
                  );
                  return;
                }
                setRestorePassphrase("");
                await syncAllFromSettings().catch(() => {});
                await syncWidgetSnapshot().catch(() => {});
                onRestoreComplete?.();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Restore complete", "Your iCloud backup is back on this device.");
              } catch (e) {
                Alert.alert(
                  "Restore failed",
                  describeCloudKitRestoreError(e instanceof Error ? e.message : null),
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("Couldn’t restore", describeCloudKitRestoreError(e instanceof Error ? e.message : null));
    } finally {
      setBusy(false);
    }
  };

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : 8;
  const iCloudLastBackup = formatWhen(iCloudStatus?.lastSyncedAt || iCloudStatus?.cloudLastUpdatedAt);
  const iCloudReady =
    Boolean(iCloudStatus?.featureEnabled) &&
    Boolean(iCloudStatus?.available) &&
    Boolean(iCloudStatus?.recoveryConfigured) &&
    Boolean(iCloudStatus?.dekPresent);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} accessibilityRole="header">
          Backup & Restore
        </Text>
        <Text style={styles.subtitle}>
          Keep a copy of your Synapse information so you can restore it later.
        </Text>

        <View style={styles.statusCard} accessibilityRole="summary">
          <Text style={styles.statusEyebrow}>{activeStatus.eyebrow}</Text>
          <Text style={styles.statusTitle}>{activeStatus.title}</Text>
          <Text style={styles.statusDetail}>{activeStatus.detail}</Text>
          {activeStatus.reminder ? <Text style={styles.statusReminder}>{activeStatus.reminder}</Text> : null}
        </View>

        {cloudSectionAvailable ? (
          <View style={styles.segment} accessibilityRole="tablist">
            {(
              [
                { id: "cloud" as const, label: "Cloud Backup" },
                { id: "file" as const, label: "Backup File" },
              ] as const
            ).map((tab) => {
              const selected = segment === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.segmentBtn, selected && styles.segmentBtnActive]}
                  onPress={() => selectSegment(tab.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={tab.label}
                >
                  <Text style={[styles.segmentBtnText, selected && styles.segmentBtnTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {segment === "cloud" && cloudSectionAvailable ? (
          <View style={styles.card}>
            {authLoading ? (
              <ActivityIndicator color={C.tint} />
            ) : userId ? (
              <>
                <View style={styles.connectedRow}>
                  <View style={styles.connectedIcon}>
                    <Ionicons name="cloud-done-outline" size={22} color={C.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Synapse Cloud</Text>
                    <Text style={styles.rowBody}>Connected with Apple</Text>
                  </View>
                </View>
                <Text style={styles.note}>
                  Cloud backups are stored with your Synapse account. They are not end-to-end encrypted. Treat this like
                  any online copy of health information.
                </Text>
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
                    style={[styles.secondaryBtnText, (!cloudStatus?.hasBackup || busy) && { opacity: 0.45 }]}
                  >
                    Restore From Cloud
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.linkBtn}
                  onPress={handleSignOut}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out of Apple account"
                >
                  <Text style={styles.linkText}>Sign Out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Synapse Cloud</Text>
                <Text style={styles.rowBody}>
                  Sign in with Apple to upload a backup to Synapse cloud storage and restore it after a reinstall or on
                  another iPhone.
                </Text>
                <Text style={styles.note}>
                  Cloud backups are stored with your Synapse account. They are not end-to-end encrypted. Manual file
                  backup still works without an account.
                </Text>
                {appleAvailable ? (
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
                ) : (
                  <Text style={styles.rowBody}>Sign in with Apple isn’t available on this device.</Text>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Backup File</Text>
            <Text style={styles.rowBody}>
              Export a JSON file you control, or restore from a file you saved earlier. No account required.
            </Text>
            <Text style={styles.note}>
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
        )}

        {showICloudSection ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>iCloud Backup</Text>
            <Text style={styles.rowBody}>
              Optional automatic encrypted backup to your private iCloud (CloudKit) database. Works without Sign in with
              Apple inside Synapse. Free.
            </Text>

            {!featureFlags.cloudKitBackupEnabled ? (
              <Text style={styles.note}>
                Automatic iCloud backup stays off in this build until the CloudKit Production schema is deployed and
                encrypted recovery is enabled. Manual file backup and Synapse Cloud backup continue to work. See
                docs/ICLOUD_BACKUP.md for Apple Developer steps.
              </Text>
            ) : (
              <>
                <Text style={styles.statusDetail}>
                  {describeCloudKitAccountStatus(iCloudStatus?.accountStatus)}
                </Text>
                <Text style={styles.statusDetail}>
                  Last successful backup: {iCloudLastBackup ?? "None yet"}
                </Text>
                {iCloudStatus?.lastError ? (
                  <Text style={styles.note}>{describeCloudKitSaveError(iCloudStatus.lastError)}</Text>
                ) : null}

                {!iCloudStatus?.recoveryConfigured ? (
                  <>
                    <Text style={styles.rowBody}>
                      Set a recovery passphrase (at least {CLOUDKIT_PASSPHRASE_MIN_LENGTH} characters) before enabling
                      automatic backup. You’ll need it on a new iPhone or after reinstalling.
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={passphrase}
                      onChangeText={setPassphrase}
                      placeholder="Recovery passphrase"
                      placeholderTextColor={C.textTertiary}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                      accessibilityLabel="Recovery passphrase"
                    />
                    <TextInput
                      style={styles.input}
                      value={passphraseConfirm}
                      onChangeText={setPassphraseConfirm}
                      placeholder="Confirm passphrase"
                      placeholderTextColor={C.textTertiary}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                      accessibilityLabel="Confirm recovery passphrase"
                    />
                    <Pressable
                      style={[styles.primaryBtn, busy && { opacity: 0.5 }]}
                      onPress={handleSetupRecoveryPassphrase}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel="Save recovery passphrase"
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Save Recovery Passphrase</Text>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.guideStep}>Automatic Backup</Text>
                        <Text style={styles.rowBody}>
                          Backs up after meaningful changes (debounced) and when Synapse backgrounds, if iCloud allows
                          it.
                        </Text>
                      </View>
                      <Switch
                        value={Boolean(iCloudStatus?.autoBackupEnabled)}
                        onValueChange={(value) => {
                          void handleToggleAutoICloud(value);
                        }}
                        disabled={busy || !iCloudReady}
                        accessibilityLabel="Automatic iCloud backup"
                      />
                    </View>

                    <Pressable
                      style={[styles.primaryBtn, (!iCloudReady || busy) && { opacity: 0.5 }]}
                      onPress={handleICloudBackupNow}
                      disabled={busy || !iCloudReady}
                      accessibilityRole="button"
                      accessibilityLabel="Back Up Now to iCloud"
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Back Up Now</Text>
                      )}
                    </Pressable>

                    <Text style={styles.rowBody}>
                      If this iPhone doesn’t have the encryption key yet (reinstall / new device), enter your recovery
                      passphrase before restoring.
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={restorePassphrase}
                      onChangeText={setRestorePassphrase}
                      placeholder="Recovery passphrase (if needed)"
                      placeholderTextColor={C.textTertiary}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                      accessibilityLabel="Restore recovery passphrase"
                    />

                    <Pressable
                      style={[styles.secondaryBtn, busy && { opacity: 0.5 }]}
                      onPress={() => {
                        void confirmAndRestoreICloud();
                      }}
                      disabled={busy || !iCloudStatus?.available}
                      accessibilityRole="button"
                      accessibilityLabel="Restore From iCloud"
                    >
                      <Text style={styles.secondaryBtnText}>Restore From iCloud</Text>
                    </Pressable>

                    {iCloudSnapshots.length > 0 ? (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.guideStep}>Available recovery snapshots</Text>
                        {iCloudSnapshots.slice(0, 8).map((snap) => {
                          const when = formatWhen(snap.createdAt) ?? "Unknown date";
                          return (
                            <Pressable
                              key={snap.recordName}
                              style={styles.snapshotRow}
                              onPress={() => {
                                void confirmAndRestoreICloud(snap.recordName);
                              }}
                              disabled={busy}
                              accessibilityRole="button"
                              accessibilityLabel={`Restore snapshot from ${when}`}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.guideStep}>{when}</Text>
                                <Text style={styles.rowBody}>
                                  {snap.summary
                                    ? `${snap.summary.medicationCount} meds · ${snap.summary.appointmentCount} appointments · ${snap.summary.healthLogCount} logs`
                                    : snap.encrypted
                                      ? "Encrypted snapshot"
                                      : "Snapshot"}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={18} color={C.textSecondary} />
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.rowBody}>No recovery snapshots listed yet.</Text>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        ) : null}

        <Pressable
          style={styles.guideHeader}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setGuideOpen((open) => !open);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: guideOpen }}
          accessibilityLabel="How Backups Work"
        >
          <Text style={styles.guideTitle}>How Backups Work</Text>
          <Ionicons name={guideOpen ? "chevron-up" : "chevron-down"} size={18} color={C.textSecondary} />
        </Pressable>
        {guideOpen ? (
          <View style={styles.guideBody}>
            <Text style={styles.guideStep}>File backup</Text>
            <Text style={styles.rowBody}>
              Tap Save My Backup, choose Save to Files, then pick iCloud Drive or another location you control. Saving
              only to On My iPhone may not protect the file if this device is lost or reset.
            </Text>
            <Text style={[styles.guideStep, { marginTop: 12 }]}>Synapse Cloud backup</Text>
            <Text style={styles.rowBody}>
              Optional Sign in with Apple uploads a copy to Synapse account storage. Restore after reinstall by signing
              in with the same Apple ID. This is separate from saving a file to iCloud Drive, and from automatic iCloud
              (CloudKit) backup.
            </Text>
            <Text style={[styles.guideStep, { marginTop: 12 }]}>iCloud (CloudKit) backup</Text>
            <Text style={styles.rowBody}>
              When enabled, Synapse encrypts a snapshot with AES-256-GCM and stores it in your private iCloud database.
              A recovery passphrase unwraps the encryption key on a new device. Automatic restore never runs just because
              you signed into iCloud.
            </Text>
            {!featureFlags.cloudKitBackupEnabled ? (
              <Text style={[styles.rowBody, { marginTop: 12 }]}>
                Automatic iCloud (CloudKit) backup remains unavailable until CloudKit Production schema deploy and the
                feature flag are turned on.
              </Text>
            ) : null}
            <Text style={[styles.rowBody, { marginTop: 12 }]}>
              Restoring replaces information currently on this device. Changes made after the backup may be lost.
            </Text>
          </View>
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
    subtitle: { fontWeight: "500", fontSize: 15, color: C.textSecondary, marginBottom: 18, lineHeight: 21 },
    statusCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
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
      marginTop: 4,
      fontWeight: "600",
      fontSize: 13,
      color: C.text,
      lineHeight: 18,
    },
    segment: {
      flexDirection: "row",
      backgroundColor: C.surfaceElevated,
      borderRadius: 12,
      padding: 4,
      marginBottom: 16,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 10,
    },
    segmentBtnActive: {
      backgroundColor: C.surface,
      ...raised("sm"),
    },
    segmentBtnText: {
      fontWeight: "700",
      fontSize: 14,
      color: C.textSecondary,
    },
    segmentBtnTextActive: {
      color: C.text,
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
    rowBody: { fontWeight: "500", fontSize: 14, color: C.textSecondary, lineHeight: 20 },
    note: {
      fontWeight: "500",
      fontSize: 13,
      color: C.textSecondary,
      lineHeight: 19,
      backgroundColor: C.surfaceElevated,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    connectedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    connectedIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: C.tintLight,
      alignItems: "center",
      justifyContent: "center",
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
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    input: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      paddingHorizontal: 14,
      color: C.text,
      fontWeight: "500",
      fontSize: 15,
    },
    snapshotRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
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
      gap: 6,
    },
    guideStep: { fontWeight: "700", fontSize: 13, color: C.text, lineHeight: 18 },
    linkBtn: { paddingVertical: 8, marginBottom: 4 },
    linkText: { fontWeight: "700", fontSize: 14, color: C.tint },
  });
}
