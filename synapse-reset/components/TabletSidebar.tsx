import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme, type ThemeId } from "@/contexts/ThemeContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { useIsTablet } from "@/lib/device";
import { useWalkthroughTargets, measureInWindow } from "@/contexts/WalkthroughContext";
import { featureFlags } from "@/constants/feature-flags";
import { useSynapseHQPanel } from "@/components/SynapseHQPanel";
import { getNavBadgeCounts, type NavBadgeCounts } from "@/lib/nav-badge-counts";

const LIGHT_SIDEBAR_GRADIENT = ["#F5F1EA", "#E0EAE0"] as const;

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
  { key: "healthdata", label: "Vitals", icon: "analytics-outline", iconActive: "analytics" },
  { key: "medications", label: "Medications", icon: "medical-outline", iconActive: "medical" },
  { key: "symptoms", label: "Symptoms", icon: "pulse-outline", iconActive: "pulse" },
  { key: "labwork", label: "LabWork", icon: "flask-outline", iconActive: "flask" },
  { key: "imaging", label: "Imaging", icon: "scan-outline", iconActive: "scan" },
  { key: "timeline", label: "Timeline", icon: "git-branch-outline", iconActive: "git-branch" },
  ...(featureFlags.documentScannerEnabled
    ? [
        { key: "documents", label: "Documents", icon: "scan-outline" as IconName, iconActive: "scan" as IconName },
        { key: "insights", label: "Insights", icon: "sparkles-outline" as IconName, iconActive: "sparkles" as IconName },
      ]
    : []),
  { key: "monthlycheckin", label: "Monthly check-in", icon: "fitness-outline", iconActive: "fitness" },
  { key: "cycletracking", label: "Cycle tracking", icon: "water-outline", iconActive: "water" },
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
  { title: "Emergency", keys: ["emergency", "emergencycard"] },
  { title: "Primary", keys: ["log", "medications", "healthdata", "appointments", "symptoms"] },
  { title: "Diagnostics", keys: ["labwork", "imaging"] },
  { title: "Health & Insights", keys: ["timeline", "reports", "monthlycheckin", "cycletracking", "comfort", "eating", "mentalhealth", "goals", "documents", "insights"] },
  { title: "System", keys: ["privacy", "settings"] },
];

interface TabletSidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

const SIDEBAR_WIDTH = 280;

export default function TabletSidebar({ activeScreen, onNavigate }: TabletSidebarProps) {
  const isTablet = useIsTablet();
  const { isSimpleMode } = useAppMode();
  const insets = useSafeAreaInsets();
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeId), [C, themeId]);
  const synapseHQ = useSynapseHQPanel();
  const openSynapseHQ = __DEV__ ? synapseHQ.open : undefined;
  const [badgeCounts, setBadgeCounts] = useState<NavBadgeCounts>({});
  const emergencyCardRef = useRef<View>(null);
  const walkthrough = useWalkthroughTargets();
  const registerTarget = walkthrough?.registerTarget;
  const unregisterTarget = walkthrough?.unregisterTarget;

  useEffect(() => {
    if (!registerTarget || !unregisterTarget || !isTablet) return;
    registerTarget("emergencycard", () => measureInWindow(emergencyCardRef));
    return () => unregisterTarget("emergencycard");
  }, [registerTarget, unregisterTarget, isTablet]);

  const loadBadges = useCallback(async () => {
    try {
      setBadgeCounts(await getNavBadgeCounts());
    } catch {
      setBadgeCounts({});
    }
  }, []);

  useEffect(() => {
    if (!isTablet || isSimpleMode) return;
    loadBadges();
    const interval = setInterval(loadBadges, 10000);
    return () => clearInterval(interval);
  }, [activeScreen, isSimpleMode, isTablet, loadBadges]);

  const getBadgeCount = useCallback((key: string) => badgeCounts[key] ?? 0, [badgeCounts]);
  const getNavAccessibilityLabel = useCallback((item: NavItem) => {
    const count = getBadgeCount(item.key);
    return count > 0 ? `${item.label}, ${count > 9 ? "9 plus" : count} pending` : item.label;
  }, [getBadgeCount]);
  const renderIconBadge = useCallback((count: number) => {
    if (count <= 0) return null;
    return (
      <View style={styles.iconBadge}>
        <Text style={styles.iconBadgeText}>{count > 9 ? "9+" : count}</Text>
      </View>
    );
  }, [styles]);

  if (!isTablet || isSimpleMode) return null;

  return (
    <View style={[styles.sidebarWrap, { width: SIDEBAR_WIDTH }]}>
      {themeId === "light" || themeId === "calm" ? (
        <LinearGradient
          colors={LIGHT_SIDEBAR_GRADIENT}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]} />
      )}
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
                const isEmergencyCard = item.key === "emergencycard";
                const badgeCount = getBadgeCount(item.key);
                return (
                  <View key={item.key} ref={isEmergencyCard ? emergencyCardRef : undefined} collapsable={false}>
                    <Pressable
                      style={[styles.navItem, styles.navItemExpanded, active && styles.navItemActive]}
                      onPress={() => onNavigate(item.key)}
                      onLongPress={item.key === "settings" ? openSynapseHQ : undefined}
                      delayLongPress={3500}
                      accessibilityRole="button"
                      accessibilityLabel={getNavAccessibilityLabel(item)}
                      accessibilityState={{ selected: active }}
                    >
                      <View style={styles.navIconWrap}>
                        <Ionicons
                          name={active ? item.iconActive : item.icon}
                          size={24}
                          color={active ? C.accent : C.textTertiary}
                        />
                        {renderIconBadge(badgeCount)}
                      </View>
                      <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
      </View>
      {__DEV__ ? synapseHQ.element : null}
    </View>
  );
}

function makeStyles(C: Theme, themeId: ThemeId) {
  return StyleSheet.create({
    sidebarWrap: {
      flexShrink: 0,
      borderRightWidth: 1,
      borderRightColor: C.border,
      shadowColor: "#000",
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: themeId === "dark" ? 0.18 : 0.06,
      shadowRadius: 4,
      elevation: 4,
      overflow: "hidden",
    },
    sidebar: {
      flex: 1,
    },
    logo: {
      fontWeight: "700",
      fontSize: 20,
      color: C.text,
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
      color: C.textTertiary,
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
      backgroundColor: C.sidebarActive,
      borderRadius: 10,
      marginHorizontal: 8,
    },
    navIconWrap: {
      position: "relative",
      minWidth: 28,
      minHeight: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBadge: {
      position: "absolute",
      top: -7,
      right: -10,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.red,
      borderWidth: 2,
      borderColor: themeId === "dark" ? "#1C1C1E" : "#FFFFFF",
    },
    iconBadgeText: {
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    navLabel: {
      fontWeight: "500",
      fontSize: 15,
      color: C.textSecondary,
      flex: 1,
    },
    navLabelActive: {
      color: C.text,
      fontWeight: "600",
    },
  });
}
