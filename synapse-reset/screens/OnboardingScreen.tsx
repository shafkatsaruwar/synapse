import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
  Animated,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { settingsStorage, healthProfileStorage, ALL_SECTION_KEYS, REQUIRED_SECTION_KEYS, type AppMode, type UserRole } from "@/lib/storage";
import { useTheme, type Theme, type ThemeId, type ThemePreference } from "@/contexts/ThemeContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { setBiometricLockEnabled } from "@/lib/biometric-storage";
import SynapseLogo from "@/components/SynapseLogo";

const founderImage = require("../assets/images/founder.png");

const onboardingMedications = require("../assets/onboarding/medications.png");
const onboardingDashboard = require("../assets/onboarding/dashboard.png");
const onboardingAppointments = require("../assets/onboarding/appointments.png");

const SECTION_LABELS: Record<string, string> = {
  log: "Daily Log",
  healthdata: "Vitals",
  medications: "Medications",
  symptoms: "Symptoms",
  cycletracking: "Cycle tracking",
  monthlycheckin: "Monthly check-in",
  eating: "Eating",
  mentalhealth: "Mental health day",
  comfort: "Mood lifters",
  goals: "Goals",
  appointments: "Appointments",
  reports: "Reports",
  privacy: "Privacy",
};

type OnboardingStepId =
  | "intro"
  | "privacy"
  | "mode"
  | "name"
  | "role"
  | "appearance"
  | "features"
  | "addMeds"
  | "done";

const FULL_ONBOARDING_STEPS: OnboardingStepId[] = [
  "intro",
  "privacy",
  "mode",
  "name",
  "appearance",
  "features",
  "addMeds",
  "done",
];

const SIMPLE_ONBOARDING_STEPS: OnboardingStepId[] = [
  "intro",
  "privacy",
  "mode",
  "name",
  "role",
];

const APP_MODE_OPTIONS: { id: AppMode; label: string; description: string }[] = [
  { id: "simple", label: "Simple Mode", description: "Bigger text, bigger buttons, and a simpler view of your main daily screens" },
  { id: "full", label: "Full Mode", description: "More control with detailed tracking and options" },
];

const APPEARANCE_OPTIONS: { id: ThemePreference; label: string; description: string }[] = [
  { id: "system", label: "System", description: "Follows your device setting" },
  { id: "calm", label: "Calm", description: "Warm cream tones" },
  { id: "light", label: "Light", description: "Clean blue-white" },
  { id: "dark", label: "Dark", description: "Easy on the eyes at night" },
];

export interface OnboardingCompleteOptions {
  openMedications?: boolean;
  appMode?: AppMode;
}

interface OnboardingScreenProps {
  onComplete: (options?: OnboardingCompleteOptions) => void;
}

