import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getBackupStatus, backupNow, restoreFromCloud, type BackupStatus } from "@/lib/backup";

const C = Colors.dark;
const MAROON = "#800020";

interface EditProfileScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  onRestoreComplete?: () => void;
}

export default function EditProfileScreen({ onBack, onNavigate, onRestoreComplete }: EditProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  useEffect(() => {
    if (user?.id) {
      getBackupStatus(user.id).then(setBackupStatus);
    } else {
      setBackupStatus(null);
    }
  }, [user?.id]);

  const handleBackupNow = async () => {
    if (!user?.id) return;
    setBackupLoading(true);
    try {
      const { error } = await backupNow(user.id);
      if (error) {
        Alert.alert("Backup failed", error?.message ?? String(error), [{ text: "OK" }]);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const status = await getBackupStatus(user.id);
      setBackupStatus(status);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!user?.id) return;
    setShowRestoreConfirm(false);
    setRestoreLoading(true);
    const { error } = await restoreFromCloud(user.id);
    setRestoreLoading(false);
    if (error) {
      Alert.alert("Restore failed", error.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRestoreComplete?.();
  };

  const fullName =
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
    ([user?.user_metadata?.first_name, user?.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ") ||
      user?.email?.split("@")[0] ||
      "—");

  const initials = (() => {
    const words = fullName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2)
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    if (words[0]?.length >= 2) return (words[0][0] + words[0][1]).toUpperCase();
    return (words[0]?.[0] ?? "?").toUpperCase().repeat(2);
  })();

  const lastSyncedLabel = backupStatus?.lastBackedUpAt
    ? `Last synced: ${new Date(backupStatus.lastBackedUpAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "Never synced";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={MAROON} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.fullName}>{fullName}</Text>
              {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
            </View>
          </View>
        </View>

        {/* Cloud Backup Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cloud Backup</Text>
          <Text style={styles.lastSynced}>{lastSyncedLabel}</Text>
          <View style={styles.backupActions}>
            <Pressable
              style={[styles.secondaryBtn, backupLoading && { opacity: 0.6 }]}
              onPress={handleBackupNow}
              disabled={backupLoading}
              accessibilityRole="button"
              accessibilityLabel="Backup Now"
            >
              {backupLoading
                ? <ActivityIndicator size="small" color={MAROON} />
                : <Text style={styles.secondaryBtnText}>Backup Now</Text>}
            </Pressable>
            <Pressable
              style={[styles.outlineBtn, restoreLoading && { opacity: 0.6 }]}
              onPress={() => setShowRestoreConfirm(true)}
              disabled={restoreLoading}
              accessibilityRole="button"
              accessibilityLabel="Restore from Cloud"
            >
              {restoreLoading
                ? <ActivityIndicator size="small" color={C.text} />
                : <Text style={styles.outlineBtnText}>Restore from Cloud</Text>}
            </Pressable>
          </View>
        </View>

        {/* Manage Account */}
        <Pressable
          style={({ pressed }) => [styles.fullWidthBtn, styles.secondaryBtnFull, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => onNavigate?.("auth")}
          accessibilityRole="button"
          accessibilityLabel="Manage Account"
        >
          <Text style={styles.secondaryBtnText}>Manage Account</Text>
        </Pressable>

        {/* Sign Out */}
        <Pressable
          style={({ pressed }) => [styles.fullWidthBtn, styles.outlineBtnFull, { opacity: pressed ? 0.85 : 1 }]}
          onPress={async () => {
            await signOut();
            Haptics.selectionAsync();
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign Out"
        >
          <Text style={styles.outlineBtnText}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      {/* Restore confirmation modal */}
      <Modal visible={showRestoreConfirm} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowRestoreConfirm(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalEmoji}>☁️</Text>
            <Text style={styles.modalTitle}>Restore from cloud?</Text>
            <Text style={styles.modalDesc}>This will overwrite local data. Continue?</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowRestoreConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, { backgroundColor: MAROON }]} onPress={handleRestore}>
                <Text style={styles.confirmText}>Restore</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.background,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontWeight: "700", fontSize: 17, color: C.text },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: MAROON,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "600", fontSize: 22, color: "#fff" },
  profileInfo: { flex: 1, minWidth: 0 },
  fullName: { fontWeight: "700", fontSize: 18, color: C.text },
  email: { fontWeight: "400", fontSize: 13, color: C.textTertiary, marginTop: 2 },
  cardTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 4 },
  lastSynced: { fontWeight: "400", fontSize: 13, color: C.textTertiary, marginBottom: 14 },
  backupActions: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.tintLight,
    alignItems: "center",
  },
  secondaryBtnText: { fontWeight: "600", fontSize: 14, color: C.tint },
  outlineBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  outlineBtnText: { fontWeight: "600", fontSize: 14, color: C.text },
  fullWidthBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryBtnFull: { backgroundColor: C.tintLight },
  outlineBtnFull: { borderWidth: 1, borderColor: C.border },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 28,
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  modalEmoji: { fontSize: 56, marginBottom: 16 },
  modalTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 8, textAlign: "center" },
  modalDesc: {
    fontWeight: "400",
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
  },
  cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
});
