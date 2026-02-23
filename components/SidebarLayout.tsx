import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
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

interface SidebarLayoutProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  children: React.ReactNode;
}

export default function SidebarLayout({
  activeScreen,
  onNavigate,
  children,
}: SidebarLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  if (!isWide) {
    return (
      <View style={styles.mobileContainer}>
        <View style={[styles.mobileContent, { paddingBottom: 72 + (Platform.OS === "web" ? 34 : insets.bottom) }]}>
          {children}
        </View>
        <View
          style={[
            styles.mobileNav,
            {
              paddingBottom: Platform.OS === "web" ? 34 : insets.bottom,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mobileNavContent}
          >
            {NAV_ITEMS.filter(n => n.key !== "settings").map((item) => {
              const active = activeScreen === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={styles.mobileNavItem}
                  onPress={() => onNavigate(item.key)}
                >
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={22}
                    color={active ? C.tint : C.textTertiary}
                  />
                  <Text
                    style={[
                      styles.mobileNavLabel,
                      active && { color: C.tint },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
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
            return (
              <Pressable
                key={item.key}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => onNavigate(item.key)}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={18}
                  color={active ? C.text : C.textTertiary}
                />
                <Text
                  style={[styles.navLabel, active && styles.navLabelActive]}
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
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  mobileNavItem: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 56,
  },
  mobileNavLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.textTertiary,
    marginTop: 3,
  },
});
