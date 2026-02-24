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
import { fastingLogStorage, type FastingLog } from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import { getTodayRamadan } from "@/constants/ramadan-timetable";

const C = Colors.dark;

const ENERGY_LABELS = ["Low", "Fair", "Good", "Great", "Excellent"];

export default function RamadanScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();

  const ramadanDay = getTodayRamadan(today);

  const [fasted, setFasted] = useState<boolean | null>(null);
  const [suhoorTime, setSuhoorTime] = useState(ramadanDay?.fajr || "");
  const [iftarTime, setIftarTime] = useState(ramadanDay?.maghrib || "");
  const [hydration, setHydration] = useState(0);
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const fl = await fastingLogStorage.getByDate(today);
    if (fl) {
      setFasted(true);
      setSuhoorTime(fl.suhoorTime || ramadanDay?.fajr || "");
      setIftarTime(fl.iftarTime || ramadanDay?.maghrib || "");
      setHydration(fl.hydrationGlasses);
      setEnergy(fl.energyLevel);
      setNotes(fl.notes || "");
      setSaved(true);
    }
    setLoaded(true);
  }, [today]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    await fastingLogStorage.save({
      date: today,
      suhoorTime,
      iftarTime,
      hydrationGlasses: hydration,
      energyLevel: energy,
      notes,
    });
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const dateObj = new Date(today + "T12:00:00");
  const dateStr = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const ordinalSuffix = (n: number) => {
    if (n >= 11 && n <= 13) return "th";
    switch (n % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

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
      keyboardDismissMode="on-drag"
    >
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="moon" size={24} color="#B8860B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ramadan Fasting</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
          {ramadanDay && (
            <Text style={styles.hijriText}>
              {ramadanDay.hijriDay}{ordinalSuffix(ramadanDay.hijriDay)} Ramadan, 1447 AH
            </Text>
          )}
          {!ramadanDay && (
            <Text style={styles.hijriText}>Outside Ramadan dates</Text>
          )}
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleBtn, fasted === true && styles.toggleBtnActive]}
          onPress={() => { setFasted(true); Haptics.selectionAsync(); }}
        >
          <Ionicons name={fasted === true ? "checkmark-circle" : "ellipse-outline"} size={20} color={fasted === true ? "#fff" : C.textSecondary} />
          <Text style={[styles.toggleText, fasted === true && styles.toggleTextActive]}>Fasted</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, fasted === false && styles.toggleBtnInactive]}
          onPress={() => { setFasted(false); Haptics.selectionAsync(); }}
        >
          <Ionicons name={fasted === false ? "close-circle" : "ellipse-outline"} size={20} color={fasted === false ? C.text : C.textSecondary} />
          <Text style={[styles.toggleText, fasted === false && { color: C.text }]}>Not today</Text>
        </Pressable>
      </View>

      {fasted !== false && (
        <>
          <View style={styles.timesRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>Suhoor Time</Text>
              <TextInput
                style={styles.timeInput}
                value={suhoorTime}
                onChangeText={setSuhoorTime}
                placeholder={ramadanDay?.fajr || "e.g. 4:30"}
                placeholderTextColor={C.textTertiary}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>Iftar Time</Text>
              <TextInput
                style={styles.timeInput}
                value={iftarTime}
                onChangeText={setIftarTime}
                placeholder={ramadanDay?.maghrib || "e.g. 6:45"}
                placeholderTextColor={C.textTertiary}
              />
            </View>
          </View>

          <View style={styles.tipsCard}>
            <View style={styles.tipRow}>
              <Text style={styles.tipEmoji}>💊</Text>
              <Text style={styles.tipText}>Take medications at suhoor (before fasting begins) or after iftar</Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipEmoji}>💧</Text>
              <Text style={styles.tipText}>Aim for 8+ glasses of water between iftar and suhoor</Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipEmoji}>🍏</Text>
              <Text style={styles.tipText}>Include slow-release carbs at suhoor for sustained energy</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Hydration (glasses between iftar & suhoor)</Text>
          <View style={styles.hydrationRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
              <Pressable
                key={g}
                style={[styles.hydrationGlass, g <= hydration && styles.hydrationGlassActive]}
                onPress={() => { setHydration(g); Haptics.selectionAsync(); }}
              >
                <Ionicons name="water" size={18} color={g <= hydration ? "#fff" : C.textTertiary} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Energy Level</Text>
          <View style={styles.energyRow}>
            <View style={styles.energyTrack}>
              {[1, 2, 3, 4, 5].map((e) => (
                <Pressable
                  key={e}
                  style={[styles.energySegment, e <= energy && styles.energySegmentActive]}
                  onPress={() => { setEnergy(e); Haptics.selectionAsync(); }}
                />
              ))}
            </View>
            <Text style={styles.energyLabel}>{ENERGY_LABELS[energy - 1]}</Text>
          </View>

          <Text style={styles.sectionLabel}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="How was your fast today?"
            placeholderTextColor={C.textTertiary}
            multiline
            textAlignVertical="top"
          />
        </>
      )}

      <Pressable
        style={[styles.saveBtn, saved && styles.saveBtnSaved]}
        onPress={handleSave}
      >
        <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={18} color="#fff" />
        <Text style={styles.saveBtnText}>{saved ? "Saved" : "Save Log"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 24 },
  headerIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(184,134,11,0.12)",
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  dateText: { fontWeight: "400", fontSize: 14, color: C.textSecondary },
  hijriText: { fontWeight: "600", fontSize: 14, color: "#B8860B", marginTop: 2 },

  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  toggleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  toggleBtnActive: { backgroundColor: "#800020", borderColor: "#800020" },
  toggleBtnInactive: { backgroundColor: C.surface, borderColor: C.border },
  toggleText: { fontWeight: "600", fontSize: 16, color: C.textSecondary },
  toggleTextActive: { color: "#fff" },

  timesRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  timeField: { flex: 1 },
  label: { fontWeight: "500", fontSize: 14, color: C.textSecondary, marginBottom: 6 },
  timeInput: {
    fontWeight: "500", fontSize: 16, color: C.text,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },

  tipsCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 24, gap: 14,
  },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tipEmoji: { fontSize: 18, marginTop: 1 },
  tipText: { fontWeight: "400", fontSize: 14, color: C.text, flex: 1, lineHeight: 20 },

  sectionLabel: { fontWeight: "600", fontSize: 14, color: C.textSecondary, marginBottom: 10 },

  hydrationRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  hydrationGlass: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  hydrationGlassActive: { backgroundColor: "#2E8B8B", borderColor: "#2E8B8B" },

  energyRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  energyTrack: { flex: 1, flexDirection: "row", gap: 6 },
  energySegment: {
    flex: 1, height: 12, borderRadius: 6, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  energySegmentActive: { backgroundColor: "#B8860B", borderColor: "#B8860B" },
  energyLabel: { fontWeight: "600", fontSize: 14, color: "#B8860B", minWidth: 60, textAlign: "right" },

  notesInput: {
    fontWeight: "400", fontSize: 15, color: C.text,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
    minHeight: 80, marginBottom: 24,
  },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#800020", borderRadius: 14, paddingVertical: 16, marginBottom: 20,
  },
  saveBtnSaved: { backgroundColor: "#2D7D46" },
  saveBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
});
