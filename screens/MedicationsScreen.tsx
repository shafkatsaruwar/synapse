import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { medicationStorage, medicationLogStorage, type Medication, type MedicationLog } from "@/lib/storage";
import { getToday } from "@/lib/date-utils";

const C = Colors.dark;
const TIME_TAGS: Medication["timeTag"][] = ["Morning", "Afternoon", "Night", "Before Fajr", "After Iftar"];
const TAG_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Morning: { bg: C.tintLight, text: C.tint, icon: "sunny-outline" },
  Afternoon: { bg: C.yellowLight, text: C.yellow, icon: "partly-sunny-outline" },
  Night: { bg: C.purpleLight, text: C.purple, icon: "moon-outline" },
  "Before Fajr": { bg: C.accentLight, text: C.accent, icon: "moon-outline" },
  "After Iftar": { bg: C.orangeLight, text: C.orange, icon: "restaurant-outline" },
};

const DEFAULT_MEDICATIONS: Omit<Medication, "id">[] = [
  { name: "Testosterone Cypionate", dosage: "50 mg (0.5 mL) IM injection", frequency: "Once weekly", timeTag: "Morning", active: true },
  { name: "Sograya (Semaglutide)", dosage: "10 mg / 1.5 mL SubQ injection", frequency: "Once weekly", timeTag: "Morning", active: true },
  { name: "Levothyroxine", dosage: "200 mcg tablet", frequency: "Daily, before breakfast", timeTag: "Morning", active: true },
  { name: "Fluticasone/Salmeterol (Advair)", dosage: "250-50 mcg diskus inhaler, 1 puff", frequency: "Twice daily (morning & bedtime)", timeTag: "Morning", active: true },
  { name: "Hydrocortisone", dosage: "5 mg tablet (3 morning + 1 afternoon)", frequency: "Daily", timeTag: "Morning", active: true },
  { name: "Simethicone", dosage: "80 mg chewable tablet", frequency: "As needed for gas, with Levothyroxine", timeTag: "Morning", active: true },
];

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [newTimeTag, setNewTimeTag] = useState<Medication["timeTag"]>("Morning");
  const [nudgeMedId, setNudgeMedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    let meds = await medicationStorage.getAll();
    const defaultNames = DEFAULT_MEDICATIONS.map((d) => d.name);
    const hasAllDefaults = defaultNames.every((n) => meds.some((m) => m.name === n));
    if (meds.length === 0 || !hasAllDefaults) {
      for (const def of DEFAULT_MEDICATIONS) {
        if (!meds.some((m) => m.name === def.name)) {
          await medicationStorage.save(def);
        } else {
          const existing = meds.find((m) => m.name === def.name);
          if (existing && (existing.frequency !== def.frequency || existing.timeTag !== def.timeTag)) {
            const updated = { ...existing, frequency: def.frequency, timeTag: def.timeTag };
            const allMeds = await medicationStorage.getAll();
            const idx = allMeds.findIndex((m) => m.id === existing.id);
            if (idx !== -1) {
              allMeds[idx] = updated;
              const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
              await AsyncStorage.setItem("@fir_medications", JSON.stringify(allMeds));
            }
          }
        }
      }
      meds = await medicationStorage.getAll();
    }
    const logs = await medicationLogStorage.getByDate(today);
    setMedications(meds);
    setMedLogs(logs);
  }, [today]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await medicationStorage.save({ name: newName.trim(), dosage: newDosage.trim(), frequency: newFrequency.trim(), timeTag: newTimeTag, active: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewName(""); setNewDosage(""); setNewFrequency(""); setNewTimeTag("Morning"); setShowModal(false);
    loadData();
  };

  const handleTaken = async (medId: string) => {
    const log = medLogs.find((l) => l.medicationId === medId);
    if (log?.taken) {
      await medicationLogStorage.toggle(medId, today);
      Haptics.selectionAsync();
      loadData();
    } else {
      await medicationLogStorage.toggle(medId, today);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    }
  };

  const handleNotYet = (medId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setNudgeMedId(medId);
  };

  const handleAlrightTookIt = async () => {
    if (nudgeMedId) {
      const log = medLogs.find((l) => l.medicationId === nudgeMedId);
      if (!log?.taken) {
        await medicationLogStorage.toggle(nudgeMedId, today);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNudgeMedId(null);
      loadData();
    }
  };

  const handleDelete = async (med: Medication) => {
    if (Platform.OS === "web") { await medicationStorage.delete(med.id); loadData(); return; }
    Alert.alert("Remove", `Remove ${med.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await medicationStorage.delete(med.id); loadData(); } },
    ]);
  };

  const isTaken = (medId: string) => medLogs.find((l) => l.medicationId === medId)?.taken || false;

  const grouped = TIME_TAGS.map((tag) => ({
    tag, meds: medications.filter((m) => m.timeTag === tag && m.active),
  })).filter((g) => g.meds.length > 0);

  const takenCount = medications.filter((m) => m.active && isTaken(m.id)).length;
  const totalActive = medications.filter((m) => m.active).length;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Medications</Text>
            <Text style={styles.subtitle}>{takenCount}/{totalActive} taken today</Text>
          </View>
          <Pressable testID="add-medication" style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        {totalActive > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${totalActive > 0 ? (takenCount / totalActive) * 100 : 0}%` }]} />
          </View>
        )}

        {grouped.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="medical-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No medications</Text>
            <Text style={styles.emptyDesc}>Tap + to add your medications</Text>
          </View>
        )}

        {grouped.map(({ tag, meds }) => (
          <View key={tag} style={{ marginBottom: 20 }}>
            <View style={[styles.tagBadge, { backgroundColor: TAG_COLORS[tag].bg }]}>
              <Ionicons name={TAG_COLORS[tag].icon as any} size={12} color={TAG_COLORS[tag].text} />
              <Text style={[styles.tagText, { color: TAG_COLORS[tag].text }]}>{tag}</Text>
            </View>
            {meds.map((med) => {
              const taken = isTaken(med.id);
              return (
                <View key={med.id} style={[styles.medCard, taken && styles.medCardTaken]}>
                  <View style={styles.medInfo}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.medName, taken && styles.medNameTaken]}>{med.name}</Text>
                      {!!med.dosage && <Text style={styles.medDose}>{med.dosage}</Text>}
                      {!!med.frequency && <Text style={styles.medFreq}>{med.frequency}</Text>}
                    </View>
                    <Pressable onPress={() => handleDelete(med)} hitSlop={12}>
                      <Ionicons name="trash-outline" size={16} color={C.textTertiary} />
                    </Pressable>
                  </View>

                  {taken ? (
                    <Pressable style={styles.takenBanner} onPress={() => handleTaken(med.id)}>
                      <Ionicons name="checkmark-circle" size={18} color={C.green} />
                      <Text style={styles.takenText}>Taken</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.actionRow}>
                      <Pressable style={styles.yesBtn} onPress={() => handleTaken(med.id)} testID={`taken-${med.name}`}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.yesBtnText}>Yes, took it</Text>
                      </Pressable>
                      <Pressable style={styles.notYetBtn} onPress={() => handleNotYet(med.id)} testID={`notyet-${med.name}`}>
                        <Text style={styles.notYetText}>Not yet</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Medication</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Metformin" placeholderTextColor={C.textTertiary} value={newName} onChangeText={setNewName} />
            <Text style={styles.label}>Dosage</Text>
            <TextInput style={styles.input} placeholder="e.g. 500mg tablet" placeholderTextColor={C.textTertiary} value={newDosage} onChangeText={setNewDosage} />
            <Text style={styles.label}>Frequency</Text>
            <TextInput style={styles.input} placeholder="e.g. Once daily" placeholderTextColor={C.textTertiary} value={newFrequency} onChangeText={setNewFrequency} />
            <Text style={styles.label}>Time of Day</Text>
            <View style={styles.tagPicker}>
              {TIME_TAGS.map((tag) => (
                <Pressable key={tag} style={[styles.tagOpt, newTimeTag === tag && { backgroundColor: TAG_COLORS[tag].bg, borderColor: TAG_COLORS[tag].text }]} onPress={() => { setNewTimeTag(tag); Haptics.selectionAsync(); }}>
                  <Text style={[styles.tagOptText, newTimeTag === tag && { color: TAG_COLORS[tag].text }]}>{tag}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirmBtn, !newName.trim() && { opacity: 0.5 }]} onPress={handleAdd} disabled={!newName.trim()}><Text style={styles.confirmText}>Add</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!nudgeMedId} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.nudgeCard}>
            <Text style={styles.nudgeEmoji}>😤</Text>
            <Text style={styles.nudgeText}>What, you expecting an invite from Amma?</Text>
            <Pressable
              style={styles.nudgeBtn}
              testID="alright-took-it"
              onPress={handleAlrightTookIt}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.nudgeBtnText}>alright, alright, took it</Text>
            </Pressable>
            <Pressable style={styles.nudgeDismiss} onPress={() => setNudgeMedId(null)}>
              <Text style={styles.nudgeDismissText}>I really haven't yet</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: C.surfaceElevated, marginBottom: 24 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: C.green },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: C.text, marginTop: 8 },
  emptyDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
  tagBadge: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  tagText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  medCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  medCardTaken: { borderColor: "rgba(48,209,88,0.25)", backgroundColor: "rgba(48,209,88,0.05)" },
  medInfo: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  medName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, marginBottom: 2 },
  medNameTaken: { color: C.textSecondary },
  medDose: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  medFreq: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.tint, marginTop: 3 },
  actionRow: { flexDirection: "row", gap: 8 },
  yesBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.green },
  yesBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  notYetBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  notYetText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  takenBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(48,209,88,0.1)" },
  takenText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.green },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 380, borderWidth: 1, borderColor: C.border },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginBottom: 20 },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  tagPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  tagOpt: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
  tagOptText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
  cancelText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.tint, alignItems: "center" },
  confirmText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  nudgeCard: { backgroundColor: C.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  nudgeEmoji: { fontSize: 44, marginBottom: 16 },
  nudgeText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  nudgeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: "100%", marginBottom: 10 },
  nudgeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  nudgeDismiss: { paddingVertical: 10 },
  nudgeDismissText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textTertiary },
});
