import React, { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TextInput from "@/components/DoneTextInput";
import { raised } from "@/constants/raised";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  cycleTrackingStorage,
  healthLogStorage,
  medicationLogStorage,
  symptomStorage,
  type CycleEntry,
  type CycleFlow,
  type CycleSymptomTag,
  type HealthLog,
  type MedicationLog,
  type Symptom,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";

interface CycleTrackingScreenProps {
  onBack: () => void;
}

type CycleGroup = {
  id: string;
  startDate: string;
  endDate?: string;
  entries: CycleEntry[];
  length?: number;
};

const FLOW_OPTIONS: { id: CycleFlow; label: string; strength: number }[] = [
  { id: "light", label: "Light", strength: 1 },
  { id: "medium", label: "Medium", strength: 2 },
  { id: "heavy", label: "Heavy", strength: 3 },
];

const SYMPTOM_TAGS: { id: CycleSymptomTag; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "cramping", label: "Cramping", icon: "pulse-outline" },
  { id: "headache", label: "Headache", icon: "cloud-outline" },
  { id: "fatigue", label: "Fatigue", icon: "battery-half-outline" },
  { id: "bloating", label: "Bloating", icon: "ellipse-outline" },
  { id: "mood_changes", label: "Mood changes", icon: "heart-outline" },
  { id: "nausea", label: "Nausea", icon: "sad-outline" },
];

const PRIVACY_KEY = "fir_cycle_tracking_privacy_mode";
const NEW_CYCLE_GAP_DAYS = 14;

