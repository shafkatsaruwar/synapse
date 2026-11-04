import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, Switch, Modal, useWindowDimensions, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";
import {
  settingsStorage,
  type UserSettings,
} from "@/lib/storage-self";
import { isCurrentMonthRamadan } from "@/lib/hijri";
import { syncAllFromSettings } from "@/lib/notification-manager";
import { raised } from "@/constants/raised";
import { modalOverlay, modalSurface } from "@/lib/modal-colors";
import { HAMBURGER_KEYS, NAV_REGISTRY } from "@/lib/navigation-registry";

type PreferencesScreenProps = {
  onNavigate?: (screen: string) => void;
  onResetApp?: () => void;
};

export default function PreferencesScreen({ onNavigate, onResetApp }: PreferencesScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const { appMode, setAppMode } = useAppMode();
  const { textSize, setTextSize } = useDisplaySettings();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showSections, setShowSections] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sectionSelections, setSectionSelections] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const s = await settingsStorage.get();
    setSettings(s);
    const enabled = s.enabledSections?.length ? s.enabledSections : [...HAMBURGER_KEYS];
    setSectionSelections(new Set(enabled));
  }, []);

  useEffect(() => { load(); }, [load]);

  const persistSettings = async (next: UserSettings, resync = false) => {
    setSettings(next);
    await settingsStorage.save(next);
    if (resync) await syncAllFromSettings().catch(() => {});
  };

  const handleModeChange = async (mode: "simple" | "full") => {
    Haptics.selectionAsync();
    await setAppMode(mode);
    if (settings) await persistSettings({ ...settings, appMode: mode });
  };

  const handleRamadanToggle = async (value: boolean) => {
    if (!settings) return;
    if (value && !isCurrentMonthRamadan()) {
      Alert.alert(
        "Ramadan Mode",
        "It doesn’t look like Ramadan right now. You can still enable tracking tools if you need them.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable",
            onPress: async () => {
              await persistSettings({ ...settings, ramadanMode: true });
            },
          },
        ]
      );
      return;
    }
    await persistSettings({ ...settings, ramadanMode: value });
  };

  const saveSections = async () => {
    if (!settings) return;
    const enabledSections = HAMBURGER_KEYS.filter((k) => sectionSelections.has(k));
    if (!enabledSections.includes("emergencyhub") || !enabledSections.includes("dashboard")) {
      Alert.alert("Keep essentials", "Today and Emergency stay available so you can always reach care quickly.");
    }
    const nextSections = Array.from(new Set(["dashboard", "emergencyhub", ...enabledSections]));
    await persistSettings({ ...settings, enabledSections: nextSections });
    setShowSections(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveNotificationToggle = async (
    key: "notificationsMedications" | "notificationsAppointments" | "notificationsDailyCheckIn" | "notificationsMonthly",
    value: boolean
  ) => {
    if (!settings) return;
    await persistSettings({ ...settings, [key]: value }, true);
    Haptics.selectionAsync();
  };

  if (!settings) return null;

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : 8;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.subtitle}>App experience, appearance, and reminders.</Text>

        <Text style={styles.sectionLabel}>App Experience</Text>
        <View style={styles.card}>
          <View style={styles.segment}>
            {([
              { id: "simple" as const, label: "Simple Mode", body: "Larger controls and fewer distractions." },
              { id: "full" as const, label: "Full Mode", body: "The complete Synapse experience." },
            ]).map((opt) => {
              const selected = appMode === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.segmentBtn, selected && styles.segmentBtnActive]}
                  onPress={() => handleModeChange(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.segmentTitle, selected && styles.segmentTitleActive]}>{opt.label}</Text>
                  <Text style={styles.segmentBody}>{opt.body}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {appMode === "simple" ? (
          <View style={styles.card}>
            <Text style={styles.rowTitle}>Text size</Text>
            <View style={styles.chipRow}>
              {([
                { id: "normal" as const, label: "Default" },
                { id: "large" as const, label: "Large" },
                { id: "extra_large" as const, label: "Extra large" },
              ]).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.chip, textSize === opt.id && styles.chipActive]}
                  onPress={() => {
                    void setTextSize(opt.id);
                    void persistSettings({ ...settings, textSize: opt.id });
                  }}
                >
                  <Text style={[styles.chipText, textSize === opt.id && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Appearance</Text>
        <Pressable
          style={styles.navRow}
          onPress={() => onNavigate?.("appearance")}
          accessibilityRole="button"
          accessibilityLabel="Open Appearance Studio"
        >
          <View style={styles.iconWrap}><Ionicons name="color-palette-outline" size={20} color={C.text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Appearance Studio</Text>
            <Text style={styles.rowBody}>Themes, accents, wallpapers, and more — free for everyone</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
        </Pressable>

        <Text style={styles.sectionLabel}>Navigation</Text>
        <Pressable style={styles.navRow} onPress={() => setShowSections(true)} accessibilityRole="button">
          <View style={styles.iconWrap}><Ionicons name="menu-outline" size={20} color={C.text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Menu sections</Text>
            <Text style={styles.rowBody}>Choose what appears in the menu</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
        </Pressable>

        <Text style={styles.sectionLabel}>Ramadan Mode</Text>
        <View style={styles.navRow}>
          <View style={styles.iconWrap}><Ionicons name="moon-outline" size={20} color={C.text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Ramadan Mode</Text>
            <Text style={styles.rowBody}>Fasting-aware tools and schedules</Text>
          </View>
          <Switch
            value={!!settings.ramadanMode}
            onValueChange={handleRamadanToggle}
            trackColor={{ true: C.tintLight, false: C.border }}
            thumbColor={settings.ramadanMode ? C.tint : C.surfaceElevated}
          />
        </View>
        {onNavigate ? (
          <Pressable style={styles.linkRow} onPress={() => onNavigate("ramadan")}>
            <Text style={styles.linkText}>Open Ramadan tools</Text>
            <Ionicons name="chevron-forward" size={16} color={C.tint} />
          </Pressable>
        ) : null}

        <Text style={styles.sectionLabel}>Notifications</Text>
        <Pressable style={styles.navRow} onPress={() => setShowNotifications(true)} accessibilityRole="button">
          <View style={styles.iconWrap}><Ionicons name="notifications-outline" size={20} color={C.text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Reminders & alerts</Text>
            <Text style={styles.rowBody}>Medications, appointments, and check-ins</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
        </Pressable>

        {onResetApp ? (
          <>
            <Text style={styles.sectionLabel}>Advanced</Text>
            <View style={styles.card}>
              <Text style={styles.rowTitle}>Reset App</Text>
              <Text style={styles.rowBody}>
                Erase local data on this device and return to onboarding. Backup files you already saved elsewhere are not deleted.
              </Text>
              <Pressable
                style={styles.dangerBtn}
                onPress={() => setShowResetConfirm(true)}
                testID="preferences-reset-app"
                accessibilityRole="button"
                accessibilityLabel="Reset app"
                accessibilityHint="Erases all local data and returns to onboarding"
              >
                <Ionicons name="trash-outline" size={16} color={C.red} />
                <Text style={styles.dangerBtnText}>Reset App</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={showSections} transparent animationType="fade" onRequestClose={() => setShowSections(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSections(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Menu sections</Text>
            <Text style={styles.modalHint}>Today and Emergency stay available.</Text>
            {HAMBURGER_KEYS.map((key) => {
              const entry = NAV_REGISTRY.find((e) => e.key === key);
              const locked = key === "dashboard" || key === "emergencyhub";
              const selected = sectionSelections.has(key) || locked;
              return (
                <Pressable
                  key={key}
                  style={styles.modalRow}
                  disabled={locked}
                  onPress={() => {
                    setSectionSelections((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                >
                  <Text style={styles.modalRowText}>{entry?.label ?? key}</Text>
                  <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? C.tint : C.textTertiary} />
                </Pressable>
              );
            })}
            <Pressable style={styles.modalDone} onPress={saveSections}>
              <Text style={styles.modalDoneText}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowNotifications(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Notifications</Text>
            {([
              { key: "notificationsMedications" as const, label: "Medication reminders" },
              { key: "notificationsAppointments" as const, label: "Appointment reminders" },
              { key: "notificationsDailyCheckIn" as const, label: "Daily check-in" },
              { key: "notificationsMonthly" as const, label: "Monthly check-in" },
            ]).map((row) => (
              <View key={row.key} style={styles.modalRow}>
                <Text style={styles.modalRowText}>{row.label}</Text>
                <Switch
                  value={!!settings[row.key]}
                  onValueChange={(v) => saveNotificationToggle(row.key, v)}
                  trackColor={{ true: C.tintLight, false: C.border }}
                  thumbColor={settings[row.key] ? C.tint : C.surfaceElevated}
                />
              </View>
            ))}
            <Pressable style={styles.modalDone} onPress={() => setShowNotifications(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showResetConfirm} transparent animationType="fade" onRequestClose={() => setShowResetConfirm(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowResetConfirm(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Reset App?</Text>
            <Text style={styles.modalHint}>
              This deletes medications, appointments, logs, and settings on this device. It cannot be undone unless you restore from Backup & Restore.
            </Text>
            <Text style={[styles.modalHint, { marginBottom: 4 }]}>
              Your health information is important. Consider saving a backup so you can restore it if you change phones.
            </Text>
            {onNavigate ? (
              <Pressable
                style={styles.linkRow}
                onPress={() => {
                  setShowResetConfirm(false);
                  onNavigate("editprofile");
                }}
                accessibilityRole="button"
                accessibilityLabel="Save a backup before resetting"
              >
                <Text style={styles.linkText}>Save a backup first</Text>
                <Ionicons name="chevron-forward" size={16} color={C.tint} />
              </Pressable>
            ) : null}
            <View style={styles.resetActions}>
              <Pressable style={styles.resetCancel} onPress={() => setShowResetConfirm(false)}>
                <Text style={styles.resetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.resetConfirm}
                onPress={() => {
                  setShowResetConfirm(false);
                  onResetApp?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm reset app"
              >
                <Text style={styles.resetConfirmText}>Reset</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme) {
  const solid = modalSurface(C);
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
      marginTop: 8,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 12,
      ...raised("sm"),
    },
    segment: { gap: 10 },
    segmentBtn: {
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    segmentBtnActive: { borderColor: C.text, backgroundColor: C.surface },
    segmentTitle: { fontWeight: "800", fontSize: 16, color: C.textSecondary, marginBottom: 4 },
    segmentTitleActive: { color: C.text },
    segmentBody: { fontWeight: "500", fontSize: 13, color: C.textTertiary, lineHeight: 18 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    chipActive: { borderColor: C.text, backgroundColor: C.surface },
    chipText: { fontWeight: "700", fontSize: 13, color: C.textSecondary },
    chipTextActive: { color: C.text },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 8,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: { fontWeight: "700", fontSize: 16, color: C.text },
    rowBody: { fontWeight: "500", fontSize: 13, color: C.textSecondary, marginTop: 2 },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, marginBottom: 8 },
    linkText: { fontWeight: "700", fontSize: 14, color: C.tint },
    overlay: { flex: 1, backgroundColor: modalOverlay(), justifyContent: "center", padding: 20 },
    modal: {
      backgroundColor: solid,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: C.border,
      maxHeight: "88%",
    },
    modalTitle: { fontWeight: "800", fontSize: 20, color: C.text, marginBottom: 8 },
    modalHint: { fontWeight: "500", fontSize: 13, color: C.textSecondary, marginBottom: 12 },
    modalLabel: { fontWeight: "700", fontSize: 12, color: C.textTertiary, textTransform: "uppercase", marginBottom: 8 },
    modalRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    modalRowActive: {},
    modalRowText: { fontWeight: "600", fontSize: 15, color: C.text, flex: 1, paddingRight: 12 },
    modalDone: {
      marginTop: 16,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.text,
    },
    modalDoneText: { fontWeight: "700", fontSize: 16, color: "#fff" },
    dangerBtn: {
      marginTop: 14,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.red,
      backgroundColor: C.surfaceElevated,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    dangerBtnText: { fontWeight: "700", fontSize: 15, color: C.red },
    resetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
    resetCancel: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    resetCancelText: { fontWeight: "700", fontSize: 15, color: C.textSecondary },
    resetConfirm: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.red,
    },
    resetConfirmText: { fontWeight: "700", fontSize: 15, color: "#fff" },
  });
}
