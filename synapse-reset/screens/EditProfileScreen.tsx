import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import GlassView from "@/components/GlassView";
import { getCloudKitBackupStatus, restoreFromICloud, saveToICloud } from "@/lib/cloudkit-backup";
import { getBackupStatus, backupNow, type BackupStatus } from "@/lib/backup";

interface EditProfileScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  onRestoreComplete?: () => void;
}

type CloudKitStatus = Awaited<ReturnType<typeof getCloudKitBackupStatus>>;

function formatBackupTime(value?: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";
  return `Last synced ${date.toLocaleString()}`;
}

function cloudKitUnavailableMessage(status?: string | null) {
  switch (status) {
    case "native_bridge_missing":
      return "CloudKit needs a native iOS build. Expo Go cannot access Synapse’s iCloud container.";
    case "unsupported_platform":
      return "iCloud backup is only available on iOS.";
    case "no_account":
      return "Sign in to iCloud on this device, then try again.";
    case "restricted":
      return "iCloud is restricted on this device. Check Screen Time or MDM settings.";
    case "temporarily_unavailable":
      return "iCloud is temporarily unavailable. Try again in a moment.";
    case "save_in_progress":
    case "restore_in_progress":
      return "A backup operation is already in progress. Try again in a moment.";
    case "no_backup_found":
      return "Synapse could not find a private iCloud backup for this Apple ID yet.";
    default:
      return "CloudKit is not available right now. Synapse will keep your data local until iCloud is ready.";
  }
}

/**
 * You hub → Backup & Restore.
 * CloudKit / assistant sync live here — not under Preferences.
 */
