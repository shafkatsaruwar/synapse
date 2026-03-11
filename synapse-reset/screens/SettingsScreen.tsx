import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  settingsStorage,
  conditionStorage,
  clearAllData,
  ALL_SECTION_KEYS,
  medicationStorage,
  medicationLogStorage,
  appointmentStorage,
  type UserSettings,
  type Medication,
  type MedicationLog,
  type Appointment,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import { getBackupStatus, backupNow, restoreFromCloud, type BackupStatus } from "@/lib/backup";
import { isCurrentMonthRamadan } from "@/lib/hijri";

const C = Colors.dark;
const MAROON = "#800020";
const CREAM = "#FDF1E5";

const SECTION_LABELS: Record<string, string> = {
  log: "Daily Log", healthdata: "Health Data", medications: "Medications", symptoms: "Symptoms",
  monthlycheckin: "Monthly check-in", eating: "Eating", mentalhealth: "Mental health day",
  comfort: "Mood lifters", goals: "Goals", appointments: "Appointments", reports: "Reports", privacy: "Privacy",
};

interface SettingsScreenProps {
  onResetApp?: () => void;
  onNavigate?: (screen: string) => void;
  onRestoreComplete?: () => void;
}

const SECTION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  log: "heart-outline", healthdata: "analytics-outline", medications: "medical-outline", symptoms: "pulse-outline",
  monthlycheckin: "fitness-outline", eating: "restaurant-outline", mentalhealth: "heart-outline", comfort: "happy-outline",
  goals: "flag-outline", appointments: "calendar-outline", reports: "document-text-outline", privacy: "shield-outline",
};

