import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  useWindowDimensions,
  Animated,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { settingsStorage, healthProfileStorage, ALL_SECTION_KEYS } from "@/lib/storage";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { setBiometricLockEnabled } from "@/lib/biometric-storage";
import SynapseLogo from "@/components/SynapseLogo";

const founderImage = require("../assets/images/founder.png");

const onboardingMedications = require("../assets/onboarding/medications.png");
const onboardingDashboard = require("../assets/onboarding/dashboard.png");
const onboardingAppointments = require("../assets/onboarding/appointments.png");

const C = Colors.dark;
const CREAM_BG = "#FDF1E5";
const MAROON = "#800020";
const MAROON_LIGHT = "rgba(128,0,32,0.12)";

const SECTION_LABELS: Record<string, string> = {
  log: "Daily Log",
  healthdata: "Health Data",
  medications: "Medications",
  symptoms: "Symptoms",
  monthlycheckin: "Monthly check-in",
  eating: "Eating",
  mentalhealth: "Mental health day",
  comfort: "Mood lifters",
  goals: "Goals",
  appointments: "Appointments",
  reports: "Reports",
  privacy: "Privacy",
};

const SLIDE_COUNT = 7;

const APPEARANCE_OPTIONS: { id: ThemePreference; label: string; description: string }[] = [
  { id: "system", label: "System", description: "Follows your device setting" },
  { id: "calm", label: "Calm", description: "Warm cream tones" },
  { id: "light", label: "Light", description: "Clean blue-white" },
  { id: "dark", label: "Dark", description: "Easy on the eyes at night" },
];

export interface OnboardingCompleteOptions {
  openMedications?: boolean;
}

interface OnboardingScreenProps {
  onComplete: (options?: OnboardingCompleteOptions) => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { setThemeId } = useTheme();

