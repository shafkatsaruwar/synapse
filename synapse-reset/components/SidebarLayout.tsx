import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Platform,
  ScrollView,
  useWindowDimensions,
  Modal,
  Animated,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { useTheme, type Theme, type ThemeId } from "@/contexts/ThemeContext";
import GlassView from "@/components/GlassView";
import { useSynapseHQPanel } from "@/components/SynapseHQPanel";
import VisualScanImportModal from "@/screens/VisualScanImportModal";
import { healthProfileStorage, settingsStorage } from "@/lib/storage";
import { getDeveloperMode } from "@/lib/developer-mode";
import { getNavBadgeCounts, type NavBadgeCounts } from "@/lib/nav-badge-counts";
import {
  FULL_BOTTOM_TAB_KEYS,
  getHamburgerItems,
  getNavEntry,
  primaryTabForScreen,
  resolveNavKey,
  SIMPLE_BOTTOM_TAB_KEYS,
  type IconName,
} from "@/lib/navigation-registry";
import { useWalkthroughTargets, measureInWindow } from "@/contexts/WalkthroughContext";

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

function entryToNavItem(key: string, labelOverride?: string): NavItem {
  const entry = getNavEntry(key)!;
  return {
    key: entry.key,
    label: labelOverride ?? entry.label,
    icon: entry.icon,
    iconActive: entry.iconActive,
  };
}

/** Simple Mode keeps essential destinations reachable in one tap. */
const SIMPLE_NAV_ITEMS: NavItem[] = SIMPLE_BOTTOM_TAB_KEYS.map((key) => {
  if (key === "medications") return entryToNavItem(key, "Meds");
  if (key === "appointments") return entryToNavItem(key, "Visits");
  if (key === "feelinghub") return entryToNavItem(key, "Feeling");
  if (key === "accounthub") return entryToNavItem(key, "You");
  return entryToNavItem(key);
});

/** Full Mode bottom tabs — Today / Health / Quick Add / Emergency / You. */
const PRIMARY_ITEMS: NavItem[] = FULL_BOTTOM_TAB_KEYS.map((key) => {
  if (key === "quickadd") {
    return {
      key: "quickadd",
      label: "Add",
      icon: "add" as IconName,
      iconActive: "add" as IconName,
    };
  }
  if (key === "accounthub") return entryToNavItem(key, "You");
  if (key === "emergencyhub") return entryToNavItem(key, "Emergency");
  return entryToNavItem(key);
});

/** Primary hamburger: exactly the nine top-level destinations. */
const HAMBURGER_ITEMS: NavItem[] = getHamburgerItems().map((e) => ({
  key: e.key,
  label: e.label,
  icon: e.icon,
  iconActive: e.iconActive,
}));

const ESSENTIAL_SICK_KEYS = [
  "dashboard",
  "sickmode",
  "medications",
  "symptoms",
  "feelinghub",
  "health",
  "emergencyhub",
  "emergency",
  "emergencycard",
  "accounthub",
  "settings",
];

/**
 * Compact Zelle-style arc — five shortcuts above the centered +.
 * Keep the span tight so outer buttons (Scan / More) stay clearly above the tab bar
 * instead of sliding down behind it.
 */
const RADIAL_RADIUS = 132;
const RADIAL_LIFT = 36;
const RADIAL_ADD_ACTIONS = (
  [
    { key: "scan" as const, label: "Scan", icon: "scan-outline" as const },
    { key: "medication" as const, label: "Medication", icon: "medical-outline" as const },
    { key: "appointment" as const, label: "Appointment", icon: "calendar-outline" as const },
    { key: "symptom" as const, label: "Log Symptom", icon: "pulse-outline" as const },
    { key: "more" as const, label: "More", icon: "ellipsis-horizontal" as const },
  ] as const
).map((action, index, list) => {
  // ~110° arc centered on straight up — close together, all elevated.
  const span = Math.PI * 0.62;
  const start = Math.PI / 2 + span / 2;
  const end = Math.PI / 2 - span / 2;
  const t = list.length <= 1 ? 0.5 : index / (list.length - 1);
  const angle = start + (end - start) * t;
  return {
    ...action,
    offsetX: Math.cos(angle) * RADIAL_RADIUS,
    offsetY: -Math.sin(angle) * RADIAL_RADIUS - RADIAL_LIFT,
  };
});

type QuickAddTarget = "medication" | "appointment" | "symptom" | "calendar" | "labwork" | "imaging";
type RadialAddKey = (typeof RADIAL_ADD_ACTIONS)[number]["key"];

interface SidebarLayoutProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
  onSimpleAddSelect?: (target: QuickAddTarget) => void;
  children: React.ReactNode;
  sickMode?: boolean;
  simpleMode?: boolean;
  headerRight?: React.ReactNode;
  walkthroughStepId?: string | null;
  walkthroughMenuOpen?: boolean | null;
  webSidebarCollapsed?: boolean;
  onWebSidebarToggle?: (collapsed: boolean) => void;
}

