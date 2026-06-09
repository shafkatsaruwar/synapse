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
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { useTheme, type Theme, type ThemeId } from "@/contexts/ThemeContext";
import SynapseLogo from "@/components/SynapseLogo";
import { useSynapseHQPanel } from "@/components/SynapseHQPanel";
import VisualScanImportModal from "@/screens/VisualScanImportModal";
import { featureFlags } from "@/constants/feature-flags";
import { useAuth } from "@/contexts/AuthContext";
import { healthProfileStorage, settingsStorage } from "@/lib/storage";
import { getDeveloperMode } from "@/lib/developer-mode";
import { useWalkthroughTargets, measureInWindow } from "@/contexts/WalkthroughContext";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

const SIMPLE_NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Home", icon: "home-outline", iconActive: "home" },
  { key: "medications", label: "Meds", icon: "medical-outline", iconActive: "medical" },
  { key: "appointments", label: "Visits", icon: "calendar-outline", iconActive: "calendar" },
  { key: "symptoms", label: "Symptoms", icon: "pulse-outline", iconActive: "pulse" },
  { key: "settings", label: "Account", icon: "person-circle-outline", iconActive: "person-circle" },
];

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid-outline", iconActive: "grid" },
  { key: "log", label: "Daily Log", icon: "heart-outline", iconActive: "heart" },
  { key: "healthdata", label: "Vitals", icon: "analytics-outline", iconActive: "analytics" },
  { key: "medications", label: "Medications", icon: "medical-outline", iconActive: "medical" },
  { key: "symptoms", label: "Symptoms", icon: "pulse-outline", iconActive: "pulse" },
  { key: "labwork", label: "LabWork", icon: "flask-outline", iconActive: "flask" },
  { key: "imaging", label: "Imaging", icon: "scan-outline", iconActive: "scan" },
  { key: "timeline", label: "Timeline", icon: "git-branch-outline", iconActive: "git-branch" },
  ...(featureFlags.documentScannerEnabled ? [
    { key: "documents", label: "Documents", icon: "scan-outline", iconActive: "scan" },
    { key: "insights", label: "Insights", icon: "sparkles-outline", iconActive: "sparkles" },
  ] : []) as NavItem[],
  { key: "monthlycheckin", label: "Monthly check-in", icon: "fitness-outline", iconActive: "fitness" },
  { key: "cycletracking", label: "Cycle tracking", icon: "water-outline", iconActive: "water" },
  { key: "eating", label: "Eating", icon: "restaurant-outline", iconActive: "restaurant" },
  { key: "mentalhealth", label: "Mental health day", icon: "heart-outline", iconActive: "heart" },
  { key: "comfort", label: "Mood lifters", icon: "happy-outline", iconActive: "happy" },
  { key: "goals", label: "Goals", icon: "flag-outline", iconActive: "flag" },
  { key: "appointments", label: "Appointments", icon: "calendar-outline", iconActive: "calendar" },
  { key: "reports", label: "Reports", icon: "bar-chart-outline", iconActive: "bar-chart" },
  { key: "privacy", label: "Privacy", icon: "shield-outline", iconActive: "shield" },
  { key: "settings", label: "Account", icon: "person-circle-outline", iconActive: "person-circle" },
  { key: "emergency", label: "Emergency Protocol", icon: "shield-outline", iconActive: "shield" },
  { key: "emergencycard", label: "Emergency Card", icon: "card-outline", iconActive: "card" },
];

const PRIMARY_KEYS = ["dashboard", "symptoms", "settings"];
const PRIMARY_ITEMS = NAV_ITEMS.filter((n) => PRIMARY_KEYS.includes(n.key));
const MORE_ITEMS = NAV_ITEMS.filter((n) => !PRIMARY_KEYS.includes(n.key));

