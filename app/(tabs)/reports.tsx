import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  healthLogStorage,
  medicationStorage,
  medicationLogStorage,
  appointmentStorage,
  doctorNoteStorage,
  type HealthLog,
  type Medication,
  type MedicationLog,
  type Appointment,
  type DoctorNote,
} from "@/lib/storage";
import { getDaysAgo, formatDate, getToday } from "@/lib/date-utils";

const C = Colors.dark;

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [range, setRange] = useState<7 | 14 | 30>(7);

  const loadData = useCallback(async () => {
    const [l, m, ml, a, n] = await Promise.all([
      healthLogStorage.getAll(),
      medicationStorage.getAll(),
      medicationLogStorage.getAll(),
      appointmentStorage.getAll(),
      doctorNoteStorage.getAll(),
    ]);
    setLogs(l);
    setMedications(m);
    setMedLogs(ml);
    setAppointments(a);
    setNotes(n);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const cutoff = getDaysAgo(range);
  const recentLogs = logs
    .filter((l) => l.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  const avgEnergy =
    recentLogs.length > 0
      ? recentLogs.reduce((s, l) => s + l.energy, 0) / recentLogs.length
      : 0;

  const fastingDays = recentLogs.filter((l) => l.fasting).length;

  const symptomCounts: Record<string, number> = {};
  recentLogs.forEach((l) =>
    l.symptoms.forEach((s) => {
      symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    }),
  );
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const activeMeds = medications.filter((m) => m.active);
  const recentMedLogs = medLogs.filter((ml) => ml.date >= cutoff);
  const totalExpectedDoses = activeMeds.length * range;
  const takenDoses = recentMedLogs.filter((ml) => ml.taken).length;
  const adherence =
    totalExpectedDoses > 0
      ? Math.round((takenDoses / totalExpectedDoses) * 100)
      : 0;

  const energyLabels = ["", "Low", "Fair", "Good", "Great", "Excellent"];
  const energyColors = ["", C.danger, C.warning, C.tint, C.success, C.accent];
  const avgEnergyIdx = Math.round(avgEnergy);

  const generateReport = () => {
    const today = getToday();
    let report = `HEALTH SUMMARY REPORT\n`;
    report += `Period: Last ${range} days (${formatDate(cutoff)} - ${formatDate(today)})\n`;
    report += `Generated: ${formatDate(today)}\n\n`;

    report += `--- ENERGY ---\n`;
    report += `Average Energy: ${avgEnergy.toFixed(1)}/5 (${energyLabels[avgEnergyIdx]})\n`;
    report += `Days Logged: ${recentLogs.length}\n\n`;

    report += `--- FASTING ---\n`;
    report += `Fasting Days: ${fastingDays} out of ${recentLogs.length} logged days\n\n`;

    report += `--- SYMPTOMS ---\n`;
    if (topSymptoms.length > 0) {
      topSymptoms.forEach(([s, c]) => {
        report += `  ${s}: ${c} day(s)\n`;
      });
    } else {
      report += `  No symptoms reported\n`;
    }
    report += `\n`;

    report += `--- MEDICATIONS ---\n`;
    report += `Active Medications: ${activeMeds.length}\n`;
    activeMeds.forEach((m) => {
      report += `  - ${m.name} (${m.dosage}) - ${m.timeTag}\n`;
    });
    report += `Adherence: ${adherence}% (${takenDoses}/${totalExpectedDoses} doses)\n\n`;

    report += `--- UPCOMING APPOINTMENTS ---\n`;
    const upcoming = appointments.filter((a) => a.date >= today);
    if (upcoming.length > 0) {
      upcoming.forEach((a) => {
        report += `  ${formatDate(a.date)} - ${a.doctorName} (${a.specialty})\n`;
      });
    } else {
      report += `  None scheduled\n`;
    }
    report += `\n`;

    report += `--- QUESTIONS FOR DOCTOR ---\n`;
    if (notes.length > 0) {
      notes.forEach((n, i) => {
        report += `  ${i + 1}. ${n.text}\n`;
      });
    } else {
      report += `  No questions added\n`;
    }

    return report;
  };

  const handleShare = async () => {
    const report = generateReport();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await Share.share({ message: report });
    } catch {}
  };

  const maxSymptomCount = topSymptoms.length > 0 ? topSymptoms[0][1] : 1;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 118 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Reports</Text>
          <Pressable
            style={({ pressed }) => [
              styles.shareBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.rangePicker}>
          {([7, 14, 30] as const).map((r) => (
            <Pressable
              key={r}
              style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
              onPress={() => {
                setRange(r);
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.rangeBtnText,
                  range === r && styles.rangeBtnTextActive,
                ]}
              >
                {r}d
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIcon,
                { backgroundColor: energyColors[avgEnergyIdx] + "22" },
              ]}
            >
              <Ionicons
                name="flash-outline"
                size={18}
                color={energyColors[avgEnergyIdx] || C.textSecondary}
              />
            </View>
            <Text style={styles.statValue}>
              {avgEnergy > 0 ? avgEnergy.toFixed(1) : "--"}
            </Text>
            <Text style={styles.statLabel}>Avg Energy</Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[styles.statIcon, { backgroundColor: C.tintLight }]}
            >
              <Ionicons name="moon-outline" size={18} color={C.tint} />
            </View>
            <Text style={styles.statValue}>{fastingDays}</Text>
            <Text style={styles.statLabel}>Fasting Days</Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[styles.statIcon, { backgroundColor: C.accentLight }]}
            >
              <Ionicons name="medkit-outline" size={18} color={C.accent} />
            </View>
            <Text style={styles.statValue}>{adherence}%</Text>
            <Text style={styles.statLabel}>Med Adherence</Text>
          </View>
        </View>

        {recentLogs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Energy Trend</Text>
            <View style={styles.energyChart}>
              {recentLogs.slice(-7).map((log, i) => (
                <View key={log.id} style={styles.barCol}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${(log.energy / 5) * 100}%`,
                          backgroundColor: energyColors[log.energy],
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>
                    {new Date(log.date + "T00:00:00")
                      .toLocaleDateString("en-US", { weekday: "narrow" })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {topSymptoms.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Symptoms</Text>
            {topSymptoms.map(([symptom, count]) => (
              <View key={symptom} style={styles.symptomRow}>
                <Text style={styles.symptomName}>{symptom}</Text>
                <View style={styles.symptomBarOuter}>
                  <View
                    style={[
                      styles.symptomBarInner,
                      {
                        width: `${(count / maxSymptomCount) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.symptomCount}>{count}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medication List</Text>
          {activeMeds.length > 0 ? (
            activeMeds.map((med) => (
              <View key={med.id} style={styles.medRow}>
                <View style={styles.medDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{med.name}</Text>
                  <Text style={styles.medDetail}>
                    {med.dosage} - {med.timeTag}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active medications</Text>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.generateBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleShare}
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={styles.generateBtnText}>Share Health Summary</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  rangePicker: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  rangeBtnActive: {
    backgroundColor: C.surfaceElevated,
  },
  rangeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.textSecondary,
  },
  rangeBtnTextActive: {
    color: C.text,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: C.text,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
    marginBottom: 16,
  },
  energyChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
  },
  barContainer: {
    width: "100%",
    height: 100,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "70%",
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.textTertiary,
    marginTop: 6,
  },
  symptomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  symptomName: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.text,
    width: 80,
  },
  symptomBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 4,
    overflow: "hidden",
  },
  symptomBarInner: {
    height: "100%",
    backgroundColor: C.danger,
    borderRadius: 4,
  },
  symptomCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textSecondary,
    width: 24,
    textAlign: "right",
  },
  medRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 10,
  },
  medDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
    marginTop: 6,
  },
  medName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.text,
  },
  medDetail: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textTertiary,
    textAlign: "center",
    paddingVertical: 12,
  },
  generateBtn: {
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  generateBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
});