export default function SettingsScreen({ onResetApp, onNavigate, onRestoreComplete }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user, signOut } = useAuth();

  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [saved, setSaved] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [conditionsCount, setConditionsCount] = useState(0);

  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [sectionSelections, setSectionSelections] = useState<Set<string>>(new Set());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const handleResetApp = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await clearAllData();
    setShowResetConfirm(false);
    if (onResetApp) onResetApp();
  };

  const loadData = useCallback(async () => {
    const today = getToday();
    const [s, conds, meds, logs, apts] = await Promise.all([
      settingsStorage.get(),
      conditionStorage.getAll(),
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      appointmentStorage.getAll(),
    ]);
    setSettings(s);
    setConditionsCount(conds.length);
    setSectionSelections(
      new Set((s.enabledSections?.length ? s.enabledSections : ALL_SECTION_KEYS) as unknown as string[])
    );
    setMedications(meds.filter((m) => m.active));
    setMedLogs(logs);
    setAppointments(
      apts
        .filter((a) => !a.status || a.status !== "cancelled")
        .filter((a) => a.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))
    );
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (user?.id) {
      getBackupStatus(user.id).then(setBackupStatus);
    } else {
      setBackupStatus(null);
    }
  }, [user?.id]);

  const handleSave = async () => {
    await settingsStorage.save(settings);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  };

  const toggleSection = (key: string) => {
    setSectionSelections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    Haptics.selectionAsync();
  };

  const handleSaveSections = async () => {
    const list = Array.from(sectionSelections);
    await settingsStorage.save({ ...settings, enabledSections: list.length > 0 ? list : (ALL_SECTION_KEYS as unknown as string[]) });
    setSettings((s) => ({ ...s, enabledSections: list.length > 0 ? list : (ALL_SECTION_KEYS as unknown as string[]) }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSectionsModal(false);
  };

  const handleBackupNow = async () => {
    if (!user?.id) return;
    setBackupLoading(true);
    try {
      const { error } = await backupNow(user.id);
      if (error) {
        Alert.alert(
          "Backup failed",
          error?.message ?? String(error),
          [{ text: "OK" }]
        );
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
    await loadData();
    onRestoreComplete?.();
  };

  const dateObj = new Date();
  const greeting =
    dateObj.getHours() < 12 ? "Good morning," : dateObj.getHours() < 17 ? "Good afternoon," : "Good evening,";
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
  const getDoseCount = (med: Medication) => (med.doses ?? 1);
  const totalDoses = medications.reduce((s, m) => s + getDoseCount(m), 0);
  const takenDoses = medications.reduce((s, m) => {
    const dc = getDoseCount(m);
    let t = 0;
    for (let i = 0; i < dc; i++) {
      if (medLogs.find((l) => l.medicationId === m.id && (l.doseIndex ?? 0) === i)?.taken) t++;
    }
    return s + t;
  }, 0);
  const medProgressLabel = totalDoses > 0 ? `${takenDoses}/${totalDoses} today` : "0/0 today";
  const nextApt = appointments[0];
  const nextAptLabel = nextApt
    ? `${new Date(nextApt.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${nextApt.doctorName}`
    : "None scheduled";

  const contentPadding = {
    paddingTop: isWide ? 40 : Platform.OS === "web" ? 67 : insets.top + 16,
    paddingBottom: isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100,
    paddingHorizontal: 24,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[contentPadding, styles.scrollViewContent]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <Text style={styles.title}>Account</Text>

        {/* ——— Profile Header ——— */}
        {!user ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Not signed in</Text>
            <Text style={styles.desc}>Sign in to back up and restore your data.</Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}
              onPress={() => onNavigate?.("auth")}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </Pressable>
            <Text style={[styles.localHint, { marginTop: 14 }]}>Data stored locally. Sign in to enable backup.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{initials}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileGreeting}>Hello,</Text>
                <Text style={styles.profileFullName}>{fullName}</Text>
                <Pressable
                  onPress={() => onNavigate?.("healthprofile")}
                  accessibilityRole="link"
                  accessibilityLabel="Edit profile"
                >
                  <Text style={styles.editProfileLink}>Edit profile</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ——— Doctors & Pharmacies quick cards ——— */}
        <View style={styles.quickCardsRow}>
          <Pressable
            style={({ pressed }) => [styles.quickCard, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => onNavigate?.("doctors")}
            accessibilityRole="button"
            accessibilityLabel="Doctors"
          >
            <Ionicons name="medical-outline" size={26} color={MAROON} />
            <Text style={styles.quickCardLabel}>Doctors</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickCard, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => onNavigate?.("pharmacies")}
            accessibilityRole="button"
            accessibilityLabel="Pharmacies"
          >
            <Ionicons name="storefront-outline" size={26} color={MAROON} />
            <Text style={styles.quickCardLabel}>Pharmacies</Text>
          </Pressable>
        </View>

        {/* ——— Account Settings ——— */}
        {user && (
          <View style={styles.card}>
            <Text style={styles.accountSettingsLabel}>Account Settings</Text>
            <View style={styles.backupActions}>
              <Pressable
                style={[styles.secondaryBtn, backupLoading && { opacity: 0.6 }]}
                onPress={handleBackupNow}
                disabled={backupLoading}
              >
                {backupLoading ? <ActivityIndicator size="small" color={MAROON} /> : <Text style={styles.secondaryBtnText}>Backup Now</Text>}
              </Pressable>
              <Pressable
                style={[styles.outlineBtn, restoreLoading && { opacity: 0.6 }]}
                onPress={() => setShowRestoreConfirm(true)}
                disabled={restoreLoading}
              >
                {restoreLoading ? <ActivityIndicator size="small" color={C.text} /> : <Text style={styles.outlineBtnText}>Restore</Text>}
              </Pressable>
            </View>
            <View style={[styles.accountActions, { marginTop: 10 }]}>
              <Pressable style={styles.secondaryBtn} onPress={() => onNavigate?.("auth")}>
                <Text style={styles.secondaryBtnText}>Manage Account</Text>
              </Pressable>
              <Pressable
                style={styles.outlineBtn}
                onPress={async () => {
                  await signOut();
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.outlineBtnText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable
          style={styles.card}
          testID="ramadan-mode-toggle"
          onPress={() => {
            const next = !settings.ramadanMode;
            if (next) {
              if (!isCurrentMonthRamadan()) {
                Alert.alert(
                  "Not Ramadan Yet",
                  "We're so glad you're looking forward to Ramadan! The toggle will activate automatically when Ramadan begins. Come back then 🌙",
                  [{ text: "Got it" }]
                );
                return;
              }
            }
            setSettings((p) => ({ ...p, ramadanMode: next }));
            setSaved(false);
            Haptics.selectionAsync();
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.ramadanMode }}
        >
          <View style={styles.toggleHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Ramadan Mode</Text>
              <Text style={styles.desc}>Enable fasting tracking with Fajr & Iftar times</Text>
            </View>
            <View style={[styles.toggle, settings.ramadanMode && styles.toggleActive]}>
              <View style={[styles.toggleThumb, settings.ramadanMode && styles.toggleThumbActive]} />
            </View>
          </View>
        </Pressable>

        <Pressable
          style={styles.card}
          testID="high-contrast-toggle"
          onPress={() => {
            setSettings((p) => ({ ...p, highContrast: !p.highContrast }));
            setSaved(false);
            Haptics.selectionAsync();
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!settings.highContrast }}
        >
          <View style={styles.toggleHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>High Contrast</Text>
              <Text style={styles.desc}>Increase contrast for better readability</Text>
            </View>
            <View style={[styles.toggle, settings.highContrast && styles.toggleActive]}>
              <View style={[styles.toggleThumb, settings.highContrast && styles.toggleThumbActive]} />
            </View>
          </View>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() => setShowSectionsModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Manage menu sections"
        >
          <View style={styles.profileRow}>
            <View style={[styles.profileIcon, { backgroundColor: C.tintLight }]}>
              <Ionicons name="list-outline" size={16} color={C.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileRowTitle}>Manage sections</Text>
              <Text style={styles.profileRowDesc}>Choose which sections appear in the menu. You can change this anytime.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, saved && styles.saveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Settings saved" : "Save settings"}
        >
          <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saved ? "Saved" : "Save Settings"}</Text>
        </Pressable>

        {onResetApp && (
          <Pressable
            style={({ pressed }) => [styles.resetAppBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => setShowResetConfirm(true)}
            testID="reset-app"
            accessibilityRole="button"
            accessibilityLabel="Reset app"
            accessibilityHint="Erases all data and returns to onboarding"
          >
            <Ionicons name="trash-outline" size={16} color={C.red} />
            <Text style={styles.resetAppText}>Reset App</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={showResetConfirm} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowResetConfirm(false)}>
          <Pressable style={styles.resetModal} onPress={() => {}}>
            <Text style={styles.resetEmoji}>⚠️</Text>
            <Text style={styles.resetTitle}>Are you sure?</Text>
            <Text style={styles.resetDesc}>This will delete all your data.</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowResetConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.resetConfirmBtn} onPress={handleResetApp}>
                <Text style={styles.resetConfirmText}>Reset</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showRestoreConfirm} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowRestoreConfirm(false)}>
          <Pressable style={styles.resetModal} onPress={() => {}}>
            <Text style={styles.resetEmoji}>☁️</Text>
            <Text style={styles.resetTitle}>Restore from cloud?</Text>
            <Text style={styles.resetDesc}>This will overwrite local data. Continue?</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowRestoreConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.resetConfirmBtn, { backgroundColor: MAROON }]} onPress={handleRestore}>
                <Text style={styles.resetConfirmText}>Restore</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSectionsModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowSectionsModal(false)}>
          <Pressable style={[styles.resetModal, { maxWidth: 400 }]} onPress={() => {}}>
            <Text style={[styles.resetTitle, { marginBottom: 8 }]}>Manage sections</Text>
            <Text style={[styles.resetDesc, { marginBottom: 16 }]}>Choose which sections appear in the menu.</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator>
              {(ALL_SECTION_KEYS as unknown as string[]).map((key) => {
                const label = SECTION_LABELS[key] ?? key;
                const isSelected = sectionSelections.has(key);
                const iconName = SECTION_ICONS[key] ?? "ellipse-outline";
                return (
                  <Pressable
                    key={key}
                    style={[styles.profileRow, { marginBottom: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: isSelected ? MAROON : C.border, backgroundColor: isSelected ? "rgba(128,0,32,0.08)" : C.surface }]}
                    onPress={() => toggleSection(key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${label}, ${isSelected ? "on" : "off"}`}
                  >
                    <View style={[styles.profileIcon, { backgroundColor: (isSelected ? MAROON : C.surfaceElevated) + "99" }]}>
                      <Ionicons name={iconName} size={18} color={isSelected ? "#fff" : C.textSecondary} />
                    </View>
                    <Text style={[styles.profileRowTitle, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>{label}</Text>
                    <View style={[styles.sectionCheckbox, isSelected && styles.sectionCheckboxActive]}>
                      {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowSectionsModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.resetConfirmBtn, { backgroundColor: MAROON }]} onPress={handleSaveSections}>
                <Text style={styles.resetConfirmText}>Done</Text>
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
  scrollView: { flex: 1 },
  scrollViewContent: { flexGrow: 1 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 24 },
  editProfileLink: { fontWeight: "500", fontSize: 13, color: MAROON, marginTop: 4 },
  quickCardsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  quickCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickCardLabel: { fontWeight: "600", fontSize: 14, color: C.text },
  accountSettingsLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  sectionTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 4 },
  desc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 14 },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, minHeight: 50 },
  profileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  profileRowTitle: { fontWeight: "600", fontSize: 14, color: C.text },
  profileRowDesc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: MAROON, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontWeight: "600", fontSize: 22, color: "#fff" },
  profileInfo: { flex: 1, minWidth: 0 },
  profileGreeting: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 2 },
  profileFullName: { fontWeight: "700", fontSize: 18, color: C.text },
  profileEmail: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  statCardsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: CREAM,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MAROON + "30",
    padding: 14,
    minHeight: 80,
  },
  statCardLabel: { fontWeight: "600", fontSize: 12, color: C.textSecondary, marginTop: 6 },
  statCardValue: { fontWeight: "600", fontSize: 14, color: C.text, marginTop: 2 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "600", fontSize: 16, color: C.tint },
  syncedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  syncedText: { fontWeight: "500", fontSize: 11, color: C.green },
  accountActions: { flexDirection: "row", gap: 10 },
  primaryBtn: { backgroundColor: MAROON, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
  secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.tintLight, alignItems: "center" },
  secondaryBtnText: { fontWeight: "600", fontSize: 14, color: C.tint },
  outlineBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  outlineBtnText: { fontWeight: "600", fontSize: 14, color: C.text },
  backupActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  localHint: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 12 },
  toggleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.surfaceElevated, justifyContent: "center", paddingHorizontal: 3 },
  toggleActive: { backgroundColor: C.tint },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  toggleThumbActive: { alignSelf: "flex-end" },
  saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  saveBtnSaved: { backgroundColor: '#800020' },
  saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
  cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  resetAppBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.red + "30" },
  resetAppText: { fontWeight: "500", fontSize: 14, color: C.red },
  resetModal: { backgroundColor: C.surface, borderRadius: 22, padding: 28, width: "100%", maxWidth: 320, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  resetEmoji: { fontSize: 56, marginBottom: 16 },
  resetTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 8, textAlign: "center" },
  resetDesc: { fontWeight: "400", fontSize: 15, color: C.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 22 },
  resetConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.red, alignItems: "center" },
  resetConfirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  sectionCheckbox: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center", backgroundColor: C.surface, marginRight: 12,
  },
  sectionCheckboxActive: { backgroundColor: MAROON, borderColor: MAROON },
});
