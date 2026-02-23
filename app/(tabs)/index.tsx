import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import SidebarLayout from "@/components/SidebarLayout";
import DashboardScreen from "@/screens/DashboardScreen";
import DailyLogScreen from "@/screens/DailyLogScreen";
import MedicationsScreen from "@/screens/MedicationsScreen";
import SymptomsScreen from "@/screens/SymptomsScreen";
import AppointmentsScreen from "@/screens/AppointmentsScreen";
import ReportsScreen from "@/screens/ReportsScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import HealthDataScreen from "@/screens/HealthDataScreen";
import DocumentsScreen from "@/screens/DocumentsScreen";
import InsightsScreen from "@/screens/InsightsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import SickModeScreen from "@/screens/SickModeScreen";
import { settingsStorage } from "@/lib/storage";
import Colors from "@/constants/colors";

const C = Colors.dark;

export default function MainScreen() {
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sickMode, setSickMode] = useState(false);

  const checkSickMode = useCallback(async () => {
    const settings = await settingsStorage.get();
    setSickMode(settings.sickMode);
  }, []);

  useEffect(() => { checkSickMode(); }, [checkSickMode]);

  const handleNavigate = (screen: string) => {
    setActiveScreen(screen);
    setRefreshKey((k) => k + 1);
    checkSickMode();
  };

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

  const renderScreen = () => {
    if (sickMode && activeScreen === "dashboard") {
      return <SickModeScreen onDeactivate={handleDeactivateSickMode} onRefreshKey={refreshKey} />;
    }
    if (activeScreen === "sickmode") {
      return <SickModeScreen onDeactivate={handleDeactivateSickMode} onRefreshKey={refreshKey} />;
    }

    switch (activeScreen) {
      case "dashboard":
        return <DashboardScreen onNavigate={handleNavigate} onRefreshKey={refreshKey} onActivateSickMode={handleActivateSickMode} />;
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
      case "appointments":
        return <AppointmentsScreen />;
      case "reports":
        return <ReportsScreen />;
      case "privacy":
        return <PrivacyScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={handleNavigate} onRefreshKey={refreshKey} onActivateSickMode={handleActivateSickMode} />;
    }
  };

  return (
    <View style={styles.container}>
      <SidebarLayout activeScreen={sickMode && activeScreen === "dashboard" ? "sickmode" : activeScreen} onNavigate={handleNavigate} sickMode={sickMode}>
        {renderScreen()}
      </SidebarLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
});
