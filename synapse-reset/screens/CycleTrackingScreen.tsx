import React, { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import TextInput from "@/components/DoneTextInput";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { cycleTrackingStorage, type CycleEntry, type CycleFlow } from "@/lib/storage";
import { getToday } from "@/lib/date-utils";

interface CycleTrackingScreenProps {
  onBack: () => void;
}

const FLOW_OPTIONS: CycleFlow[] = ["light", "medium", "heavy"];

export default function CycleTrackingScreen({ onBack }: CycleTrackingScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [date, setDate] = useState(getToday());
  const [flow, setFlow] = useState<CycleFlow>("medium");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");

  const loadEntries = useCallback(async () => {
    const all = await cycleTrackingStorage.getAll();
    setEntries(
      [...all].sort((a, b) => b.date.localeCompare(a.date))
    );
  }, []);

  React.useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleSave = async () => {
    await cycleTrackingStorage.save({
      date: date.trim() || getToday(),
      flow,
      symptoms: symptoms.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setDate(getToday());
    setFlow("medium");
    setSymptoms("");
    setNotes("");
    await loadEntries();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete entry?", "This cycle log will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cycleTrackingStorage.delete(id);
          await loadEntries();
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to Settings">
          <Ionicons name="arrow-back" size={22} color={C.text} />
          <Text style={styles.backText}>Settings</Text>
        </Pressable>

        <Text style={styles.title}>Cycle Tracking</Text>
        <Text style={styles.subtitle}>Simple, respectful logging for flow, symptoms, and notes.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.textTertiary}
          />

          <Text style={styles.label}>Flow</Text>
          <View style={styles.flowRow}>
            {FLOW_OPTIONS.map((option) => {
              const active = flow === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.flowChip, active && styles.flowChipActive]}
                  onPress={() => setFlow(option)}
                >
                  <Text style={[styles.flowChipText, active && styles.flowChipTextActive]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Symptoms</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="Cramping, headache, fatigue..."
            placeholderTextColor={C.textTertiary}
            multiline
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything else you want to remember"
            placeholderTextColor={C.textTertiary}
            multiline
          />

          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Cycle Entry</Text>
          </Pressable>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Recent Entries</Text>
        </View>

        {entries.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No cycle entries yet.</Text>
          </View>
        ) : (
          entries.map((entry) => (
            <View key={entry.id} style={styles.card}>
              <View style={styles.entryHeader}>
                <View>
                  <Text style={styles.entryDate}>{entry.date}</Text>
                  <Text style={styles.entryFlow}>{entry.flow ? `${entry.flow} flow` : "Logged entry"}</Text>
                </View>
                <Pressable onPress={() => handleDelete(entry.id)} accessibilityRole="button" accessibilityLabel="Delete cycle entry">
                  <Ionicons name="trash-outline" size={20} color={C.red} />
                </Pressable>
              </View>
              {entry.symptoms ? <Text style={styles.entryText}>Symptoms: {entry.symptoms}</Text> : null}
              {entry.notes ? <Text style={styles.entryText}>Notes: {entry.notes}</Text> : null}
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
    title: { fontWeight: "700", fontSize: 26, color: C.text, letterSpacing: -0.5, marginBottom: 8 },
    subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24 },
    card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 8 },
    input: {
      fontWeight: "400",
      fontSize: 16,
      color: C.text,
      backgroundColor: C.surfaceElevated,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 14,
    },
    textArea: { minHeight: 88, textAlignVertical: "top" },
    flowRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 },
    flowChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
    },
    flowChipActive: { borderColor: C.tint, backgroundColor: C.tintLight },
    flowChipText: { fontWeight: "600", fontSize: 13, color: C.textSecondary },
    flowChipTextActive: { color: C.tint },
    saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
    historyHeader: { marginTop: 8, marginBottom: 8 },
    historyTitle: { fontWeight: "700", fontSize: 18, color: C.text },
    emptyText: { fontWeight: "400", fontSize: 14, color: C.textTertiary },
    entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    entryDate: { fontWeight: "700", fontSize: 16, color: C.text },
    entryFlow: { fontWeight: "500", fontSize: 13, color: C.tint, marginTop: 2, textTransform: "capitalize" },
    entryText: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginTop: 4, lineHeight: 20 },
  });
}
