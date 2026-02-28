import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
  Modal,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import SynapseLogo from "@/components/SynapseLogo";
import { featureFlags } from "@/constants/feature-flags";
import { useAuth } from "@/contexts/AuthContext";
import { settingsStorage } from "@/lib/storage";

const C = Colors.dark;

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
  ...(featureFlags.documentScannerEnabled ? [
    { key: "documents", label: "Documents", icon: "scan-outline", iconActive: "scan" },
    { key: "insights", label: "Insights", icon: "sparkles-outline", iconActive: "sparkles" },
  ] : []) as NavItem[],
  { key: "monthlycheckin", label: "Monthly check-in", icon: "fitness-outline", iconActive: "fitness" },
  { key: "eating", label: "Eating", icon: "restaurant-outline", iconActive: "restaurant" },
  { key: "mentalhealth", label: "Mental health day", icon: "heart-outline", iconActive: "heart" },
  { key: "comfort", label: "Mood lifters", icon: "happy-outline", iconActive: "happy" },
  { key: "goals", label: "Goals", icon: "flag-outline", iconActive: "flag" },
  { key: "appointments", label: "Appointments", icon: "calendar-outline", iconActive: "calendar" },
  { key: "reports", label: "Reports", icon: "document-text-outline", iconActive: "document-text" },
  { key: "privacy", label: "Privacy", icon: "shield-outline", iconActive: "shield" },
  { key: "settings", label: "Settings", icon: "settings-outline", iconActive: "settings" },
];

const PRIMARY_KEYS = ["dashboard", "healthdata", "symptoms"];
const PRIMARY_ITEMS = NAV_ITEMS.filter((n) => PRIMARY_KEYS.includes(n.key));
const MORE_ITEMS = NAV_ITEMS.filter((n) => !PRIMARY_KEYS.includes(n.key));

const DRAWER_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Primary", keys: ["log", "medications", "healthdata", "appointments"] },
  { title: "Health & Insights", keys: ["reports", "monthlycheckin", "comfort", "eating", "mentalhealth", "goals", "documents", "insights"] },
  { title: "System", keys: ["privacy", "settings"] },
];

const ESSENTIAL_SICK_KEYS = ["dashboard", "sickmode", "medications", "symptoms", "settings"];

interface SidebarLayoutProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  children: React.ReactNode;
  sickMode?: boolean;
  headerRight?: React.ReactNode;
}