  const [step, setStep] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    () => new Set(ALL_SECTION_KEYS as unknown as string[])
  );

  const [onboardingFirstName, setOnboardingFirstName] = useState("");
  const [onboardingLastName, setOnboardingLastName] = useState("");
  const [selectedAppearance, setSelectedAppearance] = useState<ThemePreference>("system");

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  useEffect(() => {
    Animated.timing(slideX, {
      toValue: -step * width,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [step, width]);

  const goNext = () => {
    if (step < SLIDE_COUNT - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s + 1);
    }
  };

  const toggleSection = (key: string) => {
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
    const settings = await settingsStorage.get();
    const enabledSections = Array.from(selectedSections);
    const firstName = onboardingFirstName.trim();
    const lastName = onboardingLastName.trim();
    await settingsStorage.save({
      ...settings,
      firstName: firstName || settings.firstName,
      lastName: lastName || settings.lastName,
      name: [firstName, lastName].filter(Boolean).join(" ") || settings.name || "You",
      onboardingCompleted: true,
      enabledSections: enabledSections.length > 0 ? enabledSections : (ALL_SECTION_KEYS as unknown as string[]),
    });
    await setThemeId(selectedAppearance);
    onComplete(openMedications ? { openMedications: true } : undefined);
  };

  const handleSkipForNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(SLIDE_COUNT - 1);
  };

  const slideWidth = width;
  const paddingH = 28;

  const renderSlide0 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <View style={styles.slideCenter}>
        <View style={styles.brainLogo}>
          <SynapseLogo size={180} color={MAROON} />
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
        <Text style={styles.setupTitle}>What should we call you?</Text>
        <Text style={styles.setupSub}>
          Only used to personalize your experience inside the app.
        </Text>
        <TextInput
          style={styles.nameInput}
          placeholder="First name"
          placeholderTextColor={C.textTertiary}
          value={onboardingFirstName}
          onChangeText={setOnboardingFirstName}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <TextInput
          style={[styles.nameInput, { marginTop: 16 }]}
          placeholder="Last name"
          placeholderTextColor={C.textTertiary}
          value={onboardingLastName}
          onChangeText={setOnboardingLastName}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>
    </View>
  );

  const renderSlide3 = () => (
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

  const renderSlide4 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <Text style={styles.setupTitle}>Make Synapse yours.</Text>
      <Text style={styles.setupSub}>Choose what matters to you. You can always change this later.</Text>
      <ScrollView
        style={styles.sectionsScroll}
        contentContainerStyle={styles.sectionsScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionsList}>
          {(ALL_SECTION_KEYS as unknown as string[]).map((key) => {
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

  const renderSlide5 = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <KeyboardAvoidingView
        style={styles.authSlide}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={60}
      >
        <View style={styles.slideCenter}>
          <Text style={styles.setupTitle}>Add your medications?</Text>
          <Text style={styles.setupSub}>You can add them now or later from the Medications screen.</Text>
          <Pressable style={styles.primaryAuthBtn} onPress={() => handleFinish(true)}>
            <Text style={styles.primaryAuthBtnText}>Add Medications</Text>
          </Pressable>
          <Pressable style={styles.secondaryAuthBtn} onPress={() => handleFinish(false)}>
            <Text style={styles.secondaryAuthBtnText}>Skip</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  const renderSlide6 = () => (
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

  const slides = [renderSlide0, renderSlide1, renderSlide2, renderSlide3, renderSlide4, renderSlide5, renderSlide6];

  const showContinue = step < SLIDE_COUNT - 1 && step !== 5;
  const showOpenSynapse = step === SLIDE_COUNT - 1;

  return (
    <View style={[styles.container, styles.containerCream, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <StatusBar barStyle="dark-content" backgroundColor={CREAM_BG} translucent={false} />
      <View style={styles.sliderWrap}>
        <Animated.View
          style={[
            styles.sliderRow,
            {
              width: slideWidth * SLIDE_COUNT,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          {slides.map((render, i) => (
            <View key={i} style={{ width: slideWidth }}>
              {render()}
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingHorizontal: paddingH }]}>
        <View style={styles.dotsRow}>
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
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
        {showContinue && (
          <Pressable style={styles.continueBtn} onPress={goNext} accessibilityRole="button" accessibilityLabel="Continue">
            <Text style={styles.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        )}
        {showOpenSynapse && (
          <Pressable
            style={styles.continueBtn}
            onPress={() => {
              if (Platform.OS === "ios" || Platform.OS === "android") {
                Alert.alert(
                  "Enable Face ID / Touch ID?",
                  "Lock the app when opening so only you can access it. You can change this later in Settings → Privacy.",
                  [
                    { text: "Not now", style: "cancel", onPress: () => handleFinish() },
                    { text: "Enable", onPress: async () => {
                      await setBiometricLockEnabled(true);
                      handleFinish();
                    } },
                  ]
                );
              } else {
                handleFinish();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Synapse"
          >
            <Text style={styles.continueBtnText}>Open Synapse</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  containerCream: { backgroundColor: CREAM_BG },
  sliderWrap: { flex: 1, overflow: "hidden" },
  sliderRow: { flexDirection: "row", flex: 1 },
  slide: { flex: 1, justifyContent: "center" },
  slideCenter: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  featureSlideBg: { backgroundColor: CREAM_BG },
  featureSlideCenter: { alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  phoneMockup: {
    width: 280,
    height: 420,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#fff",
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

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(128,0,32,0.2)" },
  dotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: MAROON },
  dotDone: { backgroundColor: "rgba(128,0,32,0.4)" },

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
    borderColor: MAROON,
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
    color: MAROON,
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
  appearanceRowActive: { borderColor: MAROON, backgroundColor: MAROON_LIGHT },
  appearanceTextGroup: { flex: 1 },
  appearanceLabel: { fontWeight: "600", fontSize: 16, color: C.text },
  appearanceLabelActive: { color: MAROON },
  appearanceDesc: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  appearanceRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  appearanceRadioActive: { borderColor: MAROON },
  appearanceRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: MAROON },

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
    borderColor: MAROON,
    backgroundColor: MAROON_LIGHT,
  },
  sectionRowLabel: {
    fontWeight: "500",
    fontSize: 16,
    color: C.text,
    flex: 1,
  },
  sectionRowLabelActive: {
    color: MAROON,
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
  sectionCheckboxActive: { backgroundColor: MAROON, borderColor: MAROON },
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
    borderBottomColor: MAROON,
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
    borderBottomColor: MAROON,
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
    backgroundColor: MAROON,
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
    backgroundColor: MAROON,
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
    color: MAROON,
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
    backgroundColor: MAROON,
    borderRadius: 16,
    paddingVertical: 18,
  },
  continueBtnText: { fontWeight: "600", fontSize: 17, color: "#fff" },
});