export default function EditProfileScreen({ onNavigate, onRestoreComplete }: EditProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { user, signOut } = useAuth();
  const authUserId = (user as { id?: string } | null)?.id ?? null;

  const [cloudStatus, setCloudStatus] = useState<CloudKitStatus | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [assistantBackup, setAssistantBackup] = useState<BackupStatus | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);

  const refreshCloudStatus = useCallback(() => {
    getCloudKitBackupStatus().then(setCloudStatus).catch(() => {});
  }, []);

  const refreshAssistantBackup = useCallback(() => {
    if (!authUserId) {
      setAssistantBackup(null);
      return;
    }
    getBackupStatus(authUserId).then(setAssistantBackup).catch(() => setAssistantBackup(null));
  }, [authUserId]);

  useEffect(() => {
    refreshCloudStatus();
  }, [refreshCloudStatus]);

  useEffect(() => {
    refreshAssistantBackup();
  }, [refreshAssistantBackup]);

  const handleBackupNow = async () => {
    Haptics.selectionAsync().catch(() => {});
    if (cloudStatus && !cloudStatus.available) {
      Alert.alert("CloudKit unavailable", cloudKitUnavailableMessage(cloudStatus.accountStatus));
      return;
    }
    setCloudBusy(true);
    try {
      const result = await saveToICloud();
      refreshCloudStatus();
      if (result.skipped) {
        Alert.alert("iCloud backup unavailable", cloudKitUnavailableMessage(result.skipReason || cloudStatus?.accountStatus));
      } else if (result.error) {
        Alert.alert("iCloud backup failed", result.error.message);
      } else {
        Alert.alert("Backed up", "Your latest Synapse backup is saved privately in iCloud.");
      }
    } catch (error) {
      Alert.alert("Backup failed", error instanceof Error ? error.message : "Could not save a backup right now.");
    } finally {
      setCloudBusy(false);
    }
  };

  const handleRestoreCloudKit = () => {
    Haptics.selectionAsync().catch(() => {});
    if (cloudStatus && !cloudStatus.available) {
      Alert.alert("CloudKit unavailable", cloudKitUnavailableMessage(cloudStatus.accountStatus));
      return;
    }
    Alert.alert(
      "Restore from iCloud?",
      "Synapse will find your latest private iCloud backup and restore it on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "default",
          onPress: async () => {
            setCloudBusy(true);
            try {
              const result = await restoreFromICloud({ uploadLocalIfNewer: false, forceRestoreLatest: true });
              onRestoreComplete?.();
              refreshCloudStatus();
              if (result.restored) {
                Alert.alert("Restored", "Your latest iCloud backup has been restored.");
              } else if (result.error) {
                Alert.alert("iCloud restore failed", result.error.message);
              } else {
                Alert.alert("No backup found", cloudKitUnavailableMessage("no_backup_found"));
              }
            } catch (error) {
              Alert.alert("Restore failed", error instanceof Error ? error.message : "Could not restore right now.");
            } finally {
              setCloudBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleAssistantSync = async () => {
    if (!authUserId) {
      onNavigate?.("auth");
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setAssistantBusy(true);
    try {
      const { error } = await backupNow(authUserId);
      refreshAssistantBackup();
      if (error) {
        Alert.alert("Assistant sync failed", "Could not update the signed-in cloud copy. Try again after checking sign-in.");
      } else {
        Alert.alert("Synced", "Your signed-in cloud copy is updated for the assistant. iCloud backup on this device is unchanged.");
      }
    } catch {
      Alert.alert("Assistant sync failed", "Could not update the signed-in cloud copy.");
    } finally {
      setAssistantBusy(false);
    }
  };

  const handleAssistantSignOut = async () => {
    try {
      await signOut();
      setAssistantBackup(null);
    } catch {
      Alert.alert("Sign out failed", "Could not sign out right now.");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Platform.OS === "web" ? 40 : 14, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} accessibilityRole="header">
          Backup & Restore
        </Text>
        <Text style={styles.subtitle}>
          Optional iCloud backup, assistant sync, and local export. Profile editing lives under Health Profile.
        </Text>

        <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.card}>
          <Text style={styles.sectionTitle}>CloudKit Backup</Text>
          <Text style={styles.desc}>
            Private CloudKit backup for medications, appointments, logs, labs, imaging, and health notes.
          </Text>
          <View style={styles.syncedBadge}>
            <Ionicons
              name={cloudStatus?.available ? "cloud-done-outline" : "cloud-offline-outline"}
              size={15}
              color={cloudStatus?.available ? C.green : C.textTertiary}
            />
            <Text style={[styles.syncedText, !cloudStatus?.available && { color: C.textTertiary }]}>
              {cloudStatus?.available
                ? formatBackupTime(cloudStatus.lastSyncedAt ?? cloudStatus.cloudLastUpdatedAt)
                : cloudStatus?.accountStatus === "native_bridge_missing"
                  ? "iCloud backup needs a native iOS build"
                  : cloudStatus?.accountStatus === "unsupported_platform"
                    ? "iCloud backup is iOS-only"
                    : cloudStatus?.lastError
                      ? `iCloud error: ${cloudStatus.lastError}`
                      : "Not synced yet"}
            </Text>
          </View>
          <View style={styles.backupActions}>
            <Pressable
              style={[styles.secondaryBtn, cloudBusy && { opacity: 0.55 }]}
              onPress={handleBackupNow}
              disabled={cloudBusy}
              accessibilityRole="button"
              accessibilityLabel="Backup now"
            >
              <Text style={styles.secondaryBtnText}>{cloudBusy ? "Working..." : "Backup Now"}</Text>
            </Pressable>
            <Pressable
              style={[styles.outlineBtn, cloudBusy && { opacity: 0.55 }]}
              onPress={handleRestoreCloudKit}
              disabled={cloudBusy}
              accessibilityRole="button"
              accessibilityLabel="Restore from iCloud"
            >
              <Text style={styles.outlineBtnText}>Restore</Text>
            </Pressable>
          </View>
        </GlassView>

        <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.card}>
          <Text style={styles.sectionTitle}>Assistant access</Text>
          <Text style={styles.desc}>
            Optional signed-in cloud copy so a personal Cursor assistant can read your own health data over MCP. This is
            separate from private iCloud backup. Not medical advice.
          </Text>
          <View style={styles.syncedBadge}>
            <Ionicons
              name={authUserId ? "sparkles-outline" : "lock-closed-outline"}
              size={15}
              color={authUserId ? C.green : C.textTertiary}
            />
            <Text style={[styles.syncedText, !authUserId && { color: C.textTertiary }]}>
              {authUserId ? formatBackupTime(assistantBackup?.lastSyncedAt) : "Sign in to enable assistant sync"}
            </Text>
          </View>
          <View style={styles.backupActions}>
            {authUserId ? (
              <>
                <Pressable
                  style={[styles.secondaryBtn, assistantBusy && { opacity: 0.55 }]}
                  onPress={handleAssistantSync}
                  disabled={assistantBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Sync health data for assistant"
                >
                  <Text style={styles.secondaryBtnText}>{assistantBusy ? "Working..." : "Sync now"}</Text>
                </Pressable>
                <Pressable
                  style={[styles.outlineBtn, assistantBusy && { opacity: 0.55 }]}
                  onPress={handleAssistantSignOut}
                  disabled={assistantBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out of assistant access"
                >
                  <Text style={styles.outlineBtnText}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => onNavigate?.("auth")}
                accessibilityRole="button"
                accessibilityLabel="Sign in for assistant access"
              >
                <Text style={styles.secondaryBtnText}>Sign in</Text>
              </Pressable>
            )}
          </View>
        </GlassView>

        <Pressable
          style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigate?.("privacy");
          }}
          accessibilityRole="button"
          accessibilityLabel="Open Privacy for local export"
        >
          <View style={styles.linkIcon}>
            <Ionicons name="download-outline" size={18} color={C.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Local export</Text>
            <Text style={styles.linkDesc}>Export or restore a file from Privacy</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, gap: 12 },
    title: {
      fontWeight: "700",
      fontSize: 28,
      color: C.text,
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    subtitle: {
      fontWeight: "400",
      fontSize: 15,
      lineHeight: 22,
      color: C.textSecondary,
      marginBottom: 12,
    },
    card: {
      borderRadius: 22,
      padding: 16,
      gap: 4,
    },
    sectionTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 4 },
    desc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 14, lineHeight: 18 },
    syncedBadge: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    syncedText: { flex: 1, fontWeight: "600", fontSize: 13, color: C.green },
    backupActions: { flexDirection: "row", gap: 10 },
    secondaryBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      backgroundColor: C.tintLight,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    secondaryBtnText: { color: C.tint, fontWeight: "700", fontSize: 14 },
    outlineBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    outlineBtnText: { color: C.textSecondary, fontWeight: "600", fontSize: 14 },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      marginTop: 4,
    },
    linkIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: C.tintLight,
      alignItems: "center",
      justifyContent: "center",
    },
    linkTitle: { fontSize: 16, fontWeight: "600", color: C.text },
    linkDesc: { fontSize: 13, lineHeight: 18, color: C.textSecondary, marginTop: 2 },
  });
}
