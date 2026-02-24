import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  useWindowDimensions,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { healthLogStorage, settingsStorage, type HealthLog, type UserSettings } from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import RAMADAN_2026 from "@/constants/ramadan-timetable";

const C = Colors.dark;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatYYYYMMDD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function getHijriDay(dateStr: string): number | undefined {
  const entry = RAMADAN_2026.find((d) => d.date === dateStr);
  return entry?.hijriDay;
}

export default function DailyLogScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const todayStr = getToday();

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    const [allLogs, userSettings] = await Promise.all([
      healthLogStorage.getAll(),
      settingsStorage.get(),
    ]);
    setLoggedDates(new Set(allLogs.map((l) => l.date)));
    setSettings(userSettings);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const daysInMonth = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const firstDayOfWeek = useMemo(() => getFirstDayOfWeek(viewYear, viewMonth), [viewYear, viewMonth]);

  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [daysInMonth, firstDayOfWeek]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
    Haptics.selectionAsync();
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
    Haptics.selectionAsync();
  };

  const openDayLog = async (day: number) => {
    const dateStr = formatYYYYMMDD(viewYear, viewMonth, day);
    setSelectedDate(dateStr);
    Haptics.selectionAsync();

    const existing = await healthLogStorage.getByDate(dateStr);
    if (existing) {
      setEnergy(existing.energy);
      setMood(existing.mood);
      setSleep(existing.sleep);
      setNotes(existing.notes);
      setSaved(true);
    } else {
      setEnergy(3);
      setMood(3);
      setSleep(3);
      setNotes("");
      setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    await healthLogStorage.save({ date: selectedDate, energy, mood, sleep, fasting: false, notes });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setLoggedDates((prev) => new Set([...prev, selectedDate]));
  };

  const closeModal = () => {
    setSelectedDate(null);
  };

  const ramadanMode = settings?.ramadanMode ?? false;

  const energyLabels = ["Low", "Fair", "Good", "Great", "Excellent"];
  const moodLabels = ["Down", "Low", "Okay", "Good", "Great"];
  const sleepLabels = ["Poor", "Fair", "Okay", "Good", "Restful"];

  const renderSlider = (
    label: string,
    value: number,
    setValue: (v: number) => void,
    labels: string[],
    color: string,
  ) => (
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

  const cellSize = Math.min((width - 48 - 12) / 7, 52);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: isWide ? 40 : Platform.OS === "web" ? 67 : insets.top + 16,
            paddingBottom: isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} accessibilityRole="header">Daily Log</Text>

        <View style={styles.monthNav}>
          <Pressable onPress={goToPrevMonth} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={22} color={C.tint} />
          </Pressable>
          <Text style={styles.monthLabel} accessibilityRole="header">{getMonthLabel(viewYear, viewMonth)}</Text>
          <Pressable onPress={goToNextMonth} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={22} color={C.tint} />
          </Pressable>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d) => (
              <View key={d} style={[styles.weekdayCell, { width: cellSize }]}>
                <Text style={styles.weekdayText}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={[styles.dayCell, { width: cellSize, height: cellSize }]} />;
              }
              const dateStr = formatYYYYMMDD(viewYear, viewMonth, day);
              const isToday = dateStr === todayStr;
              const hasLog = loggedDates.has(dateStr);
              const hijriDay = ramadanMode ? getHijriDay(dateStr) : undefined;

              return (
                <Pressable
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    { width: cellSize, height: cellSize },
                    isToday && styles.todayCell,
                  ]}
                  onPress={() => openDayLog(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}${hasLog ? ", logged" : ""}${isToday ? ", today" : ""}`}
                >
                  <Text style={[styles.dayNumber, isToday && styles.todayText]}>{day}</Text>
                  {hijriDay !== undefined && (
                    <Text style={styles.hijriText}>{hijriDay}</Text>
                  )}
                  {hasLog && (
                    <Ionicons name="checkmark-circle" size={12} color={C.tint} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <Ionicons name="checkmark-circle" size={12} color={C.tint} />
            <Text style={styles.legendText}>Logged</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.todayIndicator]} />
            <Text style={styles.legendText}>Today</Text>
          </View>
          {ramadanMode && (
            <View style={styles.legendItem}>
              <Text style={[styles.legendText, { color: C.cyan, fontWeight: "600" as const }]}>3</Text>
              <Text style={styles.legendText}>Hijri Day</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={selectedDate !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate
                  ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                  : ""}
              </Text>
              <Pressable onPress={closeModal} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close log" hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.modalScroll}
            >
              <View style={styles.formCard}>
                {renderSlider("Energy", energy, setEnergy, energyLabels, C.tint)}
                {renderSlider("Mood", mood, setMood, moodLabels, C.purple)}
                {renderSlider("Sleep", sleep, setSleep, sleepLabels, C.cyan)}
              </View>

              <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="How are you feeling?"
                  placeholderTextColor={C.textTertiary}
                  value={notes}
                  onChangeText={(t) => {
                    setNotes(t);
                    setSaved(false);
                  }}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Notes"
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  saved && styles.saveBtnSaved,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel={saved ? "Log saved" : "Save log"}
              >
                <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{saved ? "Saved" : "Save Log"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  title: {
    fontWeight: "700",
    fontSize: 28,
    color: C.text,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  monthLabel: {
    fontWeight: "600",
    fontSize: 17,
    color: C.text,
  },
  calendarCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 4,
  },
  weekdayCell: {
    alignItems: "center",
    paddingVertical: 6,
  },
  weekdayText: {
    fontWeight: "600",
    fontSize: 11,
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  dayCell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginVertical: 2,
  },
  todayCell: {
    backgroundColor: C.tintLight,
    borderWidth: 1.5,
    borderColor: C.tint,
  },
  dayNumber: {
    fontWeight: "500",
    fontSize: 14,
    color: C.text,
  },
  todayText: {
    fontWeight: "700",
    color: C.tint,
  },
  hijriText: {
    fontWeight: "500",
    fontSize: 9,
    color: C.cyan,
    marginTop: -1,
  },
  logDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.tint,
    marginTop: 1,
  },
  legendRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  todayIndicator: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.tint,
    backgroundColor: C.tintLight,
  },
  legendText: {
    fontWeight: "400",
    fontSize: 12,
    color: C.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: C.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 18,
    color: C.text,
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flexGrow: 0,
  },
  formCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    fontWeight: "600",
    fontSize: 14,
    color: C.text,
    marginBottom: 14,
  },
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
  notesInput: {
    fontWeight: "400",
    fontSize: 14,
    color: C.text,
    minHeight: 80,
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
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
