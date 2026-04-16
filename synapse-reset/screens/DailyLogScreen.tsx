import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
  Modal,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { healthLogStorage, settingsStorage, healthProfileStorage, type UserSettings, type HealthProfileInfo, type RecordOwner } from "@/lib/storage";
import { formatTimestamp, getToday } from "@/lib/date-utils";
import RAMADAN_2026 from "@/constants/ramadan-timetable";
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

function normalizeLegacyFivePoint(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 5;
  return value <= 5 ? Math.max(0, Math.min(10, value * 2)) : Math.max(0, Math.min(10, value));
}

function getTenPointLabel(value: number): string {
  if (value <= 1) return "Very low";
  if (value <= 3) return "Low";
  if (value <= 5) return "Okay";
  if (value <= 7) return "Good";
  if (value <= 9) return "High";
  return "Excellent";
}

interface DailyLogScreenProps {
  openTodayOnLaunch?: boolean;
}

export default function DailyLogScreen({ openTodayOnLaunch = false }: DailyLogScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const todayStr = getToday();

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<HealthProfileInfo>({ userRole: "self", backupCriticalMedications: [] });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [logEntryOwner, setLogEntryOwner] = useState<RecordOwner>("self");
  const [energy, setEnergy] = useState(5);
  const [mood, setMood] = useState(5);
  const [sleep, setSleep] = useState(5);
  const [overallFeeling, setOverallFeeling] = useState(5);
  const [fatigue, setFatigue] = useState(0);
  const [dizziness, setDizziness] = useState(0);
  const [chestPain, setChestPain] = useState(0);
  const [shortnessOfBreath, setShortnessOfBreath] = useState(0);
  const [notes, setNotes] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    const [allLogs, userSettings, profileInfo] = await Promise.all([
      healthLogStorage.getAll(),
      settingsStorage.get(),
      healthProfileStorage.get(),
    ]);
    setLoggedDates(new Set(allLogs.map((l) => `${l.date}:${l.entryOwner ?? "self"}`)));
    setSettings(userSettings);
    setProfile(profileInfo);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (!openTodayOnLaunch) return;
    setSelectedDate(todayStr);
    setLogEntryOwner("self");
  }, [openTodayOnLaunch, todayStr]);

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
    setLogEntryOwner("self");
  };

  React.useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    const loadSelectedLog = async () => {
      const existing = await healthLogStorage.getByDate(selectedDate, logEntryOwner);
      if (!active) return;
      if (existing) {
        setEnergy(normalizeLegacyFivePoint(existing.energy));
        setMood(normalizeLegacyFivePoint(existing.mood));
        setSleep(normalizeLegacyFivePoint(existing.sleep));
        setOverallFeeling(existing.overallFeeling ?? 5);
        setFatigue(existing.fatigue ?? 0);
        setDizziness(existing.dizziness ?? 0);
        setChestPain(existing.chestPain ?? 0);
        setShortnessOfBreath(existing.shortnessOfBreath ?? 0);
        setNotes(existing.notes);
        setRecordedAt(existing.recordedAt ?? `${existing.date}T12:00:00`);
        setSaved(true);
      } else {
        setEnergy(5);
        setMood(5);
        setSleep(5);
        setOverallFeeling(5);
        setFatigue(0);
        setDizziness(0);
        setChestPain(0);
        setShortnessOfBreath(0);
        setNotes("");
        setRecordedAt(new Date().toISOString());
        setSaved(false);
      }
    };
    loadSelectedLog();
    return () => {
      active = false;
    };
  }, [selectedDate, logEntryOwner]);

  const handleSave = async () => {
    if (!selectedDate) return;
    const nextRecordedAt = new Date().toISOString();
    await healthLogStorage.save({
      date: selectedDate,
      recordedAt: nextRecordedAt,
      energy,
      mood,
      sleep,
      overallFeeling,
      fatigue,
      dizziness,
      chestPain,
      shortnessOfBreath,
      fasting: false,
      notes,
      entryOwner: logEntryOwner,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRecordedAt(nextRecordedAt);
    setSaved(true);
    setLoggedDates((prev) => new Set([...prev, `${selectedDate}:${logEntryOwner}`]));
  };

  const closeModal = () => {
    setSelectedDate(null);
  };

  const ramadanMode = settings?.ramadanMode ?? false;
  const isCaregiver = profile.userRole === "caregiver" && !!profile.caredForName?.trim();
  const ownerOptions: { value: RecordOwner; label: string }[] = [
    { value: "self", label: "You" },
    ...(isCaregiver ? [{ value: "care_recipient" as const, label: profile.caredForName!.trim() }] : []),
  ];

  const renderSlider = (
    label: string,
    value: number,
    setValue: (v: number) => void,
    color: string,
  ) => (
    <View style={styles.sliderSection}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={[styles.sliderValue, { color }]}>{value}/10 · {getTenPointLabel(value)}</Text>
      </View>
      <View style={styles.recoveryScaleTrack}>
        {Array.from({ length: 11 }, (_, index) => index).map((i) => (
          <Pressable
            key={i}
            style={[styles.recoveryScaleDot, i <= value && { backgroundColor: color }]}
            onPress={() => {
              setValue(i);
              setSaved(false);
              Haptics.selectionAsync();
            }}
            accessibilityRole="adjustable"
            accessibilityLabel={`${label} ${i} out of 10`}
            accessibilityState={{ selected: i === value }}
            hitSlop={{ top: 18, bottom: 18 }}
          />
        ))}
      </View>
    </View>
  );

  const renderRecoveryScale = (
    label: string,
    value: number,
    setValue: (v: number) => void,
    color: string,
    hint?: string,
  ) => (
    <View style={styles.sliderSection}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={[styles.sliderValue, { color }]}>{value}/10</Text>
      </View>
      {hint ? <Text style={styles.scaleHint}>{hint}</Text> : null}
      <View style={styles.recoveryScaleTrack}>
        {Array.from({ length: 11 }, (_, index) => index).map((index) => (
          <Pressable
            key={index}
            style={[styles.recoveryScaleDot, index <= value && { backgroundColor: color }]}
            onPress={() => {
              setValue(index);
              setSaved(false);
              Haptics.selectionAsync();
            }}
            accessibilityRole="adjustable"
            accessibilityLabel={`${label} ${index} out of 10`}
            accessibilityState={{ selected: index === value }}
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
        <Text style={styles.title} accessibilityRole="header">Daily Check-in</Text>

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
              const hasLog = loggedDates.has(`${dateStr}:self`) || loggedDates.has(`${dateStr}:care_recipient`);
              const hijriDay = ramadanMode ? getHijriDay(dateStr) : undefined;
              const isFuture = dateStr > todayStr;
              const isPast = dateStr < todayStr;
              const isDisabled = isPast;

              return (
                <Pressable
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    { width: cellSize, height: cellSize },
                    isToday && styles.todayCell,
                    isDisabled && styles.disabledCell,
                  ]}
                  onPress={isDisabled ? undefined : () => openDayLog(day)}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={`${new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}${hasLog ? ", logged" : ""}${isToday ? ", today" : ""}${isFuture ? ", future date" : ""}`}
                >
                  <Text style={[styles.dayNumber, isToday && styles.todayText, isDisabled && styles.disabledText]}>{day}</Text>
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

            {selectedDate && selectedDate > todayStr ? (
              <View style={styles.futureMessage}>
                <Text style={styles.futureEmoji}>🌱</Text>
                <Text style={styles.futureTitle}>Come back tomorrow to log your day</Text>
                <Text style={styles.futureSubtitle}>You can&apos;t live it before it happens.</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.modalScroll}
              >
                <View style={styles.formCard}>
                  <Text style={styles.sectionTitle}>Recovery check-in</Text>
                  <Text style={styles.timestampLabel}>
                    {recordedAt ? `Latest save: ${formatTimestamp(recordedAt)}` : "Not saved yet"}
                  </Text>
                  {isCaregiver && (
                    <>
                      <Text style={styles.sectionTitle}>Who is this log for?</Text>
                      <View style={styles.ownerRow}>
                        {ownerOptions.map((option) => (
                          <Pressable
                            key={option.value}
                            style={[styles.ownerChip, logEntryOwner === option.value && styles.ownerChipActive]}
                            onPress={() => {
                              setLogEntryOwner(option.value);
                              Haptics.selectionAsync();
                            }}
                          >
                            <Text style={[styles.ownerChipText, logEntryOwner === option.value && styles.ownerChipTextActive]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                  {renderRecoveryScale("Overall feeling", overallFeeling, setOverallFeeling, C.tint, "0 = worst, 10 = best")}
                  {renderRecoveryScale("Fatigue", fatigue, setFatigue, C.orange)}
                  {renderRecoveryScale("Dizziness", dizziness, setDizziness, C.cyan)}
                  {renderRecoveryScale("Chest pain", chestPain, setChestPain, C.red)}
                  {renderRecoveryScale("Shortness of breath / wheezing", shortnessOfBreath, setShortnessOfBreath, C.purple)}
                  {renderSlider("Energy", energy, setEnergy, C.tint)}
                  {renderSlider("Mood", mood, setMood, C.purple)}
                  {renderSlider("Sleep", sleep, setSleep, C.cyan)}
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="How was recovery today? Any meds, symptoms, triggers, or weird patterns?"
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
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
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
  disabledCell: {
    opacity: 0.4,
  },
  disabledText: {
    color: C.textTertiary,
  },
  futureMessage: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  futureEmoji: {
    fontSize: 36,
    marginBottom: 16,
  },
  futureTitle: {
    fontWeight: "600",
    fontSize: 18,
    color: C.text,
    textAlign: "center",
    marginBottom: 8,
  },
  futureSubtitle: {
    fontWeight: "400",
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 20,
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
  ownerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  ownerChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  ownerChipActive: {
    backgroundColor: C.tintLight,
    borderColor: C.tint,
  },
  ownerChipText: {
    fontWeight: "600",
    fontSize: 13,
    color: C.textSecondary,
  },
  ownerChipTextActive: {
    color: C.tint,
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
  scaleHint: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: -4, marginBottom: 8 },
  timestampLabel: { fontWeight: "500", fontSize: 12, color: C.textTertiary, marginBottom: 14 },
  recoveryScaleTrack: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  recoveryScaleDot: {
    flexGrow: 1,
    minWidth: 20,
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
}
