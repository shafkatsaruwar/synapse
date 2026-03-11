import React, { useState, useCallback, useEffect } from "react";
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
import { getToday, formatTime12h } from "@/lib/date-utils";
import { getTodayRamadan } from "@/constants/ramadan-timetable";
import {
  getRamadanDailyLogByDate,
  saveRamadanDailyLogEntry,
  type RamadanDailyLogEntry,
  type WaterUnit,
} from "@/lib/ramadan-daily-log-storage";

const C = Colors.dark;

const energyLabels = ["Low", "Fair", "Good", "Great", "Excellent"];
const moodLabels = ["Down", "Low", "Okay", "Good", "Great"];
const motivationLabels = ["Low", "Fair", "Okay", "Good", "High"];

interface RamadanDailyLogScreenProps {
  onBack: () => void;
}

function renderSlider(
  label: string,
  value: number,
  setValue: (v: number) => void,
  labels: string[],
  color: string,
  styles: Record<string, object>
) {
  return (
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
            onPress={() => {
              setValue(i);
              setSaved(false);
              Haptics.selectionAsync();
            }}
            accessibilityRole="adjustable"
            accessibilityLabel={`${label} level ${i}, ${labels[i - 1]}`}
            accessibilityState={{ selected: i === value }}
            hitSlop={{ top: 18, bottom: 18 }}
          />
        ))}
      </View>
    </View>
  );
}

export default function RamadanDailyLogScreen({ onBack }: RamadanDailyLogScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();
  const ramadanDay = getTodayRamadan(today);

  const fajrTime = ramadanDay ? formatTime12h(ramadanDay.fajr) : "--";
  const iftarTime = ramadanDay ? formatTime12h(ramadanDay.maghrib) : "--";

  const [fasted, setFasted] = useState(true);
  const [waterIntake, setWaterIntake] = useState("");
  const [waterUnit, setWaterUnit] = useState<WaterUnit>("glasses");
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [motivation, setMotivation] = useState(3);
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    const existing = await getRamadanDailyLogByDate(today);
    if (existing) {
      setFasted(existing.fasted);
      setWaterIntake(existing.waterIntake > 0 ? String(existing.waterIntake) : "");
      setWaterUnit(existing.waterUnit);
      setEnergy(existing.energy);
      setMood(existing.mood);
      setMotivation(existing.motivation);
      setSaved(true);
    }
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    const entry: RamadanDailyLogEntry = {
      date: today,
      fasted,
      waterIntake: parseInt(waterIntake, 10) || 0,
      waterUnit,
      energy,
      mood,
      motivation,
    };
    await saveRamadanDailyLogEntry(entry);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  };

  const topPad = isWide ? 40 : Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
        >
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Ramadan Daily Log</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.timeRow}>
          <View style={styles.timeCard}>
            <Text style={styles.timeLabel}>Fajr</Text>
            <Text style={styles.timeValue}>{fajrTime}</Text>
          </View>
          <View style={styles.timeDivider} />
          <View style={styles.timeCard}>
            <Text style={styles.timeLabel}>Iftar</Text>
            <Text style={styles.timeValue}>{iftarTime}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Fasted today?</Text>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleOption, fasted && styles.toggleOptionActive]}
              onPress={() => {
                setFasted(true);
                setSaved(false);
                Haptics.selectionAsync();
              }}
              accessibilityRole="button"
              accessibilityLabel="Yes, I fasted"
              accessibilityState={{ selected: fasted }}
            >
              <Text style={[styles.toggleOptionText, fasted && styles.toggleOptionTextActive]}>Yes</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleOption, !fasted && styles.toggleOptionActive]}
              onPress={() => {
                setFasted(false);
                setSaved(false);
                Haptics.selectionAsync();
              }}
              accessibilityRole="button"
              accessibilityLabel="No, I did not fast"
              accessibilityState={{ selected: !fasted }}
            >
              <Text style={[styles.toggleOptionText, !fasted && styles.toggleOptionTextActive]}>No</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Water intake</Text>
          <Text style={styles.waterNote}>From Fajr to Iftar</Text>
          <View style={styles.waterRow}>
            <TextInput
              style={styles.waterInput}
              placeholder="0"
              placeholderTextColor={C.textTertiary}
              value={waterIntake}
              onChangeText={(t) => {
                setWaterIntake(t);
                setSaved(false);
              }}
              keyboardType="number-pad"
              accessibilityLabel="Water intake amount"
            />
            <View style={styles.unitRow}>
              {(["glasses", "ml", "oz"] as const).map((u) => (
                <Pressable
                  key={u}
                  style={[styles.unitBtn, waterUnit === u && styles.unitBtnActive]}
                  onPress={() => {
                    setWaterUnit(u);
                    setSaved(false);
                    Haptics.selectionAsync();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Unit: ${u}`}
                  accessibilityState={{ selected: waterUnit === u }}
                >
                  <Text style={[styles.unitBtnText, waterUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          {renderSlider("Energy", energy, setEnergy, energyLabels, C.tint, styles)}
          {renderSlider("Mood", mood, setMood, moodLabels, C.purple, styles)}
          {renderSlider("Motivation", motivation, setMotivation, motivationLabels, C.cyan, styles)}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            saved && styles.saveBtnSaved,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Log saved" : "Save Ramadan daily log"}
        >
          <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backBtn: { marginRight: 12, padding: 4 },
  title: {
    fontWeight: "700",
    fontSize: 28,
    color: C.text,
    letterSpacing: -0.5,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  timeCard: { flex: 1, alignItems: "center" },
  timeLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 4 },
  timeValue: { fontWeight: "700", fontSize: 18, color: C.text },
  timeDivider: { width: 1, height: 32, backgroundColor: C.border },
  formCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: { fontWeight: "600", fontSize: 14, color: C.text, marginBottom: 14 },
  toggleRow: { flexDirection: "row", gap: 12 },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleOptionActive: { backgroundColor: C.tintLight, borderColor: C.tint },
  toggleOptionText: { fontWeight: "500", fontSize: 15, color: C.textSecondary },
  toggleOptionTextActive: { color: C.tint, fontWeight: "600" },
  waterNote: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 10 },
  waterRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  waterInput: {
    flex: 1,
    minWidth: 80,
    height: 44,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.text,
  },
  unitRow: { flexDirection: "row", gap: 8 },
  unitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  unitBtnActive: { backgroundColor: C.tintLight, borderColor: C.tint },
  unitBtnText: { fontWeight: "500", fontSize: 13, color: C.textSecondary },
  unitBtnTextActive: { color: C.tint, fontWeight: "600" },
  sliderSection: { marginBottom: 20 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sliderLabel: { fontWeight: "500", fontSize: 13, color: C.textSecondary },
  sliderValue: { fontWeight: "600", fontSize: 13 },
  sliderTrack: { flexDirection: "row", gap: 8, alignItems: "center" },
  sliderDot: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.surfaceElevated,
  },
  saveBtn: {
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  saveBtnSaved: { backgroundColor: C.green },
  saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
});
