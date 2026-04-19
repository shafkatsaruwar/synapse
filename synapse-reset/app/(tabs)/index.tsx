import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, Platform, AppState, Linking, Modal, Pressable, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import SidebarLayout from "@/components/SidebarLayout";
import TabletSidebar from "@/components/TabletSidebar";
import { useIsTablet } from "@/lib/device";
import SickModeHeaderButton from "@/components/SickModeHeaderButton";
import DashboardScreen from "@/screens/DashboardScreen";
import DailyLogScreen from "@/screens/DailyLogScreen";
import MedicationsScreen from "@/screens/MedicationsScreen";
import SymptomsScreen from "@/screens/SymptomsScreen";
import AppointmentsScreen from "@/screens/AppointmentsScreen";
import MonthlyCheckInScreen from "@/screens/MonthlyCheckInScreen";
import EatingScreen from "@/screens/EatingScreen";
import MentalHealthModeScreen from "@/screens/MentalHealthModeScreen";
import ComfortScreen from "@/screens/ComfortScreen";
import GoalsScreen from "@/screens/GoalsScreen";
import ReportsScreen from "@/screens/ReportsScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import HealthDataScreen from "@/screens/HealthDataScreen";
import DocumentsScreen from "@/screens/DocumentsScreen";
import InsightsScreen from "@/screens/InsightsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import SickModeScreen from "@/screens/SickModeScreen";
import RamadanScreen from "@/screens/RamadanScreen";
import HealthProfileScreen from "@/screens/HealthProfileScreen";
import HealthProfileConditionsScreen from "@/screens/HealthProfileConditionsScreen";
import AllergyScreen from "@/screens/AllergyScreen";
import DoctorsScreen from "@/screens/DoctorsScreen";
import PharmaciesScreen from "@/screens/PharmaciesScreen";
import CycleTrackingScreen from "@/screens/CycleTrackingScreen";
import RamadanDailyLogScreen from "@/screens/RamadanDailyLogScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import EmergencyProtocolScreen from "@/screens/EmergencyProtocolScreen";
import EmergencyCardScreen from "@/screens/EmergencyCardScreen";
import MeetFounderScreen from "@/screens/MeetFounderScreen";
import FeedbackScreen from "@/screens/FeedbackScreen";
import { settingsStorage } from "@/lib/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  requestPermission,
  getPermissionStatus,
  syncAllFromSettings,
  setNotificationNavigateCallback,
  handleLastNotificationResponse,
} from "@/lib/notification-manager";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import AppBackground from "@/components/AppBackground";
import BiometricGate from "@/components/BiometricGate";
import AppWalkthrough from "@/components/AppWalkthrough";
import { getHasSeenWalkthrough, setHasSeenWalkthrough } from "@/lib/walkthrough-storage";
import { WalkthroughProvider } from "@/contexts/WalkthroughContext";
import {
  markFeedbackPromptCompleted,
  markFeedbackPromptDismissed,
  shouldShowFeedbackPrompt,
  trackFeedbackAppOpen,
  trackFeedbackWidgetLaunch,
} from "@/lib/feedback-service";
import type { FeedbackSentiment } from "@/lib/storage";
import { useAppMode } from "@/contexts/AppModeContext";

