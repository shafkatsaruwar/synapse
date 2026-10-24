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
  StatusBar,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { settingsStorage, healthProfileStorage, ALL_SECTION_KEYS, type AppMode } from "@/lib/storage-self";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { recordMilestone } from "@/lib/product-milestones";
import SynapseLogo from "@/components/SynapseLogo";

type OnboardingStepId = "welcome" | "name" | "firstAction";

const ONBOARDING_STEPS: OnboardingStepId[] = ["welcome", "name", "firstAction"];

export type OnboardingFirstAction = "medications" | "appointments" | "feeling" | "explore";

export interface OnboardingCompleteOptions {
  /** @deprecated Prefer firstAction */
  openMedications?: boolean;
  appMode?: AppMode;
  firstAction?: OnboardingFirstAction;
}

interface OnboardingScreenProps {
  onComplete: (options?: OnboardingCompleteOptions) => void;
}

/**
 * Simplified first-run onboarding: Welcome → Name → First useful action.
 * Theme, app mode, modules, biometrics, and walkthrough are deferred to Settings / contextual tips.
 */
export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: previewColors, themeId } = useTheme();
  const { appMode, setAppMode } = useAppMode();

  const [step, setStep] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;
  const [onboardingFirstName, setOnboardingFirstName] = useState("");
  const [finishing, setFinishing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;
  const styles = useMemo(() => makeStyles(previewColors), [previewColors]);
  const statusBarStyle = themeId === "dark" ? "light-content" : "dark-content";
  const stepId = ONBOARDING_STEPS[step];
  const slideCount = ONBOARDING_STEPS.length;

  useEffect(() => {
    Animated.timing(slideX, {
      toValue: -step * width,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [step, width, slideX]);

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

  const handleFinish = async (firstAction: OnboardingFirstAction) => {
    if (finishing) return;
    setFinishing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const [settings, profile] = await Promise.all([settingsStorage.get(), healthProfileStorage.get()]);
      const firstName = onboardingFirstName.trim();
      // Preserve existing mode/sections/theme for returning installs; default new installs to full mode
      // with all sections available (discoverable via Health hub—not forced during onboarding).
      const resolvedAppMode: AppMode = settings.appMode ?? appMode ?? "full";
      const existingSections = settings.enabledSections;
      await settingsStorage.save({
        ...settings,
        firstName: firstName || settings.firstName,
        lastName: settings.lastName,
        // Avoid awkward "You" placeholder when name is blank — leave empty for natural greetings.
        name: firstName || settings.name || "",
        onboardingCompleted: true,
        appMode: resolvedAppMode,
        enabledSections:
          existingSections && existingSections.length > 0
            ? existingSections
            : (ALL_SECTION_KEYS as unknown as string[]),
      });
      // Do not overwrite role/profile for existing users; only ensure profile exists.
      if (!profile.userRole) {
        await healthProfileStorage.save({
          ...profile,
          userRole: "self",
        });
      }
      await setAppMode(resolvedAppMode);
      await recordMilestone("onboarding_completed");
      if (firstAction !== "explore") {
        await recordMilestone("first_useful_action");
      }
      onComplete({
        firstAction,
        openMedications: firstAction === "medications",
        appMode: resolvedAppMode,
      });
    } catch {
      setFinishing(false);
      onComplete({ firstAction: "explore", appMode: "full" });
    }
  };

  const slideWidth = width;
  const paddingH = 28;

  const renderWelcome = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView
        style={styles.onboardingScroll}
        contentContainerStyle={styles.onboardingScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.onboardingPanel}>
          <View style={styles.introLogoWrap}>
            <SynapseLogo size={168} accessibilityLabel="Synapse logo" />
          </View>
          <Text style={styles.welcomeTitle}>Synapse</Text>
          <Text style={styles.headline}>Your health, a little easier to manage.</Text>
          <Text style={styles.welcomeSub}>
            Keep track of medications, appointments, and how you’re feeling—all in one place.
          </Text>
          <View style={styles.localCard}>
            <Ionicons name="phone-portrait-outline" size={20} color={previewColors.tint} />
            <Text style={styles.localCardText}>
              Your information stays on this device by default. Optional backup is available later if you want it.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderName = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView
        style={styles.onboardingScroll}
        contentContainerStyle={styles.onboardingScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="person-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.setupTitle}>What should we call you?</Text>
          <Text style={styles.setupSub}>
            Just a first name is enough. Everything else is optional and can wait.
          </Text>
          <View style={styles.formFieldCard}>
            <Text style={styles.formFieldLabel}>Preferred name (optional)</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="e.g. Sam"
              placeholderTextColor={previewColors.textTertiary}
              value={onboardingFirstName}
              onChangeText={setOnboardingFirstName}
              autoCapitalize="words"
              returnKeyType="done"
              accessibilityLabel="Preferred name, optional"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const firstActions: {
    id: OnboardingFirstAction;
    label: string;
    description: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
  }[] = [
    {
      id: "medications",
      label: "Set up my medications",
      description: "Add what you take so reminders can help",
      icon: "medical-outline",
    },
    {
      id: "appointments",
      label: "Add an appointment",
      description: "Keep your next visit easy to find",
      icon: "calendar-outline",
    },
    {
      id: "feeling",
      label: "Log how I’m feeling",
      description: "A quick check-in for mood, energy, or symptoms",
      icon: "heart-outline",
    },
  ];

  const renderFirstAction = () => (
    <View style={[styles.slide, { width: slideWidth, paddingHorizontal: paddingH }]}>
      <ScrollView
        style={styles.onboardingScroll}
        contentContainerStyle={styles.onboardingScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingHeroBadge}>
            <Ionicons name="sparkles-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.setupTitle}>What would help right now?</Text>
          <Text style={styles.setupSub}>Pick one useful starting point, or explore on your own.</Text>
          <View style={styles.actionList}>
            {firstActions.map((action) => (
              <Pressable
                key={action.id}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                onPress={() => void handleFinish(action.id)}
                disabled={finishing}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon} size={22} color={previewColors.tint} />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                  <Text style={styles.actionDesc}>{action.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={previewColors.textTertiary} />
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.exploreBtn}
            onPress={() => void handleFinish("explore")}
            disabled={finishing}
            accessibilityRole="button"
            accessibilityLabel="I’ll explore on my own"
          >
            <Text style={styles.exploreBtnText}>I’ll explore on my own</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );

  const renderSlide = (id: OnboardingStepId) => {
    switch (id) {
      case "welcome":
        return renderWelcome();
      case "name":
        return renderName();
      case "firstAction":
        return renderFirstAction();
      default:
        return null;
    }
  };

  const showBack = step > 0;
  const showContinue = step < slideCount - 1;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topPad, paddingBottom: bottomPad, backgroundColor: previewColors.background },
      ]}
    >
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
          {ONBOARDING_STEPS.map((currentStepId, i) => (
            <View key={currentStepId} style={{ width: slideWidth }}>
              {i === step || Math.abs(i - step) <= 1 ? renderSlide(currentStepId) : null}
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingHorizontal: paddingH }]}>
        <View style={styles.dotsRow}>
          {Array.from({ length: slideCount }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
            />
          ))}
        </View>
        {showBack ? (
          <Pressable style={styles.backBtnFooter} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={18} color={previewColors.tint} />
            <Text style={styles.backBtnFooterText}>Back</Text>
          </Pressable>
        ) : null}
        {showContinue ? (
          <Pressable
            style={styles.continueBtn}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        ) : null}
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
    onboardingScroll: { flex: 1 },
    onboardingScrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingTop: 20,
      paddingBottom: 140,
    },
    onboardingPanel: {
      alignItems: "center",
      justifyContent: "center",
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
    introLogoWrap: {
      width: 200,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    welcomeTitle: {
      fontWeight: "700",
      fontSize: 36,
      textAlign: "center",
      letterSpacing: -0.5,
      marginBottom: 12,
      color: C.text,
    },
    headline: {
      fontWeight: "700",
      fontSize: 22,
      textAlign: "center",
      letterSpacing: -0.3,
      lineHeight: 30,
      marginBottom: 12,
      paddingHorizontal: 8,
      color: C.text,
    },
    welcomeSub: {
      fontWeight: "400",
      fontSize: 17,
      textAlign: "center",
      lineHeight: 26,
      paddingHorizontal: 10,
      color: C.textSecondary,
      marginBottom: 20,
    },
    localCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      width: "100%",
      maxWidth: 360,
      backgroundColor: C.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    localCardText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 21,
      color: C.textSecondary,
    },
    setupTitle: {
      fontWeight: "800",
      fontSize: 28,
      letterSpacing: -0.6,
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
    nameInput: {
      fontWeight: "500",
      fontSize: 18,
      color: C.text,
      textAlign: "left",
      paddingVertical: 8,
      width: "100%",
    },
    actionList: { width: "100%", gap: 10, marginTop: 4 },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      width: "100%",
      backgroundColor: C.surface,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    actionRowPressed: {
      borderColor: C.tint,
      backgroundColor: C.tintLight,
    },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: C.tintLight,
      alignItems: "center",
      justifyContent: "center",
    },
    actionText: { flex: 1, gap: 2 },
    actionLabel: { fontWeight: "600", fontSize: 16, color: C.text },
    actionDesc: { fontWeight: "400", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    exploreBtn: {
      marginTop: 18,
      paddingVertical: 14,
      alignSelf: "stretch",
      alignItems: "center",
    },
    exploreBtnText: { fontWeight: "600", fontSize: 16, color: C.textSecondary },
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
    continueBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: C.tint,
      borderRadius: 16,
      paddingVertical: 18,
    },
    continueBtnText: { fontWeight: "600", fontSize: 17, color: "#fff" },
  });
}
