import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, useWindowDimensions, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import ViewShot, { captureRef } from "react-native-view-shot";
import Colors from "@/constants/colors";
import {
  healthLogStorage, medicationStorage, medicationLogStorage, appointmentStorage,
  doctorNoteStorage, symptomStorage, settingsStorage, sickModeStorage,
  type HealthLog, type Medication, type MedicationLog, type Appointment, type DoctorNote, type Symptom, type UserSettings, type SickModeData,
} from "@/lib/storage";
import { getDaysAgo, formatDate, getToday } from "@/lib/date-utils";

const C = Colors.dark;

interface SummaryEvent {
  date: string;
  time?: string;
  type: "symptom" | "fever" | "medication" | "appointment" | "sickmode";
  text: string;
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const summaryRef = useRef<View>(null);

  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [sickMode, setSickMode] = useState<SickModeData | null>(null);
  const [range, setRange] = useState<7 | 30>(7);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    const [l, m, ml, a, n, s, st, sm] = await Promise.all([
      healthLogStorage.getAll(), medicationStorage.getAll(), medicationLogStorage.getAll(),
      appointmentStorage.getAll(), doctorNoteStorage.getAll(), symptomStorage.getAll(), settingsStorage.get(), sickModeStorage.get(),
    ]);
    setLogs(l); setMedications(m); setMedLogs(ml); setAppointments(a); setNotes(n); setSymptoms(s); setSettings(st); setSickMode(sm);
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
  const missedDoses = totalExpected - takenDoses;

  const recentSymptoms = symptoms.filter((s) => s.date >= cutoff);
  const symptomCounts: Record<string, number> = {};
  recentSymptoms.forEach((s) => { symptomCounts[s.name] = (symptomCounts[s.name] || 0) + 1; });
  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const feverEvents = recentSymptoms.filter((s) => s.temperature && s.temperature >= 99);
  const recentAppointments = appointments.filter((a) => a.date >= cutoff && a.date <= today);

