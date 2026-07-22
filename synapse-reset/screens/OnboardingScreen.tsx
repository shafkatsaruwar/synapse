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

const founderImage = require("../assets/images/founder.png");
const onboardingBrain = require("../assets/images/brain-logo.png");

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
  | "founder"
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
  "founder",
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
  "founder",
  "privacy",
  "mode",
  "name",
  "role",
];

const APP_MODE_OPTIONS: { id: AppMode; label: string; description: string }[] = [
  { id: "simple", label: "Simple Mode", description: "Bigger text, bigger buttons, and a simpler setup for the screens you use most" },
  { id: "full", label: "Full Mode", description: "See everything and track more details" },
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
      <View style={styles.onboardingHeroScreen}>
        <View style={styles.introBrainWrap}>
          <Image source={onboardingBrain} style={styles.introBrainImage} resizeMode="contain" />
        </View>
        <Text style={styles.welcomeTitle}>Synapse</Text>
        <Text style={styles.welcomeSub}>Built by a real patient, for real patients</Text>
        <View style={styles.introPromiseRow}>
          {[
            { icon: "shield-checkmark-outline" as const, label: "Private" },
            { icon: "medical-outline" as const, label: "Practical" },
            { icon: "sparkles-outline" as const, label: "Made for real life" },
          ].map((item) => (
            <View key={item.label} style={styles.introPromiseChip}>
              <Ionicons name={item.icon} size={14} color={previewColors.tint} />
              <Text style={styles.introPromiseText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderFounderSlide = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView
        style={styles.onboardingScroll}
        contentContainerStyle={styles.onboardingScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="heart-outline" size={28} color="#fff" />
          </View>
          <View style={styles.photoCircle}>
            <Image source={founderImage} style={styles.photoImage} />
          </View>
          <Text style={styles.founderTitle}>Meet the founder</Text>
          <Text style={styles.founderSub}>
            Synapse was built by a real patient who wanted something calmer, clearer, and actually helpful day to day.
          </Text>
          <View style={styles.modeCallout}>
            <Text style={styles.modeCalloutTitle}>Why this exists</Text>
            <Text style={styles.modeCalloutText}>
              Too many health apps feel cold, cluttered, or made for everybody except the people actually carrying the stress. Synapse is built to feel human.
            </Text>
          </View>
          <Text style={styles.storyBlock}>
            Less chaos. Fewer mistakes. More support when life is already hard enough.
          </Text>
        </View>
      </ScrollView>
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
        <ScrollView
          style={styles.privacyScroll}
          contentContainerStyle={styles.privacyScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.privacySlide}>
            <View style={styles.privacyHeroWrap}>
              <View style={styles.privacyGlowLarge} />
              <View style={styles.privacyGlowSmall} />
              <View style={styles.privacyHeroCard}>
                <View style={styles.privacyHeroDevice}>
                  <View style={styles.privacyHeroDeviceTop}>
                    <View style={styles.privacyHeroDot} />
                    <View style={styles.privacyHeroPill} />
                    <View style={styles.privacyHeroDotMuted} />
                  </View>
                  <View style={styles.privacyShieldBadge}>
                    <Ionicons name="shield-checkmark" size={28} color="#fff" />
                  </View>
                  <View style={styles.privacyHeroLine} />
                  <View style={[styles.privacyHeroLine, styles.privacyHeroLineShort]} />
                  <View style={styles.privacyHeroFooterRow}>
                    <View style={styles.privacyHeroChip}>
                      <Ionicons name="phone-portrait-outline" size={14} color={previewColors.tint} />
                      <Text style={styles.privacyHeroChipText}>On this device</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.privacyContent}>
              <Text style={styles.privacyTitle}>Your data stays with you</Text>
              <Text style={styles.privacyIntro}>
                Synapse keeps this simple: private by default, local by default, and built to feel safe.
              </Text>

              <View style={styles.privacyPromiseStack}>
                {[
                  {
                    icon: "person-circle-outline" as const,
                    title: "No account needed",
                    body: "You can use Synapse without signing up first.",
                  },
                  {
                    icon: "phone-portrait-outline" as const,
                    title: "Stays on this device",
                    body: "What you add stays here unless you choose otherwise later.",
                  },
                  {
                    icon: "lock-closed-outline" as const,
                    title: "Not sent or shared",
                    body: "We do not send or share your health info.",
                  },
                ].map((item) => (
                  <View key={item.title} style={styles.privacyPromiseCard}>
                    <View style={styles.privacyPromiseIcon}>
                      <Ionicons name={item.icon} size={20} color={previewColors.tint} />
                    </View>
                    <View style={styles.privacyPromiseText}>
                      <Text style={styles.privacyPromiseTitle}>{item.title}</Text>
                      <Text style={styles.privacyPromiseBody}>{item.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );

  const renderSlide2 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView style={styles.onboardingScroll} contentContainerStyle={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="layers-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.setupTitle}>How do you want to use Synapse?</Text>
          <Text style={styles.setupSub}>Pick the version that feels easiest right now. You can switch later in Settings.</Text>
          <View style={styles.modeCallout}>
            <Text style={styles.modeCalloutTitle}>Quick difference</Text>
            <Text style={styles.modeCalloutText}>Simple Mode trims the app down to the essentials. Full Mode gives you the whole health-tracking system.</Text>
          </View>
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
      </ScrollView>
    </View>
  );

  const renderSlide3 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView style={styles.onboardingScroll} contentContainerStyle={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="person-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.setupTitle}>What should we call you?</Text>
          <Text style={styles.setupSub}>
            This stays inside the app and just makes things feel more personal.
          </Text>
          <View style={styles.formStack}>
            <View style={styles.formFieldCard}>
              <Text style={styles.formFieldLabel}>First name</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="First name"
                placeholderTextColor={previewColors.textTertiary}
                value={onboardingFirstName}
                onChangeText={setOnboardingFirstName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            <View style={styles.formFieldCard}>
              <Text style={styles.formFieldLabel}>Last name</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Last name"
                placeholderTextColor={previewColors.textTertiary}
                value={onboardingLastName}
                onChangeText={setOnboardingLastName}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderSlide4 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView style={styles.onboardingScroll} contentContainerStyle={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="people-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.setupTitle}>Who is this for?</Text>
          <Text style={styles.setupSub}>Choose the role that fits best right now.</Text>
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
            <View style={[styles.formFieldCard, styles.roleFollowupCard]}>
              <Text style={styles.formFieldLabel}>Who are you helping?</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Name"
                placeholderTextColor={previewColors.textTertiary}
                value={onboardingCaredForName}
                onChangeText={setOnboardingCaredForName}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );

  const renderSlide5 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView style={styles.onboardingScroll} contentContainerStyle={styles.onboardingScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="color-palette-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.setupTitle}>Choose your appearance</Text>
          <Text style={styles.setupSub}>Pick the vibe that feels best. You can switch it anytime later.</Text>
          <View style={styles.themePreviewCard}>
            <View style={styles.themePreviewHeader}>
              <View style={[styles.themePreviewDot, { backgroundColor: previewColors.tint }]} />
              <View style={[styles.themePreviewDot, { backgroundColor: previewColors.orange }]} />
              <View style={[styles.themePreviewDot, { backgroundColor: previewColors.cyan }]} />
            </View>
            <View style={[styles.themePreviewBlock, { backgroundColor: previewColors.surface }]} />
            <View style={[styles.themePreviewLine, { backgroundColor: previewColors.border }]} />
            <View style={[styles.themePreviewLineShort, { backgroundColor: previewColors.tintLight }]} />
          </View>
          <View style={styles.appearanceList}>
            {APPEARANCE_OPTIONS.map((opt) => {
              const isSelected = selectedAppearance === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.appearanceRow, isSelected && styles.appearanceRowActive]}
                  onPress={() => {
                    setSelectedAppearance(opt.id);
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
      </ScrollView>
    </View>
  );

  const renderSlide6 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView
        style={styles.onboardingScroll}
        contentContainerStyle={styles.featureScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="sparkles-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.setupTitle}>Make Synapse yours.</Text>
          <Text style={styles.setupSub}>The core health tools are already included. Add the extras that actually fit your life.</Text>
          <View style={styles.coreFeaturesCard}>
            <Text style={styles.coreFeaturesTitle}>Already included</Text>
            <Text style={styles.coreFeaturesText}>
              {REQUIRED_SECTION_KEYS.map((key) => SECTION_LABELS[key] ?? key).join(" • ")}
            </Text>
          </View>
          <View style={styles.sectionsList}>
            {(ALL_SECTION_KEYS as unknown as string[]).filter((key) => !REQUIRED_SECTION_KEYS.includes(key)).map((key) => {
              const label = SECTION_LABELS[key] ?? key;
              const isSelected = selectedSections.has(key);
              return (
                <Pressable
                  key={key}
                  style={[styles.featureOptionRow, isSelected && styles.featureOptionRowActive]}
                  onPress={() => toggleSection(key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${label}, ${isSelected ? "on" : "off"}`}
                >
                  <View style={styles.featureOptionTextWrap}>
                    <Text style={[styles.featureOptionLabel, isSelected && styles.featureOptionLabelActive]}>{label}</Text>
                  </View>
                  <View style={[styles.featureOptionCheckWrap, isSelected && styles.featureOptionCheckWrapActive]}>
                    <View style={[styles.sectionCheckbox, isSelected && styles.sectionCheckboxActive]}>
                      {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
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
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="medical-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.setupTitle}>Add your medications?</Text>
          <Text style={styles.setupSub}>You can set them up now so Synapse starts being useful immediately, or skip and do it later.</Text>
          <View style={styles.medicationStartCard}>
            <View style={styles.medicationStartPills}>
              <Text style={styles.medicationStartEmoji}>💊</Text>
              <Text style={styles.medicationStartEmoji}>🩺</Text>
              <Text style={styles.medicationStartEmoji}>⏰</Text>
            </View>
            <Text style={styles.medicationStartTitle}>Good first step</Text>
            <Text style={styles.medicationStartBody}>Adding meds now helps with reminders, tracking, and building your dashboard faster.</Text>
          </View>
          <Pressable style={styles.primaryAuthBtn} onPress={() => void finishWithBiometricPrompt(true)}>
            <Text style={styles.primaryAuthBtnText}>Add Medications</Text>
          </Pressable>
          <Pressable style={styles.secondaryAuthBtn} onPress={() => void finishWithBiometricPrompt(false)}>
            <Text style={styles.secondaryAuthBtnText}>Skip for now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  const renderSlide8 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.onboardingHeroScreen}>
        <View style={styles.completionGlow} />
        <View style={styles.completionCircle}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <View style={styles.completionChipRow}>
          {["Ready", "Private", "Personalized"].map((label) => (
            <View key={label} style={styles.completionChip}>
              <Text style={styles.completionChipText}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.completionTitle}>Synapse is ready.</Text>
        <Text style={styles.completionSub}>Your stability system. Built to prevent mistakes.</Text>
      </View>
    </View>
  );

  const renderSlide = (id: OnboardingStepId) => {
    switch (id) {
      case "intro": return renderSlide0();
      case "founder": return renderFounderSlide();
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
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad, backgroundColor: previewColors.background }]}>
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
  container: { flex: 1, backgroundColor: "transparent" },
  sliderWrap: { flex: 1, overflow: "hidden" },
  sliderRow: { flexDirection: "row", flex: 1 },
  slide: { flex: 1, justifyContent: "center" },
  slideCenter: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  onboardingScroll: { flex: 1 },
  onboardingScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: 20,
    paddingBottom: 140,
  },
  featureScrollContent: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 150,
  },
  onboardingPanel: {
    alignItems: "center",
    justifyContent: "center",
  },
  onboardingHeroScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  onboardingHeroBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  introBrainWrap: {
    width: 435,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    paddingVertical: 0,
  },
  introPromiseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },
  introPromiseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  introPromiseText: {
    fontWeight: "600",
    fontSize: 12,
    color: C.textSecondary,
  },
  privacyScroll: { flex: 1 },
  privacyScrollContent: {
    flexGrow: 1,
    paddingTop: 18,
    paddingBottom: 160,
  },
  privacySlide: { flex: 1, justifyContent: "center", paddingVertical: 10 },
  privacyHeroWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
    minHeight: 250,
  },
  privacyGlowLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.tintLight,
    opacity: 0.9,
  },
  privacyGlowSmall: {
    position: "absolute",
    top: 26,
    right: 72,
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: C.surface,
    opacity: 0.95,
  },
  privacyHeroCard: {
    width: 238,
    height: 210,
    borderRadius: 34,
    padding: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.12,
        shadowRadius: 30,
      },
      android: { elevation: 10 },
    }),
  },
  privacyHeroDevice: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderLight,
    padding: 16,
    alignItems: "center",
  },
  privacyHeroDeviceTop: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  privacyHeroDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.tint,
  },
  privacyHeroDotMuted: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.border,
  },
  privacyHeroPill: {
    width: 74,
    height: 10,
    borderRadius: 999,
    backgroundColor: C.border,
  },
  privacyShieldBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  privacyHeroLine: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: C.surface,
    marginBottom: 10,
  },
  privacyHeroLineShort: {
    width: "72%",
  },
  privacyHeroFooterRow: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  privacyHeroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.tintLight,
  },
  privacyHeroChipText: {
    fontWeight: "700",
    fontSize: 12,
    color: C.tint,
  },
  privacyContent: {
    alignItems: "center",
  },
  privacyTitle: {
    fontWeight: "800",
    fontSize: 31,
    lineHeight: 38,
    textAlign: "center",
    letterSpacing: -0.8,
    color: C.text,
    marginBottom: 10,
  },
  privacyIntro: {
    maxWidth: 320,
    fontWeight: "400",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: C.textSecondary,
    marginBottom: 22,
  },
  privacyPromiseStack: {
    width: "100%",
    gap: 12,
    maxWidth: 360,
  },
  privacyPromiseCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  privacyPromiseIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.tintLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  privacyPromiseText: {
    flex: 1,
    alignItems: "flex-start",
  },
  privacyPromiseTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: C.text,
    marginBottom: 4,
  },
  privacyPromiseBody: {
    fontWeight: "400",
    fontSize: 14,
    lineHeight: 21,
    color: C.textSecondary,
  },
  featureSlideBg: { backgroundColor: "transparent" },
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

  introBrainImage: {
    width: 435,
    height: 320,
  },
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
  modeCallout: {
    width: "100%",
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  modeCalloutTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: C.tint,
    marginBottom: 4,
  },
  modeCalloutText: {
    fontWeight: "400",
    fontSize: 14,
    lineHeight: 21,
    color: C.textSecondary,
  },
  formStack: {
    width: "100%",
    gap: 14,
    marginTop: 6,
  },
  formFieldCard: {
    width: "100%",
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  formFieldLabel: {
    fontWeight: "700",
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 10,
  },
  roleFollowupCard: {
    marginTop: 18,
  },
  themePreviewCard: {
    width: "100%",
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 18,
  },
  themePreviewHeader: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  themePreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  themePreviewBlock: {
    width: "100%",
    height: 88,
    borderRadius: 16,
    marginBottom: 14,
  },
  themePreviewLine: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  themePreviewLineShort: {
    width: "70%",
    height: 10,
    borderRadius: 999,
  },
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
    fontWeight: "800",
    fontSize: 30,
    letterSpacing: -0.8,
    textAlign: "center",
    marginBottom: 10,
    color: C.text,
  },
  setupSub: {
    fontWeight: "400",
    fontSize: 16,
    textAlign: "center",
    maxWidth: 340,
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
  featureOptionRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  featureOptionRowActive: {
    borderColor: C.tint,
    backgroundColor: C.tintLight,
  },
  featureOptionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  featureOptionLabel: {
    fontWeight: "600",
    fontSize: 16,
    color: C.text,
  },
  featureOptionLabelActive: {
    color: C.tint,
  },
  featureOptionCheckWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureOptionCheckWrapActive: {
    borderColor: C.tint,
    backgroundColor: C.surface,
  },
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
    textAlign: "left",
    paddingVertical: 8,
    width: "100%",
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
    marginTop: 14,
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
    marginBottom: 22,
  },
  completionGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.tintLight,
    opacity: 0.95,
    top: 120,
  },
  completionChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 22,
  },
  completionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  completionChipText: {
    fontWeight: "700",
    fontSize: 12,
    color: C.tint,
  },
  completionTitle: {
    fontWeight: "800",
    fontSize: 32,
    textAlign: "center",
    letterSpacing: -0.8,
    marginBottom: 10,
    color: C.text,
  },
  completionSub: {
    fontWeight: "400",
    fontSize: 18,
    textAlign: "center",
    lineHeight: 28,
    color: C.textSecondary,
  },
  medicationStartCard: {
    width: "100%",
    backgroundColor: C.surface,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 6,
    marginBottom: 8,
    alignItems: "center",
  },
  medicationStartPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  medicationStartEmoji: {
    fontSize: 28,
  },
  medicationStartTitle: {
    fontWeight: "800",
    fontSize: 20,
    color: C.text,
    marginBottom: 6,
  },
  medicationStartBody: {
    fontWeight: "400",
    fontSize: 15,
    lineHeight: 23,
    color: C.textSecondary,
    textAlign: "center",
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
