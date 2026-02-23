import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { healthLogStorage, type HealthLog } from "@/lib/storage";
import { getToday, formatDate, getRelativeDay } from "@/lib/date-utils";

const C = Colors.dark;

const SYMPTOM_OPTIONS = [
  "Headache",
  "Fatigue",
  "Nausea",
  "Dizziness",
  "Joint Pain",
  "Bloating",
  "Insomnia",
  "Anxiety",
  "Back Pain",
  "Muscle Ache",
];

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const today = getToday();

  const [energy, setEnergy] = useState(3);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [fasting, setFasting] = useState(false);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [pastLogs, setPastLogs] = useState<HealthLog[]>([]);

  const loadData = useCallback(async () => {
    const log = await healthLogStorage.getByDate(today);
    if (log) {
      setEnergy(log.energy);
      setSymptoms(log.symptoms);
      setFasting(log.fasting);
      setNotes(log.notes);
      setSaved(true);
    }
    const all = await healthLogStorage.getAll();
    setPastLogs(
      all
        .filter((l) => l.date !== today)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7),
    );
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const toggleSymptom = (s: string) => {
    Haptics.selectionAsync();
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
    setSaved(false);
  };

  const handleSave = async () => {
    await healthLogStorage.save({
      date: today,
      energy,
      symptoms,
      fasting,
      notes,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  };

  const energyLabels = ["Low", "Fair", "Good", "Great", "Excellent"];
  const energyColors = [C.danger, C.warning, C.tint, C.success, C.accent];

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
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Daily Log</Text>
        <Text style={styles.subtitle}>{formatDate(today)}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Energy Level</Text>
          <View style={styles.energyRow}>
            {[1, 2, 3, 4, 5].map((level) => (
              <Pressable
                key={level}
                style={[
                  styles.energyBtn,
                  energy === level && {
                    backgroundColor: energyColors[level - 1] + "22",
                    borderColor: energyColors[level - 1],
                  },
                ]}
                onPress={() => {
                  setEnergy(level);
                  setSaved(false);
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.energyNum,
                    energy === level && { color: energyColors[level - 1] },
                  ]}
                >
                  {level}
                </Text>
                <Text
                  style={[
                    styles.energyLabel,
                    energy === level && { color: energyColors[level - 1] },
                  ]}
                >
                  {energyLabels[level - 1]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <View style={styles.chipContainer}>
            {SYMPTOM_OPTIONS.map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.chip,
                  symptoms.includes(s) && styles.chipActive,
                ]}
                onPress={() => toggleSymptom(s)}
              >
                <Text
                  style={[
                    styles.chipText,
                    symptoms.includes(s) && styles.chipTextActive,
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fasting</Text>
          <View style={styles.fastingRow}>
            <Pressable
              style={[
                styles.fastingBtn,
                fasting && {
                  backgroundColor: C.tintLight,
                  borderColor: C.tint,
                },
              ]}
              onPress={() => {
                setFasting(true);
                setSaved(false);
                Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={fasting ? C.tint : C.textTertiary}
              />
              <Text
                style={[
                  styles.fastingText,
                  fasting && { color: C.tint },
                ]}
              >
                Yes
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.fastingBtn,
                !fasting && {
                  backgroundColor: C.dangerLight,
                  borderColor: C.danger,
                },
              ]}
              onPress={() => {
                setFasting(false);
                setSaved(false);
                Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={!fasting ? C.danger : C.textTertiary}
              />
              <Text
                style={[
                  styles.fastingText,
                  !fasting && { color: C.danger },
                ]}
              >
                No
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="How are you feeling today?"
            placeholderTextColor={C.textTertiary}
            value={notes}
            onChangeText={(t) => {
              setNotes(t);
              setSaved(false);
            }}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            saved && styles.saveBtnSaved,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSave}
        >
          <Ionicons
            name={saved ? "checkmark-circle" : "save-outline"}
            size={20}
            color="#fff"
          />
          <Text style={styles.saveBtnText}>
            {saved ? "Saved" : "Save Log"}
          </Text>
        </Pressable>

        {pastLogs.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            {pastLogs.map((log) => (
              <View key={log.id} style={styles.pastLogCard}>
                <View style={styles.pastLogHeader}>
                  <Text style={styles.pastLogDate}>
                    {getRelativeDay(log.date)}
                  </Text>
                  <View
                    style={[
                      styles.energyBadge,
                      { backgroundColor: energyColors[log.energy - 1] + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.energyBadgeText,
                        { color: energyColors[log.energy - 1] },
                      ]}
                    >
                      {energyLabels[log.energy - 1]}
                    </Text>
                  </View>
                </View>
                {log.symptoms.length > 0 && (
                  <Text style={styles.pastLogSymptoms}>
                    {log.symptoms.join(", ")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.textSecondary,
    marginBottom: 24,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
    marginBottom: 14,
  },
  energyRow: {
    flexDirection: "row",
    gap: 8,
  },
  energyBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceElevated,
  },
  energyNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.textSecondary,
    marginBottom: 2,
  },
  energyLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: C.textTertiary,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.tintLight,
    borderColor: C.tint,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  chipTextActive: {
    color: C.tint,
  },
  fastingRow: {
    flexDirection: "row",
    gap: 12,
  },
  fastingBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceElevated,
    gap: 8,
  },
  fastingText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.textSecondary,
  },
  notesInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
    minHeight: 80,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  saveBtn: {
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnSaved: {
    backgroundColor: C.success,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  pastLogCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  pastLogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pastLogDate: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.text,
  },
  energyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  energyBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  pastLogSymptoms: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 6,
  },
});
