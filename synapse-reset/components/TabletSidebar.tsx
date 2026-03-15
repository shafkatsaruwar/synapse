import React, { useMemo } from "react";
import { View, StyleSheet, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useIsTablet } from "@/lib/device";

const SIDEBAR_GRADIENT = ["#D1E0F7", "#BDD4F2"];
import { featureFlags } from "@/constants/feature-flags";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid-outline", iconActive: "grid" },
  { key: "log", label: "Daily Log", icon: "heart-outline", iconActive: "heart" },
  { key: "healthdata", label: "Health Data", icon: "analytics-outline", iconActive: "analytics" },
  { key: "medications", label: "Medications", icon: "medical-outline", iconActive: "medical" },
  { key: "symptoms", label: "Symptoms", icon: "pulse-outline", iconActive: "pulse" },
  ...(featureFlags.documentScannerEnabled
    ? [
        { key: "documents", label: "Documents", icon: "scan-outline" as IconName, iconActive: "scan" as IconName },
        { key: "insights", label: "Insights", icon: "sparkles-outline" as IconName, iconActive: "sparkles" as IconName },
      ]
    : []),
  { key: "monthlycheckin", label: "Monthly check-in", icon: "fitness-outline", iconActive: "fitness" },
  { key: "eating", label: "Eating", icon: "restaurant-outline", iconActive: "restaurant" },
  { key: "mentalhealth", label: "Mental health day", icon: "heart-outline", iconActive: "heart" },
  { key: "comfort", label: "Mood lifters", icon: "happy-outline", iconActive: "happy" },
  { key: "goals", label: "Goals", icon: "flag-outline", iconActive: "flag" },
  { key: "appointments", label: "Appointments", icon: "calendar-outline", iconActive: "calendar" },
  { key: "reports", label: "Reports", icon: "bar-chart-outline", iconActive: "bar-chart" },
  { key: "emergency", label: "Emergency Protocol", icon: "shield-outline", iconActive: "shield" },
  { key: "emergencycard", label: "Emergency Card", icon: "card-outline", iconActive: "card" },
  { key: "privacy", label: "Privacy", icon: "shield-outline", iconActive: "shield" },
  { key: "settings", label: "Account", icon: "person-circle-outline", iconActive: "person-circle" },
];

const DRAWER_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Main", keys: ["dashboard"] },
  { title: "Primary", keys: ["log", "medications", "healthdata", "appointments"] },
  { title: "Health & Insights", keys: ["reports", "monthlycheckin", "comfort", "eating", "mentalhealth", "goals", "documents", "insights"] },
  { title: "Emergency", keys: ["emergency", "emergencycard"] },
  { title: "System", keys: ["privacy", "settings"] },
];

interface TabletSidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

const SIDEBAR_WIDTH = 260;

export default function TabletSidebar({ activeScreen, onNavigate }: TabletSidebarProps) {
  const isTablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  if (!isTablet) return null;

  return (
    <View style={[styles.sidebarWrap, { width: SIDEBAR_WIDTH }]}>
      <LinearGradient
        colors={SIDEBAR_GRADIENT}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.sidebar, { paddingTop: insets.top + 32 }]}>
      <Text style={styles.logo} numberOfLines={1}>
        Synapse
      </Text>
      <ScrollView style={styles.navScroll} contentContainerStyle={styles.navScrollContent} showsVerticalScrollIndicator={false}>
        {DRAWER_GROUPS.map((group, groupIndex) => {
          const items = group.keys
            .map((key) => NAV_ITEMS.find((n) => n.key === key))
            .filter((n): n is NavItem => n != null);
          if (items.length === 0) return null;
          return (
            <View key={group.title} style={[styles.group, groupIndex === 0 && styles.groupFirst]}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {items.map((item) => {
                const active = activeScreen === item.key;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.navItem, styles.navItemExpanded, active && styles.navItemActive]}
                    onPress={() => onNavigate(item.key)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={active ? item.iconActive : item.icon}
                      size={24}
                      color={active ? "#2563eb" : "rgba(0,0,0,0.55)"}
                    />
                    <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
      </View>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    sidebarWrap: {
      flex: 1,
      borderRightWidth: 1,
      borderRightColor: "rgba(0,0,0,0.06)",
      shadowColor: "#000",
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 4,
    },
    sidebar: {
      flex: 1,
    },
    logo: {
      fontWeight: "700",
      fontSize: 20,
      color: "#1a1a1a",
      marginHorizontal: 16,
      marginBottom: 24,
    },
    navScroll: {
      flex: 1,
    },
    navScrollContent: {
      paddingBottom: 24,
    },
    group: {
      marginTop: 24,
      marginBottom: 4,
    },
    groupFirst: {
      marginTop: 0,
    },
    groupTitle: {
      fontSize: 11,
      fontWeight: "600",
      color: "rgba(0,0,0,0.5)",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 4,
      paddingHorizontal: 16,
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 12,
      borderRadius: 10,
      marginHorizontal: 8,
    },
    navItemExpanded: {
      paddingHorizontal: 16,
    },
    navItemActive: {
      backgroundColor: "rgba(255,255,255,0.25)",
      borderRadius: 10,
      marginHorizontal: 8,
    },
    navLabel: {
      fontWeight: "500",
      fontSize: 15,
      color: "#1a1a1a",
      flex: 1,
    },
    navLabelActive: {
      color: "#1a1a1a",
      fontWeight: "600",
    },
  });
}
