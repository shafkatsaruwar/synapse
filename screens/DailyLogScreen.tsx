import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { healthLogStorage, fastingLogStorage, settingsStorage, type HealthLog, type FastingLog, type UserSettings } from "@/lib/storage";
import { getToday, getRelativeDay } from "@/lib/date-utils";

const C = Colors.dark;

export default function DailyLogScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();

  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [fasting, setFasting] = useState(false);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [pastLogs, setPastLogs] = useState<HealthLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false });

  const [suhoorTime, setSuhoorTime] = useState("");
  const [iftarTime, setIftarTime] = useState("");
  const [hydration, setHydration] = useState(0);
  const [fastEnergy, setFastEnergy] = useState(3);
  const [fastNotes, setFastNotes] = useState("");

  const loadData = useCallback(async () => {
    const [log, all, sett, fl] = await Promise.all([
      healthLogStorage.getByDate(today),
      healthLogStorage.getAll(),
      settingsStorage.get(),
      fastingLogStorage.getByDate(today),
    ]);
    if (log) {
      setEnergy(log.energy);
      setMood(log.mood);
      setSleep(log.sleep);
      setFasting(log.fasting);
      setNotes(log.notes);
      setSaved(true);
    }
    if (fl) {
      setSuhoorTime(fl.suhoorTime);
      setIftarTime(fl.iftarTime);
      setHydration(fl.hydrationGlasses);
      setFastEnergy(fl.energyLevel);
      setFastNotes(fl.notes);
    }
    setPastLogs(all.filter((l) => l.date !== today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7));
    setSettings(sett);
  }, [today]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    await healthLogStorage.save({ date: today, energy, mood, sleep, fasting: settings.ramadanMode ? fasting : false, notes });
    if (settings.ramadanMode && fasting) {
      await fastingLogStorage.save({ date: today, suhoorTime, iftarTime, hydrationGlasses: hydration, energyLevel: fastEnergy, notes: fastNotes });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  };

  const energyLabels = ["Low", "Fair", "Good", "Great", "Excellent"];
  const moodLabels = ["Down", "Low", "Okay", "Good", "Great"];
  const sleepLabels = ["Poor", "Fair", "Okay", "Good", "Restful"];

  const renderSlider = (label: string, value: number, setValue: (v: number) => void, labels: string[], color: string) => (
    <View style={styles.sliderSection}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={[styles.sliderValue, { color }]}>{labels[value - 1]}</Text>
      </View>
      <View style={styles.sliderTrack}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable
            key={i}
            style={[styles.sliderDot, i <= value && { backgroundColor: color }]}
            onPress={() => { setValue(i); setSaved(false); Haptics.selectionAsync(); }}
          />
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Daily Log</Text>
      <Text style={styles.subtitle}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </Text>

      <View style={[styles.cardGrid, isWide && styles.cardGridWide]}>
        <View style={[styles.card, isWide && styles.cardHalf]}>
          {renderSlider("Energy", energy, setEnergy, energyLabels, C.tint)}
          {renderSlider("Mood", mood, setMood, moodLabels, C.purple)}
          {renderSlider("Sleep", sleep, setSleep, sleepLabels, C.cyan)}
        </View>

        {settings.ramadanMode && (
          <View style={[styles.card, isWide && styles.cardHalf]}>
            <View style={styles.ramadanHeader}>
              <Ionicons name="moon" size={16} color={C.yellow} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Ramadan Fasting</Text>
            </View>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleBtn, fasting && { backgroundColor: C.tintLight, borderColor: C.tint }]}
                onPress={() => { setFasting(true); setSaved(false); Haptics.selectionAsync(); }}
              >
                <Ionicons name="checkmark-circle" size={18} color={fasting ? C.tint : C.textTertiary} />
                <Text style={[styles.toggleText, fasting && { color: C.tint }]}>Fasted</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, !fasting && { backgroundColor: C.redLight, borderColor: C.red }]}
                onPress={() => { setFasting(false); setSaved(false); Haptics.selectionAsync(); }}
              >
                <Ionicons name="close-circle" size={18} color={!fasting ? C.red : C.textTertiary} />
                <Text style={[styles.toggleText, !fasting && { color: C.red }]}>Not today</Text>
              </Pressable>
            </View>

            {fasting && (
              <View style={styles.fastingFields}>
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Suhoor Time</Text>
                    <TextInput style={styles.fieldInput} placeholder="e.g. 4:30" placeholderTextColor={C.textTertiary} value={suhoorTime} onChangeText={(t) => { setSuhoorTime(t); setSaved(false); }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Iftar Time</Text>
                    <TextInput style={styles.fieldInput} placeholder="e.g. 6:45" placeholderTextColor={C.textTertiary} value={iftarTime} onChangeText={(t) => { setIftarTime(t); setSaved(false); }} />
                  </View>
                </View>

                <View style={styles.ramadanTips}>
                  <View style={styles.ramTipRow}>
                    <Ionicons name="medical" size={14} color={C.orange} />
                    <Text style={styles.ramTipText}>Take medications at suhoor (before fasting begins) or after iftar</Text>
                  </View>
                  <View style={styles.ramTipRow}>
                    <Ionicons name="water" size={14} color={C.cyan} />
                    <Text style={styles.ramTipText}>Aim for 8+ glasses of water between iftar and suhoor</Text>
                  </View>
                  <View style={styles.ramTipRow}>
                    <Ionicons name="nutrition" size={14} color={C.green} />
                    <Text style={styles.ramTipText}>Include slow-release carbs at suhoor for sustained energy</Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Hydration (glasses between iftar & suhoor)</Text>
                <View style={styles.hydrationRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <Pressable key={i} style={[styles.hydrationDot, i <= hydration && { backgroundColor: C.cyan }]} onPress={() => { setHydration(i); setSaved(false); }} />
                  ))}
                </View>
                {hydration > 0 && hydration < 8 && (
                  <View style={styles.hydrationWarning}>
                    <Ionicons name="alert-circle" size={14} color={C.orange} />
                    <Text style={styles.hydrationWarningText}>Try to drink at least 8 glasses to stay hydrated during fasting</Text>
                  </View>
                )}
                {renderSlider("Energy Level", fastEnergy, (v) => { setFastEnergy(v); setSaved(false); }, energyLabels, C.yellow)}
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="How are you feeling today?"
          placeholderTextColor={C.textTertiary}
          value={notes}
          onChangeText={(t) => { setNotes(t); setSaved(false); }}
          multiline
          textAlignVertical="top"
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.saveBtn, saved && styles.saveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
        onPress={handleSave}
      >
        <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={18} color="#fff" />
        <Text style={styles.saveBtnText}>{saved ? "Saved" : "Save Log"}</Text>
      </Pressable>

      {pastLogs.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>Recent</Text>
          {pastLogs.map((log) => (
            <View key={log.id} style={styles.historyCard}>
              <Text style={styles.historyDate}>{getRelativeDay(log.date)}</Text>
              <View style={styles.historyChips}>
                <View style={[styles.historyChip, { backgroundColor: C.tintLight }]}>
                  <Text style={[styles.historyChipText, { color: C.tint }]}>E:{log.energy}</Text>
                </View>
                <View style={[styles.historyChip, { backgroundColor: C.purpleLight }]}>
                  <Text style={[styles.historyChipText, { color: C.purple }]}>M:{log.mood}</Text>
                </View>
                <View style={[styles.historyChip, { backgroundColor: C.cyanLight }]}>
                  <Text style={[styles.historyChipText, { color: C.cyan }]}>S:{log.sleep}</Text>
                </View>
                {log.fasting && (
                  <View style={[styles.historyChip, { backgroundColor: C.yellowLight }]}>
                    <Text style={[styles.historyChipText, { color: C.yellow }]}>Fasting</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, marginBottom: 24 },
  cardGrid: { gap: 12 },
  cardGridWide: { flexDirection: "row" },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardHalf: { flex: 1 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, marginBottom: 14 },
  ramadanHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sliderSection: { marginBottom: 20 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sliderLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  sliderValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  sliderTrack: { flexDirection: "row", gap: 8, alignItems: "center" },
  sliderDot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.surfaceElevated },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, gap: 6 },
  toggleText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  fastingFields: { marginTop: 4 },
  fieldRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textTertiary, marginBottom: 6 },
  fieldInput: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  ramadanTips: { backgroundColor: C.orangeLight, borderRadius: 10, padding: 12, marginBottom: 14, gap: 8 },
  ramTipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  ramTipText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.text, flex: 1, lineHeight: 16 },
  hydrationRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  hydrationDot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.surfaceElevated },
  hydrationWarning: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  hydrationWarningText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.orange, flex: 1 },
  notesInput: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, minHeight: 80, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border },
  saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  saveBtnSaved: { backgroundColor: C.green },
  saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  historySection: { marginTop: 12 },
  historySectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  historyCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  historyDate: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text },
  historyChips: { flexDirection: "row", gap: 6 },
  historyChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  historyChipText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});