const DRAWER_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Main", keys: ["dashboard"] },
  { title: "Emergency", keys: ["emergency", "emergencycard"] },
  { title: "Primary", keys: ["log", "medications", "healthdata", "appointments", "symptoms"] },
  { title: "Diagnostics", keys: ["labwork", "imaging"] },
  { title: "Health & Insights", keys: ["timeline", "reports", "monthlycheckin", "cycletracking", "comfort", "eating", "mentalhealth", "goals", "documents", "insights"] },
  { title: "System", keys: ["privacy", "settings"] },
];

const ESSENTIAL_SICK_KEYS = ["dashboard", "sickmode", "medications", "symptoms", "settings"];
const SIMPLE_ADD_ACTIONS = [
  { key: "medication" as const, label: "Add medication", icon: "medical-outline" as const, offsetX: -88, offsetY: -26 },
  { key: "appointment" as const, label: "Add appointment", icon: "calendar-outline" as const, offsetX: -70, offsetY: -92 },
  { key: "symptom" as const, label: "Add symptom", icon: "pulse-outline" as const, offsetX: -24, offsetY: -146 },
] as const;

type QuickAddTarget = "medication" | "appointment" | "symptom" | "calendar" | "labwork" | "imaging";

interface SidebarLayoutProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  onSimpleAddSelect?: (target: QuickAddTarget) => void;
  children: React.ReactNode;
  sickMode?: boolean;
  simpleMode?: boolean;
  headerRight?: React.ReactNode;
  walkthroughStepId?: string | null;
  walkthroughMenuOpen?: boolean | null;
}

