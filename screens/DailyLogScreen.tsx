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
import { healthLogStorage, type HealthLog } from "@/lib/storage";
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
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [pastLogs, setPastLogs] = useState<HealthLog[]>([]);

  const loadData = useCallback(async () => {
    const [log, all] = await Promise.all([
      healthLogStorage.getByDate(today),
      healthLogStorage.getAll(),
    ]);
    if (log) {
      setEnergy(log.energy);
      setMood(log.mood);
      setSleep(log.sleep);
      setNotes(log.notes);
      setSaved(true);
    }
    setPastLogs(all.filter((l) => l.date !== today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7));
  }, [today]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    await healthLogStorage.save({ date: today, energy, mood, sleep, fasting: false, notes });
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
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24 },
  cardGrid: { gap: 12 },
  cardGridWide: { flexDirection: "row" },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardHalf: { flex: 1 },
  sectionTitle: { fontWeight: "600", fontSize: 14, color: C.text, marginBottom: 14 },
  sliderSection: { marginBottom: 20 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sliderLabel: { fontWeight: "500", fontSize: 13, color: C.textSecondary },
  sliderValue: { fontWeight: "600", fontSize: 13 },
  sliderTrack: { flexDirection: "row", gap: 8, alignItems: "center" },
  sliderDot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.surfaceElevated },
  notesInput: { fontWeight: "400", fontSize: 14, color: C.text, minHeight: 80, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border },
  saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  saveBtnSaved: { backgroundColor: C.green },
  saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
  historySection: { marginTop: 12 },
  historySectionTitle: { fontWeight: "600", fontSize: 14, color: C.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  historyCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  historyDate: { fontWeight: "500", fontSize: 13, color: C.text },
  historyChips: { flexDirection: "row", gap: 6 },
  historyChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  historyChipText: { fontWeight: "600", fontSize: 11 },
});