  const buildChronologicalEvents = (): SummaryEvent[] => {
    const events: SummaryEvent[] = [];

    recentSymptoms.forEach((s) => {
      events.push({
        date: s.date,
        type: "symptom",
        text: `${s.name} (severity ${s.severity}/5)${s.notes ? ` - ${s.notes}` : ""}`,
      });
    });

    feverEvents.forEach((s) => {
      events.push({
        date: s.date,
        type: "fever",
        text: `Fever: ${s.temperature}\u00B0F${s.name ? ` with ${s.name}` : ""}`,
      });
    });

    recentAppointments.forEach((a) => {
      events.push({
        date: a.date,
        time: a.time,
        type: "appointment",
        text: `${a.doctorName} (${a.specialty})${a.location ? ` at ${a.location}` : ""}`,
      });
    });

    if (sickMode?.active && sickMode.startedAt && sickMode.startedAt >= cutoff) {
      events.push({
        date: sickMode.startedAt.split("T")[0],
        type: "sickmode",
        text: `Sick mode activated${sickMode.recoveryMode ? " (now in recovery)" : ""}`,
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    return events;
  };

  const summaryEvents = buildChronologicalEvents();

  const generateSummaryText = () => {
    let r = `HEALTH SUMMARY REPORT\n`;
    r += `Patient: ${settings.name || "Not set"}\n`;
    r += `Conditions: ${settings.conditions.length > 0 ? settings.conditions.join(", ") : "None listed"}\n`;
    r += `Period: Last ${range} days (${formatDate(cutoff)} \u2013 ${formatDate(today)})\n\n`;
    r += `DAILY AVERAGES\n`;
    r += `Energy: ${avgEnergy.toFixed(1)}/5 | Mood: ${avgMood.toFixed(1)}/5 | Sleep: ${avgSleep.toFixed(1)}/5\n`;
    r += `Days Logged: ${recentLogs.length} | Fasting Days: ${fastingDays}\n\n`;
    r += `SYMPTOMS (${recentSymptoms.length} total)\n`;
    if (topSymptoms.length > 0) topSymptoms.forEach(([s, c]) => { r += `  ${s}: ${c}x\n`; });
    else r += `  None reported\n`;
    r += `\nFEVER EVENTS (${feverEvents.length})\n`;
    if (feverEvents.length > 0) feverEvents.forEach((f) => { r += `  ${formatDate(f.date)}: ${f.temperature}\u00B0F\n`; });
    else r += `  None\n`;
    r += `\nMEDICATIONS\n`;
    r += `Active: ${activeMeds.length} | Adherence: ${adherence}% | Missed: ${missedDoses}\n`;
    activeMeds.forEach((m) => { r += `  - ${m.name} ${m.dosage} (${Array.isArray(m.timeTag) ? m.timeTag.join(", ") : m.timeTag})\n`; });
    r += `\nAPPOINTMENTS IN RANGE (${recentAppointments.length})\n`;
    if (recentAppointments.length > 0) recentAppointments.forEach((a) => { r += `  ${formatDate(a.date)} - ${a.doctorName} (${a.specialty})\n`; });
    else r += `  None\n`;
    if (sickMode?.active) {
      r += `\nSICK MODE: Active${sickMode.recoveryMode ? " (Recovery)" : ""}\n`;
    }
    return r;
  };

  const handleExportPng = async () => {
    if (!summaryRef.current) return;
    setExporting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const uri = await captureRef(summaryRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share Health Summary" });
      } else {
        Alert.alert("Sharing not available", "Sharing is not supported on this device.");
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export summary.");
    } finally {
      setExporting(false);
    }
  };

  const eventIcon = (type: SummaryEvent["type"]) => {
    switch (type) {
      case "symptom": return "pulse-outline" as const;
      case "fever": return "thermometer-outline" as const;
      case "medication": return "medical-outline" as const;
      case "appointment": return "calendar-outline" as const;
      case "sickmode": return "bed-outline" as const;
    }
  };

  const eventColor = (type: SummaryEvent["type"]) => {
    switch (type) {
      case "symptom": return C.orange;
      case "fever": return C.red;
      case "medication": return C.green;
      case "appointment": return C.cyan;
      case "sickmode": return C.purple;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, {
      paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
      paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
    }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>

      <View style={styles.rangePicker}>
        {([7, 30] as const).map((r) => (
          <Pressable key={r} style={[styles.rangeBtn, range === r && styles.rangeBtnActive]} onPress={() => { setRange(r); Haptics.selectionAsync(); }} accessibilityRole="button" accessibilityLabel={r === 7 ? "7 day range" : "30 day range"} accessibilityState={{ selected: range === r }}>
            <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r === 7 ? "7 Days" : "30 Days"}</Text>
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

      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>Health Summary</Text>
        <Text style={styles.sectionSubtitle}>
          {formatDate(cutoff)} \u2013 {formatDate(today)}
        </Text>
      </View>

      <View ref={summaryRef} collapsable={false} style={styles.summaryCapture}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryHeaderTitle}>Health Summary Report</Text>
          <Text style={styles.summaryHeaderSub}>
            {settings.name || "Patient"} \u2022 Last {range} days
          </Text>
          {settings.conditions.length > 0 && (
            <Text style={styles.summaryHeaderConditions}>
              Conditions: {settings.conditions.join(", ")}
            </Text>
          )}
        </View>

        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStatBox}>
            <Text style={styles.summaryStatNum}>{avgEnergy > 0 ? avgEnergy.toFixed(1) : "--"}</Text>
            <Text style={styles.summaryStatLbl}>Energy</Text>
          </View>
          <View style={styles.summaryStatBox}>
            <Text style={styles.summaryStatNum}>{avgMood > 0 ? avgMood.toFixed(1) : "--"}</Text>
            <Text style={styles.summaryStatLbl}>Mood</Text>
          </View>
          <View style={styles.summaryStatBox}>
            <Text style={styles.summaryStatNum}>{avgSleep > 0 ? avgSleep.toFixed(1) : "--"}</Text>
            <Text style={styles.summaryStatLbl}>Sleep</Text>
          </View>
          <View style={styles.summaryStatBox}>
            <Text style={styles.summaryStatNum}>{adherence}%</Text>
            <Text style={styles.summaryStatLbl}>Med Adh.</Text>
          </View>
        </View>

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryBlockTitle}>Symptoms Logged ({recentSymptoms.length})</Text>
          {topSymptoms.length > 0 ? topSymptoms.map(([name, count]) => (
            <Text key={name} style={styles.summaryItem}>{name}: {count}x</Text>
          )) : <Text style={styles.summaryItemEmpty}>None reported</Text>}
        </View>

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryBlockTitle}>Fever Events ({feverEvents.length})</Text>
          {feverEvents.length > 0 ? feverEvents.map((f, i) => (
            <Text key={i} style={styles.summaryItem}>{formatDate(f.date)}: {f.temperature}{"\u00B0"}F</Text>
          )) : <Text style={styles.summaryItemEmpty}>None</Text>}
        </View>

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryBlockTitle}>Medications ({activeMeds.length} active)</Text>
          <Text style={styles.summaryItem}>Adherence: {adherence}% | Missed doses: {missedDoses}</Text>
          {activeMeds.map((m) => (
            <Text key={m.id} style={styles.summaryItem}>{m.name} {m.dosage} ({Array.isArray(m.timeTag) ? m.timeTag.join(", ") : m.timeTag})</Text>
          ))}
        </View>

        <View style={styles.summaryBlock}>
          <Text style={styles.summaryBlockTitle}>Appointments ({recentAppointments.length})</Text>
          {recentAppointments.length > 0 ? recentAppointments.map((a) => (
            <Text key={a.id} style={styles.summaryItem}>{formatDate(a.date)} - {a.doctorName} ({a.specialty})</Text>
          )) : <Text style={styles.summaryItemEmpty}>None in this period</Text>}
        </View>

        {sickMode?.active && (
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryBlockTitle}>Sick Mode</Text>
            <Text style={styles.summaryItem}>
              Active{sickMode.recoveryMode ? " (Recovery Mode)" : ""}
              {sickMode.startedAt ? ` since ${formatDate(sickMode.startedAt.split("T")[0])}` : ""}
            </Text>
          </View>
        )}
      </View>

      {summaryEvents.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Timeline</Text>
          {summaryEvents.map((ev, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: eventColor(ev.type) + "22" }]}>
                <Ionicons name={eventIcon(ev.type)} size={14} color={eventColor(ev.type)} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineDate}>{formatDate(ev.date)}</Text>
                <Text style={styles.timelineText}>{ev.text}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.generateBtn, { opacity: pressed ? 0.85 : 1 }, exporting && styles.generateBtnDisabled]}
        onPress={handleExportPng}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel={exporting ? "Exporting health summary" : "Export health summary"}
        accessibilityHint="Generates a shareable image of your health report"
      >
        <Ionicons name="image-outline" size={18} color="#fff" />
        <Text style={styles.generateText}>{exporting ? "Exporting..." : "Export Health Summary"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5 },
  rangePicker: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 10, padding: 3, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  rangeBtnActive: { backgroundColor: C.surfaceElevated },
  rangeText: { fontWeight: "600", fontSize: 13, color: C.textSecondary },
  rangeTextActive: { color: C.text },
  statsGrid: { gap: 8, marginBottom: 16 },
  statsGridWide: { flexDirection: "row", flexWrap: "wrap" },
  statCard: { backgroundColor: C.surface, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.border },
  statCardWide: { width: "32%", marginRight: "1%" },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontWeight: "700", fontSize: 24, color: C.text, letterSpacing: -0.5 },
  statLabel: { fontWeight: "400", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontWeight: "600", fontSize: 14, color: C.text, marginBottom: 14 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 100, gap: 6 },
  barCol: { flex: 1, alignItems: "center" },
  barTrack: { width: "100%", height: 80, justifyContent: "flex-end", alignItems: "center" },
  bar: { width: "65%", borderRadius: 3, minHeight: 4 },
  barLabel: { fontWeight: "500", fontSize: 10, color: C.textTertiary, marginTop: 4 },
  freqRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  freqName: { fontWeight: "500", fontSize: 12, color: C.text, width: 90 },
  freqBarOuter: { flex: 1, height: 6, backgroundColor: C.surfaceElevated, borderRadius: 3, overflow: "hidden" },
  freqBarInner: { height: "100%", backgroundColor: C.orange, borderRadius: 3 },
  freqCount: { fontWeight: "600", fontSize: 12, color: C.textSecondary, width: 20, textAlign: "right" },
  summarySection: { marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: "700", fontSize: 20, color: C.text, letterSpacing: -0.3 },
  sectionSubtitle: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  summaryCapture: { backgroundColor: "#FFFAF5", borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  summaryHeader: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12 },
  summaryHeaderTitle: { fontWeight: "700", fontSize: 18, color: C.tint, letterSpacing: -0.3 },
  summaryHeaderSub: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginTop: 4 },
  summaryHeaderConditions: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  summaryStatsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryStatBox: { flex: 1, backgroundColor: C.surface, borderRadius: 10, padding: 10, alignItems: "center" },
  summaryStatNum: { fontWeight: "700", fontSize: 18, color: C.text },
  summaryStatLbl: { fontWeight: "400", fontSize: 10, color: C.textSecondary, marginTop: 2 },
  summaryBlock: { marginBottom: 12 },
  summaryBlockTitle: { fontWeight: "600", fontSize: 13, color: C.tint, marginBottom: 4 },
  summaryItem: { fontWeight: "400", fontSize: 12, color: C.text, paddingLeft: 8, marginBottom: 2 },
  summaryItemEmpty: { fontWeight: "400", fontSize: 12, color: C.textTertiary, paddingLeft: 8, fontStyle: "italic" },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 },
  timelineDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  timelineContent: { flex: 1 },
  timelineDate: { fontWeight: "600", fontSize: 11, color: C.textSecondary },
  timelineText: { fontWeight: "400", fontSize: 13, color: C.text, marginTop: 1 },
  generateBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  generateBtnDisabled: { opacity: 0.6 },
  generateText: { fontWeight: "600", fontSize: 15, color: "#fff" },
});
