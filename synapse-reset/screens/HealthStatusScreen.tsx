import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  appointmentStorage,
  convertHydrationToMl,
  enableRecoveryTracking,
  hydrationStorage,
  medicationLogStorage,
  medicationStorage,
  settingsStorage,
  sickModeStorage,
  type Appointment,
  type HydrationEntry,
  type Medication,
  type MedicationLog,
  type UserSettings,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import { formatHydrationVolume } from "@/lib/hydration-format";
import { syncRecoveryTrackingCheckIn } from "@/lib/notification-manager";

interface HealthStatusScreenProps {
  onNavigate: (screen: string) => void;
  onRefreshKey?: number;
}

function isDueAppointment(appointment: Appointment, today: string): boolean {
  if (
    appointment.status === "completed" ||
    appointment.status === "cancelled" ||
    appointment.status === "rescheduled"
  ) {
    return false;
  }
  return appointment.date >= today;
}

export default function HealthStatusScreen({ onNavigate, onRefreshKey }: HealthStatusScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const today = getToday();

  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [hydrationEntries, setHydrationEntries] = useState<HydrationEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const loadData = useCallback(async () => {
    const [s, meds, logs, hydration, apts] = await Promise.all([
      settingsStorage.get(),
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      hydrationStorage.getAll(),
      appointmentStorage.getAll(),
    ]);
    setSettings(s);
    setMedications(meds);
    setMedLogs(logs);
    setHydrationEntries(hydration);
    setAppointments(apts);
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData, onRefreshKey]);

  const isSickMode = settings.sickMode;

  const getDoseCount = (med: Medication) => {
    if (Array.isArray(med.doses) && med.doses.length > 0) return med.doses.length;
    const base = (med as { doses?: number }).doses ?? 1;
    return typeof base === "number" && base > 0 ? base : 1;
  };

  const totalDoses = useMemo(
    () =>
      medications
        .filter((med) => med.active !== false && med.medicationType !== "prn")
        .reduce((sum, med) => sum + getDoseCount(med), 0),
    [medications]
  );

  const takenDoses = useMemo(() => {
    return medications
      .filter((med) => med.active !== false && med.medicationType !== "prn")
      .reduce((sum, med) => {
        const doseCount = getDoseCount(med);
        const taken = Array.from({ length: doseCount }, (_, doseIndex) =>
          medLogs.some(
            (log) => log.medicationId === med.id && (log.doseIndex ?? 0) === doseIndex && log.taken
          )
        ).filter(Boolean).length;
        return sum + taken;
      }, 0);
  }, [medications, medLogs]);

  const todayHydrationMl = useMemo(
    () =>
      hydrationEntries
        .filter((entry) => entry.date === today)
        .reduce((sum, entry) => sum + convertHydrationToMl(entry.amount, entry.unit), 0),
    [hydrationEntries, today]
  );

  const upcomingVisitCount = useMemo(
    () => appointments.filter((apt) => isDueAppointment(apt, today)).length,
    [appointments, today]
  );

  const openSickMode = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    if (isSickMode) {
      onNavigate("sickmode");
      return;
    }
    const s = await settingsStorage.get();
    await settingsStorage.save({ ...s, sickMode: true });
    await enableRecoveryTracking();
    const sd = await sickModeStorage.get();
    await sickModeStorage.save({ ...sd, active: true, startedAt: new Date().toISOString() });
    await syncRecoveryTrackingCheckIn();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setSettings({ ...s, sickMode: true });
    onNavigate("sickmode");
  }, [isSickMode, onNavigate]);

  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : 8;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title}>Health Status</Text>
          <Text style={styles.subtitle}>A clearer picture of how things are going.</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.chartBtn, pressed && { opacity: 0.85 }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigate("reports");
          }}
          accessibilityRole="button"
          accessibilityLabel="Open reports"
        >
          <Ionicons name="analytics-outline" size={20} color={C.tint} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.cardTitle}>Recovery & Sick Mode</Text>
            <Text style={styles.cardBody}>
              {isSickMode
                ? "Sick Mode is on — open your recovery tools."
                : "Feeling unwell? Open your recovery tools."}
            </Text>
          </View>
          <View style={styles.shieldIcon}>
            <Ionicons name="shield-checkmark-outline" size={18} color={C.tint} />
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
          onPress={openSickMode}
          accessibilityRole="button"
          accessibilityLabel={isSickMode ? "Open Sick Mode" : "Enter Sick Mode"}
        >
          <Text style={styles.primaryBtnText}>
            {isSickMode ? "Open Sick Mode" : "Enter Sick Mode"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <Pressable
          style={({ pressed }) => [styles.statTile, pressed && { opacity: 0.9 }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigate("medications");
          }}
          accessibilityRole="button"
          accessibilityLabel="Medications"
        >
          <Ionicons name="medical-outline" size={18} color={C.tint} />
          <Text style={styles.statLabel}>Medications</Text>
          <Text style={styles.statValue}>
            {totalDoses > 0 ? `${takenDoses}/${totalDoses}` : "0/0"}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.statTile, pressed && { opacity: 0.9 }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigate("eating");
          }}
          accessibilityRole="button"
          accessibilityLabel="Hydration"
        >
          <Ionicons name="water-outline" size={18} color={C.tint} />
          <Text style={styles.statLabel}>Hydration</Text>
          <Text style={styles.statValue}>{formatHydrationVolume(todayHydrationMl)}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.statTile, pressed && { opacity: 0.9 }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigate("appointments");
          }}
          accessibilityRole="button"
          accessibilityLabel="Visits"
        >
          <Ionicons name="calendar-outline" size={18} color={C.tint} />
          <Text style={styles.statLabel}>Visits</Text>
          <Text style={styles.statValue}>{upcomingVisitCount}</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onNavigate("reports");
        }}
        accessibilityRole="button"
        accessibilityLabel="Your health history"
      >
        <View style={styles.historyHeader}>
          <Text style={styles.cardTitle}>Your health history</Text>
          <Ionicons name="arrow-up-outline" size={16} color={C.textTertiary} style={{ transform: [{ rotate: "45deg" }] }} />
        </View>
        <Text style={styles.cardBody}>
          Weekly trends, check-ins, medication history, and recovery progress.
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: {
      paddingHorizontal: 20,
      gap: 14,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 4,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: C.text,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: C.textSecondary,
    },
    chartBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: C.tintLight ?? C.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      gap: 14,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: C.text,
      letterSpacing: -0.2,
    },
    cardBody: {
      fontSize: 14,
      lineHeight: 20,
      color: C.textSecondary,
    },
    shieldIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: C.tintLight ?? C.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtn: {
      backgroundColor: C.text,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      color: C.background,
      fontSize: 15,
      fontWeight: "700",
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
    },
    statTile: {
      flex: 1,
      backgroundColor: C.surface,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      gap: 6,
      alignItems: "flex-start",
    },
    statLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: C.textSecondary,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "700",
      color: C.text,
      letterSpacing: -0.3,
    },
    historyHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
  });
}
