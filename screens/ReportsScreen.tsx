import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, Share, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  healthLogStorage, medicationStorage, medicationLogStorage, appointmentStorage,
  doctorNoteStorage, symptomStorage, settingsStorage,
  type HealthLog, type Medication, type MedicationLog, type Appointment, type DoctorNote, type Symptom, type UserSettings,
} from "@/lib/storage";
import { getDaysAgo, formatDate, getToday } from "@/lib/date-utils";

const C = Colors.dark;

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false });
  const [range, setRange] = useState<7 | 14 | 30>(7);

  const loadData = useCallback(async () => {
    const [l, m, ml, a, n, s, st] = await Promise.all([
      healthLogStorage.getAll(), medicationStorage.getAll(), medicationLogStorage.getAll(),
      appointmentStorage.getAll(), doctorNoteStorage.getAll(), symptomStorage.getAll(), settingsStorage.get(),
    ]);
    setLogs(l); setMedications(m); setMedLogs(ml); setAppointments(a); setNotes(n); setSymptoms(s); setSettings(st);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const cutoff = getDaysAgo(range);
  const today = getToday();
  const recentLogs = logs.filter((l) => l.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const avgEnergy = recentLogs.length > 0 ? recentLogs.reduce((s, l) => s + l.energy, 0) / recentLogs.length : 0;
  const avgMood = recentLogs.length > 0 ? recentLogs.reduce((s, l) => s + l.mood, 0) / recentLogs.length : 0;
  const avgSleep = recentLogs.length > 0 ? recentLogs.reduce((s, l) => s + l.sleep, 0) / recentLogs.length : 0;
  const fastingDays = recentLogs.filter((l) => l.fasting).length;
  const activeMeds = medications.filter((m) => m.active);
  const recentMedLogs = medLogs.filter((ml) => ml.date >= cutoff);
  const totalExpected = activeMeds.length * range;
  const takenDoses = recentMedLogs.filter((ml) => ml.taken).length;
  const adherence = totalExpected > 0 ? Math.round((takenDoses / totalExpected) * 100) : 0;

  const recentSymptoms = symptoms.filter((s) => s.date >= cutoff);
  const symptomCounts: Record<string, number> = {};
  recentSymptoms.forEach((s) => { symptomCounts[s.name] = (symptomCounts[s.name] || 0) + 1; });
  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const energyLabels = ["", "Low", "Fair", "Good", "Great", "Excellent"];

  const generateReport = () => {
    let r = `HEALTH SUMMARY REPORT\n`;
    r += `Patient: ${settings.name || "Not set"}\n`;
    r += `Conditions: ${settings.conditions.length > 0 ? settings.conditions.join(", ") : "None listed"}\n`;
    r += `Period: Last ${range} days (${formatDate(cutoff)} - ${formatDate(today)})\n\n`;
    r += `--- DAILY AVERAGES ---\n`;
    r += `Energy: ${avgEnergy.toFixed(1)}/5 | Mood: ${avgMood.toFixed(1)}/5 | Sleep: ${avgSleep.toFixed(1)}/5\n`;
    r += `Days Logged: ${recentLogs.length}\n`;
    r += `Fasting Days: ${fastingDays}\n\n`;
    r += `--- SYMPTOMS (${recentSymptoms.length} total) ---\n`;
    if (topSymptoms.length > 0) topSymptoms.forEach(([s, c]) => { r += `  ${s}: ${c}x\n`; });
    else r += `  None reported\n`;
    r += `\n--- MEDICATIONS ---\n`;
    r += `Active: ${activeMeds.length}\n`;
    activeMeds.forEach((m) => { r += `  - ${m.name} ${m.dosage} (${m.timeTag})\n`; });
    r += `Adherence: ${adherence}%\n\n`;
    r += `--- UPCOMING APPOINTMENTS ---\n`;
    const upcoming = appointments.filter((a) => a.date >= today);
    if (upcoming.length > 0) upcoming.forEach((a) => { r += `  ${formatDate(a.date)} - ${a.doctorName} (${a.specialty})\n`; });
    else r += `  None\n`;
    r += `\n--- QUESTIONS FOR DOCTOR ---\n`;
    if (notes.length > 0) notes.forEach((n, i) => { r += `  ${i + 1}. ${n.text}\n`; });
    else r += `  None\n`;
    return r;
  };

  const handleShare = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try { await Share.share({ message: generateReport() }); } catch {}
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, {
      paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
      paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
    }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <Pressable style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.rangePicker}>
        {([7, 14, 30] as const).map((r) => (
          <Pressable key={r} style={[styles.rangeBtn, range === r && styles.rangeBtnActive]} onPress={() => { setRange(r); Haptics.selectionAsync(); }}>
            <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r}d</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.statsGrid, isWide && styles.statsGridWide]}>
        {[
          { label: "Avg Energy", value: avgEnergy > 0 ? avgEnergy.toFixed(1) : "--", color: C.tint, icon: "flash-outline" as const },
          { label: "Avg Mood", value: avgMood > 0 ? avgMood.toFixed(1) : "--", color: C.purple, icon: "happy-outline" as const },
          { label: "Avg Sleep", value: avgSleep > 0 ? avgSleep.toFixed(1) : "--", color: C.cyan, icon: "moon-outline" as const },
          { label: "Med Adherence", value: `${adherence}%`, color: C.green, icon: "medical-outline" as const },
          { label: "Fasting Days", value: `${fastingDays}`, color: C.yellow, icon: "restaurant-outline" as const },
          { label: "Symptoms", value: `${recentSymptoms.length}`, color: C.orange, icon: "pulse-outline" as const },
        ].map((stat, i) => (
          <View key={i} style={[styles.statCard, isWide && styles.statCardWide]}>
            <View style={[styles.statIcon, { backgroundColor: stat.color + "1A" }]}>
              <Ionicons name={stat.icon} size={16} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {recentLogs.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Energy Trend</Text>
          <View style={styles.chart}>
            {recentLogs.slice(-7).map((log) => (
              <View key={log.id} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${(log.energy / 5) * 100}%`, backgroundColor: C.tint }]} />
                </View>
                <Text style={styles.barLabel}>{new Date(log.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {topSymptoms.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Symptoms</Text>
          {topSymptoms.map(([name, count]) => (
            <View key={name} style={styles.freqRow}>
              <Text style={styles.freqName}>{name}</Text>
              <View style={styles.freqBarOuter}>
                <View style={[styles.freqBarInner, { width: `${(count / topSymptoms[0][1]) * 100}%` }]} />
              </View>
              <Text style={styles.freqCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable style={({ pressed }) => [styles.generateBtn, { opacity: pressed ? 0.85 : 1 }]} onPress={handleShare}>
        <Ionicons name="document-text-outline" size={18} color="#fff" />
        <Text style={styles.generateText}>Export Health Summary</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, letterSpacing: -0.5 },
  shareBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  rangePicker: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 10, padding: 3, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  rangeBtnActive: { backgroundColor: C.surfaceElevated },
  rangeText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  rangeTextActive: { color: C.text },
  statsGrid: { gap: 8, marginBottom: 16 },
  statsGridWide: { flexDirection: "row", flexWrap: "wrap" },
  statCard: { backgroundColor: C.surface, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.border },
  statCardWide: { width: "32%", marginRight: "1%" },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text, letterSpacing: -0.5 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, marginBottom: 14 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 100, gap: 6 },
  barCol: { flex: 1, alignItems: "center" },
  barTrack: { width: "100%", height: 80, justifyContent: "flex-end", alignItems: "center" },
  bar: { width: "65%", borderRadius: 3, minHeight: 4 },
  barLabel: { fontFamily: "Inter_500Medium", fontSize: 10, color: C.textTertiary, marginTop: 4 },
  freqRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  freqName: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.text, width: 90 },
  freqBarOuter: { flex: 1, height: 6, backgroundColor: C.surfaceElevated, borderRadius: 3, overflow: "hidden" },
  freqBarInner: { height: "100%", backgroundColor: C.orange, borderRadius: 3 },
  freqCount: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary, width: 20, textAlign: "right" },
  generateBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  generateText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
});
