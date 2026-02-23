import React, { useState } from "react";
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
import Colors from "@/constants/colors";

const C = Colors.dark;

export default function MainScreen() {
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNavigate = (screen: string) => {
    setActiveScreen(screen);
    setRefreshKey((k) => k + 1);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "dashboard":
        return <DashboardScreen onNavigate={handleNavigate} onRefreshKey={refreshKey} />;
      case "log":
        return <DailyLogScreen />;
      case "healthdata":
        return <HealthDataScreen />;
      case "medications":
        return <MedicationsScreen />;
      case "symptoms":
        return <SymptomsScreen />;
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
        return <DashboardScreen onNavigate={handleNavigate} onRefreshKey={refreshKey} />;
    }
  };

  return (
    <View style={styles.container}>
      <SidebarLayout activeScreen={activeScreen} onNavigate={handleNavigate}>
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
