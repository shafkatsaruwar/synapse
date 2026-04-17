import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, useWindowDimensions,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { monthlyCheckInStorage, type MonthlyCheckIn } from "@/lib/storage";
import { getToday, formatDate } from "@/lib/date-utils";

export default function MonthlyCheckInScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [latest, setLatest] = useState<MonthlyCheckIn | null>(null);
  const [bp, setBp] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("in");
  const [heartRate, setHeartRate] = useState("");
  const [ecgNotes, setEcgNotes] = useState("");
  const [mentalHealthNotes, setMentalHealthNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const today = getToday();
  const currentMonthKey = today.slice(0, 7);
  const currentMonthDateLabel = useMemo(
    () => new Date(`${currentMonthKey}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [currentMonthKey],
  );

  const loadLatest = useCallback(async () => {
    const all = await monthlyCheckInStorage.getAll();
    const sorted = [...all].sort((a, b) => b.date.localeCompare(a.date));
    const l = sorted[0];
    setLatest(l ?? null);
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  const handleSave = async () => {
    setSaving(true);
    await monthlyCheckInStorage.save({
      date: today,
      bp: bp.trim() || undefined,
      weight: weight.trim() || undefined,
      weightUnit: weight.trim() ? weightUnit : undefined,
      height: height.trim() || undefined,
      heightUnit: height.trim() ? heightUnit : undefined,
      heartRate: heartRate.trim() || undefined,
      ecgNotes: ecgNotes.trim() || undefined,
      mentalHealthNotes: mentalHealthNotes.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBp("");
    setWeight("");
    setHeight("");
    setHeartRate("");
    setEcgNotes("");
    setMentalHealthNotes("");
    loadLatest();
    setSaving(false);
  };

  const latestSummaryItems = useMemo(() => {
    if (!latest) return [];

    const items = [
      latest.bp ? { label: "Blood pressure", value: `${latest.bp} mmHg` } : null,
      latest.weight ? { label: "Weight", value: `${latest.weight} ${latest.weightUnit || ""}`.trim() } : null,
      latest.height ? { label: "Height", value: `${latest.height} ${latest.heightUnit || ""}`.trim() } : null,
      latest.heartRate ? { label: "Heart rate", value: `${latest.heartRate} bpm` } : null,
      latest.ecgNotes ? { label: "ECG", value: latest.ecgNotes } : null,
      latest.mentalHealthNotes ? { label: "Mental health", value: latest.mentalHealthNotes } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    return items;
  }, [latest]);

  const currentMonthCheckInDone = latest?.date.slice(0, 7) === currentMonthKey;

  const topPad = isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad,
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Monthly check-in</Text>
      <Text style={styles.subtitle}>
        {latest
          ? `Last check-in: ${formatDate(latest.date)}`
          : "Record BP, weight, height, heart rate (Apple Watch), ECG (Apple Watch), and mental health once a month."}
      </Text>

      {latest && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Last check-in details</Text>
            <Text style={styles.summaryDate}>{formatDate(latest.date)}</Text>
          </View>
          {latestSummaryItems.length ? (
            <View style={styles.summaryGrid}>
              {latestSummaryItems.map((item) => (
                <View key={item.label} style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={styles.summaryValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.summaryEmpty}>No extra details were recorded in the last check-in.</Text>
          )}
        </View>
      )}

      {currentMonthCheckInDone ? (
        <View style={styles.lockedCard}>
          <View style={styles.lockedIcon}>
            <Ionicons name="checkmark-circle" size={22} color={C.tint} />
          </View>
          <Text style={styles.lockedTitle}>You already checked in for {currentMonthDateLabel}</Text>
          <Text style={styles.lockedText}>
            Monthly check-ins unlock once per month. You’ll be able to log the next one when the new month starts.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Blood pressure (mmHg)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 120/80"
              placeholderTextColor={C.textTertiary}
              value={bp}
              onChangeText={setBp}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Weight</Text>
              <TextInput
                style={styles.input}
                placeholder="Value"
                placeholderTextColor={C.textTertiary}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.unitChunk}>
              <Text style={styles.label}>Unit</Text>
              <View style={styles.unitRow}>
                {["lbs", "kg"].map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.unitChip, weightUnit === u && styles.unitChipActive]}
                    onPress={() => { setWeightUnit(u); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.unitChipText, weightUnit === u && styles.unitChipTextActive]}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Height</Text>
              <TextInput
                style={styles.input}
                placeholder="Value"
                placeholderTextColor={C.textTertiary}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.unitChunk}>
              <Text style={styles.label}>Unit</Text>
              <View style={styles.unitRow}>
                {["in", "cm"].map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.unitChip, heightUnit === u && styles.unitChipActive]}
                    onPress={() => { setHeightUnit(u); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.unitChipText, heightUnit === u && styles.unitChipTextActive]}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Heart rate (bpm) — Apple Watch</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 72"
              placeholderTextColor={C.textTertiary}
              value={heartRate}
              onChangeText={setHeartRate}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>ECG — Apple Watch</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Sinus rhythm, normal"
              placeholderTextColor={C.textTertiary}
              value={ecgNotes}
              onChangeText={setEcgNotes}
              multiline
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mental health</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="How are you feeling overall?"
              placeholderTextColor={C.textTertiary}
              value={mentalHealthNotes}
              onChangeText={setMentalHealthNotes}
              multiline
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save monthly check-in"
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>Save check-in</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 24 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: C.textSecondary, marginBottom: 24 },
  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.surfaceElevated,
    marginBottom: 20,
  },
  summaryHeader: { gap: 4, marginBottom: 14 },
  summaryTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  summaryDate: { fontSize: 13, color: C.textSecondary },
  summaryGrid: { gap: 12 },
  summaryItem: {
    backgroundColor: C.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.surfaceElevated,
  },
  summaryLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, marginBottom: 6, textTransform: "uppercase" },
  summaryValue: { fontSize: 15, color: C.text, lineHeight: 22 },
  summaryEmpty: { fontSize: 14, color: C.textSecondary, lineHeight: 20 },
  lockedCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.surfaceElevated,
    marginBottom: 12,
  },
  lockedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.tintLight,
    marginBottom: 12,
  },
  lockedTitle: { fontSize: 18, fontWeight: "700", color: C.text, marginBottom: 8 },
  lockedText: { fontSize: 14, lineHeight: 22, color: C.textSecondary },
  field: { marginBottom: 16 },
  label: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.text,
    borderWidth: 1,
    borderColor: C.surfaceElevated,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  unitChunk: { width: 100 },
  unitRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceElevated,
  },
  unitChipActive: { backgroundColor: C.tintLight, borderColor: C.tint },
  unitChipText: { fontSize: 14, fontWeight: "500", color: C.textSecondary },
  unitChipTextActive: { color: C.tint },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.tint,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  saveBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
  });
}
