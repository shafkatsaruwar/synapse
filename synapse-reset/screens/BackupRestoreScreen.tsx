import React, { useMemo, useState } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { exportAllData, importAllData } from "@/lib/storage";
import { syncAllFromSettings } from "@/lib/notification-manager";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import { raised } from "@/constants/raised";

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
  const [localBusy, setLocalBusy] = useState(false);

  const handleExportLocal = async () => {
    if (localBusy) return;
    setLocalBusy(true);
    try {
      if (!FileSystem.documentDirectory) {
        Alert.alert("Export unavailable", "This device can’t create a backup file right now.");
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
        Alert.alert("Export ready", `Backup saved on this device as ${fileName}. Sharing isn’t available here.`);
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Save Synapse backup",
        UTI: "public.json",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setLocalBusy(false);
    }
  };

  const handleImportLocal = async () => {
    if (localBusy) return;
    setLocalBusy(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain"],
        copyToCacheDirectory: true,
      });
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
                const uri = pick.assets![0].uri;
                const text =
                  Platform.OS === "web"
                    ? await (await fetch(uri)).text()
                    : await FileSystem.readAsStringAsync(uri);
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Backup & Restore</Text>
        <Text style={styles.subtitle}>
          Data stays on this device. Make a local backup file anytime, or restore from a file you saved earlier.
        </Text>

        <Text style={styles.sectionLabel}>On this device</Text>
        <View style={styles.card}>
          <Text style={styles.rowBody}>
            Export writes a JSON backup you can save to Files or share. Restore replaces what’s currently on this device.
          </Text>
          <Pressable
            style={[styles.primaryBtn, localBusy && { opacity: 0.5 }]}
            onPress={handleExportLocal}
            disabled={localBusy}
            accessibilityRole="button"
            accessibilityLabel="Export backup file"
          >
            {localBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Export backup file</Text>}
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, localBusy && { opacity: 0.5 }]}
            onPress={handleImportLocal}
            disabled={localBusy}
            accessibilityRole="button"
            accessibilityLabel="Restore from file"
          >
            <Text style={styles.secondaryBtnText}>Restore from file</Text>
          </Pressable>
          {onNavigate ? (
            <Pressable style={styles.linkBtn} onPress={() => onNavigate("privacy")}>
              <Text style={styles.linkText}>Open Privacy for more data tools</Text>
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
    rowBody: { fontWeight: "500", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
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
