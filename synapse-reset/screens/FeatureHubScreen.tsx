import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  getHubChildren,
  getNavEntry,
  resolveNavKey,
  type NavRegistryEntry,
} from "@/lib/navigation-registry";

export type HubItem = {
  key: string;
  label: string;
  description?: string;
  icon: NavRegistryEntry["icon"];
  target: string;
};

export type HubDefinition = {
  id: string;
  title: string;
  subtitle: string;
  items: HubItem[];
};

/** Canonical hub ids used by the router. */
export const HUB_IDS = [
  "health",
  "feelinghub",
  "recordshub",
  "wellbeinghub",
  "carehub",
  "emergencyhub",
  "accounthub",
] as const;

/**
 * Bottom-tab Health mega-hub — links to top-level clinical destinations
 * (not registry parent/child rows).
 */
export const HEALTH_HUB: HubDefinition = {
  id: "health",
  title: "Health",
  subtitle: "Everything that helps you manage day to day.",
  items: [
    {
      key: "medications",
      label: "Medications",
      description: "Schedules, doses, and reminders",
      icon: "medical-outline",
      target: "medications",
    },
    {
      key: "appointments",
      label: "Appointments",
      description: "Upcoming visits and prep notes",
      icon: "calendar-outline",
      target: "appointments",
    },
    {
      key: "feelinghub",
      label: "How I’m Feeling",
      description: "Daily log, symptoms, monthly check-in",
      icon: "happy-outline",
      target: "feelinghub",
    },
    {
      key: "recordshub",
      label: "Health Records",
      description: "Vitals, labs, imaging, timeline, reports",
      icon: "folder-outline",
      target: "recordshub",
    },
    {
      key: "wellbeinghub",
      label: "Wellbeing",
      description: "Eating, comfort, goals, and more",
      icon: "leaf-outline",
      target: "wellbeinghub",
    },
    {
      key: "carehub",
      label: "Care & Support",
      description: "Doctors, pharmacies, and care helpers",
      icon: "people-outline",
      target: "carehub",
    },
  ],
};

function hubFromRegistry(hubKey: string, role: string): HubDefinition | null {
  if (hubKey === "health") return HEALTH_HUB;
  const entry = getNavEntry(hubKey);
  if (!entry || entry.type !== "hub") return null;
  const children = getHubChildren(hubKey, { role });
  return {
    id: hubKey,
    title: entry.label,
    subtitle: entry.description ?? "",
    items: children.map((child) => ({
      key: child.key,
      label: child.label,
      description: child.description,
      icon: child.icon,
      target: child.key,
    })),
  };
}

/** @deprecated Prefer canonical hub keys; kept for older callers. */
export const FEELING_HUB: HubDefinition = hubFromRegistry("feelinghub", "self")!;
export const HEALTH_RECORDS_HUB: HubDefinition = hubFromRegistry("recordshub", "self")!;
export const WELLBEING_HUB: HubDefinition = hubFromRegistry("wellbeinghub", "self")!;
export const CARE_SUPPORT_HUB: HubDefinition = hubFromRegistry("carehub", "self")!;
export const YOU_HUB: HubDefinition = hubFromRegistry("accounthub", "self")!;
export const EMERGENCY_HUB: HubDefinition = hubFromRegistry("emergencyhub", "self")!;

interface FeatureHubScreenProps {
  hubId: string;
  onNavigate: (screen: string) => void;
  /** Current app role for gated children. */
  role?: string;
  /** @deprecated Use role="caregiver" instead. */
  includeCaregiver?: boolean;
}

export default function FeatureHubScreen({
  hubId,
  onNavigate,
  role: roleProp,
  includeCaregiver = false,
}: FeatureHubScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const role = roleProp ?? (includeCaregiver ? "caregiver" : "self");
  const resolvedId = resolveNavKey(hubId);

  const hub = useMemo(() => {
    return hubFromRegistry(resolvedId, role) ?? HEALTH_HUB;
  }, [resolvedId, role]);

  const isEmergency = resolvedId === "emergencyhub";

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 24 : 8 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{hub.title}</Text>
        <Text style={styles.subtitle}>{hub.subtitle}</Text>
        {isEmergency ? (
          <Text style={styles.emergencyNote}>
            Both actions below open immediately—no extra delay.
          </Text>
        ) : null}
        <View style={styles.list}>
          {hub.items.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.row,
                isEmergency && styles.emergencyRow,
                pressed && styles.rowPressed,
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onNavigate(item.target);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityHint={item.description}
            >
              <View style={[styles.iconWrap, isEmergency && styles.emergencyIconWrap]}>
                <Ionicons name={item.icon} size={22} color={isEmergency ? C.red : C.tint} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                {item.description ? <Text style={styles.rowDesc}>{item.description}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 20, paddingTop: 8 },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: C.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: C.textSecondary,
      marginBottom: 12,
    },
    emergencyNote: {
      fontSize: 13,
      lineHeight: 18,
      color: C.textTertiary,
      marginBottom: 16,
    },
    list: { gap: 10 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    emergencyRow: {
      paddingVertical: 16,
    },
    rowPressed: { opacity: 0.85 },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: C.tintLight ?? C.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    emergencyIconWrap: {
      backgroundColor: (C.red ?? "#C73A4A") + "22",
    },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 16, fontWeight: "600", color: C.text },
    rowDesc: { fontSize: 13, lineHeight: 18, color: C.textSecondary },
  });
}