function getPreviewTheme(themeId: ThemeId): Theme {
  switch (themeId) {
    case "light":
      return require("@/themes/light").default as Theme;
    case "dark":
      return require("@/themes/dark").default as Theme;
    default:
      return require("@/themes/calm").default as Theme;
  }
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { setThemeId, themeId, preference } = useTheme();
  const { setAppMode } = useAppMode();

  const [step, setStep] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    () => new Set(ALL_SECTION_KEYS as unknown as string[])
  );

  const [onboardingFirstName, setOnboardingFirstName] = useState("");
  const [onboardingLastName, setOnboardingLastName] = useState("");
  const [selectedAppearance, setSelectedAppearance] = useState<ThemePreference>(preference);
  const [selectedAppMode, setSelectedAppMode] = useState<AppMode | null>(null);
  const [onboardingRole, setOnboardingRole] = useState<UserRole>("self");
  const [onboardingCaredForName, setOnboardingCaredForName] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;
  const previewThemeId = useMemo<ThemeId>(
    () => (selectedAppearance === "system" ? themeId : selectedAppearance),
    [selectedAppearance, themeId]
  );
  const previewColors = useMemo(() => getPreviewTheme(previewThemeId), [previewThemeId]);
  const styles = useMemo(() => makeStyles(previewColors), [previewColors]);
  const statusBarStyle = previewThemeId === "dark" ? "light-content" : "dark-content";
  const onboardingSteps = useMemo<OnboardingStepId[]>(
    () => (selectedAppMode === "simple" ? SIMPLE_ONBOARDING_STEPS : FULL_ONBOARDING_STEPS),
    [selectedAppMode]
  );
  const stepId = onboardingSteps[step];
  const slideCount = onboardingSteps.length;

  useEffect(() => {
    Animated.timing(slideX, {
      toValue: -step * width,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [step, width]);

  const goNext = () => {
    if (step < slideCount - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s - 1);
    }
  };

  const finishWithBiometricPrompt = async (openMedications?: boolean) => {
    if ((selectedAppMode ?? "full") === "simple") {
      await handleFinish(openMedications);
      return;
    }

    if (Platform.OS === "ios" || Platform.OS === "android") {
      Alert.alert(
        "Enable Face ID / Touch ID?",
        "Would you like to enable Face ID for this app? You can change this later in Synapse Privacy & Data.",
        [
          { text: "Not now", style: "cancel", onPress: () => { void handleFinish(openMedications); } },
          {
            text: "Enable",
            onPress: async () => {
              await setBiometricLockEnabled(true);
              await handleFinish(openMedications);
            },
          },
        ]
      );
      return;
    }

    await handleFinish(openMedications);
  };

  const toggleSection = (key: string) => {
    if (REQUIRED_SECTION_KEYS.includes(key)) return;
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    Haptics.selectionAsync();
  };

  const handleFinish = async (openMedications?: boolean) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const [settings, profile] = await Promise.all([settingsStorage.get(), healthProfileStorage.get()]);
    const enabledSections = Array.from(selectedSections);
    const firstName = onboardingFirstName.trim();
    const lastName = onboardingLastName.trim();
    const resolvedAppMode = selectedAppMode ?? "full";
    const caredForName = onboardingRole === "caregiver" ? onboardingCaredForName.trim() : "";
    await settingsStorage.save({
      ...settings,
      firstName: firstName || settings.firstName,
      lastName: lastName || settings.lastName,
      name: [firstName, lastName].filter(Boolean).join(" ") || settings.name || "You",
      onboardingCompleted: true,
      appMode: resolvedAppMode,
      enabledSections: enabledSections.length > 0 ? enabledSections : (ALL_SECTION_KEYS as unknown as string[]),
    });
    await healthProfileStorage.save({
      ...profile,
      userRole: onboardingRole,
      caredForName: onboardingRole === "caregiver" ? caredForName || undefined : undefined,
    });
    await setAppMode(resolvedAppMode);
    await setThemeId(selectedAppearance);
    onComplete({
      ...(openMedications ? { openMedications: true } : {}),
      appMode: resolvedAppMode,
    });
  };

  const handleSkipForNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(slideCount - 1);
  };

  const slideWidth = width;
  const paddingH = 28;

  const renderSlide0 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.slideCenter}>
        <View style={styles.brainLogo}>
          <SynapseLogo size={180} color={previewColors.tint} />
        </View>
        <Text style={styles.welcomeTitle}>Synapse</Text>
        <Text style={styles.welcomeSub}>Built by a real patient, for real patients</Text>
      </View>
    </View>
  );

  const renderFeatureSlide = (
    imageSource: typeof founderImage,
    caption: string,
    subtitle: string
  ) => (
    <View style={[styles.slide, styles.featureSlideBg, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.featureSlideCenter}>
        <View style={styles.phoneMockup}>
          <Image source={imageSource} style={styles.phoneMockupImage} resizeMode="cover" />
        </View>
        <Text style={styles.featureCaption}>{caption}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );

  const renderSlide1 = () =>
    (
      <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
        <View style={styles.slideCenter}>
          <Text style={styles.setupTitle}>Your data stays with you</Text>
          <Text style={styles.setupSub}>
            This app does not create accounts or collect personal information.{"\n"}
            Everything you enter in Synapse stays stored locally on your device.{"\n"}
            Your health information is never uploaded or shared.
          </Text>
        </View>
      </View>
    );

  const renderSlide2 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.slideCenter}>
        <Text style={styles.setupTitle}>How would you like to use Synapse?</Text>
        <Text style={styles.setupSub}>Simple Mode focuses on Dashboard, Medications, Appointments, Symptoms, and Roles. You can change this anytime in Settings.</Text>
        <View style={styles.appearanceList}>
          {APP_MODE_OPTIONS.map((opt) => {
            const isSelected = selectedAppMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[styles.appearanceRow, isSelected && styles.appearanceRowActive]}
                onPress={() => {
                  setSelectedAppMode(opt.id);
                  Haptics.selectionAsync();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.appearanceTextGroup}>
                  <Text style={[styles.appearanceLabel, isSelected && styles.appearanceLabelActive]}>{opt.label}</Text>
                  <Text style={styles.appearanceDesc}>{opt.description}</Text>
                </View>
                <View style={[styles.appearanceRadio, isSelected && styles.appearanceRadioActive]}>
                  {isSelected && <View style={styles.appearanceRadioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  const renderSlide3 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.slideCenter}>
        <Text style={styles.setupTitle}>What should we call you?</Text>
        <Text style={styles.setupSub}>
          Only used to personalize your experience inside the app.
        </Text>
        <TextInput
          style={styles.nameInput}
          placeholder="First name"
          placeholderTextColor={previewColors.textTertiary}
          value={onboardingFirstName}
          onChangeText={setOnboardingFirstName}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <TextInput
          style={[styles.nameInput, { marginTop: 16 }]}
          placeholder="Last name"
          placeholderTextColor={previewColors.textTertiary}
          value={onboardingLastName}
          onChangeText={setOnboardingLastName}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>
    </View>
  );

  const renderSlide4 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.slideCenter}>
        <Text style={styles.setupTitle}>Who is this for?</Text>
        <Text style={styles.setupSub}>Choose the role that fits best.</Text>
        <View style={styles.appearanceList}>
          {[
            { id: "self" as const, label: "Just me", description: "Track your own medications, appointments, and symptoms" },
            { id: "caregiver" as const, label: "Helping someone", description: "Manage care for another person with a simpler view" },
          ].map((opt) => {
            const isSelected = onboardingRole === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[styles.appearanceRow, isSelected && styles.appearanceRowActive]}
                onPress={() => {
                  setOnboardingRole(opt.id);
                  void Haptics.selectionAsync().catch(() => {});
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.appearanceTextGroup}>
                  <Text style={[styles.appearanceLabel, isSelected && styles.appearanceLabelActive]}>{opt.label}</Text>
                  <Text style={styles.appearanceDesc}>{opt.description}</Text>
                </View>
                <View style={[styles.appearanceRadio, isSelected && styles.appearanceRadioActive]}>
                  {isSelected && <View style={styles.appearanceRadioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        {onboardingRole === "caregiver" ? (
          <TextInput
            style={[styles.nameInput, { marginTop: 20 }]}
            placeholder="Who are you helping?"
            placeholderTextColor={previewColors.textTertiary}
            value={onboardingCaredForName}
            onChangeText={setOnboardingCaredForName}
            autoCapitalize="words"
            returnKeyType="done"
          />
        ) : null}
      </View>
    </View>
  );

  const renderSlide5 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.slideCenter}>
        <Text style={styles.setupTitle}>Choose your appearance</Text>
        <Text style={styles.setupSub}>You can change this anytime in Settings.</Text>
        <View style={styles.appearanceList}>
          {APPEARANCE_OPTIONS.map((opt) => {
            const isSelected = selectedAppearance === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[styles.appearanceRow, isSelected && styles.appearanceRowActive]}
                onPress={() => {
                  setSelectedAppearance(opt.id);
                  void setThemeId(opt.id);
                  Haptics.selectionAsync();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.appearanceTextGroup}>
                  <Text style={[styles.appearanceLabel, isSelected && styles.appearanceLabelActive]}>{opt.label}</Text>
                  <Text style={styles.appearanceDesc}>{opt.description}</Text>
                </View>
                <View style={[styles.appearanceRadio, isSelected && styles.appearanceRadioActive]}>
                  {isSelected && <View style={styles.appearanceRadioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  const renderSlide6 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <Text style={styles.setupTitle}>Make Synapse yours.</Text>
      <Text style={styles.setupSub}>Core features like Medications, Appointments, and Vitals are already included. Please choose what else you&apos;d like to include in your health journey.</Text>
      <View style={styles.coreFeaturesCard}>
        <Text style={styles.coreFeaturesTitle}>Core features already included</Text>
        <Text style={styles.coreFeaturesText}>
          {REQUIRED_SECTION_KEYS.map((key) => SECTION_LABELS[key] ?? key).join(" • ")}
        </Text>
      </View>
      <ScrollView
        style={styles.sectionsScroll}
        contentContainerStyle={styles.sectionsScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionsList}>
          {(ALL_SECTION_KEYS as unknown as string[]).filter((key) => !REQUIRED_SECTION_KEYS.includes(key)).map((key) => {
            const label = SECTION_LABELS[key] ?? key;
            const isSelected = selectedSections.has(key);
            return (
              <Pressable
                key={key}
                style={[styles.sectionRow, isSelected && styles.sectionRowActive]}
                onPress={() => toggleSection(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${label}, ${isSelected ? "on" : "off"}`}
              >
                <Text style={[styles.sectionRowLabel, isSelected && styles.sectionRowLabelActive]}>{label}</Text>
                <View style={[styles.sectionCheckbox, isSelected && styles.sectionCheckboxActive]}>
                  {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderSlide7 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <KeyboardAvoidingView
        style={styles.authSlide}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={60}
      >
        <View style={styles.slideCenter}>
          <Text style={styles.setupTitle}>Add your medications?</Text>
          <Text style={styles.setupSub}>You can add them now or later from the Medications screen.</Text>
          <Pressable style={styles.primaryAuthBtn} onPress={() => void finishWithBiometricPrompt(true)}>
            <Text style={styles.primaryAuthBtnText}>Add Medications</Text>
          </Pressable>
          <Pressable style={styles.secondaryAuthBtn} onPress={() => void finishWithBiometricPrompt(false)}>
            <Text style={styles.secondaryAuthBtnText}>Skip</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  const renderSlide8 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.slideCenter}>
        <View style={styles.completionCircle}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <Text style={styles.completionTitle}>Synapse is ready.</Text>
        <Text style={styles.completionSub}>Your stability system. Built to prevent mistakes.</Text>
      </View>
    </View>
  );

  const renderSlide = (id: OnboardingStepId) => {
    switch (id) {
      case "intro": return renderSlide0();
      case "privacy": return renderSlide1();
      case "mode": return renderSlide2();
      case "name": return renderSlide3();
      case "role": return renderSlide4();
      case "appearance": return renderSlide5();
      case "features": return renderSlide6();
      case "addMeds": return renderSlide7();
      case "done": return renderSlide8();
      default: return null;
    }
  };

  const showBack = step > 0;
  const showContinue = step < slideCount - 1 && stepId !== "addMeds";
  const showOpenSynapse = step === slideCount - 1 && stepId !== "addMeds";
  const continueDisabled =
    (stepId === "mode" && !selectedAppMode) ||
    (stepId === "role" && onboardingRole === "caregiver" && !onboardingCaredForName.trim());

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={previewColors.background} translucent={false} />
      <View style={styles.sliderWrap}>
        <Animated.View
          style={[
            styles.sliderRow,
            {
              width: slideWidth * slideCount,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          {onboardingSteps.map((currentStepId, i) => (
            <View key={i} style={{ width: slideWidth }}>
              {renderSlide(currentStepId)}
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingHorizontal: paddingH }]}>
        <View style={styles.dotsRow}>
          {Array.from({ length: slideCount }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && styles.dotActive,
                i < step && styles.dotDone,
              ]}
            />
          ))}
        </View>
        {showBack && (
          <Pressable style={styles.backBtnFooter} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={18} color={previewColors.tint} />
            <Text style={styles.backBtnFooterText}>Back</Text>
          </Pressable>
        )}
        {showContinue && (
          <Pressable
            style={[styles.continueBtn, continueDisabled && styles.continueBtnDisabled]}
            onPress={goNext}
            disabled={continueDisabled}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: continueDisabled }}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        )}
        {showOpenSynapse && (
          <Pressable
            style={styles.continueBtn}
            onPress={() => { void finishWithBiometricPrompt(); }}
            accessibilityRole="button"
            accessibilityLabel={selectedAppMode === "simple" ? "Get started" : "Open Synapse"}
          >
            <Text style={styles.continueBtnText}>{selectedAppMode === "simple" ? "Get Started" : "Open Synapse"}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  sliderWrap: { flex: 1, overflow: "hidden" },
  sliderRow: { flexDirection: "row", flex: 1 },
  slide: { flex: 1, justifyContent: "center" },
  slideCenter: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  featureSlideBg: { backgroundColor: C.background },
  featureSlideCenter: { alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  phoneMockup: {
    width: 280,
    height: 420,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: C.surface,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  phoneMockupImage: { width: "100%", height: "100%" },
  featureCaption: {
    fontWeight: "700",
    fontSize: 24,
    textAlign: "center",
    color: C.text,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  featureSubtitle: {
    fontWeight: "400",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    color: C.textSecondary,
    marginTop: 8,
    paddingHorizontal: 24,
  },
  footer: { gap: 16, paddingBottom: 8 },
  backBtnFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  backBtnFooterText: {
    fontWeight: "600",
    fontSize: 16,
    color: C.tint,
  },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.tintLight },
  dotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.tint },
  dotDone: { backgroundColor: C.tint },

  brainLogo: { width: 180, height: 180, resizeMode: "contain" },
  welcomeTitle: {
    fontWeight: "700",
    fontSize: 36,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 12,
    marginTop: 24,
    color: C.text,
  },
  welcomeSub: {
    fontWeight: "400",
    fontSize: 18,
    textAlign: "center",
    lineHeight: 28,
    paddingHorizontal: 10,
    color: C.textSecondary,
  },

  photoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: C.tint,
    alignSelf: "center",
    marginBottom: 28,
  },
  photoImage: { width: "100%", height: "100%", resizeMode: "cover" },
  founderTitle: {
    fontWeight: "700",
    fontSize: 28,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 20,
    color: C.tint,
  },
  founderSub: {
    fontWeight: "400",
    fontSize: 18,
    textAlign: "center",
    lineHeight: 28,
    color: C.textSecondary,
    paddingHorizontal: 8,
  },

  storyBlock: {
    fontWeight: "600",
    fontSize: 22,
    lineHeight: 34,
    letterSpacing: -0.3,
    textAlign: "center",
    color: C.text,
  },

  appearanceList: { gap: 12, width: "100%", marginTop: 8 },
  appearanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  appearanceRowActive: { borderColor: C.tint, backgroundColor: C.tintLight },
  appearanceTextGroup: { flex: 1 },
  appearanceLabel: { fontWeight: "600", fontSize: 16, color: C.text },
  appearanceLabelActive: { color: C.tint },
  appearanceDesc: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  appearanceRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  appearanceRadioActive: { borderColor: C.tint },
  appearanceRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.tint },

  sectionsScroll: { flex: 1 },
  sectionsScrollContent: { paddingTop: 20, paddingBottom: 40 },
  setupTitle: {
    fontWeight: "700",
    fontSize: 28,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 8,
    color: C.text,
  },
  setupSub: {
    fontWeight: "400",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
    color: C.textSecondary,
  },
  sectionsList: { marginTop: 16, gap: 10 },
  coreFeaturesCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  coreFeaturesTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: C.tint,
    marginBottom: 4,
  },
  coreFeaturesText: {
    fontWeight: "500",
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 20,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionRowActive: {
    borderColor: C.tint,
    backgroundColor: C.tintLight,
  },
  sectionRowLabel: {
    fontWeight: "500",
    fontSize: 16,
    color: C.text,
    flex: 1,
  },
  sectionRowLabelActive: {
    color: C.tint,
    fontWeight: "600",
  },
  sectionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
  },
  sectionCheckboxActive: { backgroundColor: C.tint, borderColor: C.tint },
  medChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  medChipName: { fontWeight: "600", fontSize: 16, color: C.text },
  fieldHint: {
    fontWeight: "400",
    fontSize: 14,
    color: C.textTertiary,
    textAlign: "center",
    marginTop: 16,
  },

  ageOnboardInput: {
    fontWeight: "700",
    fontSize: 56,
    color: C.text,
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: C.tint,
    paddingVertical: 12,
    width: 160,
    marginBottom: 32,
    marginTop: 16,
  },
  authSlide: { flex: 1, justifyContent: "center" },
  authHeading: {
    fontWeight: "700",
    fontSize: 28,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 12,
    color: C.text,
  },
  authFormScroll: { paddingVertical: 20, gap: 12, alignItems: "center" },
  nameInput: {
    fontWeight: "500",
    fontSize: 18,
    color: C.text,
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: C.tint,
    paddingVertical: 12,
    width: "100%",
    maxWidth: 280,
  },
  authError: {
    fontWeight: "500",
    fontSize: 13,
    color: C.red,
    textAlign: "center",
    marginBottom: 4,
  },
  primaryAuthBtn: {
    backgroundColor: C.tint,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 8,
  },
  primaryAuthBtnText: { fontWeight: "600", fontSize: 17, color: "#fff" },
  secondaryAuthBtn: {
    paddingVertical: 14,
    alignSelf: "stretch",
    alignItems: "center",
  },
  secondaryAuthBtnText: { fontWeight: "600", fontSize: 16, color: C.textSecondary },
  skipLink: { marginTop: 16, paddingVertical: 8 },
  skipLinkText: { fontWeight: "600", fontSize: 14, color: C.cyan, textAlign: "center" },

  completionCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  completionTitle: {
    fontWeight: "700",
    fontSize: 32,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
    color: C.tint,
  },
  completionSub: {
    fontWeight: "400",
    fontSize: 18,
    textAlign: "center",
    lineHeight: 28,
    color: C.textSecondary,
  },

  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.tint,
    borderRadius: 16,
    paddingVertical: 18,
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueBtnText: { fontWeight: "600", fontSize: 17, color: "#fff" },
});
}
