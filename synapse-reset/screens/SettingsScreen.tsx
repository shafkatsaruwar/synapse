import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Platform,
  useWindowDimensions,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type ThemePreference, type Theme } from "@/contexts/ThemeContext";
import { useDisplaySettings, type TextSizeSetting } from "@/contexts/DisplaySettingsContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { useAuth } from "@/contexts/AuthContext";
import GlassView from "@/components/GlassView";
import { modalOverlay, modalSurface } from "@/lib/modal-colors";
import {
  settingsStorage,
  healthProfileStorage,
  conditionStorage,
  clearAllData,
  ALL_SECTION_KEYS,
  REQUIRED_SECTION_KEYS,
  medicationStorage,
  medicationLogStorage,
  appointmentStorage,
  type UserSettings,
  type Medication,
  type MedicationLog,
  type Appointment,
  type HealthProfileInfo,
  type UserRole,
  type WidgetAppearancePreference,
  type AppMode,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import { isCurrentMonthRamadan } from "@/lib/hijri";
import { syncAllFromSettings } from "@/lib/notification-manager";
import { syncWidgetSnapshot } from "@/lib/widget-sync";
import { raised } from "@/constants/raised";

const SECTION_LABELS: Record<string, string> = {
  log: "Daily Log", healthdata: "Vitals", medications: "Medications", symptoms: "Symptoms",
  labwork: "Lab Work", imaging: "Imaging",
  timeline: "Timeline",
  monthlycheckin: "Monthly check-in", eating: "Eating", mentalhealth: "Mental health day",
  comfort: "Mood lifters", goals: "Goals", appointments: "Appointments", reports: "Reports", privacy: "Privacy", cycletracking: "Cycle tracking",
};

interface SettingsScreenProps {
  onResetApp?: () => void;
  onNavigate?: (screen: string) => void;
  onRestoreComplete?: () => void;
  onShowAppTour?: () => void;
  onShowWhatsNew?: () => void;
  openAppearanceModalToken?: number;
}

const SECTION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  log: "heart-outline", healthdata: "analytics-outline", medications: "medical-outline", symptoms: "pulse-outline",
  labwork: "flask-outline", imaging: "scan-outline",
  timeline: "git-branch-outline",
  monthlycheckin: "fitness-outline", eating: "restaurant-outline", mentalhealth: "heart-outline", comfort: "happy-outline",
  goals: "flag-outline", appointments: "calendar-outline", reports: "document-text-outline", privacy: "shield-outline", cycletracking: "water-outline",
};

const THEME_OPTIONS: { id: ThemePreference; label: string; description: string }[] = [
  { id: "system", label: "System", description: "Follow device appearance" },
  { id: "calm", label: "Calm", description: "Warm beige, easy on the eyes" },
  { id: "light", label: "Light", description: "Clean white, modern" },
  { id: "dark", label: "Dark", description: "True black, OLED-friendly" },
];

const APP_MODE_OPTIONS: { id: AppMode; label: string; description: string }[] = [
  { id: "simple", label: "Simple Mode", description: "Bigger text, bigger buttons, and simpler main screens" },
  { id: "full", label: "Full Mode", description: "Detailed tracking and more control" },
];

const SIMPLE_TEXT_SIZE_OPTIONS: { id: TextSizeSetting; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "large", label: "Large" },
  { id: "extra_large", label: "Extra Large" },
];

const PROFILE_IMAGE_DIR = `${FileSystem.documentDirectory ?? ""}profile-images/`;

function getFileExtension(uri: string) {
  const clean = uri.split("?")[0] ?? uri;
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return "jpg";
  return clean.slice(lastDot + 1).toLowerCase() || "jpg";
}

