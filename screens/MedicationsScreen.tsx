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
const TIME_TAGS: Medication["timeTag"][] = ["Before Fajr", "After Iftar", "Morning", "Afternoon", "Night"];
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Before Fajr": { bg: C.accentLight, text: C.accent },
  "After Iftar": { bg: C.orangeLight, text: C.orange },
  Morning: { bg: C.tintLight, text: C.tint },
  Afternoon: { bg: C.yellowLight, text: C.yellow },
  Night: { bg: C.purpleLight, text: C.purple },
};

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
  const [newTimeTag, setNewTimeTag] = useState<Medication["timeTag"]>("Morning");

  const loadData = useCallback(async () => {
    const [meds, logs] = await Promise.all([medicationStorage.getAll(), medicationLogStorage.getByDate(today)]);
    setMedications(meds);
    setMedLogs(logs);
  }, [today]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await medicationStorage.save({ name: newName.trim(), dosage: newDosage.trim(), timeTag: newTimeTag, active: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewName(""); setNewDosage(""); setNewTimeTag("Morning"); setShowModal(false);
    loadData();
  };

  const handleToggle = async (medId: string) => {
    await medicationLogStorage.toggle(medId, today);
    Haptics.selectionAsync();
    loadData();
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
            <Text style={styles.subtitle}>{medications.filter((m) => m.active).length} active</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

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
              <Text style={[styles.tagText, { color: TAG_COLORS[tag].text }]}>{tag}</Text>
            </View>
            {meds.map((med) => {
              const taken = isTaken(med.id);
              return (
                <Pressable key={med.id} style={[styles.medCard, taken && styles.medCardTaken]} onPress={() => handleToggle(med.id)}>
                  <View style={[styles.check, taken && { backgroundColor: C.tint, borderColor: C.tint }]}>
                    {taken && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.medName, taken && { textDecorationLine: "line-through", color: C.textSecondary }]}>{med.name}</Text>
                    {!!med.dosage && <Text style={styles.medDose}>{med.dosage}</Text>}
                  </View>
                  <Pressable onPress={() => handleDelete(med)} hitSlop={12}>
                    <Ionicons name="trash-outline" size={16} color={C.textTertiary} />
                  </Pressable>
                </Pressable>
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
            <TextInput style={styles.input} placeholder="e.g. 500mg" placeholderTextColor={C.textTertiary} value={newDosage} onChangeText={setNewDosage} />
            <Text style={styles.label}>Time</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: C.text, marginTop: 8 },
  emptyDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
  tagBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  tagText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  medCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, gap: 12 },
  medCardTaken: { borderColor: "rgba(10,132,255,0.2)", backgroundColor: C.tintLight },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  medName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  medDose: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 1 },
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
});
