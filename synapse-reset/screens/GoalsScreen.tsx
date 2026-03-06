import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Modal, TextInput, Platform, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  goalStorage, medicationStorage, medicationLogStorage,
  type Goal, type Medication, type MedicationLog,
} from "@/lib/storage";
import { getToday, getDaysAgo } from "@/lib/date-utils";

const C = Colors.dark;

function getDoseCount(med: Medication): number {
  if (med.doses != null && med.doses > 0) return med.doses;
  const tag = med.timeTag;
  if (Array.isArray(tag)) return tag.length;
  return 1;
}

function isDayCompleteForMeds(dateStr: string, active: Medication[], logs: MedicationLog[]): boolean {
  for (const med of active) {
    const doseCount = getDoseCount(med);
    const takenForMed = logs.filter((l) => l.date === dateStr && l.medicationId === med.id && l.taken);
    const distinctDoses = new Set(takenForMed.map((l) => l.doseIndex ?? 0)).size;
    if (distinctDoses < doseCount) return false;
  }
  return true;
}

function computeMedsStreak(meds: Medication[], logs: MedicationLog[]): number {
  const active = meds.filter((m) => m.active);
  if (active.length === 0) return 0;
  let streak = 0;
  let d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (isDayCompleteForMeds(dateStr, active, logs)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [goals, setGoals] = useState<Goal[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addType, setAddType] = useState<"meds_streak" | "custom">("meds_streak");
  const [addTargetDays, setAddTargetDays] = useState("7");

  const loadData = useCallback(async () => {
    const [g, meds, logs] = await Promise.all([
      goalStorage.getAll(),
      medicationStorage.getAll(),
      medicationLogStorage.getAll(),
    ]);
    const active = meds.filter((m) => m.active);
    const streak = active.length === 0 ? 0 : (() => {
      let s = 0;
      let d = new Date();
      for (let i = 0; i < 365; i++) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (isDayCompleteForMeds(dateStr, active, logs)) { s++; d.setDate(d.getDate() - 1); } else break;
      }
      return s;
    })();
    for (const goal of g) {
      if (goal.type === "meds_streak" && goal.targetDays && !goal.completedAt && streak >= goal.targetDays) {
        await goalStorage.update(goal.id, { completedAt: new Date().toISOString() });
      }
    }
    const updated = await goalStorage.getAll();
    setGoals(updated);
    setMedications(meds);
    setMedLogs(logs);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const medsStreak = computeMedsStreak(medications, medLogs);

  const handleAdd = async () => {
    const title = addTitle.trim() || (addType === "meds_streak" ? "Take meds on time every day" : "My goal");
    const targetDays = addType === "meds_streak" ? parseInt(addTargetDays, 10) : undefined;
    if (addType === "meds_streak" && (isNaN(targetDays!) || targetDays! < 1)) return;
    await goalStorage.save({
      title,
      type: addType,
      targetDays: targetDays,
      startDate: getToday(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddTitle("");
    setAddTargetDays("7");
    setShowAdd(false);
    loadData();
  };

  const handleMarkComplete = async (goal: Goal) => {
    await goalStorage.update(goal.id, { completedAt: new Date().toISOString() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await goalStorage.delete(id);
    Haptics.selectionAsync();
    loadData();
  };

  const topPad = isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Goals</Text>
          <Text style={styles.subtitle}>Set goals like taking meds for a week without missing a dose.</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setShowAdd(true)}
          accessibilityRole="button"
          accessibilityLabel="Add goal"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {goals.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="flag-outline" size={40} color={C.textTertiary} />
          <Text style={styles.emptyTitle}>No goals yet</Text>
          <Text style={styles.emptyDesc}>Tap + to add a goal</Text>
        </View>
      ) : (
        goals.map((goal) => {
          const isMedsStreak = goal.type === "meds_streak";
          const target = goal.targetDays ?? 0;
          const current = isMedsStreak ? medsStreak : 0;
          const completed = goal.completedAt || (isMedsStreak && target > 0 && current >= target);

          return (
            <View key={goal.id} style={[styles.goalCard, completed && styles.goalCardDone]}>
              <View style={styles.goalMain}>
                <Text style={[styles.goalTitle, completed && styles.goalTitleDone]}>{goal.title}</Text>
                {isMedsStreak && target > 0 && (
                  <Text style={styles.goalProgress}>
                    {completed ? "Done!" : `${current} / ${target} days`}
                  </Text>
                )}
                {goal.type === "custom" && goal.completedAt && (
                  <Text style={styles.goalProgress}>Completed</Text>
                )}
              </View>
              <View style={styles.goalActions}>
                {!goal.completedAt && (goal.type !== "meds_streak" || current < target) && (
                  <Pressable
                    style={styles.doneBtn}
                    onPress={() => handleMarkComplete(goal)}
                    accessibilityRole="button"
                    accessibilityLabel="Mark complete"
                  >
                    <Ionicons name="checkmark-circle-outline" size={22} color={C.green} />
                  </Pressable>
                )}
                <Pressable onPress={() => handleDelete(goal.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove goal">
                  <Ionicons name="trash-outline" size={20} color={C.textTertiary} />
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <Modal visible={showAdd} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={styles.modalBox} onPress={(ev) => ev.stopPropagation()}>
            <Text style={styles.modalTitle}>Add goal</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeChip, addType === "meds_streak" && styles.typeChipActive]}
                onPress={() => { setAddType("meds_streak"); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.typeChipText, addType === "meds_streak" && styles.typeChipTextActive]}>Meds streak</Text>
              </Pressable>
              <Pressable
                style={[styles.typeChip, addType === "custom" && styles.typeChipActive]}
                onPress={() => { setAddType("custom"); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.typeChipText, addType === "custom" && styles.typeChipTextActive]}>Custom</Text>
              </Pressable>
            </View>
            <Text style={styles.modalLabel}>Goal (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={addType === "meds_streak" ? "e.g. Take meds for a week" : "e.g. Walk 3x this week"}
              placeholderTextColor={C.textTertiary}
              value={addTitle}
              onChangeText={setAddTitle}
            />
            {addType === "meds_streak" && (
              <>
                <Text style={styles.modalLabel}>Target (days)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="7"
                  placeholderTextColor={C.textTertiary}
                  value={addTargetDays}
                  onChangeText={setAddTargetDays}
                  keyboardType="number-pad"
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowAdd(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, addType === "meds_streak" && isNaN(parseInt(addTargetDays, 10)) && { opacity: 0.5 }]}
                onPress={handleAdd}
                disabled={addType === "meds_streak" && (isNaN(parseInt(addTargetDays, 10)) || parseInt(addTargetDays, 10) < 1)}
              >
                <Text style={styles.modalSaveText}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.textSecondary, maxWidth: 280 },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontWeight: "600", fontSize: 18, color: C.text, marginTop: 12 },
  emptyDesc: { fontSize: 14, color: C.textTertiary, marginTop: 4 },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  goalCardDone: { backgroundColor: C.green + "12", borderColor: C.green + "35" },
  goalMain: { flex: 1 },
  goalTitle: { fontWeight: "600", fontSize: 16, color: C.text },
  goalTitleDone: { color: C.green },
  goalProgress: { fontSize: 13, color: C.textSecondary, marginTop: 4 },
  goalActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  doneBtn: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalBox: { backgroundColor: C.surface, borderRadius: 20, padding: 24 },
  modalTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 16 },
  modalLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginTop: 12, marginBottom: 6 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: C.surfaceElevated },
  typeChipActive: { backgroundColor: C.tintLight },
  typeChipText: { fontSize: 14, fontWeight: "500", color: C.textSecondary },
  typeChipTextActive: { color: C.tint },
  modalInput: { backgroundColor: C.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.text, marginBottom: 4 },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end", marginTop: 20 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { fontSize: 16, color: C.textSecondary },
  modalSave: { backgroundColor: C.tint, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  modalSaveText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
