import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { featureFlags } from "@/constants/feature-flags";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type HubItem = {
  key: string;
  label: string;
  description?: string;
  icon: IconName;
  /** Navigate to this screen key, or treat as nested hub id. */
  target: string;
};

export type HubDefinition = {
  id: string;
  title: string;
  subtitle: string;
  items: HubItem[];
};

export const FEELING_HUB: HubDefinition = {
  id: "feeling",
  title: "How I’m Feeling",
  subtitle: "Mood, energy, sleep, and symptoms—log as much or as little as you like.",
  items: [
    { key: "log", label: "Daily Log", description: "Quick check-in for mood, energy, and sleep", icon: "heart-outline", target: "log" },
    { key: "symptoms", label: "Symptoms", description: "Record a symptom episode with details", icon: "pulse-outline", target: "symptoms" },
    { key: "monthlycheckin", label: "Monthly check-in", description: "A fuller monthly snapshot", icon: "fitness-outline", target: "monthlycheckin" },
  ],
};

export const HEALTH_RECORDS_HUB: HubDefinition = {
  id: "healthrecords",
  title: "Health Records",
  subtitle: "Labs, imaging, timeline, and reports in one place.",
  items: [
    { key: "healthdata", label: "Vitals", description: "Blood pressure, weight, and more", icon: "analytics-outline", target: "healthdata" },
    { key: "labwork", label: "Lab Work", description: "Results and trends", icon: "flask-outline", target: "labwork" },
    { key: "imaging", label: "Imaging", description: "Scans and imaging notes", icon: "scan-outline", target: "imaging" },
    { key: "timeline", label: "Timeline", description: "Your health history over time", icon: "git-branch-outline", target: "timeline" },
    { key: "reports", label: "Reports", description: "Visit-ready summaries from what you’ve logged", icon: "bar-chart-outline", target: "reports" },
    ...(featureFlags.documentScannerEnabled
      ? [
          {
            key: "documents",
            label: "Documents",
            description: "Scanned health documents",
            icon: "document-outline" as IconName,
            target: "documents",
          },
        ]
      : []),
  ],
};

export const WELLBEING_HUB: HubDefinition = {
  id: "wellbeing",
  title: "Wellbeing",
  subtitle: "Supportive tools for everyday life. These are not a substitute for professional care.",
  items: [
    { key: "eating", label: "Eating & hydration", description: "Meals and water tracking", icon: "restaurant-outline", target: "eating" },
    { key: "mentalhealth", label: "Mental health", description: "Quieter tools for harder days", icon: "heart-outline", target: "mentalhealth" },
    { key: "comfort", label: "Comfort", description: "Small mood lifters when you need them", icon: "happy-outline", target: "comfort" },
    { key: "goals", label: "Goals", description: "Gentle goals you set for yourself", icon: "flag-outline", target: "goals" },
    { key: "cycletracking", label: "Cycle tracking", description: "Optional cycle awareness", icon: "water-outline", target: "cycletracking" },
    { key: "ramadan", label: "Ramadan Mode", description: "Fasting-aware daily support", icon: "moon-outline", target: "ramadan" },
  ],
};

export const CARE_SUPPORT_HUB: HubDefinition = {
  id: "caresupport",
  title: "Care & Support",
  subtitle: "People and places that help you manage care.",
  items: [
    { key: "doctors", label: "Doctors", description: "Your care team contacts", icon: "medkit-outline", target: "doctors" },
    { key: "pharmacies", label: "Pharmacies", description: "Pharmacy details", icon: "storefront-outline", target: "pharmacies" },
  ],
};

