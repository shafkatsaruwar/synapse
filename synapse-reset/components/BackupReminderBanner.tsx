import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  dismissBackupReminder,
  getBackupReminderDismissedAt,
  getManualBackupStatus,
  shouldShowBackupReminder,
} from "@/lib/manual-backup-status";
import { appointmentStorage, conditionStorage, medicationStorage } from "@/lib/storage";

type BackupReminderBannerProps = {
  onOpenBackup?: () => void;
};

export default function BackupReminderBanner({ onOpenBackup }: BackupReminderBannerProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [visible, setVisible] = useState(false);

  const refresh = useCallback(async () => {
    const [status, dismissedAt, meds, appts, conditions] = await Promise.all([
      getManualBackupStatus(),
      getBackupReminderDismissedAt(),
      medicationStorage.getAll(),
      appointmentStorage.getAll(),
      conditionStorage.getAll(),
    ]);
    const hasMeaningfulData = meds.length > 0 || appts.length > 0 || conditions.length > 0;
    setVisible(shouldShowBackupReminder({ status, hasMeaningfulData, reminderDismissedAt: dismissedAt }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!visible) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.title}>Protect your health information</Text>
        <Text style={styles.body}>
          Your health information is important. Consider saving a backup so you can restore it if you change phones.
        </Text>
        <View style={styles.actions}>
          {onOpenBackup ? (
            <Pressable
              onPress={onOpenBackup}
              accessibilityRole="button"
              accessibilityLabel="Open Backup and Restore"
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Save a backup</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={async () => {
              await dismissBackupReminder();
              setVisible(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss backup reminder"
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={async () => {
          await dismissBackupReminder();
          setVisible(false);
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={18} color={C.textTertiary} />
      </Pressable>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    title: { fontWeight: "800", fontSize: 14, color: C.text, letterSpacing: -0.2 },
    body: { fontWeight: "500", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
    primary: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: C.tint,
    },
    primaryText: { fontWeight: "700", fontSize: 13, color: "#fff" },
    secondary: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    secondaryText: { fontWeight: "700", fontSize: 13, color: C.text },
  });
}
