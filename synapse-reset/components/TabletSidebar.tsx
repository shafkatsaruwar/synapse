import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme, type ThemeId } from "@/contexts/ThemeContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { useIsTablet } from "@/lib/device";
import { useWalkthroughTargets, measureInWindow } from "@/contexts/WalkthroughContext";
import { useSynapseHQPanel } from "@/components/SynapseHQPanel";
import SynapseLogo from "@/components/SynapseLogo";
import { getNavBadgeCounts, type NavBadgeCounts } from "@/lib/nav-badge-counts";
import {
  getHamburgerItems,
  getNavEntry,
  resolveNavKey,
  type IconName,
} from "@/lib/navigation-registry";

const LIGHT_SIDEBAR_GRADIENT = ["#F5F1EA", "#E0EAE0"] as const;

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

const HAMBURGER_ITEMS: NavItem[] = getHamburgerItems().map((e) => ({
  key: e.key,
  label: e.label,
  icon: e.icon,
  iconActive: e.iconActive,
}));

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
    registerTarget("emergencycard-menu", () => measureInWindow(emergencyCardRef));
    return () => unregisterTarget("emergencycard-menu");
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

  const resolvedActive = resolveNavKey(activeScreen);
  const getBadgeCount = useCallback((key: string) => {
    if (key === "medications") return badgeCounts.medications ?? 0;
    if (key === "appointments") return badgeCounts.appointments ?? 0;
    return 0;
  }, [badgeCounts]);
  const getNavAccessibilityLabel = useCallback((item: NavItem) => {
    const count = getBadgeCount(item.key);
    return count > 0 ? `${item.label}, ${count > 9 ? "9 plus" : count} pending` : item.label;
  }, [getBadgeCount]);
  const isActive = useCallback(
    (itemKey: string) => {
      if (resolvedActive === itemKey) return true;
      return getNavEntry(resolvedActive)?.parent === itemKey;
    },
    [resolvedActive]
  );
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
      <View style={styles.logoRow}>
        <SynapseLogo size={36} />
        <Text style={styles.logo} numberOfLines={1}>
          Synapse
        </Text>
      </View>
      <ScrollView style={styles.navScroll} contentContainerStyle={styles.navScrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.group, styles.groupFirst]}>
          {HAMBURGER_ITEMS.map((item) => {
            const active = isActive(item.key);
            const isEmergencyHub = item.key === "emergencyhub";
            const badgeCount = getBadgeCount(item.key);
            return (
              <View key={item.key} ref={isEmergencyHub ? emergencyCardRef : undefined} collapsable={false}>
                <Pressable
                  style={[styles.navItem, styles.navItemExpanded, active && styles.navItemActive]}
                  onPress={() => onNavigate(item.key)}
                  onLongPress={item.key === "accounthub" ? openSynapseHQ : undefined}
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
                  <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={2}>
                    {item.label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {__DEV__ ? synapseHQ.element : null}
      </View>
    </View>
  );
}

function makeStyles(C: Theme, themeId: ThemeId) {
  const isDark = themeId === "dark";
  return StyleSheet.create({
    sidebarWrap: {
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: C.border,
      overflow: "hidden",
    },
    sidebar: {
      flex: 1,
      paddingHorizontal: 12,
      paddingBottom: 24,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    logo: {
      fontSize: 22,
      fontWeight: "700",
      color: C.text,
      flexShrink: 1,
    },
    navScroll: { flex: 1 },
    navScrollContent: { paddingBottom: 24 },
    group: { marginBottom: 8 },
    groupFirst: { marginTop: 0 },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 14,
      marginBottom: 4,
    },
    navItemExpanded: {},
    navItemActive: {
      backgroundColor: isDark ? "rgba(199,58,74,0.18)" : "rgba(255,255,255,0.55)",
    },
    navIconWrap: { width: 28, alignItems: "center", justifyContent: "center" },
    navLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: C.textSecondary,
    },
    navLabelActive: {
      color: C.accent,
      fontWeight: "600",
    },
    iconBadge: {
      position: "absolute",
      top: -4,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    iconBadgeText: {
      color: "#fff",
      fontSize: 9,
      fontWeight: "700",
    },
  });
}