export default function SidebarLayout({
  activeScreen,
  onNavigate,
  onSimpleAddSelect,
  children,
  sickMode,
  simpleMode = false,
  headerRight,
  walkthroughStepId,
  walkthroughMenuOpen,
}: SidebarLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const [moreOpen, setMoreOpen] = useState(false);
  const [simpleAddOpen, setSimpleAddOpen] = useState(false);
  const [showVisualScanModal, setShowVisualScanModal] = useState(false);
  const drawerSlide = useRef(new Animated.Value(1)).current;
  const simpleAddFabSpin = useRef(new Animated.Value(0)).current;
  const simpleAddActionProgress = useRef(SIMPLE_ADD_ACTIONS.map(() => new Animated.Value(0))).current;
  const simpleAddAnimatingRef = useRef(false);

  const isWideRef = useRef(isWide);
  useEffect(() => { isWideRef.current = isWide; }, [isWide]);

  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !isWideRef.current && gs.dx > 20 && Math.abs(gs.dy) < 40,
      onPanResponderRelease: (_, gs) => {
        if (!isWideRef.current && gs.dx > 60) setMoreOpen(true);
      },
    })
  ).current;
  const { user, session, signOut } = useAuth();
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeId), [C, themeId]);
  const [developerModeActive, setDeveloperModeActive] = useState(false);
  const synapseHQ = useSynapseHQPanel(setDeveloperModeActive);
  const [settingsName, setSettingsName] = useState<string | undefined>(undefined);
  const [profileImageUri, setProfileImageUri] = useState<string | undefined>(undefined);
  const [enabledSections, setEnabledSections] = useState<string[] | undefined>(undefined);
  const menuButtonRef = useRef<View>(null);
  const emergencyCardRef = useRef<View>(null);
  const simpleNavRef = useRef<View>(null);
  const simpleAddFabRef = useRef<View>(null);
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
    registerTarget("emergencycard", () => measureInWindow(emergencyCardRef));
    return () => unregisterTarget("emergencycard");
  }, [registerTarget, unregisterTarget, moreOpen]);

  useEffect(() => {
    if (!registerTarget || !unregisterTarget || !simpleMode) return;
    registerTarget("simple-nav", () => measureInWindow(simpleNavRef));
    registerTarget("simple-add", () => measureInWindow(simpleAddFabRef));
    return () => {
      unregisterTarget("simple-nav");
      unregisterTarget("simple-add");
    };
  }, [registerTarget, unregisterTarget, simpleMode]);

  const isWideScreen = width >= 768;
  const drawerWidth = Math.min(width * 0.78, isWideScreen ? 280 : 320);

  const loadSettings = useCallback(async () => {
    const [s, profile] = await Promise.all([settingsStorage.get(), healthProfileStorage.get()]);
    setSettingsName(s?.firstName?.trim() || s?.name);
    setEnabledSections(s?.enabledSections);
    setProfileImageUri(profile?.profileImageUri);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings, activeScreen]);

  useEffect(() => {
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

  const alwaysNavKeys = ["dashboard", "medications", "symptoms", "labwork", "imaging", "timeline", "settings", "privacy", "emergency", "emergencycard"];
  const enabledKeysSet = new Set(
    enabledSections !== undefined
      ? [...alwaysNavKeys, ...enabledSections]
      : NAV_ITEMS.map((n) => n.key)
  );
  const primaryItemsFiltered = PRIMARY_ITEMS.filter((n) => enabledKeysSet.has(n.key));
  const moreItemsFiltered = MORE_ITEMS.filter((n) => enabledKeysSet.has(n.key));
  const bottomNavItems = simpleMode ? SIMPLE_NAV_ITEMS : primaryItemsFiltered;
  const showBottomNav = simpleMode || (!isWide && primaryItemsFiltered.length > 0);
  const shouldShowHeaderRow = !simpleMode && (!isWide || headerRight != null);

  // Auth has been removed – app is fully local. Treat everyone as a local profile.
  const isSignedIn = false;
  const displayName = settingsName?.trim() || "You";
  const email = "";

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

  const closeSimpleAdd = useCallback(() => {
    if (!simpleAddOpen || simpleAddAnimatingRef.current) return;
    simpleAddAnimatingRef.current = true;
    Animated.parallel([
      Animated.timing(simpleAddFabSpin, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.stagger(
        24,
        [...simpleAddActionProgress].reverse().map((value) =>
          Animated.timing(value, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          })
        )
      ),
    ]).start(() => {
      simpleAddAnimatingRef.current = false;
      setSimpleAddOpen(false);
    });
  }, [simpleAddActionProgress, simpleAddFabSpin, simpleAddOpen]);

  const openSimpleAdd = useCallback(() => {
    if (simpleAddOpen || simpleAddAnimatingRef.current) return;
    simpleAddAnimatingRef.current = true;
    setSimpleAddOpen(true);
    Animated.parallel([
      Animated.timing(simpleAddFabSpin, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.stagger(
        34,
        simpleAddActionProgress.map((value) =>
          Animated.spring(value, {
            toValue: 1,
            useNativeDriver: true,
            tension: 105,
            friction: 10,
          })
        )
      ),
    ]).start(() => {
      simpleAddAnimatingRef.current = false;
    });
  }, [simpleAddActionProgress, simpleAddFabSpin, simpleAddOpen]);

  const toggleSimpleAdd = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    if (simpleAddOpen) {
      closeSimpleAdd();
      return;
    }
    openSimpleAdd();
  }, [closeSimpleAdd, openSimpleAdd, simpleAddOpen]);

  const handleSimpleAddPress = useCallback((target: QuickAddTarget) => {
    void Haptics.selectionAsync().catch(() => {});
    closeSimpleAdd();
    onSimpleAddSelect?.(target);
  }, [closeSimpleAdd, onSimpleAddSelect]);

  const handleScanPress = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    closeSimpleAdd();
    setShowVisualScanModal(true);
  }, [closeSimpleAdd]);

  return (
    <View style={styles.mobileContainer} {...swipePanResponder.panHandlers}>
      {shouldShowHeaderRow ? (
        <View style={[styles.mobileHeaderRow, { paddingTop: Platform.OS === "web" ? 12 : insets.top + 4 }]}>
          {isWide ? <View style={styles.headerSpacerLeft} /> : (
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
          )}
          {headerRight != null ? headerRight : <View style={styles.mobileHeaderSpacer} />}
        </View>
      ) : null}

      <View
        style={[
          styles.mobileContent,
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
              bottom: Platform.OS === "web" ? 20 : insets.bottom + 16,
              left: 20,
              right: 20,
            },
          ]}
        >
          {Platform.OS === "web" ? (
            <View style={[styles.mobileNav, styles.mobileNavFallback]}>
              <View style={styles.mobileNavContent}>
                {bottomNavItems.map((item) => {
                  const active = activeScreen === item.key;
                  const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.mobileNavItem, simpleMode && styles.mobileNavItemSimple, dimmed && { opacity: 0.35 }]}
                      onPress={() => onNavigate(item.key)}
                      onLongPress={item.key === "settings" ? synapseHQ.open : undefined}
                      delayLongPress={3500}
                      testID={`tab-${item.key}`}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons
                        name={active ? item.iconActive : item.icon}
                        size={24}
                        color={active ? (sickMode ? C.red : C.accent) : "#8E8E93"}
                      />
                      {simpleMode ? (
                        <Text style={[styles.mobileNavLabel, active && styles.mobileNavLabelActive]}>
                          {item.label}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <BlurView intensity={45} tint={themeId === "dark" ? "dark" : "light"} style={styles.mobileNav}>
              <View style={styles.mobileNavContent}>
                {bottomNavItems.map((item) => {
                  const active = activeScreen === item.key;
                  const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.mobileNavItem, simpleMode && styles.mobileNavItemSimple, dimmed && { opacity: 0.35 }]}
                      onPress={() => onNavigate(item.key)}
                      onLongPress={item.key === "settings" ? synapseHQ.open : undefined}
                      delayLongPress={3500}
                      testID={`tab-${item.key}`}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons
                        name={active ? item.iconActive : item.icon}
                        size={24}
                        color={active ? (sickMode ? C.red : C.accent) : "#8E8E93"}
                      />
                      {simpleMode ? (
                        <Text style={[styles.mobileNavLabel, active && styles.mobileNavLabelActive]}>
                          {item.label}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </BlurView>
          )}
        </View>
      )}

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {simpleAddOpen ? (
          <Pressable
            style={styles.simpleAddBackdrop}
            onPress={closeSimpleAdd}
            accessibilityRole="button"
            accessibilityLabel="Close quick add"
          />
        ) : null}

        {simpleAddOpen ? (
          <View
            style={[
              styles.quickAddHub,
              {
                left: isWide ? 24 : 20,
                right: isWide ? undefined : 20,
                bottom: Platform.OS === "web" ? 110 : insets.bottom + (showBottomNav ? 134 : 28),
              },
            ]}
          >
            <Text style={styles.quickAddEyebrow}>Quick Add</Text>
            <Text style={styles.quickAddTitle}>What are we adding?</Text>
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
          </View>
        ) : null}

        <View
          pointerEvents="box-none"
          style={[
            styles.simpleAddWheelLayer,
            {
              left: isWide ? 24 : 20,
              bottom: Platform.OS === "web" ? (showBottomNav ? 148 : 34) : insets.bottom + (showBottomNav ? 154 : 28),
            },
          ]}
        >
          <View ref={simpleAddFabRef} collapsable={false}>
            <Pressable
              style={styles.simpleAddFab}
              onPress={toggleSimpleAdd}
              accessibilityRole="button"
              accessibilityLabel={simpleAddOpen ? "Close quick add" : "Open quick add"}
              accessibilityHint={simpleAddOpen ? "Close add options" : "Open scan and quick add options"}
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
        </View>
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

      {!simpleMode && !isWide && (
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
              {themeId === "light" ? (
                <LinearGradient
                  colors={["#D1E0F7", "#BDD4F2"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: C.background }]} />
              )}
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

                {DRAWER_GROUPS.map((group, groupIndex) => {
                  const navItems = group.keys
                    .map((key) => NAV_ITEMS.find((n) => n.key === key))
                    .filter((n): n is NavItem => n != null && moreItemsFiltered.some((m) => m.key === n.key));
                  const items: NavItem[] = navItems;
                  if (items.length === 0) return null;
                  const isFirstGroup = groupIndex === 0;
                  return (
                    <View
                      key={group.title}
                      style={[styles.drawerGroup, isFirstGroup && styles.drawerGroupFirst]}
                    >
                      <Text style={styles.drawerGroupTitle}>{group.title}</Text>
                      {items.map((item) => {
                        const isLogout = item.key === "logout";
                        const isEmergencyCard = item.key === "emergencycard";
                        const active = !isLogout && activeScreen === item.key;
                        const dimmed = !isLogout && sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
                        const accentColor = sickMode ? C.red : C.accent;
                        const itemColor = active ? accentColor : C.textSecondary;
                        return (
                          <View key={item.key} ref={isEmergencyCard ? emergencyCardRef : undefined} collapsable={false}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.drawerRow,
                                active && [styles.drawerRowActive, { borderLeftColor: accentColor }],
                                dimmed && { opacity: 0.35 },
                                pressed && styles.drawerRowPressed,
                              ]}
                              onPress={() => {
                                if (isLogout) {
                                  signOut();
                                  closeDrawer();
                                } else {
                                  onNavigate(item.key);
                                  closeDrawer();
                                }
                              }}
                              onLongPress={!isLogout && item.key === "settings" ? synapseHQ.open : undefined}
                              delayLongPress={3500}
                              testID={isLogout ? "more-logout" : `more-${item.key}`}
                              accessibilityRole="button"
                              accessibilityLabel={item.label}
                              accessibilityState={{ selected: active }}
                            >
                              <Ionicons
                                name={item.icon}
                                size={20}
                                color={itemColor}
                                style={styles.drawerRowIcon}
                              />
                              <Text
                                style={[styles.drawerRowLabel, { color: itemColor }, active && { color: accentColor, fontWeight: "600" }]}
                                numberOfLines={1}
                              >
                                {item.label}
                              </Text>
                              <Ionicons name="chevron-forward" size={16} color={itemColor} />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}

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
      {synapseHQ.element}
    </View>
  );
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
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: themeId === "light" ? "transparent" : C.background,
    },
    mobileMenuBtn: {
      padding: 6,
      marginLeft: -6,
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
    },
    mobileNav: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 24,
      paddingVertical: 12,
      paddingHorizontal: 8,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 10,
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
      paddingVertical: 8,
      paddingHorizontal: 14,
      flex: 1,
    },
    mobileNavItemSimple: {
      minWidth: 0,
      gap: 4,
    },
    mobileNavLabel: {
      fontWeight: "600",
      fontSize: 11,
      color: "#8E8E93",
      textAlign: "center",
    },
    mobileNavLabelActive: {
      color: C.accent,
    },
    simpleAddFab: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
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
      backgroundColor: themeId === "dark" ? "rgba(0,0,0,0.12)" : "rgba(17,24,39,0.04)",
    },
    quickAddHub: {
      position: "absolute",
      maxWidth: 390,
      borderRadius: 22,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      gap: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 22,
      elevation: 16,
      zIndex: 45,
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
      borderRadius: 16,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
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
      borderRadius: 14,
      backgroundColor: C.tintLight,
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
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
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
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    drawerPanel: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      overflow: "hidden",
      borderRightWidth: 1,
      borderRightColor: "rgba(0,0,0,0.06)",
      paddingHorizontal: 20,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
      shadowColor: "#000",
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 8,
    },
    drawerScroll: {
      flex: 1,
    },
    drawerScrollContent: {
      flexGrow: 1,
      paddingBottom: 8,
    },
    drawerProfile: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    drawerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.surface,
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
      paddingHorizontal: 8,
      borderRadius: 8,
      marginBottom: 1,
    },
    drawerRowActive: {
      backgroundColor: C.tintLight,
      borderLeftWidth: 4,
      borderLeftColor: C.tint,
      paddingLeft: 10,
    },
    drawerRowPressed: {
      backgroundColor: C.surface,
    },
    drawerRowIcon: {
      marginRight: 10,
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
      backgroundColor: C.border,
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