async function persistProfileImage(sourceUri: string, previousUri?: string) {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) {
    return sourceUri;
  }

  await FileSystem.makeDirectoryAsync(PROFILE_IMAGE_DIR, { intermediates: true });

  const extension = getFileExtension(sourceUri);
  const destinationUri = `${PROFILE_IMAGE_DIR}profile-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });

  if (previousUri?.startsWith(PROFILE_IMAGE_DIR) && previousUri !== destinationUri) {
    const previousInfo = await FileSystem.getInfoAsync(previousUri);
    if (previousInfo.exists) {
      await FileSystem.deleteAsync(previousUri, { idempotent: true });
    }
  }

  return destinationUri;
}

export default function SettingsScreen({
  onResetApp,
  onNavigate,
  onRestoreComplete,
  onShowAppTour,
  onShowWhatsNew,
  openAppearanceModalToken,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user } = useAuth();
  const { appMode, setAppMode } = useAppMode();
  const { textSize, setTextSize, textScale } = useDisplaySettings();
  const { colors: C, preference, setThemeId, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeId), [C, themeId]);

  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [profile, setProfile] = useState<HealthProfileInfo>({ userRole: "self", widgetAppearance: "system", backupCriticalMedications: [] });
  const [saved, setSaved] = useState(true);
  const [showNameModal, setShowNameModal] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [conditionsCount, setConditionsCount] = useState(0);
  const [roleDetailsEditing, setRoleDetailsEditing] = useState(false);

  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
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
    const [s, profileInfo, conds, meds, logs, apts] = await Promise.all([
      settingsStorage.get(),
      healthProfileStorage.get(),
      conditionStorage.getAll(),
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      appointmentStorage.getAll(),
    ]);
    setSettings(s);
    setProfile(profileInfo);
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
    if ((openAppearanceModalToken ?? 0) > 0) {
      setShowAppearanceModal(true);
    }
  }, [openAppearanceModalToken]);

  const handleSave = async () => {
    await settingsStorage.save(settings);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    syncAllFromSettings().catch(() => {});
  };

  const handleSaveProfile = async (nextProfile: HealthProfileInfo) => {
    setProfile(nextProfile);
    await healthProfileStorage.save(nextProfile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncAllFromSettings().catch(() => {});
    syncWidgetSnapshot().catch(() => {});
  };

  const handleWidgetAppearanceChange = async (id: WidgetAppearancePreference) => {
    Haptics.selectionAsync();
    await handleSaveProfile({ ...profile, widgetAppearance: id });
  };

  const handlePickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Please allow photo library access to choose a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const persistedUri = await persistProfileImage(result.assets[0].uri, profile.profileImageUri);
    await handleSaveProfile({ ...profile, profileImageUri: persistedUri });
  };

  const toggleSection = (key: string) => {
    if (REQUIRED_SECTION_KEYS.includes(key)) return;
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

  const handleThemeChange = async (id: ThemePreference) => {
    Haptics.selectionAsync();
    await setThemeId(id);
  };

  const handleAppModeChange = async (mode: AppMode) => {
    Haptics.selectionAsync();
    await setAppMode(mode);
    setSettings((prev) => ({ ...prev, appMode: mode }));
  };

  const handleTextSizeChange = async (size: TextSizeSetting) => {
    Haptics.selectionAsync();
    await setTextSize(size);
    setSettings((prev) => ({ ...prev, textSize: size }));
  };

  const openNameModal = () => {
    setDraftName(settings.name?.trim() || "");
    setShowNameModal(true);
  };

  const handleSaveName = async () => {
    const trimmedName = draftName.trim();
    const nextSettings = { ...settings, name: trimmedName };
    setSettings(nextSettings);
    await settingsStorage.save(nextSettings);
    setSaved(true);
    setShowNameModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const updateRole = async (role: UserRole) => {
    setRoleDetailsEditing(false);
    await handleSaveProfile({ ...profile, userRole: role });
  };

  const saveBackupRoleDetails = async (updates: Partial<HealthProfileInfo>) => {
    await handleSaveProfile({ ...profile, ...updates });
  };

  const dateObj = new Date();
  const getDoseCount = (med: Medication) => (Array.isArray(med.doses) && med.doses.length > 0 ? med.doses.length : (med as { doses?: number }).doses ?? 1);
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

  const saveSimpleRoleDetails = async () => {
    await saveBackupRoleDetails({
      caredForName: profile.userRole === "caregiver" ? profile.caredForName?.trim() || undefined : undefined,
      caredForAge: profile.userRole === "caregiver" && profile.caredForAge != null ? profile.caredForAge : undefined,
      backupEmergencyProtocols: undefined,
      backupCriticalMedications: profile.backupCriticalMedications ?? [],
    });
    setRoleDetailsEditing(false);
  };

  const saveCareRecipientDetails = async () => {
    await saveBackupRoleDetails({
      caredForName: profile.caredForName?.trim() || undefined,
      caredForAge: profile.caredForAge != null ? profile.caredForAge : undefined,
      backupEmergencyProtocols: profile.backupEmergencyProtocols,
      backupCriticalMedications: profile.backupCriticalMedications ?? [],
    });
    setRoleDetailsEditing(false);
  };

  const caredForNameLabel = profile.caredForName?.trim() || "Add name";
  const caredForAgeLabel = profile.caredForAge != null ? `${profile.caredForAge} years old` : "Age not set";

  const contentPadding = {
    paddingTop: isWide ? 28 : Platform.OS === "web" ? 40 : 12,
    paddingBottom: isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100,
    paddingHorizontal: 24,
  };

  const shortcutCardMap = {
    healthprofile: {
      key: "healthprofile",
      title: "Health Profile",
      description: "Conditions, allergies, vaccines",
      icon: "person-outline" as const,
      tintColor: C.tint,
      tintBg: C.tintLight,
      onPress: () => onNavigate?.("healthprofile"),
    },
    doctors: {
      key: "doctors",
      title: "Doctors",
      description: "Your care team",
      icon: "medical-outline" as const,
      tintColor: C.tint,
      tintBg: C.tintLight,
      onPress: () => onNavigate?.("doctors"),
    },
    pharmacies: {
      key: "pharmacies",
      title: "Pharmacies",
      description: "Pickup and refill spots",
      icon: "storefront-outline" as const,
      tintColor: C.tint,
      tintBg: C.tintLight,
      onPress: () => onNavigate?.("pharmacies"),
    },
    appearance: {
      key: "appearance",
      title: "Appearances",
      description: "App and widget themes",
      icon: "color-palette-outline" as const,
      tintColor: C.tint,
      tintBg: C.tintLight,
      onPress: () => setShowAppearanceModal(true),
    },
    notifications: {
      key: "notifications",
      title: "Notifications",
      description: "Medication, appointment, and check-in reminders",
      icon: "notifications-outline" as const,
      tintColor: C.tint,
      tintBg: C.tintLight,
      onPress: () => setShowNotificationsModal(true),
    },
    feedback: {
      key: "feedback",
      title: "Send Feedback",
      description: "Tell us what feels good or needs work",
      icon: "chatbubble-ellipses-outline" as const,
      tintColor: C.tint,
      tintBg: C.tintLight,
      onPress: () => onNavigate?.("feedback"),
    },
    sections: {
      key: "sections",
      title: "Menu Sections",
      description: "Choose what shows in the menu",
      icon: "grid-outline" as const,
      tintColor: C.tint,
      tintBg: C.tintLight,
      onPress: () => setShowSectionsModal(true),
    },
    founder: {
      key: "founder",
      title: "Meet the Founder",
      description: "Why Synapse exists",
      icon: "sparkles-outline" as const,
      tintColor: C.tint,
      tintBg: C.tintLight,
      onPress: () => onNavigate?.("meetfounder"),
    },
    ...(onShowWhatsNew
      ? {
          whatsnew: {
            key: "whatsnew",
            title: "What’s New",
            description: "See the latest features again",
            icon: "megaphone-outline" as const,
            tintColor: C.tint,
            tintBg: C.tintLight,
            onPress: () => {
              Haptics.selectionAsync();
              onShowWhatsNew();
            },
          },
        }
      : {}),
    ...(onShowAppTour
      ? {
          tour: {
            key: "tour",
            title: "App Tour",
            description: "Replay the walkthrough",
            icon: "compass-outline" as const,
            tintColor: C.tint,
            tintBg: C.tintLight,
            onPress: () => {
              Haptics.selectionAsync();
              onShowAppTour();
              onNavigate?.("dashboard");
            },
          },
        }
      : {}),
  } as const;

  const accountShortcutCards = [
    shortcutCardMap.healthprofile,
    shortcutCardMap.doctors,
    shortcutCardMap.pharmacies,
    shortcutCardMap.appearance,
    shortcutCardMap.notifications,
    shortcutCardMap.feedback,
    shortcutCardMap.sections,
    shortcutCardMap.founder,
    ...(shortcutCardMap.whatsnew ? [shortcutCardMap.whatsnew] : []),
    ...(shortcutCardMap.tour ? [shortcutCardMap.tour] : []),
  ];

  const simpleHeaderTitleSize = Math.round(28 * textScale);
  const simpleSectionTitleSize = Math.round(20 * textScale);
  const simpleBodySize = Math.round(17 * textScale);
  const simpleActionSize = Math.round(16 * textScale);

  if (appMode === "simple") {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[contentPadding, styles.scrollViewContent, styles.simpleSettingsContent]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <Text style={[styles.title, { fontSize: simpleHeaderTitleSize, marginBottom: 18 }]}>Account</Text>

          <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.simpleSettingsCard}>
            <Text style={[styles.simpleSettingsSectionTitle, { fontSize: simpleSectionTitleSize }]}>Profile</Text>
            <View style={styles.simpleProfileRow}>
              <Pressable
                style={styles.simpleProfileAvatar}
                onPress={handlePickProfileImage}
                accessibilityRole="button"
                accessibilityLabel={profile.profileImageUri ? "Change photo" : "Add photo"}
              >
                {profile.profileImageUri ? (
                  <Image source={{ uri: profile.profileImageUri }} style={styles.simpleProfileAvatarImage} />
                ) : (
                  <Text style={styles.simpleProfileAvatarText}>
                    {(settings.name?.trim()?.[0] ?? "Y").toUpperCase()}
                  </Text>
                )}
              </Pressable>
              <View style={styles.simpleProfileTextWrap}>
                <Text style={[styles.simpleProfileName, { fontSize: simpleSectionTitleSize }]}>
                  {settings.name?.trim() || "You"}
                </Text>
              </View>
            </View>
            <View style={styles.simpleSettingsButtonRow}>
              <Pressable style={styles.simpleSettingsSecondaryButton} onPress={openNameModal}>
                <Text style={[styles.simpleSettingsSecondaryButtonText, { fontSize: simpleActionSize }]}>Edit name</Text>
              </Pressable>
              <Pressable style={styles.simpleSettingsPrimaryButton} onPress={handlePickProfileImage}>
                <Text style={[styles.simpleSettingsPrimaryButtonText, { fontSize: simpleActionSize }]}>
                  {profile.profileImageUri ? "Change photo" : "Add photo"}
                </Text>
              </Pressable>
            </View>
          </GlassView>

          <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.simpleSettingsCard}>
            <Text style={[styles.simpleSettingsSectionTitle, { fontSize: simpleSectionTitleSize }]}>Role</Text>
            <Text style={[styles.simpleSettingsPrompt, { fontSize: simpleBodySize }]}>Who is this for?</Text>
            <View style={styles.simpleSettingsOptionStack}>
              {[
                { id: "self" as const, label: "Just me" },
                { id: "caregiver" as const, label: "I help someone" },
              ].map((option) => {
                const active = (profile.userRole ?? "self") === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.simpleSettingsOptionButton, active && styles.simpleSettingsOptionButtonActive]}
                    onPress={() => updateRole(option.id)}
                  >
                    <Text style={[styles.simpleSettingsOptionText, { fontSize: simpleBodySize }, active && styles.simpleSettingsOptionTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {(profile.userRole ?? "self") === "caregiver" ? (
              <View style={styles.simplePersonCard}>
                <View style={styles.simplePersonHeader}>
                  <View style={styles.simplePersonAvatar}>
                    <Ionicons name="person-outline" size={20} color={C.tint} />
                  </View>
                  <View style={styles.simplePersonText}>
                    <Text style={[styles.simplePersonEyebrow, { fontSize: Math.max(11, simpleBodySize - 3) }]}>
                      Care recipient
                    </Text>
                    <Text style={[styles.simplePersonName, { fontSize: simpleSectionTitleSize }]}>
                      {caredForNameLabel}
                    </Text>
                    <Text style={[styles.simplePersonMeta, { fontSize: Math.max(12, simpleBodySize - 2) }]}>
                      {caredForAgeLabel}
                    </Text>
                  </View>
                  {!roleDetailsEditing ? (
                    <Pressable
                      style={styles.roleEditButton}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRoleDetailsEditing(true);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={15} color={C.tint} />
                      <Text style={styles.roleEditButtonText}>Edit</Text>
                    </Pressable>
                  ) : null}
                </View>
                {roleDetailsEditing ? (
                  <>
                    <View style={styles.simplePersonFieldRow}>
                      <View style={styles.simplePersonFieldName}>
                        <Text style={styles.roleInlineLabel}>Name</Text>
                        <TextInput
                          style={[styles.simpleSettingsInput, { fontSize: simpleBodySize }]}
                          value={profile.caredForName ?? ""}
                          onChangeText={(text) => setProfile((prev) => ({ ...prev, caredForName: text }))}
                          placeholder="Name"
                          placeholderTextColor={C.textTertiary}
                        />
                      </View>
                      <View style={styles.simplePersonFieldAge}>
                        <Text style={styles.roleInlineLabel}>Age</Text>
                        <TextInput
                          style={[styles.simpleSettingsInput, { fontSize: simpleBodySize }]}
                          value={profile.caredForAge != null ? String(profile.caredForAge) : ""}
                          onChangeText={(text) =>
                            setProfile((prev) => ({
                              ...prev,
                              caredForAge: text.trim() ? Math.max(0, parseInt(text, 10) || 0) : undefined,
                            }))
                          }
                          placeholder="Age"
                          placeholderTextColor={C.textTertiary}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <Pressable style={styles.personSaveButton} onPress={saveSimpleRoleDetails}>
                      <Text style={[styles.personSaveButtonText, { fontSize: simpleActionSize }]}>Save person</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            ) : null}
          </GlassView>

          <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.simpleSettingsCard}>
            <Text style={[styles.simpleSettingsSectionTitle, { fontSize: simpleSectionTitleSize }]}>Accessibility</Text>
            <Text style={[styles.simpleSettingsPrompt, { fontSize: simpleBodySize }]}>Text size</Text>
            <View style={styles.simpleSettingsOptionStack}>
              {SIMPLE_TEXT_SIZE_OPTIONS.map((option) => {
                const active = textSize === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.simpleSettingsOptionButton, active && styles.simpleSettingsOptionButtonActive]}
                    onPress={() => void handleTextSizeChange(option.id)}
                  >
                    <Text style={[styles.simpleSettingsOptionText, { fontSize: simpleBodySize }, active && styles.simpleSettingsOptionTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassView>

          <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.simpleSettingsCard}>
            <Text style={[styles.simpleSettingsSectionTitle, { fontSize: simpleSectionTitleSize }]}>App Mode</Text>
            <View style={styles.simpleSettingsOptionStack}>
              {APP_MODE_OPTIONS.map((option) => {
                const active = appMode === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.simpleSettingsOptionButton, active && styles.simpleSettingsOptionButtonActive]}
                    onPress={() => void handleAppModeChange(option.id)}
                  >
                    <Text style={[styles.simpleSettingsOptionText, { fontSize: simpleBodySize }, active && styles.simpleSettingsOptionTextActive]}>
                      {option.id === "simple" ? "Simple" : "Full"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassView>

          {onResetApp ? (
            <View style={styles.simpleSettingsDangerWrap}>
              <Pressable
                style={styles.simpleSettingsDangerButton}
                onPress={() => setShowResetConfirm(true)}
                testID="reset-app"
                accessibilityRole="button"
                accessibilityLabel="Reset app"
              >
                <Text style={[styles.simpleSettingsDangerText, { fontSize: simpleActionSize }]}>Reset App</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        <Modal visible={showResetConfirm} transparent animationType="fade">
          <Pressable style={styles.overlay} onPress={() => setShowResetConfirm(false)}>
            <Pressable style={styles.resetModal} onPress={() => {}}>
              <Text style={styles.resetEmoji}>⚠️</Text>
              <Text style={styles.resetTitle}>Reset App</Text>
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

        <Modal visible={showNameModal} transparent animationType="fade">
          <Pressable style={styles.overlay} onPress={() => setShowNameModal(false)}>
            <Pressable style={styles.resetModal} onPress={() => {}}>
              <Text style={[styles.resetTitle, { marginBottom: 12 }]}>Edit name</Text>
              <TextInput
                style={[styles.input, { marginBottom: 16 }]}
                placeholder="Your name"
                placeholderTextColor={C.textTertiary}
                value={draftName}
                onChangeText={setDraftName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setShowNameModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.resetConfirmBtn, { backgroundColor: C.tint }, !draftName.trim() && { opacity: 0.5 }]} onPress={handleSaveName} disabled={!draftName.trim()}>
                  <Text style={styles.resetConfirmText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[contentPadding, styles.scrollViewContent]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <Text style={styles.title}>Account</Text>

        {/* ——— Local Profile Header ——— */}
        <GlassView variant="hero" tint={themeId === "dark" ? "dark" : "light"} style={styles.cardGlass}>
          <Pressable
            style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.9 : 1 }]}
            onPress={openNameModal}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
          >
          <View style={styles.profileHeader}>
            <Pressable
              style={styles.profileAvatar}
              onPress={(event) => {
                event.stopPropagation();
                handlePickProfileImage();
              }}
              accessibilityRole="button"
              accessibilityLabel="Choose profile picture"
            >
              {profile.profileImageUri ? (
                <Image source={{ uri: profile.profileImageUri }} style={styles.profileAvatarImage} />
              ) : (
                <Text style={styles.profileAvatarText}>
                  {(settings.name?.trim()?.[0] ?? "Y").toUpperCase()}
                </Text>
              )}
            </Pressable>
            <View style={styles.profileInfo}>
              <Text style={styles.profileGreeting}>Hello,</Text>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileFullName}>
                  {settings.name?.trim() || "You"}
                </Text>
                <Ionicons name="pencil-outline" size={16} color={C.textTertiary} />
              </View>
              <Text style={styles.editHint}>Tap to edit</Text>
            </View>
          </View>
          <Text style={styles.localHint}>
            Data is stored locally on this device. Use Export All Data anytime if you want a manual backup file.
          </Text>
          <Pressable
            style={styles.photoLink}
            onPress={(event) => {
              event.stopPropagation();
              handlePickProfileImage();
            }}
            accessibilityRole="button"
            accessibilityLabel={profile.profileImageUri ? "Change profile picture" : "Add profile picture"}
          >
            <Ionicons name="image-outline" size={15} color={C.tint} />
            <Text style={styles.photoLinkText}>
              {profile.profileImageUri ? "Change profile picture" : "Add profile picture"}
            </Text>
          </Pressable>
          </Pressable>
        </GlassView>

        <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.card}>
          <Text style={styles.sectionTitle}>Role</Text>
          <Text style={[styles.desc, { marginBottom: 12 }]}>Tell Synapse who this setup is for so the app can stay context-aware.</Text>
          <View style={styles.roleRow}>
            {(["self", "caregiver", "backup"] as UserRole[]).map((role) => {
              const active = (profile.userRole ?? "self") === role;
              const label = role === "self" ? "Self" : role === "caregiver" ? "Caregiver" : "Backup Person";
              return (
                <Pressable
                  key={role}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                  onPress={() => updateRole(role)}
                >
                  <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {(profile.userRole ?? "self") === "caregiver" ? (
            <View style={styles.rolePersonCard}>
              <View style={styles.rolePersonHeader}>
                <View style={styles.rolePersonAvatar}>
                  <Ionicons name="person-outline" size={22} color={C.tint} />
                </View>
                <View style={styles.rolePersonText}>
                  <Text style={styles.rolePersonEyebrow}>Care recipient</Text>
                  <Text style={styles.rolePersonName}>{caredForNameLabel}</Text>
                  <Text style={styles.rolePersonMeta}>{caredForAgeLabel}</Text>
                </View>
                {!roleDetailsEditing ? (
                  <Pressable
                    style={styles.roleEditButton}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRoleDetailsEditing(true);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={15} color={C.tint} />
                    <Text style={styles.roleEditButtonText}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
              {roleDetailsEditing ? (
                <>
                  <View style={styles.rolePersonFieldRow}>
                    <View style={styles.rolePersonFieldName}>
                      <Text style={styles.roleInlineLabel}>Name</Text>
                      <TextInput
                        style={styles.roleInlineInput}
                        value={profile.caredForName ?? ""}
                        onChangeText={(text) => setProfile((prev) => ({ ...prev, caredForName: text }))}
                        placeholder="Name"
                        placeholderTextColor={C.textTertiary}
                      />
                    </View>
                    <View style={styles.rolePersonFieldAge}>
                      <Text style={styles.roleInlineLabel}>Age</Text>
                      <TextInput
                        style={styles.roleInlineInput}
                        value={profile.caredForAge != null ? String(profile.caredForAge) : ""}
                        onChangeText={(text) =>
                          setProfile((prev) => ({
                            ...prev,
                            caredForAge: text.trim() ? Math.max(0, parseInt(text, 10) || 0) : undefined,
                          }))
                        }
                        placeholder="Age"
                        placeholderTextColor={C.textTertiary}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  <Pressable style={styles.personSaveButton} onPress={saveCareRecipientDetails}>
                    <Text style={styles.personSaveButtonText}>Save person</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          {(profile.userRole ?? "self") === "backup" ? (
            <View style={{ marginTop: 14, gap: 12 }}>
              <View>
                <Text style={styles.label}>Emergency protocols</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={profile.backupEmergencyProtocols ?? ""}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, backupEmergencyProtocols: text }))}
                  placeholder="What should a backup person know in an emergency?"
                  placeholderTextColor={C.textTertiary}
                  multiline
                />
              </View>
              <View>
                <Text style={styles.label}>Critical medications</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={(profile.backupCriticalMedications ?? []).map((item) => item.name).join("\n")}
                  onChangeText={(text) =>
                    setProfile((prev) => ({
                      ...prev,
                      backupCriticalMedications: text
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((name, index) => ({ id: `critical-${index}-${name}`, name })),
                    }))
                  }
                  placeholder="One per line, like emergency injection or rescue inhaler"
                  placeholderTextColor={C.textTertiary}
                  multiline
                />
              </View>
            </View>
          ) : null}

          {(profile.userRole ?? "self") === "backup" ? (
            <Pressable
              style={[styles.primaryBtn, { marginTop: 14 }]}
              onPress={() =>
                saveBackupRoleDetails({
                  caredForName: profile.caredForName?.trim() || undefined,
                  caredForAge: profile.userRole === "caregiver" && profile.caredForAge != null ? profile.caredForAge : undefined,
                  backupEmergencyProtocols: profile.backupEmergencyProtocols?.trim() || undefined,
                  backupCriticalMedications: (profile.backupCriticalMedications ?? []).filter((item) => item.name.trim()),
                })
              }
            >
              <Text style={styles.primaryBtnText}>Save role details</Text>
            </Pressable>
          ) : null}
        </GlassView>

        <GlassView variant="hero" tint={themeId === "dark" ? "dark" : "light"} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>Health Hub</Text>
            <Text style={styles.groupSubtitle}>Quick ways into the stuff people actually use.</Text>
          </View>
          <View style={styles.tileGrid}>
            {accountShortcutCards.map((item) => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [styles.tileCard, { opacity: pressed ? 0.82 : 1 }]}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <View style={[styles.tileIconWrap, { backgroundColor: item.tintBg }]}>
                  <Ionicons name={item.icon} size={22} color={item.tintColor} />
                </View>
                <Text style={styles.tileTitle}>{item.title}</Text>
                <Text style={styles.tileDesc}>{item.description}</Text>
              </Pressable>
            ))}
          </View>
        </GlassView>

        <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.card}>
          <Text style={styles.sectionTitle}>App Mode</Text>
          <Text style={[styles.desc, { marginBottom: 12 }]}>
            Simple Mode is a focused view for Dashboard, Medications, Appointments, Symptoms, and Roles. Full Mode keeps the full detailed experience.
          </Text>
          <View style={styles.roleRow}>
            {APP_MODE_OPTIONS.map((option) => {
              const active = appMode === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                  onPress={() => void handleAppModeChange(option.id)}
                >
                  <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.desc, { marginTop: 12 }]}>
            Simple Mode keeps those main areas easier to reach with larger controls and less clutter.
          </Text>
        </GlassView>

        <GlassView variant="card" tint={themeId === "dark" ? "dark" : "light"} style={styles.cardGlass}>
          <Pressable
            style={styles.cardPressable}
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
        </GlassView>

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

      <Modal visible={showNameModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowNameModal(false)}>
          <Pressable style={styles.resetModal} onPress={() => {}}>
            <Text style={[styles.resetTitle, { marginBottom: 8 }]}>Edit name</Text>
            <Text style={[styles.resetDesc, { marginBottom: 16 }]}>This is the name Synapse shows across the app.</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, { marginBottom: 16 }]}
              placeholder="Your name"
              placeholderTextColor={C.textTertiary}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowNameModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.resetConfirmBtn, { backgroundColor: C.tint }, !draftName.trim() && { opacity: 0.5 }]} onPress={handleSaveName} disabled={!draftName.trim()}>
                <Text style={styles.resetConfirmText}>Save</Text>
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
            <ScrollView style={{ maxHeight: 320, width: "100%" }} showsVerticalScrollIndicator>
              {(ALL_SECTION_KEYS as unknown as string[]).map((key) => {
                const label = SECTION_LABELS[key] ?? key;
                const isRequired = REQUIRED_SECTION_KEYS.includes(key);
                const isSelected = isRequired || sectionSelections.has(key);
                const iconName = SECTION_ICONS[key] ?? "ellipse-outline";
                return (
                  <Pressable
                    key={key}
                    style={[styles.profileRow, { marginBottom: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: isSelected ? C.tint : C.border, backgroundColor: isSelected ? C.tintLight : C.surface, opacity: isRequired ? 0.75 : 1 }]}
                    onPress={() => toggleSection(key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${label}, ${isRequired ? "required" : isSelected ? "on" : "off"}`}
                  >
                    <View style={[styles.profileIcon, { backgroundColor: isSelected ? C.tint : C.surfaceElevated }]}>
                      <Ionicons name={iconName} size={18} color={isSelected ? "#fff" : C.textSecondary} />
                    </View>
                    <Text style={[styles.profileRowTitle, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>{label}</Text>
                    {isRequired ? (
                      <Ionicons name="lock-closed" size={14} color={C.tint} />
                    ) : (
                      <View style={[styles.sectionCheckbox, isSelected && styles.sectionCheckboxActive]}>
                        {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowSectionsModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.resetConfirmBtn, { backgroundColor: C.tint }]} onPress={handleSaveSections}>
                <Text style={styles.resetConfirmText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showAppearanceModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowAppearanceModal(false)}>
          <Pressable style={[styles.resetModal, styles.appearanceModal]} onPress={() => {}}>
            <Text style={[styles.resetTitle, { marginBottom: 8 }]}>Appearances</Text>
            <Text style={[styles.resetDesc, { marginBottom: 16 }]}>Choose your appearance for the widgets and your app.</Text>
            <ScrollView style={{ maxHeight: 420, width: "100%" }} showsVerticalScrollIndicator>
              <Text style={styles.appearanceGroupTitle}>App</Text>
              {THEME_OPTIONS.map((opt) => {
                const isSelected = preference === opt.id;
                return (
                  <Pressable
                    key={`app-${opt.id}`}
                    style={[styles.themeOption, isSelected && styles.themeOptionSelected]}
                    onPress={() => handleThemeChange(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${opt.label} app appearance`}
                  >
                    <View style={styles.themeOptionContent}>
                      <View style={[styles.themeRadio, isSelected && styles.themeRadioSelected]}>
                        {isSelected && <View style={styles.themeRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.themeOptionLabel, isSelected && { color: C.tint }]}>{opt.label}</Text>
                        <Text style={styles.themeOptionDesc}>{opt.description}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              <Text style={[styles.appearanceGroupTitle, { marginTop: 12 }]}>Widgets</Text>
              {THEME_OPTIONS.map((opt) => {
                const isSelected = (profile.widgetAppearance ?? "system") === opt.id;
                return (
                  <Pressable
                    key={`widget-${opt.id}`}
                    style={[styles.themeOption, isSelected && styles.themeOptionSelected]}
                    onPress={() => handleWidgetAppearanceChange(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${opt.label} widget appearance`}
                  >
                    <View style={styles.themeOptionContent}>
                      <View style={[styles.themeRadio, isSelected && styles.themeRadioSelected]}>
                        {isSelected && <View style={styles.themeRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.themeOptionLabel, isSelected && { color: C.tint }]}>{opt.label}</Text>
                        <Text style={styles.themeOptionDesc}>{opt.description}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: 16, width: "100%" }]}>
              <Pressable style={[styles.resetConfirmBtn, { backgroundColor: C.tint }]} onPress={() => setShowAppearanceModal(false)}>
                <Text style={styles.resetConfirmText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showNotificationsModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowNotificationsModal(false)}>
          <Pressable style={[styles.resetModal, styles.appearanceModal]} onPress={() => {}}>
            <Text style={[styles.resetTitle, { marginBottom: 8 }]}>Notifications</Text>
            <Text style={[styles.resetDesc, { marginBottom: 16 }]}>Local reminders for medications, appointments, and check-ins.</Text>
            <ScrollView style={{ maxHeight: 420, width: "100%" }} showsVerticalScrollIndicator>
              {[
                { key: "notificationsMedications" as const, label: "Medication reminders", desc: "Daily reminders to take your medications" },
                { key: "notificationsAppointments" as const, label: "Appointment reminders", desc: "Friendly day-before, same-day, and time-to-leave reminders" },
                { key: "notificationsDailyCheckIn" as const, label: "Daily check-in reminders", desc: "Remind to log mood and symptoms (default 8 PM)" },
                { key: "notificationsMonthly" as const, label: "Monthly reminders", desc: "Monthly health review reminder" },
              ].map(({ key, label, desc }) => (
                <Pressable
                  key={key}
                  style={[styles.notificationOption, { marginTop: 8 }]}
                  onPress={() => {
                    setSettings((p) => ({ ...p, [key]: !(p[key] !== false) }));
                    setSaved(false);
                    Haptics.selectionAsync();
                  }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: settings[key] !== false }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.sectionTitle}>{label}</Text>
                    <Text style={[styles.desc, { marginBottom: 0 }]}>{desc}</Text>
                  </View>
                  <View style={[styles.toggle, settings[key] !== false && styles.toggleActive]}>
                    <View style={[styles.toggleThumb, settings[key] !== false && styles.toggleThumbActive]} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: 16, width: "100%" }]}>
              <Pressable style={[styles.resetConfirmBtn, { backgroundColor: C.tint }]} onPress={() => setShowNotificationsModal(false)}>
                <Text style={styles.resetConfirmText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme, themeId: string) {
  const solidModalSurface = modalSurface(C);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    scrollView: { flex: 1 },
    scrollViewContent: { flexGrow: 1 },
    title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 24 },
    simpleSettingsContent: { gap: 12 },
    simpleSettingsCard: { borderRadius: 28, padding: 20, gap: 14, overflow: "hidden", ...raised("md") },
    simpleSettingsSectionTitle: { fontWeight: "800", color: C.text, letterSpacing: -0.4 },
    simpleSettingsPrompt: { fontWeight: "600", color: C.textSecondary, marginBottom: 2 },
    simpleProfileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    simpleProfileAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    simpleProfileAvatarImage: { width: 82, height: 82, borderRadius: 41 },
    simpleProfileAvatarText: { fontWeight: "700", fontSize: 28, color: "#fff" },
    simpleProfileTextWrap: { flex: 1, minWidth: 0 },
    simpleProfileName: { fontWeight: "800", color: C.text, letterSpacing: -0.5 },
    simpleSettingsButtonRow: { flexDirection: "row", gap: 10 },
    simpleSettingsPrimaryButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: 18, backgroundColor: C.tint, alignItems: "center", justifyContent: "center", flex: 1 },
    simpleSettingsPrimaryButtonText: { fontWeight: "800", color: "#fff", letterSpacing: -0.2 },
    simpleSettingsSecondaryButton: { minHeight: 54, paddingHorizontal: 18, borderRadius: 18, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.3)", borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)", alignItems: "center", justifyContent: "center", flex: 1 },
    simpleSettingsSecondaryButtonText: { fontWeight: "800", color: C.text, letterSpacing: -0.2 },
    simpleSettingsOptionStack: { gap: 10 },
    simpleSettingsOptionButton: { minHeight: 56, borderRadius: 18, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)", borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)", justifyContent: "center", paddingHorizontal: 18 },
    simpleSettingsOptionButtonActive: { borderColor: C.tint, backgroundColor: C.tintLight },
    simpleSettingsOptionText: { fontWeight: "700", color: C.textSecondary, letterSpacing: -0.2 },
    simpleSettingsOptionTextActive: { color: C.tint },
    simpleSettingsInputBlock: { gap: 10 },
    simpleSettingsInput: { minHeight: 56, borderRadius: 18, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.34)", borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)", paddingHorizontal: 18, color: C.text },
    simplePersonCard: {
      borderRadius: 24,
      padding: 14,
      gap: 12,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.26)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.82)",
      ...raised("sm"),
    },
    simplePersonHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    simplePersonAvatar: {
      width: 46,
      height: 46,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tintLight,
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.72)",
    },
    simplePersonText: { flex: 1, minWidth: 0 },
    simplePersonEyebrow: { fontWeight: "800", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
    simplePersonName: { fontWeight: "900", color: C.text, letterSpacing: -0.4 },
    simplePersonMeta: { fontWeight: "700", color: C.textSecondary, marginTop: 2 },
    simplePersonFieldRow: { flexDirection: "row", gap: 10 },
    simplePersonFieldName: { flex: 1.4, minWidth: 0 },
    simplePersonFieldAge: { flex: 0.8, minWidth: 86 },
    simpleSettingsToggleRow: { minHeight: 58, borderRadius: 18, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)", borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)", paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    simpleSettingsDangerWrap: { paddingTop: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: C.border },
    simpleSettingsDangerButton: { minHeight: 56, borderRadius: 18, borderWidth: 1, borderColor: C.red + "55", alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
    simpleSettingsDangerText: { fontWeight: "800", color: C.red, letterSpacing: -0.2 },
    editProfileLink: { fontWeight: "500", fontSize: 13, color: C.tint, marginTop: 4 },
    groupCard: { borderRadius: 30, padding: 18, marginBottom: 12, overflow: "hidden", ...raised("md") },
    groupHeader: { marginBottom: 14 },
    groupTitle: { fontWeight: "700", fontSize: 17, color: C.text },
    groupSubtitle: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 3 },
    tileGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    tileCard: {
      width: "48%",
      minHeight: 132,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.24)",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.78)",
      paddingHorizontal: 14,
      paddingVertical: 14,
      justifyContent: "flex-start",
      marginBottom: 12,
      ...raised("sm"),
    },
    tileIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    tileTitle: { fontWeight: "700", fontSize: 14, color: C.text, marginBottom: 4 },
    tileDesc: { fontWeight: "400", fontSize: 12, lineHeight: 17, color: C.textSecondary },
    card: { borderRadius: 28, padding: 20, marginBottom: 12, overflow: "hidden", ...raised("md") },
    cardGlass: { borderRadius: 28, marginBottom: 12, overflow: "hidden", ...raised("md") },
    cardPressable: { padding: 20 },
    sectionTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 4 },
    desc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 14 },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.34)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)" },
    textArea: { minHeight: 84, textAlignVertical: "top" },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, minHeight: 50 },
    profileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    profileRowTitle: { fontWeight: "600", fontSize: 14, color: C.text },
    profileRowDesc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
    divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
    profileHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
    profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    profileAvatarImage: { width: 64, height: 64, borderRadius: 32 },
    profileAvatarText: { fontWeight: "600", fontSize: 22, color: "#fff" },
    profileInfo: { flex: 1, minWidth: 0 },
    profileGreeting: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 2 },
    profileNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    profileFullName: { fontWeight: "700", fontSize: 18, color: C.text },
    editHint: { fontWeight: "500", fontSize: 12, color: C.textTertiary, marginTop: 4 },
    photoLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
    photoLinkText: { fontWeight: "600", fontSize: 13, color: C.tint },
    profileEmail: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
    statCardsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: C.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.tint + "30",
      padding: 14,
      minHeight: 80,
      ...raised("sm"),
    },
    statCardLabel: { fontWeight: "600", fontSize: 12, color: C.textSecondary, marginTop: 6 },
    statCardValue: { fontWeight: "600", fontSize: 14, color: C.text, marginTop: 2 },
    accountRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    avatarText: { fontWeight: "600", fontSize: 16, color: C.tint },
    syncedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    syncedText: { fontWeight: "500", fontSize: 11, color: C.green },
    accountActions: { flexDirection: "row", gap: 10 },
    primaryBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    primaryBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
    secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.tintLight, alignItems: "center" },
    secondaryBtnText: { fontWeight: "600", fontSize: 14, color: C.tint },
    outlineBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
    outlineBtnText: { fontWeight: "600", fontSize: 14, color: C.text },
    backupActions: { flexDirection: "row", gap: 10, marginTop: 8 },
    roleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    roleChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.3)",
    },
    roleChipActive: { borderColor: C.tint, backgroundColor: C.tintLight },
    roleChipText: { color: C.textSecondary, fontWeight: "600", fontSize: 13 },
    roleChipTextActive: { color: C.tint },
    rolePersonCard: {
      marginTop: 14,
      borderRadius: 24,
      padding: 14,
      gap: 12,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.26)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.82)",
      ...raised("sm"),
    },
    rolePersonHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    rolePersonAvatar: {
      width: 52,
      height: 52,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tintLight,
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.72)",
    },
    rolePersonText: { flex: 1, minWidth: 0 },
    rolePersonEyebrow: { fontWeight: "800", fontSize: 11, color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
    rolePersonName: { fontWeight: "900", fontSize: 20, color: C.text, letterSpacing: -0.5 },
    rolePersonMeta: { fontWeight: "700", fontSize: 13, color: C.textSecondary, marginTop: 2 },
    rolePersonFieldRow: { flexDirection: "row", gap: 10 },
    rolePersonFieldName: { flex: 1.4, minWidth: 0 },
    rolePersonFieldAge: { flex: 0.8, minWidth: 86 },
    roleEditButton: {
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 999,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: C.tintLight,
      borderWidth: 1,
      borderColor: C.tint + "35",
    },
    roleEditButtonText: { fontWeight: "900", fontSize: 12, color: C.tint },
    roleInlineLabel: { fontWeight: "800", fontSize: 11, color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
    roleInlineInput: {
      minHeight: 50,
      borderRadius: 16,
      paddingHorizontal: 14,
      fontWeight: "700",
      fontSize: 14,
      color: C.text,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.34)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)",
    },
    personSaveButton: {
      minHeight: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tint,
      ...raised("sm"),
    },
    personSaveButtonText: { fontWeight: "900", fontSize: 14, color: "#fff", letterSpacing: -0.2 },
    localHint: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 12 },
    toggleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.surfaceElevated, justifyContent: "center", paddingHorizontal: 3 },
    toggleActive: { backgroundColor: C.tint },
    toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
    toggleThumbActive: { alignSelf: "flex-end" },
    saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
    saveBtnSaved: { backgroundColor: C.tint },
    saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
    overlay: { flex: 1, backgroundColor: modalOverlay(), justifyContent: "center", alignItems: "center", padding: 24 },
    modalActions: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
    cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
    resetAppBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.red + "30" },
    resetAppText: { fontWeight: "500", fontSize: 14, color: C.red },
    resetModal: { backgroundColor: solidModalSurface, borderRadius: 22, padding: 28, width: "100%", maxWidth: 320, borderWidth: 1, borderColor: C.border, alignItems: "center", ...raised("lg") },
    resetEmoji: { fontSize: 56, marginBottom: 16 },
    resetTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 8, textAlign: "center" },
    resetDesc: { fontWeight: "400", fontSize: 15, color: C.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 22 },
    resetConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.red, alignItems: "center" },
    resetConfirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
    appearanceModal: { maxWidth: 420, alignItems: "stretch" },
    notificationOption: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)",
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)",
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    appearanceGroupTitle: { fontWeight: "700", fontSize: 13, color: C.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.6 },
    sectionCheckbox: {
      width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.border,
      alignItems: "center", justifyContent: "center", backgroundColor: C.surface, marginRight: 12,
    },
    sectionCheckboxActive: { backgroundColor: C.tint, borderColor: C.tint },
    // Appearance / theme selector
    themeOption: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    themeOptionSelected: {
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    themeOptionContent: { flexDirection: "row", alignItems: "center", gap: 12 },
    themeRadio: {
      width: 20, height: 20, borderRadius: 10,
      borderWidth: 2, borderColor: C.border,
      alignItems: "center", justifyContent: "center",
    },
    themeRadioSelected: { borderColor: C.tint },
    themeRadioDot: {
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: C.tint,
    },
    themeOptionLabel: { fontWeight: "600", fontSize: 14, color: C.text },
    themeOptionDesc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 1 },
  });
}