export const HEALTH_HUB: HubDefinition = {
  id: "health",
  title: "Health",
  subtitle: "Everything that helps you manage day to day.",
  items: [
    { key: "medications", label: "Medications", description: "Schedules, doses, and reminders", icon: "medical-outline", target: "medications" },
    { key: "appointments", label: "Appointments", description: "Upcoming visits and prep notes", icon: "calendar-outline", target: "appointments" },
    { key: "feeling", label: "How I’m Feeling", description: "Daily log, symptoms, monthly check-in", icon: "happy-outline", target: "feeling" },
    { key: "healthrecords", label: "Health Records", description: "Vitals, labs, imaging, timeline, reports", icon: "folder-outline", target: "healthrecords" },
    { key: "wellbeing", label: "Wellbeing", description: "Eating, comfort, goals, and more", icon: "leaf-outline", target: "wellbeing" },
    { key: "caresupport", label: "Care & Support", description: "Doctors, pharmacies, and care helpers", icon: "people-outline", target: "caresupport" },
  ],
};

export const YOU_HUB: HubDefinition = {
  id: "you",
  title: "You",
  subtitle: "Profile, safety, privacy, and preferences.",
  items: [
    { key: "healthprofile", label: "Health profile", description: "Basics about you", icon: "person-outline", target: "healthprofile" },
    { key: "healthprofileconditions", label: "Conditions", description: "Conditions that matter for your care", icon: "clipboard-outline", target: "healthprofileconditions" },
    { key: "allergy", label: "Allergies", description: "Allergies and sensitivities", icon: "alert-circle-outline", target: "allergy" },
    { key: "emergencycard", label: "Emergency information", description: "Card and protocol for urgent moments", icon: "card-outline", target: "emergencycard" },
    { key: "emergency", label: "Emergency protocol", description: "Steps and contacts for emergencies", icon: "shield-outline", target: "emergency" },
    { key: "settings", label: "Preferences", description: "Appearance, mode, notifications, and account", icon: "options-outline", target: "settings" },
    { key: "privacy", label: "Privacy", description: "Local-first defaults and app lock", icon: "lock-closed-outline", target: "privacy" },
    { key: "editprofile", label: "Backup & restore", description: "Optional iCloud backup and local export", icon: "cloud-outline", target: "editprofile" },
    { key: "feedback", label: "Help & feedback", description: "Share feedback or get help", icon: "chatbubble-ellipses-outline", target: "feedback" },
  ],
};

const HUB_BY_ID: Record<string, HubDefinition> = {
  health: HEALTH_HUB,
  feeling: FEELING_HUB,
  healthrecords: HEALTH_RECORDS_HUB,
  wellbeing: WELLBEING_HUB,
  caresupport: CARE_SUPPORT_HUB,
  you: YOU_HUB,
};

interface FeatureHubScreenProps {
  hubId: string;
  onNavigate: (screen: string) => void;
  /** Show caregiver destination when role is caregiver. */
  includeCaregiver?: boolean;
}

export default function FeatureHubScreen({
  hubId,
  onNavigate,
  includeCaregiver = false,
}: FeatureHubScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const hub = HUB_BY_ID[hubId] ?? HEALTH_HUB;

  const items = useMemo(() => {
    const list = [...hub.items];
    if (hubId === "caresupport" && includeCaregiver) {
      list.push(
        {
          key: "caregiverdashboard",
          label: "Caregiver dashboard",
          description: "Tools for supporting someone else",
          icon: "people-outline",
          target: "caregiverdashboard",
        },
        {
          key: "managedperson",
          label: "Managed person",
          description: "Details for the person you support",
          icon: "accessibility-outline",
          target: "managedperson",
        }
      );
    }
    return list;
  }, [hub.items, hubId, includeCaregiver]);

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 24 : 8 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{hub.title}</Text>
        <Text style={styles.subtitle}>{hub.subtitle}</Text>
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onNavigate(item.target);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityHint={item.description}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={22} color={C.tint} />
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
      marginBottom: 20,
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
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: C.tintLight ?? C.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 16, fontWeight: "600", color: C.text },
    rowDesc: { fontSize: 13, lineHeight: 18, color: C.textSecondary },
  });
}
