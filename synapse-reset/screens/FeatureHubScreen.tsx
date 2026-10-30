import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { getNavBadgeCounts, type NavBadgeCounts } from "@/lib/nav-badge-counts";
import { subscribeBadgeRefresh } from "@/lib/badge-refresh";
import BackupReminderBanner from "@/components/BackupReminderBanner";
import PlusBadge from "@/components/plus/PlusBadge";
import { usePlusOptional } from "@/contexts/PlusContext";
import { HEALTH_HUB_PLUS_ITEM_KEYS, requiresPlus } from "@/lib/plus/features";

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
      key: "checkin",
      label: "Check-In",
      description: "Stay connected with people you care about",
      icon: "chatbubble-ellipses-outline",
      target: "checkin",
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
  const [badgeCounts, setBadgeCounts] = useState<NavBadgeCounts>({});
  const plus = usePlusOptional();
  const showPlusIndicators = Boolean(plus?.monetizationEnabled && !plus.hasPlus);

  const hub = useMemo(() => {
    return hubFromRegistry(resolvedId, role) ?? HEALTH_HUB;
  }, [resolvedId, role]);

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
    const unsubscribe = subscribeBadgeRefresh(() => {
      void loadBadges();
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [loadBadges, resolvedId]);

  const getItemBadgeCount = useCallback(
    (itemKey: string) => {
      if (itemKey === "medications") return badgeCounts.medications ?? 0;
      if (itemKey === "appointments") return badgeCounts.appointments ?? 0;
      return 0;
    },
    [badgeCounts]
  );

  const pendingSummary = useMemo(() => {
    if (resolvedId !== "health") return null;
    const meds = badgeCounts.medications ?? 0;
    const apts = badgeCounts.appointments ?? 0;
    if (meds <= 0 && apts <= 0) return null;
    const parts: string[] = [];
    if (meds > 0) parts.push(`${meds} dose${meds === 1 ? "" : "s"} due now`);
    if (apts > 0) parts.push(`${apts} appointment${apts === 1 ? "" : "s"} due`);
    return `${parts.join(" and ")} — open the row${meds > 0 && apts > 0 ? "s" : ""} below.`;
  }, [badgeCounts, resolvedId]);

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 24 : 8 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{hub.title}</Text>
        <Text style={styles.subtitle}>{hub.subtitle}</Text>
        {pendingSummary ? (
          <Text style={styles.pendingSummary} accessibilityLiveRegion="polite">
            {pendingSummary}
          </Text>
        ) : null}
        {resolvedId === "accounthub" ? (
          <BackupReminderBanner onOpenBackup={() => onNavigate("editprofile")} />
        ) : null}
        <View style={styles.list}>
          {hub.items.map((item) => {
            const badgeCount = getItemBadgeCount(item.key);
            const isPlusItem =
              showPlusIndicators &&
              (resolvedId === "health"
                ? HEALTH_HUB_PLUS_ITEM_KEYS.has(item.key)
                : requiresPlus(item.key) || requiresPlus(item.target));
            const accessibilityLabel = [
              item.label,
              isPlusItem ? "Synapse Plus" : null,
              badgeCount > 0 ? `${badgeCount > 9 ? "9 plus" : badgeCount} pending` : null,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <Pressable
                key={item.key}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onNavigate(item.target);
                }}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={item.description}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={22} color={C.tint} />
                  {badgeCount > 0 ? (
                    <View style={styles.rowBadge} accessibilityElementsHidden>
                      <Text style={styles.rowBadgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.rowText}>
                  <View style={styles.rowLabelRow}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    {isPlusItem ? <PlusBadge compact /> : null}
                  </View>
                  {item.description ? <Text style={styles.rowDesc}>{item.description}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
              </Pressable>
            );
          })}
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
    pendingSummary: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      color: C.red,
      marginBottom: 14,
      marginTop: -4,
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
    rowPressed: { opacity: 0.85 },
    iconWrap: {
      position: "relative",
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: C.tintLight ?? C.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBadge: {
      position: "absolute",
      top: -6,
      right: -8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.red,
      borderWidth: 0,
    },
    rowBadgeText: {
      fontSize: 10,
      lineHeight: 12,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    rowText: { flex: 1, gap: 2 },
    rowLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    rowLabel: { fontSize: 16, fontWeight: "600", color: C.text },
    rowDesc: { fontSize: 13, lineHeight: 18, color: C.textSecondary },
  });
}