export default function SidebarLayout({
  activeScreen,
  onNavigate,
  children,
  sickMode,
  headerRight,
}: SidebarLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [moreOpen, setMoreOpen] = useState(false);
  const drawerSlide = useRef(new Animated.Value(1)).current;
  const { user, session, signOut } = useAuth();
  const [settingsName, setSettingsName] = useState<string | undefined>(undefined);
  const [enabledSections, setEnabledSections] = useState<string[] | undefined>(undefined);

  const moreIsActive = MORE_ITEMS.some((n) => n.key === activeScreen);
  const isWideScreen = width >= 768;
  const drawerWidth = Math.min(width * 0.78, isWideScreen ? 280 : 320);

  const loadSettings = useCallback(async () => {
    const s = await settingsStorage.get();
    setSettingsName(s?.name);
    setEnabledSections(s?.enabledSections);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings, activeScreen]);

  const alwaysNavKeys = ["dashboard", "medications", "settings", "privacy"];
  const enabledKeysSet = new Set(
    enabledSections !== undefined
      ? [...alwaysNavKeys, ...enabledSections]
      : NAV_ITEMS.map((n) => n.key)
  );
  const primaryItemsFiltered = PRIMARY_ITEMS.filter((n) => enabledKeysSet.has(n.key));
  const moreItemsFiltered = MORE_ITEMS.filter((n) => enabledKeysSet.has(n.key));

  const isSignedIn = Boolean(session ?? user);
  const displayName = isSignedIn
    ? (user?.user_metadata?.first_name ??
       user?.user_metadata?.full_name?.split(" ")[0] ??
       user?.email?.split("@")[0] ??
       settingsName ??
       "Guest")
    : "Guest";
  const email = user?.email ?? "";

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

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerSlide, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setMoreOpen(false));
  }, [drawerSlide]);

  return (
    <View style={styles.mobileContainer}>
      <View style={[styles.mobileHeaderRow, { paddingTop: Platform.OS === "web" ? 12 : insets.top + 4 }]}>
        <Pressable
          style={styles.mobileMenuBtn}
          onPress={() => setMoreOpen(true)}
          testID="tab-more"
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Ionicons name="menu" size={26} color={C.text} />
        </Pressable>
        {headerRight != null ? headerRight : <View style={styles.mobileHeaderSpacer} />}
      </View>

      <View
        style={[
          styles.mobileContent,
          {
            paddingBottom: isWide
              ? Platform.OS === "web" ? 34 : insets.bottom + 16
              : primaryItemsFiltered.length > 0
                ? (Platform.OS === "web" ? 88 : insets.bottom + 80)
                : 24,
          },
        ]}
      >
        {children}
      </View>

      {!isWide && primaryItemsFiltered.length > 0 && (
        <View
          style={[
            styles.mobileNav,
            {
              bottom: Platform.OS === "web" ? 20 : insets.bottom + 12,
              left: 20,
              right: 20,
            },
          ]}
        >
          <View style={styles.mobileNavContent}>
            {primaryItemsFiltered.map((item) => {
              const active = activeScreen === item.key;
              const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
              return (
                <Pressable
                  key={item.key}
                  style={[styles.mobileNavItem, dimmed && { opacity: 0.35 }]}
                  onPress={() => onNavigate(item.key)}
                  testID={`tab-${item.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={24}
                    color={active ? (sickMode ? C.red : C.accent) : C.textTertiary}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

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
                  paddingTop: Platform.OS === "web" ? 12 : insets.top + 8,
                  paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16,
                  transform: [{ translateX: drawerSlide.interpolate({ inputRange: [0, 1], outputRange: [0, -drawerWidth] }) }],
                },
              ]}
            >
              <ScrollView
                style={styles.drawerScroll}
                contentContainerStyle={styles.drawerScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={styles.drawerProfile}>
                  <View style={styles.drawerAvatar}>
                    <Text style={styles.drawerAvatarText}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.drawerProfileName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {isSignedIn ? (
                    <>
                      {email ? (
                        <Text style={styles.drawerProfileEmail} numberOfLines={1}>
                          {email}
                        </Text>
                      ) : null}
                      <Text style={styles.drawerProfileStatus}>Signed in</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.drawerProfileStatus}>Guest account</Text>
                      <Pressable
                        onPress={() => {
                          closeDrawer();
                          onNavigate("auth");
                        }}
                        style={styles.drawerSignInLink}
                        accessibilityRole="button"
                        accessibilityLabel="Sign in"
                      >
                        <Text style={styles.drawerSignInLinkText}>Sign in</Text>
                      </Pressable>
                    </>
                  )}
                </View>

                {DRAWER_GROUPS.map((group) => {
                  const navItems = group.keys
                    .map((key) => NAV_ITEMS.find((n) => n.key === key))
                    .filter((n): n is NavItem => n != null && moreItemsFiltered.some((m) => m.key === n.key));
                  const items: NavItem[] =
                    group.title === "System" && isSignedIn
                      ? [...navItems, { key: "logout", label: "Logout", icon: "log-out-outline", iconActive: "log-out-outline" }]
                      : navItems;
                  if (items.length === 0) return null;
                  const isFirstGroup = group.title === "Primary";
                  return (
                    <View
                      key={group.title}
                      style={[styles.drawerGroup, isFirstGroup && styles.drawerGroupFirst]}
                    >
                      <Text style={styles.drawerGroupTitle}>{group.title}</Text>
                      {items.map((item) => {
                        const isLogout = item.key === "logout";
                        const active = !isLogout && activeScreen === item.key;
                        const dimmed = !isLogout && sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
                        const accentColor = sickMode ? C.red : C.accent;
                        return (
                          <Pressable
                            key={item.key}
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
                            testID={isLogout ? "more-logout" : `more-${item.key}`}
                            accessibilityRole="button"
                            accessibilityLabel={item.label}
                            accessibilityState={{ selected: active }}
                          >
                            <Ionicons
                              name={item.icon}
                              size={20}
                              color={active ? accentColor : C.textSecondary}
                              style={styles.drawerRowIcon}
                            />
                            <Text
                              style={[styles.drawerRowLabel, active && { color: accentColor }]}
                              numberOfLines={1}
                            >
                              {item.label}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}

                <View style={styles.drawerFooter}>
                  <View style={styles.drawerFooterDivider} />
                  <View style={styles.drawerFooterContent}>
                    <Text style={styles.drawerFooterText}>Synapse v1.0</Text>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: C.background,
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
    backgroundColor: C.background,
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: C.background,
  },
  mobileHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.background,
  },
  mobileMenuBtn: {
    padding: 6,
    marginLeft: -6,
  },
  mobileHeaderSpacer: { width: 1, minWidth: 1 },
  mobileContent: {
    flex: 1,
    paddingHorizontal: 8,
  },
  mobileNav: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  mobileNavContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    flex: 1,
  },
  mobileNavItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
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
    backgroundColor: C.background,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
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
    backgroundColor: (C.accent + "12") as string,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingLeft: 11,
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