function dateMs(date: string) {
  const ms = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function daysBetween(from: string, to: string) {
  const diff = dateMs(to) - dateMs(from);
  return Math.round(diff / 86_400_000);
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeEntry(entry: CycleEntry): CycleEntry {
  if (entry.symptomTags?.length) return entry;
  const legacy = (entry.symptoms ?? "").toLowerCase();
  const tags = SYMPTOM_TAGS.filter((tag) => legacy.includes(tag.label.toLowerCase().split(" ")[0])).map((tag) => tag.id);
  return { ...entry, symptomTags: tags };
}

function buildCycles(entries: CycleEntry[]): CycleGroup[] {
  const sorted = [...entries].map(normalizeEntry).sort((a, b) => a.date.localeCompare(b.date));
  const groups: CycleGroup[] = [];

  sorted.forEach((entry) => {
    const last = groups[groups.length - 1];
    const shouldStart = entry.isCycleStart || !last || daysBetween(last.entries[last.entries.length - 1].date, entry.date) >= NEW_CYCLE_GAP_DAYS;
    if (shouldStart) {
      groups.push({ id: entry.cycleId ?? entry.id, startDate: entry.date, entries: [entry] });
      return;
    }
    last.entries.push(entry);
    last.endDate = entry.date;
  });

  return groups.map((cycle, index) => {
    const next = groups[index + 1];
    return {
      ...cycle,
      endDate: cycle.entries[cycle.entries.length - 1]?.date,
      length: next ? daysBetween(cycle.startDate, next.startDate) : undefined,
    };
  });
}

function getMostCommonTags(entries: CycleEntry[]) {
  const counts = new Map<CycleSymptomTag, number>();
  entries.forEach((entry) => entry.symptomTags?.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

function tagLabel(tag: CycleSymptomTag) {
  return SYMPTOM_TAGS.find((item) => item.id === tag)?.label ?? "Custom";
}

function getDayInCycle(date: string, cycles: CycleGroup[]) {
  const cycle = [...cycles].reverse().find((item) => dateMs(item.startDate) <= dateMs(date));
  if (!cycle) return undefined;
  return daysBetween(cycle.startDate, date) + 1;
}

function makeInsights(cycles: CycleGroup[], entries: CycleEntry[], healthLogs: HealthLog[], symptoms: Symptom[], medLogs: MedicationLog[]) {
  const completeLengths = cycles.map((cycle) => cycle.length).filter((value): value is number => typeof value === "number" && value > 0);
  const insights: string[] = [];

  if (completeLengths.length >= 2) {
    const avg = Math.round(completeLengths.reduce((sum, value) => sum + value, 0) / completeLengths.length);
    insights.push(`Your average cycle length is about ${avg} days.`);
  } else {
    insights.push("Log 2 to 3 cycles to unlock stronger pattern insights.");
  }

  const commonTags = getMostCommonTags(entries);
  if (commonTags.length > 0) {
    insights.push(`${tagLabel(commonTags[0][0])} is your most common cycle tag.`);
  }

  const crampDays = entries
    .filter((entry) => entry.symptomTags?.includes("cramping"))
    .map((entry) => getDayInCycle(entry.date, cycles))
    .filter((value): value is number => typeof value === "number" && value > 0 && value <= 4);
  if (crampDays.length >= 2) insights.push("Cramping tends to show up near the start of your cycle.");

  const cycleStartDates = new Set(cycles.map((cycle) => cycle.startDate));
  const lowEnergyNearStart = healthLogs.filter((log) => {
    const nearStart = [...cycleStartDates].some((start) => Math.abs(daysBetween(log.date, start)) <= 2);
    return nearStart && log.energy <= 4;
  });
  if (lowEnergyNearStart.length >= 2) insights.push("Low energy often appears within a couple days of cycle start.");

  const linkedSymptoms = symptoms.filter((symptom) => cycles.some((cycle) => Math.abs(daysBetween(symptom.date, cycle.startDate)) <= 2));
  if (linkedSymptoms.length >= 2) insights.push("Your symptom logs cluster around cycle start dates.");

  const linkedMeds = medLogs.filter((log) => cycles.some((cycle) => Math.abs(daysBetween(log.date, cycle.startDate)) <= 2));
  if (linkedMeds.length >= 2) insights.push("Medication logs appear near cycle start often enough to be worth noticing.");

  return insights.slice(0, 4);
}

export default function CycleTrackingScreen({ onBack }: CycleTrackingScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<Symptom[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [date, setDate] = useState(getToday());
  const [flow, setFlow] = useState<CycleFlow>("medium");
  const [selectedTags, setSelectedTags] = useState<CycleSymptomTag[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [notes, setNotes] = useState("");
  const [privacyMode, setPrivacyMode] = useState(true);
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [all, logs, symptoms, meds, privacy] = await Promise.all([
      cycleTrackingStorage.getAll(),
      healthLogStorage.getAll(),
      symptomStorage.getAll(),
      medicationLogStorage.getAll(),
      AsyncStorage.getItem(PRIVACY_KEY).catch(() => null),
    ]);
    const privacyValue = privacy === "false" ? false : true;
    if (privacy === null) await AsyncStorage.setItem(PRIVACY_KEY, "true");
    setEntries([...all].map(normalizeEntry).sort((a, b) => b.date.localeCompare(a.date)));
    setHealthLogs(logs);
    setSymptomLogs(symptoms);
    setMedLogs(meds);
    setPrivacyMode(privacyValue);
    setQuickLogOpen((current) => (all.length === 0 ? true : current));
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const cycles = useMemo(() => buildCycles(entries), [entries]);
  const latestCycle = cycles[cycles.length - 1];
  const timelineEntries = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-28), [entries]);
  const insights = useMemo(() => makeInsights(cycles, entries, healthLogs, symptomLogs, medLogs), [cycles, entries, healthLogs, symptomLogs, medLogs]);
  const commonTags = useMemo(() => getMostCommonTags(entries), [entries]);
  const lastEntryBeforeDate = useMemo(
    () => [...entries].filter((entry) => entry.date < date).sort((a, b) => b.date.localeCompare(a.date))[0],
    [date, entries]
  );
  const isLikelyNewCycle = !!lastEntryBeforeDate && daysBetween(lastEntryBeforeDate.date, date) >= NEW_CYCLE_GAP_DAYS;
  const supportTips = useMemo(() => {
    const tips: string[] = [];
    if (flow === "heavy") tips.push("Consider rest today and keep hydration close.");
    if (selectedTags.includes("cramping")) tips.push("Heat packs or a warm shower may help with cramping.");
    if (selectedTags.includes("fatigue")) tips.push("A lighter schedule may be useful if you can swing it.");
    if (selectedTags.includes("nausea")) tips.push("Small, simple meals may feel easier today.");
    return tips;
  }, [flow, selectedTags]);

  const prediction = useMemo(() => {
    const completeLengths = cycles.map((cycle) => cycle.length).filter((value): value is number => typeof value === "number" && value > 0);
    if (completeLengths.length < 2 || !latestCycle) return null;
    const avg = Math.round(completeLengths.reduce((sum, value) => sum + value, 0) / completeLengths.length);
    const daysSinceStart = daysBetween(latestCycle.startDate, getToday());
    const remaining = avg - daysSinceStart;
    if (remaining >= 3 && remaining <= 7) return "You may be approaching your next cycle in about 3 to 7 days.";
    if (remaining >= 0 && remaining < 3) return "You may be approaching your next cycle soon.";
    return null;
  }, [cycles, latestCycle]);

  const toggleTag = (tag: CycleSymptomTag) => {
    Haptics.selectionAsync();
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  const saveEntry = async (markCycleStart: boolean) => {
    const cleanDate = date.trim() || getToday();
    const cycleStart = markCycleStart || isLikelyNewCycle || cycles.length === 0;
    const currentCycle = cycleStart ? undefined : latestCycle;
    const cycleId = cycleStart ? `cycle-${cleanDate}-${Date.now()}` : currentCycle?.id;
    const cycleDay = cycleStart || !currentCycle ? 1 : daysBetween(currentCycle.startDate, cleanDate) + 1;
    await cycleTrackingStorage.save({
      date: cleanDate,
      flow,
      symptomTags: [...selectedTags, ...(customSymptom.trim() ? ["custom" as const] : [])],
      symptoms: customSymptom.trim() || undefined,
      notes: notes.trim() || undefined,
      cycleId,
      cycleDay,
      isCycleStart: cycleStart,
      privacyMode,
    });
    setDate(getToday());
    setFlow("medium");
    setSelectedTags([]);
    setCustomSymptom("");
    setNotes("");
    setQuickLogOpen(false);
    await loadData();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = async () => {
    if (isLikelyNewCycle) {
      Alert.alert("This looks like a new cycle", "Start this date as Day 1?", [
        { text: "Just log", onPress: () => saveEntry(false) },
        { text: "Start tracking", onPress: () => saveEntry(true) },
      ]);
      return;
    }
    await saveEntry(false);
  };

  const handlePrivacyToggle = async (value: boolean) => {
    setPrivacyMode(value);
    await AsyncStorage.setItem(PRIVACY_KEY, value ? "true" : "false");
    Haptics.selectionAsync();
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete entry?", "This cycle log will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cycleTrackingStorage.delete(id);
          await loadData();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: Platform.OS === "web" ? 40 : 14, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to Settings">
          <Ionicons name="arrow-back" size={22} color={C.text} />
          <Text style={styles.backText}>Settings</Text>
        </Pressable>

        <Text style={styles.title}>Cycle tracking</Text>
        <Text style={styles.subtitle}>Pattern-aware logging for flow, symptoms, energy, and context.</Text>

        <View style={styles.card}>
          <View style={styles.privacyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Privacy mode</Text>
              <Text style={styles.smallText}>Blur sensitive entries and keep cycle details out of glanceable areas.</Text>
            </View>
            <Switch value={privacyMode} onValueChange={handlePrivacyToggle} trackColor={{ true: C.tintLight, false: C.border }} thumbColor={privacyMode ? C.tint : C.surfaceElevated} />
          </View>
        </View>

        <View style={styles.card}>
          {quickLogOpen ? (
            <>
              <View style={styles.quickLogHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Quick log</Text>
                  <Text style={styles.smallText}>Add today&apos;s flow, symptoms, and context.</Text>
                </View>
                {entries.length > 0 ? (
                  <Pressable
                    style={styles.closeLogButton}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setQuickLogOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Collapse quick log"
                  >
                    <Ionicons name="chevron-up" size={20} color={C.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
              {isLikelyNewCycle ? (
                <View style={styles.detectedBanner}>
                  <Ionicons name="sparkles-outline" size={18} color={C.tint} />
                  <Text style={styles.detectedText}>This looks like the start of a new cycle.</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Date</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.textTertiary} />

              <Text style={styles.label}>Flow</Text>
              <View style={styles.flowRow}>
                {FLOW_OPTIONS.map((option) => {
                  const active = flow === option.id;
                  return (
                    <Pressable key={option.id} style={[styles.flowChip, active && styles.flowChipActive]} onPress={() => setFlow(option.id)}>
                      <View style={[styles.flowDot, { opacity: 0.35 + option.strength * 0.2 }, active && { backgroundColor: C.tint }]} />
                      <Text style={[styles.flowChipText, active && styles.flowChipTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Symptoms</Text>
              <View style={styles.tagGrid}>
                {SYMPTOM_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <Pressable key={tag.id} style={[styles.tagChip, active && styles.tagChipActive]} onPress={() => toggleTag(tag.id)}>
                      <Ionicons name={tag.icon} size={15} color={active ? C.tint : C.textTertiary} />
                      <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput style={styles.input} value={customSymptom} onChangeText={setCustomSymptom} placeholder="Optional custom symptom" placeholderTextColor={C.textTertiary} />

              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} placeholder="Anything else you want to remember" placeholderTextColor={C.textTertiary} multiline />

              {supportTips.length > 0 ? (
                <View style={styles.supportBox}>
                  {supportTips.map((tip) => (
                    <View key={tip} style={styles.supportRow}>
                      <Ionicons name="leaf-outline" size={16} color={C.green} />
                      <Text style={styles.supportText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Cycle Entry</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.collapsedLogRow}>
              <View style={styles.collapsedLogIcon}>
                <Ionicons name="water-outline" size={22} color={C.tint} />
              </View>
              <View style={styles.collapsedLogText}>
                <Text style={styles.collapsedLogTitle}>Cycle log saved</Text>
                <Text style={styles.smallText}>
                  {entries[0] ? `Last entry ${formatShortDate(entries[0].date)}.` : "Open the logger when you need it."}
                </Text>
              </View>
              <Pressable
                style={styles.openLogButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  setQuickLogOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Log another cycle entry"
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.openLogButtonText}>Log</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timeline}>
            {timelineEntries.length === 0 ? (
              <Text style={styles.emptyText}>No entries yet.</Text>
            ) : (
              timelineEntries.map((entry) => {
                const option = FLOW_OPTIONS.find((item) => item.id === entry.flow);
                return (
                  <View key={entry.id} style={styles.timelineItem}>
                    <View style={[styles.timelineBar, { height: 18 + (option?.strength ?? 1) * 10 }, entry.isCycleStart && styles.timelineStart]} />
                    <Text style={styles.timelineDate}>{formatShortDate(entry.date)}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Insights</Text>
          {prediction ? <Text style={styles.prediction}>{prediction}</Text> : null}
          {insights.map((insight) => (
            <View key={insight} style={styles.insightRow}>
              <Ionicons name="analytics-outline" size={17} color={C.tint} />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
          {commonTags.length > 0 ? (
            <View style={styles.patternRow}>
              {commonTags.map(([tag, count]) => (
                <View key={tag} style={styles.patternPill}>
                  <Text style={styles.patternText}>{tagLabel(tag)} x{count}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Recent Entries</Text>
        </View>

        {entries.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No cycle entries yet.</Text>
          </View>
        ) : (
          entries.slice(0, 12).map((entry) => (
            <View key={entry.id} style={styles.card}>
              <View style={styles.entryHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryDate}>{privacyMode || entry.privacyMode ? "Private entry" : entry.date}</Text>
                  <Text style={styles.entryFlow}>
                    {entry.isCycleStart ? "Day 1 · " : entry.cycleDay ? `Day ${entry.cycleDay} · ` : ""}
                    {entry.flow ? `${entry.flow} flow` : "Logged entry"}
                  </Text>
                </View>
                <Pressable onPress={() => handleDelete(entry.id)} accessibilityRole="button" accessibilityLabel="Delete cycle entry">
                  <Ionicons name="trash-outline" size={20} color={C.red} />
                </Pressable>
              </View>
              {privacyMode || entry.privacyMode ? (
                <Text style={styles.entryText}>Details hidden while privacy mode is on.</Text>
              ) : (
                <>
                  {entry.symptomTags?.length ? <Text style={styles.entryText}>Tags: {entry.symptomTags.map(tagLabel).join(", ")}</Text> : null}
                  {entry.symptoms ? <Text style={styles.entryText}>Custom: {entry.symptoms}</Text> : null}
                  {entry.notes ? <Text style={styles.entryText}>Notes: {entry.notes}</Text> : null}
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
    backText: { fontWeight: "600", fontSize: 15, color: C.text },
    title: { fontWeight: "800", fontSize: 30, color: C.text, marginBottom: 8 },
    subtitle: { fontWeight: "500", fontSize: 14, color: C.textSecondary, marginBottom: 18, lineHeight: 20 },
    card: { backgroundColor: C.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.border, marginBottom: 12, ...raised("md", "#55718F") },
    sectionTitle: { fontWeight: "800", fontSize: 18, color: C.text, marginBottom: 6 },
    smallText: { fontWeight: "500", fontSize: 12, color: C.textTertiary, lineHeight: 17 },
    privacyRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    quickLogHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
    closeLogButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
    collapsedLogRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    collapsedLogIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.tintLight, borderWidth: 1, borderColor: C.tint + "30" },
    collapsedLogText: { flex: 1, minWidth: 0 },
    collapsedLogTitle: { fontWeight: "800", fontSize: 17, color: C.text, marginBottom: 3 },
    openLogButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.tint, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
    openLogButtonText: { fontWeight: "800", fontSize: 13, color: "#fff" },
    detectedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.tintLight, borderRadius: 14, padding: 12, marginBottom: 14 },
    detectedText: { flex: 1, fontWeight: "700", fontSize: 13, color: C.tint },
    label: { fontWeight: "700", fontSize: 12, color: C.textSecondary, marginBottom: 8, marginTop: 2 },
    input: {
      fontWeight: "500",
      fontSize: 16,
      color: C.text,
      backgroundColor: C.surfaceElevated,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 14,
    },
    textArea: { minHeight: 88, textAlignVertical: "top" },
    flowRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 },
    flowChip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
    flowChipActive: { borderColor: C.tint, backgroundColor: C.tintLight },
    flowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.textTertiary },
    flowChipText: { fontWeight: "700", fontSize: 13, color: C.textSecondary },
    flowChipTextActive: { color: C.tint },
    tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
    tagChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
    tagChipActive: { borderColor: C.tint, backgroundColor: C.tintLight },
    tagText: { fontWeight: "700", fontSize: 12, color: C.textSecondary },
    tagTextActive: { color: C.tint },
    supportBox: { gap: 8, borderRadius: 16, padding: 12, backgroundColor: C.green + "14", marginBottom: 14 },
    supportRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    supportText: { flex: 1, fontWeight: "600", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    saveBtn: { backgroundColor: C.tint, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    saveBtnText: { fontWeight: "800", fontSize: 15, color: "#fff" },
    timeline: { minHeight: 92, flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 10 },
    timelineItem: { width: 36, alignItems: "center", justifyContent: "flex-end" },
    timelineBar: { width: 24, borderRadius: 999, backgroundColor: C.tintLight, borderWidth: 1, borderColor: C.tint + "55" },
    timelineStart: { backgroundColor: C.tint, borderColor: C.tint },
    timelineDate: { fontWeight: "700", fontSize: 10, color: C.textTertiary, marginTop: 6 },
    prediction: { fontWeight: "800", fontSize: 14, color: C.tint, backgroundColor: C.tintLight, borderRadius: 14, padding: 12, marginBottom: 10 },
    insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
    insightText: { flex: 1, fontWeight: "600", fontSize: 13, color: C.textSecondary, lineHeight: 19 },
    patternRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    patternPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
    patternText: { fontWeight: "800", fontSize: 12, color: C.textSecondary },
    historyHeader: { marginTop: 8, marginBottom: 8 },
    historyTitle: { fontWeight: "800", fontSize: 20, color: C.text },
    emptyText: { fontWeight: "500", fontSize: 14, color: C.textTertiary },
    entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 },
    entryDate: { fontWeight: "800", fontSize: 16, color: C.text },
    entryFlow: { fontWeight: "700", fontSize: 13, color: C.tint, marginTop: 2, textTransform: "capitalize" },
    entryText: { fontWeight: "500", fontSize: 14, color: C.textSecondary, marginTop: 4, lineHeight: 20 },
  });
}
