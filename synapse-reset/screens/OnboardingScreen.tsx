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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { settingsStorage, healthProfileStorage, ALL_SECTION_KEYS } from "@/lib/storage";
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

export interface OnboardingCompleteOptions {
  openMedications?: boolean;
}

interface OnboardingScreenProps {
  onComplete: (options?: OnboardingCompleteOptions) => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { signIn, signUp, user } = useAuth();

  const [step, setStep] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    () => new Set(ALL_SECTION_KEYS as unknown as string[])
  );

  // Auth (slide 4): initial choice vs form vs post-signup prompt
  const [authChoice, setAuthChoice] = useState<"none" | "signin" | "signup">("none");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showAgePrompt, setShowAgePrompt] = useState(false);
  const [onboardingAge, setOnboardingAge] = useState("");
  const [showAddMedsPrompt, setShowAddMedsPrompt] = useState(false);

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
    const displayName = user?.user_metadata?.first_name ?? user?.email?.split("@")[0] ?? "";
    const enabledSections = Array.from(selectedSections);
    await settingsStorage.save({
      ...settings,
      name: displayName || "User",
      onboardingCompleted: true,
      enabledSections: enabledSections.length > 0 ? enabledSections : (ALL_SECTION_KEYS as unknown as string[]),
    });
    onComplete(openMedications ? { openMedications: true } : undefined);
  };

  const handleSkipForNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(SLIDE_COUNT - 1);
  };

  const handleAuthSubmit = async () => {
    if (!authEmail.trim() || !authPassword) {
      setAuthError("Enter email and password.");
      return;
    }
    if (authChoice === "signup" && authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    setAuthError("");
    setAuthLoading(true);
    const metadata: { first_name?: string; last_name?: string } = {};
    if (authFirstName.trim()) metadata.first_name = authFirstName.trim();
    if (authLastName.trim()) metadata.last_name = authLastName.trim();
    const { error } =
      authChoice === "signup"
        ? await signUp(authEmail.trim(), authPassword, Object.keys(metadata).length > 0 ? metadata : undefined)
        : await signIn(authEmail.trim(), authPassword);
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (authChoice === "signup") {
      setShowAgePrompt(true);
    } else {
      goNext();
    }
  };

  const handleAgeAction = async (skip: boolean) => {
    if (!skip && onboardingAge.trim()) {
      const parsed = parseInt(onboardingAge, 10);
      if (!isNaN(parsed)) {
        await healthProfileStorage.save({ age: parsed });
      }
    }
    setShowAgePrompt(false);
    setShowAddMedsPrompt(true);
  };

  const handleAddMedsChoice = (add: boolean) => {
    setShowAddMedsPrompt(false);
    if (add) {
      handleFinish(true);
    } else {
      goNext();
    }
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
    renderFeatureSlide(
      onboardingMedications,
      "Never lose track of a medication",
      "Your full medication list, refills, prescribers, and pharmacies — all in one place."
    );

  const renderSlide2 = () =>
    renderFeatureSlide(
      onboardingDashboard,
      "Your health, at a glance",
      "See your meds, appointments, fasting times, and how you're feeling — every single day."
    );

  const renderSlide3 = () =>
    renderFeatureSlide(
      onboardingAppointments,
      "Never miss an appointment",
      "Track every doctor visit, get reminders, and log what happened after."
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
        {showAgePrompt ? (
          <View style={styles.slideCenter}>
            <Text style={styles.setupTitle}>One last thing.</Text>
            <Text style={styles.setupSub}>How old are you? This helps in emergencies.</Text>
            <TextInput
              style={styles.ageOnboardInput}
              value={onboardingAge}
              onChangeText={(t) => setOnboardingAge(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="Your age"
              placeholderTextColor={C.textTertiary}
              maxLength={3}
              autoFocus
            />
            <Pressable style={[styles.primaryAuthBtn, { alignSelf: "stretch" }]} onPress={() => handleAgeAction(false)}>
              <Text style={styles.primaryAuthBtnText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.skipLink} onPress={() => handleAgeAction(true)}>
              <Text style={styles.skipLinkText}>Skip for now</Text>
            </Pressable>
          </View>
        ) : showAddMedsPrompt ? (
          <View style={styles.slideCenter}>
            <Text style={styles.setupTitle}>Add your medications?</Text>
            <Text style={styles.setupSub}>You can add them now or later from the Medications screen.</Text>
            <Pressable style={styles.primaryAuthBtn} onPress={() => handleAddMedsChoice(true)}>
              <Text style={styles.primaryAuthBtnText}>Add Medications</Text>
            </Pressable>
            <Pressable style={styles.secondaryAuthBtn} onPress={() => handleAddMedsChoice(false)}>
              <Text style={styles.secondaryAuthBtnText}>Skip</Text>
            </Pressable>
          </View>
        ) : authChoice === "none" ? (
          <View style={styles.slideCenter}>
            <Text style={styles.authHeading}>Sign in or create an account</Text>
            <Text style={styles.setupSub}>Your data is backed up securely. You can skip and sign in later.</Text>
            <Pressable
              style={styles.primaryAuthBtn}
              onPress={() => {
                setAuthChoice("signin");
                setAuthError("");
              }}
            >
              <Text style={styles.primaryAuthBtnText}>Sign In</Text>
            </Pressable>
            <Pressable
              style={styles.primaryAuthBtn}
              onPress={() => {
                setAuthChoice("signup");
                setAuthError("");
              }}
            >
              <Text style={styles.primaryAuthBtnText}>Create Account</Text>
            </Pressable>
            <Pressable style={styles.skipLink} onPress={handleSkipForNow}>
              <Text style={styles.skipLinkText}>Skip for now</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.authFormScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.authHeading}>{authChoice === "signup" ? "Create account" : "Welcome back"}</Text>
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            {authChoice === "signup" && (
              <>
                <TextInput
                  style={styles.nameInput}
                  placeholder="First name"
                  placeholderTextColor={C.textTertiary}
                  value={authFirstName}
                  onChangeText={setAuthFirstName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.nameInput}
                  placeholder="Last name"
                  placeholderTextColor={C.textTertiary}
                  value={authLastName}
                  onChangeText={setAuthLastName}
                  autoCapitalize="words"
                />
              </>
            )}
            <TextInput
              style={styles.nameInput}
              placeholder="Email"
              placeholderTextColor={C.textTertiary}
              value={authEmail}
              onChangeText={(t) => {
                setAuthEmail(t);
                setAuthError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.nameInput}
              placeholder={authChoice === "signup" ? "Password (min 6 characters)" : "Password"}
              placeholderTextColor={C.textTertiary}
              value={authPassword}
              onChangeText={(t) => {
                setAuthPassword(t);
                setAuthError("");
              }}
              secureTextEntry
            />
            <Pressable
              style={styles.secondaryAuthBtn}
              onPress={() => {
                setAuthChoice("none");
                setAuthError("");
              }}
            >
              <Text style={styles.secondaryAuthBtnText}>
                {authChoice === "signup" ? "Back" : "Back"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.primaryAuthBtn, (authLoading || !authEmail.trim() || !authPassword) && { opacity: 0.5 }]}
              onPress={handleAuthSubmit}
              disabled={authLoading || !authEmail.trim() || !authPassword}
            >
              <Text style={styles.primaryAuthBtnText}>
                {authLoading ? "..." : authChoice === "signup" ? "Create Account" : "Sign In"}
              </Text>
            </Pressable>
          </ScrollView>
        )}
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
            onPress={() => handleFinish()}
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
  container: { flex: 1, backgroundColor: C.background },
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
