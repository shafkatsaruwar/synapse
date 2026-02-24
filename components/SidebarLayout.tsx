import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

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
  { key: "documents", label: "Documents", icon: "scan-outline", iconActive: "scan" },
  { key: "insights", label: "Insights", icon: "sparkles-outline", iconActive: "sparkles" },
  { key: "appointments", label: "Appointments", icon: "calendar-outline", iconActive: "calendar" },
  { key: "reports", label: "Reports", icon: "document-text-outline", iconActive: "document-text" },
  { key: "privacy", label: "Privacy", icon: "shield-outline", iconActive: "shield" },
  { key: "settings", label: "Settings", icon: "settings-outline", iconActive: "settings" },
];

const PRIMARY_KEYS = ["dashboard", "log", "healthdata"];
const PRIMARY_ITEMS = NAV_ITEMS.filter((n) => PRIMARY_KEYS.includes(n.key));
const MORE_ITEMS = NAV_ITEMS.filter((n) => !PRIMARY_KEYS.includes(n.key));

const ESSENTIAL_SICK_KEYS = ["dashboard", "sickmode", "medications", "symptoms", "settings"];

interface SidebarLayoutProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  children: React.ReactNode;
  sickMode?: boolean;
  onResetOnboarding?: () => void;
}

export default function SidebarLayout({
  activeScreen,
  onNavigate,
  children,
  sickMode,
  onResetOnboarding,
}: SidebarLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [moreOpen, setMoreOpen] = useState(false);

  const moreIsActive = MORE_ITEMS.some((n) => n.key === activeScreen);

  if (!isWide) {
    return (
      <View style={styles.mobileContainer}>
        <View style={[styles.mobileContent, { paddingBottom: 72 + (Platform.OS === "web" ? 34 : insets.bottom) }]}>
          {children}
        </View>

        <View
          style={[
            styles.mobileNav,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom },
          ]}
        >
          <View style={styles.mobileNavContent}>
            {PRIMARY_ITEMS.map((item) => {
              const active = activeScreen === item.key;
              const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
              return (
                <Pressable
                  key={item.key}
                  style={[styles.mobileNavItem, dimmed && { opacity: 0.35 }]}
                  onPress={() => onNavigate(item.key)}
                  testID={`tab-${item.key}`}
                >
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={22}
                    color={active ? (sickMode ? C.red : C.tint) : C.textTertiary}
                  />
                  <Text style={[styles.mobileNavLabel, active && { color: sickMode ? C.red : C.tint }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              style={styles.mobileNavItem}
              onPress={() => setMoreOpen(true)}
              testID="tab-more"
            >
              <Ionicons
                name={moreIsActive ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline"}
                size={22}
                color={moreIsActive ? C.tint : C.textTertiary}
              />
              <Text style={[styles.mobileNavLabel, moreIsActive && { color: C.tint }]}>
                More
              </Text>
            </Pressable>
          </View>
        </View>

        <Modal
          visible={moreOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setMoreOpen(false)}
        >
          <Pressable style={styles.moreOverlay} onPress={() => setMoreOpen(false)}>
            <Pressable
              style={[styles.moreSheet, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.moreHandle} />
              <Text style={styles.moreTitle}>More</Text>

              <View style={styles.moreGrid}>
                {MORE_ITEMS.map((item) => {
                  const active = activeScreen === item.key;
                  const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.moreItem, active && styles.moreItemActive, dimmed && { opacity: 0.35 }]}
                      onPress={() => {
                        onNavigate(item.key);
                        setMoreOpen(false);
                      }}
                      testID={`more-${item.key}`}
                    >
                      <View style={[styles.moreIconWrap, active && { backgroundColor: (sickMode ? C.red : C.tint) + "22" }]}>
                        <Ionicons
                          name={active ? item.iconActive : item.icon}
                          size={22}
                          color={active ? (sickMode ? C.red : C.tint) : C.textSecondary}
                        />
                      </View>
                      <Text style={[styles.moreLabel, active && { color: sickMode ? C.red : C.tint }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {onResetOnboarding && (
                <Pressable
                  style={styles.resetOnboardingBtn}
                  onPress={() => {
                    setMoreOpen(false);
                    onResetOnboarding();
                  }}
                  testID="reset-onboarding"
                >
                  <Ionicons name="refresh-outline" size={18} color={C.textSecondary} />
                  <Text style={styles.resetOnboardingText}>Reset onboarding for testing</Text>
                </Pressable>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.sidebar, { paddingTop: Platform.OS === "web" ? 40 : insets.top + 16 }]}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Ionicons name="leaf" size={18} color={C.tint} />
          </View>
          <Text style={styles.brandText}>Fir</Text>
        </View>

        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const active = activeScreen === item.key;
            const dimmed = sickMode && !ESSENTIAL_SICK_KEYS.includes(item.key);
            return (
              <Pressable
                key={item.key}
                style={[styles.navItem, active && styles.navItemActive, dimmed && { opacity: 0.35 }]}
                onPress={() => onNavigate(item.key)}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={18}
                  color={active ? (sickMode ? C.red : C.text) : C.textTertiary}
                />
                <Text
                  style={[styles.navLabel, active && styles.navLabelActive, active && sickMode && { color: C.red }]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sidebarFooter}>
          <View style={styles.sidebarDivider} />
          <Text style={styles.sidebarVersion}>Fir v1.0</Text>
        </View>
      </View>
      <View style={styles.main}>{children}</View>
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
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.tintLight,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontFamily: "Inter_700Bold",
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
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.textTertiary,
  },
  navLabelActive: {
    color: C.text,
    fontFamily: "Inter_600SemiBold",
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
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textTertiary,
    paddingHorizontal: 12,
  },
  main: {
    flex: 1,
    backgroundColor: C.background,
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: C.background,
  },
  mobileContent: {
    flex: 1,
  },
  mobileNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.92)",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  mobileNavContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
  },
  mobileNavItem: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 64,
  },
  mobileNavLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.textTertiary,
    marginTop: 3,
  },
  moreOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  moreSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  moreHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.textTertiary,
    alignSelf: "center",
    marginBottom: 16,
    opacity: 0.4,
  },
  moreTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: C.text,
    marginBottom: 20,
  },
  moreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  moreItem: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  moreItemActive: {
    backgroundColor: C.tint + "10",
  },
  moreIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.border + "60",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  moreLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: C.textSecondary,
    textAlign: "center",
  },
  resetOnboardingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  resetOnboardingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
  },
});
