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
  healthProfileStorage,
  type UserSettings,
  type HealthProfileInfo,
  type WidgetAppearancePreference,
} from "@/lib/storage";
import { isCurrentMonthRamadan } from "@/lib/hijri";
import { syncAllFromSettings } from "@/lib/notification-manager";
import { raised } from "@/constants/raised";
import { modalOverlay, modalSurface } from "@/lib/modal-colors";
import { HAMBURGER_KEYS, NAV_REGISTRY } from "@/lib/navigation-registry";

type PreferencesScreenProps = {
  onNavigate?: (screen: string) => void;
};

export default function PreferencesScreen({ onNavigate }: PreferencesScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C, preference, setThemeId, themeId } = useTheme();
  const { appMode, setAppMode } = useAppMode();
  const { textSize, setTextSize } = useDisplaySettings();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<HealthProfileInfo | null>(null);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sectionSelections, setSectionSelections] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([settingsStorage.get(), healthProfileStorage.get()]);
    setSettings(s);
    setProfile(p);
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

  const handleWidgetAppearance = async (value: WidgetAppearancePreference) => {
    if (!profile) return;
    const next = { ...profile, widgetAppearance: value };
    setProfile(next);
    await healthProfileStorage.save(next);
    Haptics.selectionAsync();
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
        <Pressable style={styles.navRow} onPress={() => setShowAppearance(true)} accessibilityRole="button">
          <View style={styles.iconWrap}><Ionicons name="color-palette-outline" size={20} color={C.text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Theme & widgets</Text>
            <Text style={styles.rowBody}>App appearance and widget look</Text>
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
      </ScrollView>

      <Modal visible={showAppearance} transparent animationType="fade" onRequestClose={() => setShowAppearance(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowAppearance(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Appearance</Text>
            <Text style={styles.modalLabel}>App theme</Text>
            {([
              { id: "system" as const, label: "System" },
              { id: "light" as const, label: "Light" },
              { id: "dark" as const, label: "Dark" },
              { id: "evergreen" as const, label: "Evergreen" },
              { id: "calm" as const, label: "Calm" },
            ]).map((opt) => (
              <Pressable
                key={opt.id}
                style={[styles.modalRow, preference === opt.id && styles.modalRowActive]}
                onPress={() => {
                  void setThemeId(opt.id);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.modalRowText}>{opt.label}</Text>
                {preference === opt.id ? <Ionicons name="checkmark" size={18} color={C.tint} /> : null}
              </Pressable>
            ))}
            <Text style={[styles.modalLabel, { marginTop: 16 }]}>Widget look</Text>
            {([
              { id: "system" as const, label: "Match system" },
              { id: "light" as const, label: "Light" },
              { id: "dark" as const, label: "Dark" },
            ]).map((opt) => (
              <Pressable
                key={opt.id}
                style={[styles.modalRow, profile?.widgetAppearance === opt.id && styles.modalRowActive]}
                onPress={() => handleWidgetAppearance(opt.id)}
              >
                <Text style={styles.modalRowText}>{opt.label}</Text>
                {profile?.widgetAppearance === opt.id ? <Ionicons name="checkmark" size={18} color={C.tint} /> : null}
              </Pressable>
            ))}
            <Pressable style={styles.modalDone} onPress={() => setShowAppearance(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  });
}
