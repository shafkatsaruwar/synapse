import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, Platform, AppState } from "react-native";
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
import RamadanDailyLogScreen from "@/screens/RamadanDailyLogScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import EmergencyProtocolScreen from "@/screens/EmergencyProtocolScreen";
import EmergencyCardScreen from "@/screens/EmergencyCardScreen";
import MeetFounderScreen from "@/screens/MeetFounderScreen";
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

export default function MainScreen() {
  const isTablet = useIsTablet();
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sickMode, setSickMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

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
  useEffect(() => {
    if (showOnboarding !== false) return;
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
  }, [showOnboarding]);

  const handleNavigate = (screen: string) => {
    setActiveScreen(screen);
    setRefreshKey((k) => k + 1);
    settingsStorage.get().then(s => setSickMode(s.sickMode));
  };

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

  const handleOnboardingComplete = (options?: { openMedications?: boolean }) => {
    setHasSeenWalkthrough(false); // always show tour after fresh onboarding
    setShowOnboarding(false);
    if (options?.openMedications) setActiveScreen("medications");
    setRefreshKey((k) => k + 1);
  };

  const handleResetApp = () => {
    setHasSeenWalkthrough(false); // reset tour on app reset too
    setShowOnboarding(true);
    setActiveScreen("dashboard");
    setSickMode(false);
  };

  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

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
      case "healthdata":
        return <HealthDataScreen />;
      case "medications":
        return <MedicationsScreen />;
      case "symptoms":
        return <SymptomsScreen onActivateSickMode={handleActivateSickMode} />;
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
        return <AppointmentsScreen />;
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
      case "settings":
        return (
          <SettingsScreen
            onResetApp={handleResetApp}
            onNavigate={handleNavigate}
            onRestoreComplete={() => setRefreshKey((k) => k + 1)}
            onShowAppTour={() => setShowWalkthrough(true)}
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
      sickMode={sickMode}
      headerRight={activeScreen === "dashboard" ? <SickModeHeaderButton onActivate={handleActivateSickMode} onNavigate={handleNavigate} refreshKey={refreshKey} /> : undefined}
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
            <TabletSidebar
              activeScreen={sickMode && activeScreen === "dashboard" ? "sickmode" : activeScreen}
              onNavigate={handleNavigate}
            />
            <View style={styles.tabletContent}>{content}</View>
          </View>
          <AppWalkthrough
            visible={showWalkthrough}
            onComplete={async () => {
              await setHasSeenWalkthrough(true);
              setShowWalkthrough(false);
            }}
          />
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
          onComplete={async () => {
            await setHasSeenWalkthrough(true);
            setShowWalkthrough(false);
          }}
        />
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
  });
}