export default function SidebarLayout({
  activeScreen,
  onNavigate,
  onBack,
  canGoBack = false,
  onSimpleAddSelect,
  children,
  sickMode,
  simpleMode = false,
  headerRight,
  walkthroughStepId,
  walkthroughMenuOpen,
  webSidebarCollapsed = false,
  onWebSidebarToggle,
}: SidebarLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const isWebPlatform = Platform.OS === "web";
  const [moreOpen, setMoreOpen] = useState(false);
  const [radialMenuOpen, setRadialMenuOpen] = useState(false);
  const [quickAddHubOpen, setQuickAddHubOpen] = useState(false);
  const [showVisualScanModal, setShowVisualScanModal] = useState(false);
  const [localWebSidebarCollapsed, setLocalWebSidebarCollapsed] = useState(webSidebarCollapsed);
  const drawerSlide = useRef(new Animated.Value(1)).current;
  const simpleAddFabSpin = useRef(new Animated.Value(0)).current;
  const radialActionProgress = useRef(RADIAL_ADD_ACTIONS.map(() => new Animated.Value(0))).current;
  const radialBackdropOpacity = useRef(new Animated.Value(0)).current;
  const simpleAddAnimatingRef = useRef(false);

  const isWideRef = useRef(isWide);
  useEffect(() => { isWideRef.current = isWide; }, [isWide]);

  useEffect(() => {
    setLocalWebSidebarCollapsed(webSidebarCollapsed);
  }, [webSidebarCollapsed]);

  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !isWideRef.current && gs.dx > 20 && Math.abs(gs.dy) < 40,
      onPanResponderRelease: (_, gs) => {
        if (!isWideRef.current && gs.dx > 60) setMoreOpen(true);
      },
    })
  ).current;
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeId), [C, themeId]);
  const [developerModeActive, setDeveloperModeActive] = useState(false);
  const synapseHQ = useSynapseHQPanel(setDeveloperModeActive);
  const openSynapseHQ = __DEV__ ? synapseHQ.open : undefined;
  const [settingsName, setSettingsName] = useState<string | undefined>(undefined);
  const [profileImageUri, setProfileImageUri] = useState<string | undefined>(undefined);
  const [badgeCounts, setBadgeCounts] = useState<NavBadgeCounts>({});
  const menuButtonRef = useRef<View>(null);
  const emergencyCardRef = useRef<View>(null);
  const recordsGroupRef = useRef<View>(null);
  const caregiverDashboardRef = useRef<View>(null);
  const simpleNavRef = useRef<View>(null);
  const simpleAddFabRef = useRef<View>(null);
  const showUniversalAdd = activeScreen !== "medications" && activeScreen !== "cycletracking";
  const walkthrough = useWalkthroughTargets();
  const registerTarget = walkthrough?.registerTarget;
  const unregisterTarget = walkthrough?.unregisterTarget;

  useEffect(() => {
    if (!registerTarget || !unregisterTarget) return;
    registerTarget("menu", () => measureInWindow(menuButtonRef));
    return () => unregisterTarget("menu");
  }, [registerTarget, unregisterTarget]);

  useEffect(() => {
    if (!registerTarget || !unregisterTarget || !moreOpen) return;
    // Emergency / Records hubs stand in for former leaf walkthrough targets in the drawer.
    registerTarget("emergencycard-menu", () => measureInWindow(emergencyCardRef));
    registerTarget("caregiverdashboard-menu", () => measureInWindow(caregiverDashboardRef));
    registerTarget("records-menu", () => measureInWindow(recordsGroupRef));
    registerTarget("labwork-menu", () => measureInWindow(recordsGroupRef));
    registerTarget("imaging-menu", () => measureInWindow(recordsGroupRef));
    return () => {
      unregisterTarget("emergencycard-menu");
      unregisterTarget("caregiverdashboard-menu");
      unregisterTarget("records-menu");
      unregisterTarget("labwork-menu");
      unregisterTarget("imaging-menu");
    };
  }, [registerTarget, unregisterTarget, moreOpen]);

  useEffect(() => {
    if (!registerTarget || !unregisterTarget || !simpleMode || !showUniversalAdd) return;
    registerTarget("simple-nav", () => measureInWindow(simpleNavRef));
    registerTarget("simple-add", () => measureInWindow(simpleAddFabRef));
    return () => {
      unregisterTarget("simple-nav");
      unregisterTarget("simple-add");
    };
  }, [registerTarget, unregisterTarget, simpleMode, showUniversalAdd]);

  const isWideScreen = width >= 768;
  const drawerWidth = Math.min(width * 0.78, isWideScreen ? 280 : 320);

  const loadSettings = useCallback(async () => {
    const [s, profile] = await Promise.all([settingsStorage.get(), healthProfileStorage.get()]);
    setSettingsName(s?.firstName?.trim() || s?.name);
    setProfileImageUri(profile?.profileImageUri);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings, activeScreen]);

  const loadBadges = useCallback(async () => {
    try {
      setBadgeCounts(await getNavBadgeCounts());
    } catch {
      setBadgeCounts({});
    }
  }, []);

  useEffect(() => {
    loadBadges();
    const interval = setInterval(loadBadges, 10000);
    return () => clearInterval(interval);
  }, [loadBadges, activeScreen, moreOpen, radialMenuOpen, quickAddHubOpen]);

  useEffect(() => {
    if (!__DEV__) {
      setDeveloperModeActive(false);
      return;
    }
    let mounted = true;
    getDeveloperMode()
      .then((state) => {
        if (mounted) setDeveloperModeActive(state?.isDeveloper === true);
      })
      .catch(() => {
        if (mounted) setDeveloperModeActive(false);
      });
    return () => {
      mounted = false;
    };
  }, [moreOpen]);

  const primaryItemsFiltered = PRIMARY_ITEMS;
  const bottomNavItems = simpleMode ? SIMPLE_NAV_ITEMS : primaryItemsFiltered;
  const showBottomNav = simpleMode || (!isWide && primaryItemsFiltered.length > 0);
  const shouldShowHeaderRow = !simpleMode && (!isWide || headerRight != null || canGoBack);
  const resolvedActive = resolveNavKey(activeScreen);
  const highlightedPrimary = primaryTabForScreen(resolvedActive);

  const displayName = settingsName?.trim() || "You";
  /** Only actionable medication/appointment badges — never roll up optional check-ins. */
  const getBadgeCount = useCallback((key: string) => {
    if (key === "health") {
      return (badgeCounts.medications ?? 0) + (badgeCounts.appointments ?? 0);
    }
    if (key === "medications") return badgeCounts.medications ?? 0;
    if (key === "appointments") return badgeCounts.appointments ?? 0;
    return 0;
  }, [badgeCounts]);
  const getNavAccessibilityLabel = useCallback((item: NavItem) => {
    const count = getBadgeCount(item.key);
    return count > 0 ? `${item.label}, ${count > 9 ? "9 plus" : count} pending` : item.label;
  }, [getBadgeCount]);
  const isNavItemActive = useCallback(
    (itemKey: string) => {
      if (simpleMode) {
        if (itemKey === "feelinghub") {
          return ["feelinghub", "log", "logtoday", "symptoms", "monthlycheckin"].includes(resolvedActive);
        }
        if (itemKey === "accounthub") {
          return highlightedPrimary === "accounthub" || resolvedActive === "settings";
        }
        return resolvedActive === itemKey;
      }
      if (itemKey === highlightedPrimary) return true;
      if (resolvedActive === itemKey) return true;
      // Highlight hamburger hub when a child of that hub is open
      const parent = getNavEntry(resolvedActive)?.parent;
      return parent === itemKey;
    },
    [resolvedActive, highlightedPrimary, simpleMode]
  );
  const renderIconBadge = useCallback((count: number) => {
    if (count <= 0) return null;
    return (
      <View style={styles.iconBadge}>
        <Text style={styles.iconBadgeText}>{count > 9 ? "9+" : count}</Text>
      </View>
    );
  }, [styles]);

  useEffect(() => {
    if (moreOpen) {
      Animated.spring(drawerSlide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      drawerSlide.setValue(1);
    }
  }, [moreOpen, drawerSlide]);

  useEffect(() => {
    if (isWide) return;
    if (walkthroughMenuOpen != null) {
      if (walkthroughMenuOpen) {
        setMoreOpen(true);
        return;
      }
      setMoreOpen(false);
      drawerSlide.setValue(1);
      return;
    }
    if (walkthroughStepId === "emergencycard") {
      setMoreOpen(true);
      return;
    }
    if (walkthroughStepId === "menu" || walkthroughStepId === "final" || walkthroughStepId == null) {
      setMoreOpen(false);
      drawerSlide.setValue(1);
    }
  }, [walkthroughMenuOpen, walkthroughStepId, isWide, drawerSlide]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerSlide, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setMoreOpen(false));
  }, [drawerSlide]);

  const closeRadialMenu = useCallback((afterClose?: () => void) => {
    if (!radialMenuOpen || simpleAddAnimatingRef.current) {
      afterClose?.();
      return;
    }
    simpleAddAnimatingRef.current = true;
    Animated.parallel([
      Animated.timing(simpleAddFabSpin, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(radialBackdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.stagger(
        22,
        [...radialActionProgress].reverse().map((value) =>
          Animated.timing(value, {
            toValue: 0,
            duration: 140,
            useNativeDriver: true,
          })
        )
      ),
    ]).start(() => {
      simpleAddAnimatingRef.current = false;
      setRadialMenuOpen(false);
      afterClose?.();
    });
  }, [radialActionProgress, radialBackdropOpacity, radialMenuOpen, simpleAddFabSpin]);

  const openRadialMenu = useCallback(() => {
    if (radialMenuOpen || simpleAddAnimatingRef.current) return;
    setQuickAddHubOpen(false);
    simpleAddAnimatingRef.current = true;
    setRadialMenuOpen(true);
    radialActionProgress.forEach((value) => value.setValue(0));
    radialBackdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(simpleAddFabSpin, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 12,
      }),
      Animated.timing(radialBackdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.stagger(
        36,
        radialActionProgress.map((value) =>
          Animated.spring(value, {
            toValue: 1,
            useNativeDriver: true,
            tension: 108,
            friction: 11,
          })
        )
      ),
    ]).start(() => {
      simpleAddAnimatingRef.current = false;
    });
  }, [radialActionProgress, radialBackdropOpacity, radialMenuOpen, simpleAddFabSpin]);

  const closeQuickAddHub = useCallback(() => {
    setQuickAddHubOpen(false);
    Animated.timing(simpleAddFabSpin, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [simpleAddFabSpin]);

  const openQuickAddHub = useCallback(() => {
    setQuickAddHubOpen(true);
    Animated.spring(simpleAddFabSpin, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 12,
    }).start();
  }, [simpleAddFabSpin]);

  const openHubFromRadial = useCallback(() => {
    if (simpleAddAnimatingRef.current) return;
    simpleAddAnimatingRef.current = true;
    Animated.parallel([
      Animated.timing(radialBackdropOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.stagger(
        18,
        [...radialActionProgress].reverse().map((value) =>
          Animated.timing(value, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          })
        )
      ),
    ]).start(() => {
      simpleAddAnimatingRef.current = false;
      setRadialMenuOpen(false);
      openQuickAddHub();
    });
  }, [openQuickAddHub, radialActionProgress, radialBackdropOpacity]);

  const toggleRadialMenu = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    if (quickAddHubOpen) {
      closeQuickAddHub();
      return;
    }
    if (radialMenuOpen) {
      closeRadialMenu();
      return;
    }
    openRadialMenu();
  }, [closeQuickAddHub, closeRadialMenu, openRadialMenu, quickAddHubOpen, radialMenuOpen]);

  /** Simple Mode FAB opens the full Quick Add sheet (preserves prior behavior). */
  const toggleSimpleAddHub = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    if (quickAddHubOpen) {
      closeQuickAddHub();
      return;
    }
    if (radialMenuOpen) {
      openHubFromRadial();
      return;
    }
    openQuickAddHub();
  }, [closeQuickAddHub, openHubFromRadial, openQuickAddHub, quickAddHubOpen, radialMenuOpen]);

  const handleSimpleAddPress = useCallback((target: QuickAddTarget) => {
    void Haptics.selectionAsync().catch(() => {});
    if (radialMenuOpen) closeRadialMenu();
    if (quickAddHubOpen) closeQuickAddHub();
    onSimpleAddSelect?.(target);
  }, [closeQuickAddHub, closeRadialMenu, onSimpleAddSelect, quickAddHubOpen, radialMenuOpen]);

  const handleScanPress = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    if (radialMenuOpen) closeRadialMenu();
    if (quickAddHubOpen) closeQuickAddHub();
    setShowVisualScanModal(true);
  }, [closeQuickAddHub, closeRadialMenu, quickAddHubOpen, radialMenuOpen]);

  const handleRadialActionPress = useCallback((key: RadialAddKey) => {
    void Haptics.selectionAsync().catch(() => {});
    if (key === "more") {
      openHubFromRadial();
      return;
    }
    if (key === "scan") {
      handleScanPress();
      return;
    }
    handleSimpleAddPress(key);
  }, [handleScanPress, handleSimpleAddPress, openHubFromRadial]);

  const handleBottomNavPress = useCallback((itemKey: string) => {
    if (itemKey === "quickadd") {
      toggleRadialMenu();
      return;
    }
    if (radialMenuOpen) closeRadialMenu();
    if (quickAddHubOpen) closeQuickAddHub();
    onNavigate(itemKey);
  }, [closeQuickAddHub, closeRadialMenu, onNavigate, quickAddHubOpen, radialMenuOpen, toggleRadialMenu]);

  const shouldShowWebSidebar = isWebPlatform && !isWide && !simpleMode;
  const sidebarWidth = 260;
  const collapsedSidebarWidth = 70;
  const currentSidebarWidth = localWebSidebarCollapsed ? collapsedSidebarWidth : sidebarWidth;
  const navBarBottom = Platform.OS === "web" ? 20 : insets.bottom + 16;
  /** Approximate vertical center of the bottom nav pill — radial fan origin. */
  const radialOriginBottom = navBarBottom + (simpleMode ? 30 : 34);
  /** Floating FAB only when the centered Quick Add tab is not available (Simple Mode or wide layouts). */
  const showFloatingSimpleFab = showUniversalAdd && (simpleMode || !showBottomNav);

  const renderBottomNavItem = useCallback(
    (item: NavItem) => {
      if (item.key === "quickadd") {
        const open = radialMenuOpen || quickAddHubOpen;
        return (
          <Pressable
            key={item.key}
            style={styles.mobileNavItem}
            onPress={() => handleBottomNavPress(item.key)}
            testID="tab-quickadd"
            accessibilityRole="button"
            accessibilityLabel={open ? "Close quick add" : "Quick add"}
            accessibilityHint={
              open
                ? "Close add options"
                : "Open shortcuts for scan, medication, appointment, symptom, and more"
            }
            accessibilityState={{ expanded: open }}
          >
            <View style={styles.quickAddNavButtonWrap}>
              <View style={[styles.quickAddNavButton, open && styles.quickAddNavButtonOpen]}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: simpleAddFabSpin.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "45deg"],
                        }),
                      },
                      {
                        scale: simpleAddFabSpin.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.04],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons name="add" size={28} color="#fff" />
                </Animated.View>
              </View>
            </View>
          </Pressable>
        );
      }

      const active = isNavItemActive(item.key);
      const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
      const badgeCount = getBadgeCount(item.key);
      return (
        <Pressable
          key={item.key}
          style={[styles.mobileNavItem, simpleMode && styles.mobileNavItemSimple, dimmed && { opacity: 0.35 }]}
          onPress={() => handleBottomNavPress(item.key)}
          onLongPress={item.key === "settings" || item.key === "accounthub" ? openSynapseHQ : undefined}
          delayLongPress={3500}
          testID={`tab-${item.key}`}
          accessibilityRole="button"
          accessibilityLabel={getNavAccessibilityLabel(item)}
          accessibilityState={{ selected: active }}
        >
          <View style={styles.mobileNavIconWrap}>
            <Ionicons
              name={active ? item.iconActive : item.icon}
              size={simpleMode ? 22 : 24}
              color={active ? (sickMode ? C.red : C.accent) : "#8E8E93"}
            />
            {renderIconBadge(badgeCount)}
          </View>
          {simpleMode ? (
            <Text
              style={[styles.mobileNavLabel, active && styles.mobileNavLabelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.76}
            >
              {item.label}
            </Text>
          ) : null}
        </Pressable>
      );
    },
    [
      C.accent,
      C.red,
      getBadgeCount,
      getNavAccessibilityLabel,
      handleBottomNavPress,
      isNavItemActive,
      openSynapseHQ,
      quickAddHubOpen,
      radialMenuOpen,
      renderIconBadge,
      simpleAddFabSpin,
      simpleMode,
      sickMode,
      styles,
    ]
  );

  const mainContent = (
    <View style={styles.mobileContainer} {...swipePanResponder.panHandlers}>
      {shouldShowHeaderRow ? (
        <View style={[styles.mobileHeaderRow, { paddingTop: Platform.OS === "web" ? 12 : insets.top }]}>
          {isWide ? <View style={styles.headerSpacerLeft} /> : !shouldShowWebSidebar ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {canGoBack && onBack ? (
                <Pressable
                  style={styles.mobileMenuBtn}
                  onPress={onBack}
                  testID="nav-back"
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="chevron-back" size={28} color={C.text} />
                </Pressable>
              ) : null}
              <View ref={menuButtonRef} collapsable={false}>
                <Pressable
                  style={styles.mobileMenuBtn}
                  onPress={() => setMoreOpen(true)}
                  testID="tab-more"
                  accessibilityRole="button"
                  accessibilityLabel="Open menu"
                >
                  <Ionicons name="menu" size={26} color={C.text} />
                </Pressable>
              </View>
            </View>
          ) : <View style={styles.headerSpacerLeft} />}
          {headerRight != null ? headerRight : <View style={styles.mobileHeaderSpacer} />}
        </View>
      ) : null}

      <View
        style={[
          styles.mobileContent,
          Platform.OS === "web" && { flex: 0, minHeight: "100vh", overflow: "auto" },
          {
            paddingHorizontal: simpleMode ? 0 : 8,
            paddingBottom: showBottomNav
              ? (Platform.OS === "web" ? 108 : insets.bottom + 96)
              : isWide
                ? Platform.OS === "web" ? 34 : insets.bottom + 16
                : 24,
            minHeight: showBottomNav || !isWide ? Math.max(200, height * 0.4) : undefined,
          },
        ]}
      >
        {children}
      </View>

      {showBottomNav && (
        <View
          ref={simpleMode ? simpleNavRef : undefined}
          collapsable={false}
          pointerEvents="box-none"
          style={[
            styles.mobileNavWrap,
            {
              bottom: navBarBottom,
              left: 20,
              right: 20,
            },
          ]}
        >
          {Platform.OS === "web" ? (
            <View style={[styles.mobileNav, simpleMode && styles.mobileNavSimple, styles.mobileNavFallback]}>
              <View style={styles.mobileNavContent}>{bottomNavItems.map(renderBottomNavItem)}</View>
            </View>
          ) : (
            <GlassView variant="nav" tint={themeId === "dark" ? "dark" : "light"} style={[styles.mobileNav, simpleMode && styles.mobileNavSimple]}>
              <View style={styles.mobileNavContent}>{bottomNavItems.map(renderBottomNavItem)}</View>
            </GlassView>
          )}
        </View>
      )}

      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          styles.simpleAddOverlayRoot,
          // Sit above the tab bar while open so Scan / More are not covered by the pill.
          radialMenuOpen && styles.simpleAddOverlayRootRaised,
        ]}
      >
        {radialMenuOpen ? (
          <Animated.View
            pointerEvents="auto"
            style={[
              styles.radialAddBackdrop,
              { opacity: radialBackdropOpacity },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => closeRadialMenu()}
              accessibilityRole="button"
              accessibilityLabel="Close quick add"
            />
          </Animated.View>
        ) : null}

        {radialMenuOpen ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.radialAddLayer,
              {
                bottom: radialOriginBottom,
              },
            ]}
          >
            {RADIAL_ADD_ACTIONS.map((action, index) => {
              const progress = radialActionProgress[index];
              return (
                <Animated.View
                  key={action.key}
                  pointerEvents="box-none"
                  style={[
                    styles.radialAddActionWrap,
                    {
                      opacity: progress,
                      transform: [
                        {
                          translateX: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, action.offsetX],
                          }),
                        },
                        {
                          translateY: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, action.offsetY],
                          }),
                        },
                        {
                          scale: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.55, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Pressable
                    style={({ pressed }) => [styles.radialAddAction, pressed && styles.simpleAddActionPressed]}
                    onPress={() => handleRadialActionPress(action.key)}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    hitSlop={6}
                  >
                    <View style={styles.radialAddActionButton}>
                      <Ionicons name={action.icon} size={22} color={C.tint} />
                    </View>
                    <Text style={styles.radialAddActionLabel} numberOfLines={2}>
                      {action.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        ) : null}

        {quickAddHubOpen ? (
          <Pressable
            style={styles.simpleAddBackdrop}
            onPress={closeQuickAddHub}
            accessibilityRole="button"
            accessibilityLabel="Close quick add"
          />
        ) : null}

        {quickAddHubOpen ? (
          <GlassView
            variant="sheet"
            tint={themeId === "dark" ? "dark" : "light"}
            style={[
              styles.quickAddHub,
              {
                left: isWide ? undefined : 20,
                right: isWide ? 24 : 20,
                bottom: Platform.OS === "web" ? 110 : insets.bottom + (showBottomNav ? 134 : 28),
              },
            ]}
          >
            <View style={styles.quickAddHeader}>
              <View style={styles.quickAddHeaderText}>
                <Text style={styles.quickAddEyebrow}>Quick Add</Text>
                <Text style={styles.quickAddTitle}>What are we adding?</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.quickAddCloseButton, pressed && styles.simpleAddActionPressed]}
                onPress={closeQuickAddHub}
                accessibilityRole="button"
                accessibilityLabel="Close quick add"
              >
                <Ionicons name="close" size={20} color={C.text} />
              </Pressable>
            </View>
            <Pressable style={[styles.quickAddOption, styles.quickAddOptionPrimary]} onPress={handleScanPress}>
              <View style={[styles.quickAddOptionIcon, styles.quickAddOptionIconPrimary]}>
                <Ionicons name="scan-outline" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickAddOptionTitlePrimary}>Scan</Text>
                <Text style={styles.quickAddOptionSubtitlePrimary}>Camera or photo upload</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </Pressable>
            <View style={styles.quickAddOption}>
              <View style={styles.quickAddOptionIcon}>
                <Ionicons name="create-outline" size={21} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickAddOptionTitle}>Add Manually</Text>
                <View style={styles.quickAddManualRow}>
                  <Pressable style={styles.quickAddMiniButton} onPress={() => handleSimpleAddPress("medication")}>
                    <Text style={styles.quickAddMiniText}>Med</Text>
                  </Pressable>
                  <Pressable style={styles.quickAddMiniButton} onPress={() => handleSimpleAddPress("appointment")}>
                    <Text style={styles.quickAddMiniText}>Visit</Text>
                  </Pressable>
                  <Pressable style={styles.quickAddMiniButton} onPress={() => handleSimpleAddPress("labwork")}>
                    <Text style={styles.quickAddMiniText}>Lab</Text>
                  </Pressable>
                  <Pressable style={styles.quickAddMiniButton} onPress={() => handleSimpleAddPress("imaging")}>
                    <Text style={styles.quickAddMiniText}>Imaging</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <Pressable style={styles.quickAddOption} onPress={() => handleSimpleAddPress("calendar")}>
              <View style={styles.quickAddOptionIcon}>
                <Ionicons name="calendar-outline" size={21} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickAddOptionTitle}>Import from Calendar</Text>
                <Text style={styles.quickAddOptionSubtitle}>Pull in an Apple Calendar event</Text>
              </View>
            </Pressable>
            <Pressable style={styles.quickAddOption} onPress={() => handleSimpleAddPress("symptom")}>
              <View style={styles.quickAddOptionIcon}>
                <Ionicons name="pulse-outline" size={21} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickAddOptionTitle}>Log Symptom</Text>
                <Text style={styles.quickAddOptionSubtitle}>Record what happened fast</Text>
              </View>
            </Pressable>
          </GlassView>
        ) : null}

        {showFloatingSimpleFab ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.simpleAddWheelLayer,
              {
                right: isWide ? 24 : 20,
                bottom: Platform.OS === "web" ? (showBottomNav ? 148 : 34) : insets.bottom + (showBottomNav ? 154 : 28),
              },
            ]}
          >
            <Pressable
              ref={simpleAddFabRef}
              collapsable={false}
              style={styles.simpleAddFab}
              onPress={toggleSimpleAddHub}
              accessibilityRole="button"
              accessibilityLabel={quickAddHubOpen ? "Close quick add" : "Quick add"}
              accessibilityHint={
                quickAddHubOpen
                  ? "Close add options"
                  : "Add a medication, appointment, symptom, or scan a document"
              }
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: simpleAddFabSpin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "45deg"],
                      }),
                    },
                    {
                      scale: simpleAddFabSpin.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.04],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons name="add" size={30} color="#fff" />
              </Animated.View>
            </Pressable>
          </View>
        ) : null}
      </View>

      <VisualScanImportModal
        visible={showVisualScanModal}
        initialType="medication"
        onClose={() => setShowVisualScanModal(false)}
        onSaved={() => {
          setShowVisualScanModal(false);
          onNavigate(activeScreen);
        }}
      />

      {(!simpleMode || walkthroughMenuOpen === true) && !isWide && (
      <Modal
          visible={moreOpen}
          transparent
          animationType="fade"
          onRequestClose={closeDrawer}
        >
          <View style={styles.drawerContainer}>
            <Pressable
              style={styles.drawerOverlay}
              onPress={closeDrawer}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            />
            <Animated.View
              style={[
                styles.drawerPanel,
                {
                  width: drawerWidth,
                  paddingTop: 0,
                  paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16,
                  transform: [{ translateX: drawerSlide.interpolate({ inputRange: [0, 1], outputRange: [0, -drawerWidth] }) }],
                },
              ]}
            >
              <View pointerEvents="none" style={styles.drawerTintLayer} />
              <GlassView
                variant="sheet"
                tint={themeId === "dark" ? "dark" : "light"}
                intensity={86}
                style={styles.drawerGlassLayer}
              />
              <ScrollView
                style={[styles.drawerScroll, { paddingTop: Platform.OS === "web" ? 12 : insets.top + 32 }]}
                contentContainerStyle={styles.drawerScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={styles.drawerProfile}>
                  <View style={styles.drawerAvatar}>
                    {profileImageUri ? (
                      <Image source={{ uri: profileImageUri }} style={styles.drawerAvatarImage} />
                    ) : (
                      <Text style={styles.drawerAvatarText}>
                        {displayName.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.drawerProfileName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.drawerProfileStatus}>Local profile</Text>
                </View>

                <View
                  ref={recordsGroupRef}
                  style={[styles.drawerGroup, styles.drawerGroupFirst]}
                  collapsable={false}
                >
                  {HAMBURGER_ITEMS.map((item) => {
                    const active = isNavItemActive(item.key);
                    const isEmergencyHub = item.key === "emergencyhub";
                    const isCareHub = item.key === "carehub";
                    const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
                    const accentColor = sickMode ? C.red : C.accent;
                    const itemColor = active ? accentColor : C.textSecondary;
                    const badgeCount = getBadgeCount(item.key);
                    return (
                      <View
                        key={item.key}
                        ref={
                          isEmergencyHub
                            ? emergencyCardRef
                            : isCareHub
                              ? caregiverDashboardRef
                              : undefined
                        }
                        collapsable={false}
                      >
                        <Pressable
                          style={({ pressed }) => [
                            styles.drawerRow,
                            active && [styles.drawerRowActive, { borderLeftColor: accentColor }],
                            dimmed && { opacity: 0.35 },
                            pressed && styles.drawerRowPressed,
                          ]}
                          onPress={() => {
                            onNavigate(item.key);
                            closeDrawer();
                          }}
                          onLongPress={item.key === "accounthub" ? openSynapseHQ : undefined}
                          delayLongPress={3500}
                          testID={`more-${item.key}`}
                          accessibilityRole="button"
                          accessibilityLabel={getNavAccessibilityLabel(item)}
                          accessibilityState={{ selected: active }}
                        >
                          <View style={styles.drawerRowIconWrap}>
                            <Ionicons
                              name={item.icon}
                              size={20}
                              color={itemColor}
                              style={styles.drawerRowIcon}
                            />
                            {renderIconBadge(badgeCount)}
                          </View>
                          <Text
                            style={[styles.drawerRowLabel, { color: itemColor }, active && { color: accentColor, fontWeight: "600" }]}
                            numberOfLines={2}
                          >
                            {item.label}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={itemColor} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.drawerFooter}>
                  <View style={styles.drawerFooterDivider} />
                  <View style={styles.drawerFooterContent}>
                    <Text style={styles.drawerFooterText}>
                      Synapse v{Constants.expoConfig?.version ?? "1.3"}{developerModeActive ? " (dev)" : ""}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      )}
      {__DEV__ ? synapseHQ.element : null}
    </View>
  );

  if (shouldShowWebSidebar) {
    return (
      <View style={{ flexDirection: "row", height: "100%", backgroundColor: C.background }}>
        {/* Web Sidebar */}
        <View style={{
          width: currentSidebarWidth,
          backgroundColor: C.surface,
          borderRightWidth: 1,
          borderRightColor: C.border,
          overflow: "hidden",
          flexDirection: "column",
        }}>
          <View style={{ paddingTop: 12, paddingHorizontal: 8, paddingBottom: 8, alignItems: "center" }}>
            <Pressable
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 8,
                backgroundColor: pressed ? C.surfaceElevated : "transparent",
              })}
              onPress={() => {
                const newCollapsed = !localWebSidebarCollapsed;
                setLocalWebSidebarCollapsed(newCollapsed);
                onWebSidebarToggle?.(newCollapsed);
              }}
              accessibilityRole="button"
              accessibilityLabel={localWebSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              accessibilityHint="Toggle sidebar expansion"
            >
              <Ionicons
                name={localWebSidebarCollapsed ? "menu" : "close"}
                size={24}
                color={C.text}
              />
            </Pressable>
          </View>

          {!localWebSidebarCollapsed && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={{ marginBottom: 12 }}>
                {HAMBURGER_ITEMS.map((item) => {
                  const active = isNavItemActive(item.key);
                  const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => onNavigate(item.key)}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      style={({ pressed }) => ({
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        marginBottom: 4,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: active
                          ? themeId === "dark" ? "rgba(199,58,74,0.18)" : "rgba(255,255,255,0.36)"
                          : pressed ? themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.08)"
                          : "transparent",
                        opacity: dimmed ? 0.4 : 1,
                        borderLeftWidth: active ? 3 : 0,
                        borderLeftColor: active ? (sickMode ? C.red : C.accent) : "transparent",
                      })}
                    >
                      <Ionicons
                        name={active ? item.iconActive : item.icon}
                        size={20}
                        color={active ? (sickMode ? C.red : C.accent) : C.textSecondary}
                      />
                      {!localWebSidebarCollapsed ? (
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 13,
                            fontWeight: active ? "600" : "500",
                            color: active ? (sickMode ? C.red : C.accent) : C.textSecondary,
                          }}
                          numberOfLines={2}
                        >
                          {item.label}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Main Content */}
        <View style={{ flex: 1 }}>
          {mainContent}
        </View>
      </View>
    );
  }

  return mainContent;
}

function makeStyles(C: Theme, themeId: ThemeId) {
  return StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: themeId === "light" ? "transparent" : C.background,
    },
    sidebar: {
      width: 220,
      backgroundColor: C.sidebar,
      borderRightWidth: 1,
      borderRightColor: C.border,
      paddingHorizontal: 12,
      justifyContent: "space-between",
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingBottom: 28,
    },
    brandText: {
      fontWeight: "700",
      fontSize: 20,
      color: C.text,
      letterSpacing: -0.5,
    },
    navList: {
      flex: 1,
      gap: 2,
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    navItemActive: {
      backgroundColor: C.sidebarActive,
    },
    navLabel: {
      fontWeight: "500",
      fontSize: 14,
      color: C.textTertiary,
    },
    navLabelActive: {
      color: C.text,
      fontWeight: "600",
    },
    sidebarFooter: {
      paddingBottom: 20,
    },
    sidebarDivider: {
      height: 1,
      backgroundColor: C.border,
      marginBottom: 12,
    },
    sidebarVersion: {
      fontWeight: "400",
      fontSize: 11,
      color: C.textTertiary,
      paddingHorizontal: 12,
    },
    main: {
      flex: 1,
      minWidth: 0,
      backgroundColor: themeId === "light" ? "transparent" : C.background,
    },
    mobileContainer: {
      flex: 1,
      minHeight: 1,
      backgroundColor: themeId === "light" ? "transparent" : C.background,
    },
    mobileHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 8,
      // Keep chrome tight under the status bar / Dynamic Island — avoid a tall empty band.
      paddingBottom: 2,
      borderBottomWidth: 0,
      backgroundColor: "transparent",
      // Keep menu tappable above the Quick Add absoluteFill layer.
      zIndex: 60,
      elevation: 60,
    },
    mobileMenuBtn: {
      padding: 4,
      marginLeft: -4,
    },
    mobileHeaderSpacer: { width: 1, minWidth: 1 },
    headerSpacerLeft: { flex: 1 },
    mobileContent: {
      flex: 1,
      minHeight: 1,
      paddingHorizontal: 8,
    },
    mobileNavWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      // Must sit above the Quick Add absoluteFill wrapper; otherwise bottom tabs
      // (and often the menu) stop receiving taps on screens like Daily Check-in.
      zIndex: 60,
      elevation: 60,
    },
    mobileNav: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 32,
      paddingVertical: 12,
      paddingHorizontal: 10,
      // Allow the centered Quick Add + to sit slightly proud of the pill.
      overflow: "visible",
    },
    mobileNavSimple: {
      borderRadius: 28,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    mobileNavFallback: {
      backgroundColor: themeId === "light" ? "rgba(255,255,255,0.85)" : "rgba(28,28,30,0.9)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
    },
    mobileNavContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flex: 1,
    },
    mobileNavItem: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 22,
      flex: 1,
    },
    mobileNavItemSimple: {
      minWidth: 0,
      gap: 2,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    mobileNavIconWrap: {
      position: "relative",
      minWidth: 28,
      minHeight: 26,
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
      // Solid red — no contrasting white ring around the badge.
      borderWidth: 0,
    },
    iconBadgeText: {
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    mobileNavLabel: {
      fontWeight: "600",
      fontSize: 10,
      color: "#8E8E93",
      textAlign: "center",
      maxWidth: "100%",
    },
    mobileNavLabelActive: {
      color: C.accent,
    },
    simpleAddOverlayRoot: {
      // Below header + bottom tabs (zIndex 60) so navigation stays usable when closed.
      zIndex: 40,
      elevation: 40,
    },
    simpleAddOverlayRootRaised: {
      zIndex: 70,
      elevation: 70,
    },
    quickAddNavButtonWrap: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 52,
      minHeight: 52,
    },
    quickAddNavButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
      // Keep the + crisp — no soft halo.
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    quickAddNavButtonOpen: {
      backgroundColor: C.tint,
    },
    radialAddBackdrop: {
      ...StyleSheet.absoluteFillObject,
      // Leave the bottom tab bar clear so the dimmer never intercepts tab taps.
      bottom: Platform.OS === "web" ? 108 : 96,
      backgroundColor: themeId === "dark" ? "rgba(0,0,0,0.28)" : "rgba(17,24,39,0.18)",
    },
    radialAddLayer: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 0,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 48,
    },
    radialAddActionWrap: {
      position: "absolute",
      width: 76,
      alignItems: "center",
      marginLeft: -38,
      marginTop: -28,
    },
    radialAddAction: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 5,
    },
    radialAddActionButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: themeId === "light" || themeId === "evergreen" ? "#FFFFFF" : C.surface,
      borderWidth: 1,
      borderColor: themeId === "dark" || themeId === "evergreenDark" ? "rgba(255,255,255,0.14)" : "rgba(71,122,112,0.18)",
      alignItems: "center",
      justifyContent: "center",
      // Flat discs — the soft shadow read as a weird glow on the dimmed backdrop.
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    radialAddActionLabel: {
      color: C.text,
      fontSize: 10,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 12,
      maxWidth: 72,
    },
    simpleAddFab: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: C.tint,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.34,
      shadowRadius: 22,
      elevation: 12,
      zIndex: 40,
    },
    simpleAddWheelLayer: {
      position: "absolute",
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    simpleAddBackdrop: {
      ...StyleSheet.absoluteFillObject,
      // Leave the bottom tab bar clear so the dimmer never intercepts tab taps.
      bottom: Platform.OS === "web" ? 108 : 96,
      backgroundColor: themeId === "dark" ? "rgba(0,0,0,0.12)" : "rgba(17,24,39,0.04)",
    },
    quickAddHub: {
      position: "absolute",
      maxWidth: 390,
      borderRadius: 30,
      padding: 18,
      gap: 10,
      zIndex: 45,
    },
    quickAddHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 2,
    },
    quickAddHeaderText: {
      flex: 1,
    },
    quickAddCloseButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.82)",
      alignItems: "center",
      justifyContent: "center",
    },
    quickAddEyebrow: {
      color: C.textSecondary,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    quickAddTitle: {
      color: C.text,
      fontSize: 22,
      fontWeight: "900",
      marginBottom: 2,
    },
    quickAddOption: {
      minHeight: 64,
      borderRadius: 22,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.58)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.76)",
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    quickAddOptionPrimary: {
      backgroundColor: C.tint,
      borderColor: C.tint,
    },
    quickAddOptionIcon: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.58)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.76)",
      alignItems: "center",
      justifyContent: "center",
    },
    quickAddOptionIconPrimary: {
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    quickAddOptionTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: "800",
    },
    quickAddOptionTitlePrimary: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "900",
    },
    quickAddOptionSubtitle: {
      color: C.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 2,
    },
    quickAddOptionSubtitlePrimary: {
      color: "rgba(255,255,255,0.82)",
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    quickAddManualRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginTop: 8,
    },
    quickAddMiniButton: {
      minHeight: 32,
      borderRadius: 999,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.84)",
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    quickAddMiniText: {
      color: C.text,
      fontSize: 12,
      fontWeight: "800",
    },
    simpleAddActionWrap: {
      position: "absolute",
      right: 0,
      bottom: 0,
    },
    simpleAddAction: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: themeId === "light" ? "rgba(255,255,255,0.92)" : C.surface,
      borderWidth: 1,
      borderColor: themeId === "light" ? "rgba(255,255,255,0.78)" : C.border,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 8,
    },
    simpleAddActionPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.99 }],
    },
    drawerContainer: {
      flex: 1,
      flexDirection: "row",
    },
    drawerOverlay: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      right: 0,
      backgroundColor: themeId === "dark" ? "rgba(0,0,0,0.48)" : "rgba(15,31,54,0.28)",
    },
    drawerPanel: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      overflow: "hidden",
      borderRightWidth: 1,
      borderRightColor: themeId === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.74)",
      paddingHorizontal: 20,
      borderTopRightRadius: 32,
      borderBottomRightRadius: 32,
      shadowColor: "#6F645E",
      shadowOffset: { width: 12, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 34,
      elevation: 18,
    },
    drawerTintLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: themeId === "dark" ? "rgba(16,10,11,0.42)" : "rgba(245,241,234,0.22)",
    },
    drawerGlassLayer: {
      ...StyleSheet.absoluteFillObject,
      borderTopRightRadius: 32,
      borderBottomRightRadius: 32,
    },
    drawerScroll: {
      flex: 1,
    },
    drawerScrollContent: {
      flexGrow: 1,
      paddingBottom: 8,
    },
    drawerProfile: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 24,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.24)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)",
      marginBottom: 10,
    },
    drawerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.52)",
      borderWidth: 1,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.84)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      overflow: "hidden",
    },
    drawerAvatarImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    drawerAvatarText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.accent,
    },
    drawerProfileName: {
      fontSize: 15,
      fontWeight: "600",
      color: C.text,
      marginBottom: 1,
    },
    drawerProfileEmail: {
      fontSize: 12,
      color: C.textTertiary,
      marginBottom: 2,
    },
    drawerProfileStatus: {
      fontSize: 11,
      color: C.textTertiary,
    },
    drawerSignInLink: {
      alignSelf: "flex-start",
      marginTop: 4,
      paddingVertical: 2,
      paddingHorizontal: 0,
    },
    drawerSignInLinkText: {
      fontSize: 13,
      fontWeight: "500",
      color: C.accent,
    },
    drawerGroup: {
      marginTop: 14,
      marginBottom: 10,
    },
    drawerGroupFirst: {
      marginTop: 10,
    },
    drawerGroupTitle: {
      fontSize: 11,
      fontWeight: "600",
      color: C.textTertiary,
      letterSpacing: 0.5,
      marginBottom: 4,
      paddingHorizontal: 4,
    },
    drawerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 16,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: "transparent",
    },
    drawerRowActive: {
      backgroundColor: themeId === "dark" ? "rgba(199,58,74,0.18)" : "rgba(255,255,255,0.36)",
      borderLeftWidth: 4,
      borderLeftColor: C.tint,
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.76)",
      paddingLeft: 10,
    },
    drawerRowPressed: {
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.32)",
      borderColor: themeId === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.72)",
    },
    drawerRowIconWrap: {
      position: "relative",
      marginRight: 10,
      minWidth: 24,
      minHeight: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    drawerRowIcon: {
      marginRight: 0,
    },
    drawerRowLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: C.text,
    },
    drawerFooter: {
      marginTop: 6,
      paddingBottom: 4,
    },
    drawerFooterDivider: {
      height: 1,
      backgroundColor: themeId === "dark" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.58)",
      marginBottom: 6,
    },
    drawerFooterContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 4,
    },
    drawerFooterText: {
      fontSize: 11,
      color: C.textTertiary,
    },
  });
}