export default function MainScreen() {
  const isTablet = useIsTablet();
  const { isSimpleMode } = useAppMode();
  const { widgetTarget } = useLocalSearchParams<{ widgetTarget?: string | string[] }>();
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sickMode, setSickMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStepId, setWalkthroughStepId] = useState<string | null>(null);
  const [walkthroughMenuOpen, setWalkthroughMenuOpen] = useState<boolean | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showSimpleModeTour, setShowSimpleModeTour] = useState(false);
  const [simpleModeTourStep, setSimpleModeTourStep] = useState(0);
  const [openAppearanceModalToken, setOpenAppearanceModalToken] = useState(0);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [suppressPostOnboardingPrompts, setSuppressPostOnboardingPrompts] = useState(false);
  const [feedbackInitialSentiment, setFeedbackInitialSentiment] = useState<FeedbackSentiment | null>(null);
  const [feedbackEntrySource, setFeedbackEntrySource] = useState<"settings" | "prompt">("settings");
  const [simpleAddMedicationToken, setSimpleAddMedicationToken] = useState(0);
  const [simpleAddAppointmentToken, setSimpleAddAppointmentToken] = useState(0);
  const [simpleAddSymptomToken, setSimpleAddSymptomToken] = useState(0);

  const navigateToWidgetTarget = useCallback((url: string | null | undefined) => {
    if (!url) return false;

    try {
      const parsed = new URL(url);
      const queryTarget = parsed.searchParams.get("widgetTarget");
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const route = queryTarget || (parsed.host === "widget" ? pathParts[0] : parsed.host);

      if (route === "medications" || route === "appointments") {
        setActiveScreen(route);
        setRefreshKey((k) => k + 1);
        trackFeedbackWidgetLaunch().catch(() => {});
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }, []);

  const checkInitialState = useCallback(async () => {
    try {
      const settings = await settingsStorage.get();
      setSickMode(settings?.sickMode ?? false);
      setShowOnboarding(!settings?.onboardingCompleted);
    } catch {
      setShowOnboarding(true);
      setSickMode(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => checkInitialState(), 200);
    return () => clearTimeout(id);
  }, [checkInitialState]);

  const NOTIFICATION_ASKED_KEY = "notification_permission_asked";
  const appVersion = Constants.expoConfig?.version ?? "dev";
  const appBuild = Constants.expoConfig?.ios?.buildNumber ?? "dev";
  const WHATS_NEW_SEEN_KEY = `whats_new_seen_${appVersion}_${appBuild}`;
  const FEEDBACK_VERSION_KEY = `${appVersion}_${appBuild}`;

  useEffect(() => {
    if (showOnboarding !== false) return;
    trackFeedbackAppOpen().catch(() => {});
  }, [showOnboarding]);

  useEffect(() => {
    if (showOnboarding !== false || showWalkthrough || showSimpleModeTour || showWhatsNew || showFeedbackPrompt || suppressPostOnboardingPrompts) return;
    if (activeScreen !== "dashboard") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const shouldPrompt = await shouldShowFeedbackPrompt(FEEDBACK_VERSION_KEY);
      if (!cancelled && shouldPrompt) {
        setShowFeedbackPrompt(true);
      }
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [FEEDBACK_VERSION_KEY, activeScreen, showFeedbackPrompt, showOnboarding, showSimpleModeTour, showWalkthrough, showWhatsNew, suppressPostOnboardingPrompts]);

  useEffect(() => {
    if (showOnboarding !== false || suppressPostOnboardingPrompts) return;
    let mounted = true;
    (async () => {
      if (Platform.OS !== "ios" && Platform.OS !== "android") return;
      try {
        const asked = await AsyncStorage.getItem(NOTIFICATION_ASKED_KEY);
        if (asked === "true") {
          syncAllFromSettings();
          return;
        }
        const status = await getPermissionStatus();
        if (status !== "undetermined") {
          syncAllFromSettings();
          return;
        }
        Alert.alert(
          "Reminders",
          "Synapse can remind you to take medications, attend appointments, and complete daily health logs.",
          [
            {
              text: "Not Now",
              style: "cancel",
              onPress: () => {
                AsyncStorage.setItem(NOTIFICATION_ASKED_KEY, "true");
              },
            },
            {
              text: "OK",
              onPress: async () => {
                await requestPermission();
                await AsyncStorage.setItem(NOTIFICATION_ASKED_KEY, "true");
                if (mounted) syncAllFromSettings();
              },
            },
          ]
        );
      } catch {
        if (mounted) syncAllFromSettings();
      }
    })();
    return () => { mounted = false; };
  }, [showOnboarding]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncAllFromSettings().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (showOnboarding !== false) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(WHATS_NEW_SEEN_KEY);
        if (!cancelled && seen !== "true") {
          setShowWhatsNew(true);
        }
      } catch {
        if (!cancelled) {
          setShowWhatsNew(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [WHATS_NEW_SEEN_KEY, showOnboarding, suppressPostOnboardingPrompts]);

  useEffect(() => {
    if (showOnboarding !== false || isSimpleMode) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const seen = await getHasSeenWalkthrough();
        if (!cancelled && !seen) setShowWalkthrough(true);
      } catch {
        if (!cancelled) setShowWalkthrough(true);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isSimpleMode, showOnboarding]);

  const handleNavigate = (screen: string) => {
    setActiveScreen(screen);
    setRefreshKey((k) => k + 1);
    settingsStorage.get().then(s => setSickMode(s.sickMode));
  };

  const handleSimpleAddNavigate = useCallback((target: "medication" | "appointment" | "symptom") => {
    if (target === "medication") {
      setActiveScreen("medications");
      setSimpleAddMedicationToken((value) => value + 1);
      return;
    }
    if (target === "appointment") {
      setActiveScreen("appointments");
      setSimpleAddAppointmentToken((value) => value + 1);
      return;
    }
    setActiveScreen("symptoms");
    setSimpleAddSymptomToken((value) => value + 1);
  }, []);

  const handleSimpleSaveReturnToDashboard = useCallback(() => {
    setActiveScreen("dashboard");
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSimpleMedicationAddConsumed = useCallback(() => {
    setSimpleAddMedicationToken(0);
  }, []);

  // Register navigate callback for notification tap routing
  useEffect(() => {
    setNotificationNavigateCallback(handleNavigate);
  }, []);

  // Handle notification that launched the app from a killed state
  useEffect(() => {
    if (showOnboarding === false) {
      handleLastNotificationResponse();
    }
  }, [showOnboarding]);

  useEffect(() => {
    const handleIncomingUrl = ({ url }: { url: string }) => {
      navigateToWidgetTarget(url);
    };

    Linking.getInitialURL().then((url) => {
      navigateToWidgetTarget(url);
    }).catch(() => {});

    const subscription = Linking.addEventListener("url", handleIncomingUrl);
    return () => subscription.remove();
  }, [navigateToWidgetTarget]);

  useEffect(() => {
    const target = Array.isArray(widgetTarget) ? widgetTarget[0] : widgetTarget;
    if (target === "medications" || target === "appointments") {
      setActiveScreen(target);
      setRefreshKey((k) => k + 1);
      trackFeedbackWidgetLaunch().catch(() => {});
    }
  }, [widgetTarget]);

  const handleActivateSickMode = () => {
    setSickMode(true);
    setActiveScreen("sickmode");
    setRefreshKey((k) => k + 1);
  };

  const handleDeactivateSickMode = () => {
    setSickMode(false);
    setActiveScreen("dashboard");
    setRefreshKey((k) => k + 1);
  };

  const handleOnboardingComplete = async (options?: { openMedications?: boolean; appMode?: "simple" | "full" }) => {
    const completedAppMode = options?.appMode ?? "full";
    if (completedAppMode === "simple") {
      await setHasSeenWalkthrough(true);
      setShowSimpleModeTour(true);
      setSimpleModeTourStep(0);
      setSuppressPostOnboardingPrompts(true);
      try {
        await AsyncStorage.setItem(WHATS_NEW_SEEN_KEY, "true");
      } catch {}
    } else {
      await setHasSeenWalkthrough(false);
      setSuppressPostOnboardingPrompts(false);
    }
    setShowOnboarding(false);
    if (options?.openMedications) setActiveScreen("medications");
    setRefreshKey((k) => k + 1);
  };

  const handleResetApp = () => {
    setHasSeenWalkthrough(false); // reset tour on app reset too
    setShowOnboarding(true);
    setShowSimpleModeTour(false);
    setSimpleModeTourStep(0);
    setSuppressPostOnboardingPrompts(false);
    setShowWhatsNew(false);
    setActiveScreen("dashboard");
    setSickMode(false);
  };

  const SIMPLE_MODE_TOUR_CARDS = [
    {
      title: "Everything in one place",
      body: "Track meds, appointments, and symptoms simply.",
    },
    {
      title: "Tap + to add anything",
      body: "Add medications, appointments, or symptoms quickly.",
    },
    {
      title: "Stay on track",
      body: "See what’s due and log how you feel daily.",
    },
  ] as const;

  const handleCloseSimpleModeTour = useCallback(() => {
    setShowSimpleModeTour(false);
    setSimpleModeTourStep(0);
    setActiveScreen("dashboard");
    setRefreshKey((k) => k + 1);
  }, []);

  const markWhatsNewSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(WHATS_NEW_SEEN_KEY, "true");
    } catch {}
  }, [WHATS_NEW_SEEN_KEY]);

  const handleDismissWhatsNew = useCallback(async () => {
    await markWhatsNewSeen();
    setShowWhatsNew(false);
  }, [markWhatsNewSeen]);

  const handleExploreWhatsNew = useCallback(async () => {
    await markWhatsNewSeen();
    setShowWhatsNew(false);
    setActiveScreen("settings");
    setOpenAppearanceModalToken((value) => value + 1);
    setRefreshKey((k) => k + 1);
  }, [markWhatsNewSeen]);

  const handleDismissFeedbackPrompt = useCallback(async () => {
    await markFeedbackPromptDismissed(FEEDBACK_VERSION_KEY);
    setShowFeedbackPrompt(false);
  }, [FEEDBACK_VERSION_KEY]);

  const handleOpenFeedback = useCallback(async (sentiment?: FeedbackSentiment) => {
    await markFeedbackPromptDismissed(FEEDBACK_VERSION_KEY);
    setShowFeedbackPrompt(false);
    setFeedbackEntrySource("prompt");
    setFeedbackInitialSentiment(sentiment ?? null);
    setActiveScreen("feedback");
  }, [FEEDBACK_VERSION_KEY]);

  const handleFinishFeedbackFlow = useCallback(async () => {
    await markFeedbackPromptCompleted(FEEDBACK_VERSION_KEY);
  }, [FEEDBACK_VERSION_KEY]);

  const handleWalkthroughStepEnter = useCallback(async (stepId: string | null) => {
    switch (stepId) {
      case "medication":
      case "dailylog":
      case "appointments":
        setWalkthroughMenuOpen(false);
        setActiveScreen("dashboard");
        return;
      case "menu":
        setActiveScreen("dashboard");
        setWalkthroughMenuOpen(true);
        return;
      case "emergencycard":
        setActiveScreen("dashboard");
        setWalkthroughMenuOpen(true);
        return;
      case "final":
        setWalkthroughMenuOpen(false);
        return;
      default:
        setWalkthroughMenuOpen(null);
    }
  }, []);

  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const simpleTourCard = SIMPLE_MODE_TOUR_CARDS[simpleModeTourStep];
  const isLastSimpleTourStep = simpleModeTourStep === SIMPLE_MODE_TOUR_CARDS.length - 1;

  // When storage hasn't loaded yet, show main app so the content area is never blank (avoids stuck splash-like screen).
  if (showOnboarding === true) {
    return (
      <AppBackground>
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </AppBackground>
    );
  }

  const renderScreen = () => {
    if (sickMode && activeScreen === "dashboard") {
      return <SickModeScreen onDeactivate={handleDeactivateSickMode} onRefreshKey={refreshKey} />;
    }
    if (activeScreen === "sickmode") {
      return <SickModeScreen onDeactivate={handleDeactivateSickMode} onRefreshKey={refreshKey} />;
    }

    switch (activeScreen) {
      case "dashboard":
        return <DashboardScreen onNavigate={handleNavigate} onRefreshKey={refreshKey} />;
      case "log":
        return <DailyLogScreen key={refreshKey} />;
      case "logtoday":
        return <DailyLogScreen key={refreshKey} openTodayOnLaunch />;
      case "healthdata":
        return <HealthDataScreen />;
      case "medications":
        return <MedicationsScreen simpleOpenAddToken={simpleAddMedicationToken} onSimpleOpenAddConsumed={handleSimpleMedicationAddConsumed} onSimpleSaveComplete={handleSimpleSaveReturnToDashboard} />;
      case "symptoms":
        return <SymptomsScreen onActivateSickMode={handleActivateSickMode} simpleOpenAddToken={simpleAddSymptomToken} />;
      case "documents":
        return <DocumentsScreen />;
      case "insights":
        return <InsightsScreen />;
      case "monthlycheckin":
        return <MonthlyCheckInScreen />;
      case "eating":
        return <EatingScreen />;
      case "mentalhealth":
        return <MentalHealthModeScreen />;
      case "comfort":
        return <ComfortScreen />;
      case "goals":
        return <GoalsScreen />;
      case "appointments":
        return <AppointmentsScreen simpleOpenAddToken={simpleAddAppointmentToken} onSimpleSaveComplete={handleSimpleSaveReturnToDashboard} />;
      case "reports":
        return <ReportsScreen />;
      case "ramadan":
        return <RamadanScreen onActivateSickMode={handleActivateSickMode} />;
      case "privacy":
        return <PrivacyScreen />;
      case "healthprofile":
        return <HealthProfileScreen onBack={() => handleNavigate("settings")} onNavigate={handleNavigate} />;
      case "doctors":
        return <DoctorsScreen onBack={() => handleNavigate("settings")} />;
      case "pharmacies":
        return <PharmaciesScreen onBack={() => handleNavigate("settings")} />;
      case "ramadandailylog":
        return <RamadanDailyLogScreen onBack={() => handleNavigate("dashboard")} />;
      case "healthprofileconditions":
        return <HealthProfileConditionsScreen onBack={() => handleNavigate("healthprofile")} />;
      case "allergy":
        return <AllergyScreen onBack={() => handleNavigate("healthprofile")} />;
      case "cycletracking":
        return <CycleTrackingScreen onBack={() => handleNavigate("settings")} />;
      case "emergency":
        return <EmergencyProtocolScreen onBack={() => handleNavigate("settings")} />;
      case "emergencycard":
        return <EmergencyCardScreen onBack={() => handleNavigate("settings")} onNavigate={handleNavigate} />;
      case "editprofile":
        return (
          <EditProfileScreen
            onBack={() => handleNavigate("settings")}
            onNavigate={handleNavigate}
            onRestoreComplete={() => setRefreshKey((k) => k + 1)}
          />
        );
      case "meetfounder":
        return <MeetFounderScreen />;
      case "feedback":
        return (
          <FeedbackScreen
            key={`${feedbackEntrySource}-${feedbackInitialSentiment ?? "choice"}`}
            onBack={() => {
              setFeedbackInitialSentiment(null);
              setActiveScreen(feedbackEntrySource === "prompt" ? "dashboard" : "settings");
              setRefreshKey((k) => k + 1);
            }}
            initialSentiment={feedbackInitialSentiment}
            onFinished={handleFinishFeedbackFlow}
          />
        );
      case "settings":
        return (
          <SettingsScreen
            onResetApp={handleResetApp}
            onNavigate={handleNavigate}
            onRestoreComplete={() => setRefreshKey((k) => k + 1)}
            onShowAppTour={() => setShowWalkthrough(true)}
            openAppearanceModalToken={openAppearanceModalToken}
          />
        );
      default:
        return <DashboardScreen onNavigate={handleNavigate} onRefreshKey={refreshKey} />;
    }
  };

  const content = (
    <SidebarLayout
      activeScreen={sickMode && activeScreen === "dashboard" ? "sickmode" : activeScreen}
      onNavigate={handleNavigate}
      onSimpleAddSelect={handleSimpleAddNavigate}
      sickMode={sickMode}
      simpleMode={isSimpleMode}
      headerRight={activeScreen === "dashboard" ? <SickModeHeaderButton onActivate={handleActivateSickMode} onNavigate={handleNavigate} refreshKey={refreshKey} /> : undefined}
      walkthroughStepId={walkthroughStepId}
      walkthroughMenuOpen={walkthroughMenuOpen}
    >
      {renderScreen()}
    </SidebarLayout>
  );

  if (isTablet) {
    return (
      <AppBackground>
        <BiometricGate>
          <WalkthroughProvider>
          <View style={styles.container}>
            {!isSimpleMode ? (
              <TabletSidebar
                activeScreen={sickMode && activeScreen === "dashboard" ? "sickmode" : activeScreen}
                onNavigate={handleNavigate}
              />
            ) : null}
            <View style={styles.tabletContent}>{content}</View>
          </View>
          <AppWalkthrough
            visible={showWalkthrough}
            onStepChange={setWalkthroughStepId}
            onStepEnter={handleWalkthroughStepEnter}
            onComplete={async () => {
              await setHasSeenWalkthrough(true);
              setWalkthroughStepId(null);
              setWalkthroughMenuOpen(null);
              setShowWalkthrough(false);
            }}
          />
          <Modal animationType="fade" transparent visible={showSimpleModeTour} onRequestClose={handleCloseSimpleModeTour}>
            <View style={styles.modalBackdrop}>
              <View style={styles.simpleTourCard}>
                <View style={styles.simpleTourDots}>
                  {SIMPLE_MODE_TOUR_CARDS.map((_, index) => (
                    <View key={index} style={[styles.simpleTourDot, index === simpleModeTourStep && styles.simpleTourDotActive]} />
                  ))}
                </View>
                <Text style={styles.simpleTourTitle}>{simpleTourCard.title}</Text>
                <Text style={styles.simpleTourBody}>{simpleTourCard.body}</Text>
                <View style={styles.simpleTourActions}>
                  <Pressable onPress={handleCloseSimpleModeTour} style={({ pressed }) => [styles.simpleTourSecondaryButton, pressed && styles.whatsNewButtonPressed]}>
                    <Text style={styles.simpleTourSecondaryText}>Skip</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (isLastSimpleTourStep) {
                        handleCloseSimpleModeTour();
                        return;
                      }
                      setSimpleModeTourStep((current) => current + 1);
                    }}
                    style={({ pressed }) => [styles.simpleTourPrimaryButton, pressed && styles.whatsNewButtonPressed]}
                  >
                    <Text style={styles.simpleTourPrimaryText}>{isLastSimpleTourStep ? "Get Started" : "Next"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
          <Modal
            animationType="fade"
            transparent
            visible={showFeedbackPrompt}
            onRequestClose={handleDismissFeedbackPrompt}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.feedbackPromptCard}>
                <Text style={styles.feedbackPromptTitle}>Help improve Synapse</Text>
                <Text style={styles.feedbackPromptBody}>How’s Synapse working for you?</Text>
                <View style={styles.feedbackPromptActions}>
                  <Pressable
                    onPress={() => handleOpenFeedback("positive")}
                    style={({ pressed }) => [styles.feedbackPromptPrimary, pressed && styles.whatsNewButtonPressed]}
                  >
                    <Text style={styles.feedbackPromptPrimaryText}>I’m enjoying it</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleOpenFeedback("needs_improvement")}
                    style={({ pressed }) => [styles.feedbackPromptSecondary, pressed && styles.whatsNewButtonPressed]}
                  >
                    <Text style={styles.feedbackPromptSecondaryText}>Needs improvement</Text>
                  </Pressable>
                </View>
                <Pressable onPress={handleDismissFeedbackPrompt} style={styles.feedbackPromptDismiss}>
                  <Text style={styles.feedbackPromptDismissText}>Not now</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
          <Modal
            animationType="fade"
            transparent
            visible={showWhatsNew}
            onRequestClose={handleDismissWhatsNew}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.whatsNewCard}>
                <Text style={styles.whatsNewEyebrow}>What’s New in Synapse</Text>
                <Text style={styles.whatsNewTitle}>A little more thoughtful. A lot easier to live with.</Text>
                <Text style={styles.whatsNewBody}>
                  This update makes Synapse feel more personal, more supportive, and way easier to stay on top of.
                </Text>
                <View style={styles.whatsNewList}>
                  <Text style={styles.whatsNewBullet}>• New widgets for quick, at-a-glance updates</Text>
                  <Text style={styles.whatsNewBullet}>• Recovery tracking to follow your progress over time</Text>
                  <Text style={styles.whatsNewBullet}>• Smarter symptom and vitals logging</Text>
                  <Text style={styles.whatsNewBullet}>• Improved medications, appointments, and dashboard</Text>
                  <Text style={styles.whatsNewBullet}>• Expanded health profile with vaccines, surgeries, and more</Text>
                </View>
                <Text style={styles.whatsNewFooter}>
                  We also polished onboarding, navigation, and dark mode so everything feels smoother, cleaner, and more intentional.
                </Text>
                <View style={styles.whatsNewActions}>
                  <Pressable onPress={handleDismissWhatsNew} style={({ pressed }) => [styles.whatsNewSecondaryButton, pressed && styles.whatsNewButtonPressed]}>
                    <Text style={styles.whatsNewSecondaryText}>Got it</Text>
                  </Pressable>
                  <Pressable onPress={handleExploreWhatsNew} style={({ pressed }) => [styles.whatsNewPrimaryButton, pressed && styles.whatsNewButtonPressed]}>
                    <Text style={styles.whatsNewPrimaryText}>Explore what’s new</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
          </WalkthroughProvider>
        </BiometricGate>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <BiometricGate>
        <WalkthroughProvider>
        <View style={styles.container}>{content}</View>
        <AppWalkthrough
          visible={showWalkthrough}
          onStepChange={setWalkthroughStepId}
          onStepEnter={handleWalkthroughStepEnter}
          onComplete={async () => {
            await setHasSeenWalkthrough(true);
            setWalkthroughStepId(null);
            setWalkthroughMenuOpen(null);
            setShowWalkthrough(false);
          }}
        />
        <Modal animationType="fade" transparent visible={showSimpleModeTour} onRequestClose={handleCloseSimpleModeTour}>
          <View style={styles.modalBackdrop}>
            <View style={styles.simpleTourCard}>
              <View style={styles.simpleTourDots}>
                {SIMPLE_MODE_TOUR_CARDS.map((_, index) => (
                  <View key={index} style={[styles.simpleTourDot, index === simpleModeTourStep && styles.simpleTourDotActive]} />
                ))}
              </View>
              <Text style={styles.simpleTourTitle}>{simpleTourCard.title}</Text>
              <Text style={styles.simpleTourBody}>{simpleTourCard.body}</Text>
              <View style={styles.simpleTourActions}>
                <Pressable onPress={handleCloseSimpleModeTour} style={({ pressed }) => [styles.simpleTourSecondaryButton, pressed && styles.whatsNewButtonPressed]}>
                  <Text style={styles.simpleTourSecondaryText}>Skip</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (isLastSimpleTourStep) {
                      handleCloseSimpleModeTour();
                      return;
                    }
                    setSimpleModeTourStep((current) => current + 1);
                  }}
                  style={({ pressed }) => [styles.simpleTourPrimaryButton, pressed && styles.whatsNewButtonPressed]}
                >
                  <Text style={styles.simpleTourPrimaryText}>{isLastSimpleTourStep ? "Get Started" : "Next"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          animationType="fade"
          transparent
          visible={showFeedbackPrompt}
          onRequestClose={handleDismissFeedbackPrompt}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.feedbackPromptCard}>
              <Text style={styles.feedbackPromptTitle}>Help improve Synapse</Text>
              <Text style={styles.feedbackPromptBody}>How’s Synapse working for you?</Text>
              <View style={styles.feedbackPromptActions}>
                <Pressable
                  onPress={() => handleOpenFeedback("positive")}
                  style={({ pressed }) => [styles.feedbackPromptPrimary, pressed && styles.whatsNewButtonPressed]}
                >
                  <Text style={styles.feedbackPromptPrimaryText}>I’m enjoying it</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleOpenFeedback("needs_improvement")}
                  style={({ pressed }) => [styles.feedbackPromptSecondary, pressed && styles.whatsNewButtonPressed]}
                >
                  <Text style={styles.feedbackPromptSecondaryText}>Needs improvement</Text>
                </Pressable>
              </View>
              <Pressable onPress={handleDismissFeedbackPrompt} style={styles.feedbackPromptDismiss}>
                <Text style={styles.feedbackPromptDismissText}>Not now</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        <Modal
          animationType="fade"
          transparent
          visible={showWhatsNew}
          onRequestClose={handleDismissWhatsNew}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.whatsNewCard}>
              <Text style={styles.whatsNewEyebrow}>What’s New in Synapse</Text>
              <Text style={styles.whatsNewTitle}>A little more thoughtful. A lot easier to live with.</Text>
              <Text style={styles.whatsNewBody}>
                This update makes Synapse feel more personal, more supportive, and way easier to stay on top of.
              </Text>
              <View style={styles.whatsNewList}>
                <Text style={styles.whatsNewBullet}>• New widgets for quick, at-a-glance updates</Text>
                <Text style={styles.whatsNewBullet}>• Recovery tracking to follow your progress over time</Text>
                <Text style={styles.whatsNewBullet}>• Smarter symptom and vitals logging</Text>
                <Text style={styles.whatsNewBullet}>• Improved medications, appointments, and dashboard</Text>
                <Text style={styles.whatsNewBullet}>• Expanded health profile with vaccines, surgeries, and more</Text>
              </View>
              <Text style={styles.whatsNewFooter}>
                We also polished onboarding, navigation, and dark mode so everything feels smoother, cleaner, and more intentional.
              </Text>
              <View style={styles.whatsNewActions}>
                <Pressable onPress={handleDismissWhatsNew} style={({ pressed }) => [styles.whatsNewSecondaryButton, pressed && styles.whatsNewButtonPressed]}>
                  <Text style={styles.whatsNewSecondaryText}>Got it</Text>
                </Pressable>
                <Pressable onPress={handleExploreWhatsNew} style={({ pressed }) => [styles.whatsNewPrimaryButton, pressed && styles.whatsNewButtonPressed]}>
                  <Text style={styles.whatsNewPrimaryText}>Explore what’s new</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        </WalkthroughProvider>
      </BiometricGate>
    </AppBackground>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: "row",
      minHeight: 1,
      backgroundColor: "transparent",
    },
    tabletContent: {
      flex: 1,
      minWidth: 0,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.28)",
      justifyContent: "center",
      paddingHorizontal: 22,
    },
    simpleTourCard: {
      backgroundColor: C.surface,
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 20,
      borderWidth: 1,
      borderColor: C.borderLight,
      gap: 14,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    simpleTourDots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      paddingBottom: 2,
    },
    simpleTourDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.tintLight,
    },
    simpleTourDotActive: {
      width: 22,
      borderRadius: 4,
      backgroundColor: C.accent,
    },
    simpleTourTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "800",
      color: C.text,
      textAlign: "center",
      letterSpacing: -0.5,
    },
    simpleTourBody: {
      fontSize: 17,
      lineHeight: 25,
      color: C.textSecondary,
      textAlign: "center",
    },
    simpleTourActions: {
      flexDirection: "row",
      gap: 12,
      paddingTop: 8,
    },
    simpleTourPrimaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    simpleTourSecondaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    simpleTourPrimaryText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
    },
    simpleTourSecondaryText: {
      fontSize: 16,
      fontWeight: "700",
      color: C.text,
    },
    whatsNewCard: {
      backgroundColor: C.surface,
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 20,
      borderWidth: 1,
      borderColor: C.borderLight,
      gap: 12,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    feedbackPromptCard: {
      backgroundColor: C.surface,
      borderRadius: 26,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 18,
      borderWidth: 1,
      borderColor: C.borderLight,
      gap: 14,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    feedbackPromptTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "800",
      color: C.text,
      letterSpacing: -0.6,
    },
    feedbackPromptBody: {
      fontSize: 17,
      lineHeight: 24,
      color: C.textSecondary,
    },
    feedbackPromptActions: {
      gap: 12,
      paddingTop: 4,
    },
    feedbackPromptPrimary: {
      minHeight: 54,
      borderRadius: 18,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    feedbackPromptPrimaryText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
    },
    feedbackPromptSecondary: {
      minHeight: 54,
      borderRadius: 18,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    feedbackPromptSecondaryText: {
      fontSize: 16,
      fontWeight: "700",
      color: C.text,
    },
    feedbackPromptDismiss: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 2,
      paddingBottom: 4,
    },
    feedbackPromptDismissText: {
      fontSize: 15,
      fontWeight: "600",
      color: C.textSecondary,
    },
    whatsNewEyebrow: {
      fontSize: 13,
      fontWeight: "700",
      color: C.accent,
      letterSpacing: 0.2,
    },
    whatsNewTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "800",
      color: C.text,
    },
    whatsNewBody: {
      fontSize: 17,
      lineHeight: 25,
      color: C.textSecondary,
    },
    whatsNewList: {
      gap: 10,
      paddingTop: 4,
    },
    whatsNewBullet: {
      fontSize: 16,
      lineHeight: 23,
      color: C.text,
    },
    whatsNewFooter: {
      fontSize: 15,
      lineHeight: 22,
      color: C.textSecondary,
      paddingTop: 2,
    },
    whatsNewActions: {
      flexDirection: "row",
      gap: 12,
      paddingTop: 8,
    },
    whatsNewPrimaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    whatsNewSecondaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    whatsNewPrimaryText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
    },
    whatsNewSecondaryText: {
      fontSize: 16,
      fontWeight: "700",
      color: C.text,
    },
    whatsNewButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
  });
}
