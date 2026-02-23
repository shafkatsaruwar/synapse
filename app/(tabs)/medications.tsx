import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  medicationStorage,
  medicationLogStorage,
  type Medication,
  type MedicationLog,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";

const C = Colors.dark;

const TIME_TAGS: Medication["timeTag"][] = [
  "Before Fajr",
  "After Iftar",
  "Morning",
  "Night",
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Before Fajr": { bg: C.accentLight, text: C.accent },
  "After Iftar": { bg: C.warningLight, text: C.warning },
  Morning: { bg: C.tintLight, text: C.tint },
  Night: { bg: C.successLight, text: C.success },
};

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const today = getToday();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newTimeTag, setNewTimeTag] = useState<Medication["timeTag"]>("Morning");

  const loadData = useCallback(async () => {
    const [meds, logs] = await Promise.all([
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
    ]);
    setMedications(meds);
    setMedLogs(logs);
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await medicationStorage.save({
      name: newName.trim(),
      dosage: newDosage.trim(),
      timeTag: newTimeTag,
      active: true,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewName("");
    setNewDosage("");
    setNewTimeTag("Morning");
    setShowModal(false);
    loadData();
  };

  const handleToggle = async (medId: string) => {
    await medicationLogStorage.toggle(medId, today);
    Haptics.selectionAsync();
    loadData();
  };

  const handleDelete = async (med: Medication) => {
    if (Platform.OS === "web") {
      await medicationStorage.delete(med.id);
      loadData();
      return;
    }
    Alert.alert("Remove Medication", `Remove ${med.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await medicationStorage.delete(med.id);
          loadData();
        },
      },
    ]);
  };

  const isTaken = (medId: string) => {
    return medLogs.find((l) => l.medicationId === medId)?.taken || false;
  };

  const grouped = TIME_TAGS.map((tag) => ({
    tag,
    meds: medications.filter((m) => m.timeTag === tag && m.active),
  })).filter((g) => g.meds.length > 0);

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
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Medications</Text>
            <Text style={styles.subtitle}>
              {medications.filter((m) => m.active).length} active
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>

        {grouped.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="medkit-outline" size={48} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No medications yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to add your first medication
            </Text>
          </View>
        )}

        {grouped.map(({ tag, meds }) => (
          <View key={tag} style={{ marginBottom: 20 }}>
            <View style={styles.tagHeader}>
              <View
                style={[
                  styles.tagBadge,
                  { backgroundColor: TAG_COLORS[tag].bg },
                ]}
              >
                <Text
                  style={[styles.tagText, { color: TAG_COLORS[tag].text }]}
                >
                  {tag}
                </Text>
              </View>
            </View>
            {meds.map((med) => {
              const taken = isTaken(med.id);
              return (
                <Pressable
                  key={med.id}
                  style={[styles.medCard, taken && styles.medCardTaken]}
                  onPress={() => handleToggle(med.id)}
                  onLongPress={() => handleDelete(med)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      taken && {
                        backgroundColor: C.tint,
                        borderColor: C.tint,
                      },
                    ]}
                  >
                    {taken && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <View style={styles.medInfo}>
                    <Text
                      style={[
                        styles.medName,
                        taken && styles.medNameTaken,
                      ]}
                    >
                      {med.name}
                    </Text>
                    {!!med.dosage && (
                      <Text style={styles.medDosage}>{med.dosage}</Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => handleDelete(med)}
                    hitSlop={12}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={C.textTertiary}
                    />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Medication</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Metformin"
              placeholderTextColor={C.textTertiary}
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>Dosage</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500mg"
              placeholderTextColor={C.textTertiary}
              value={newDosage}
              onChangeText={setNewDosage}
            />

            <Text style={styles.inputLabel}>Time</Text>
            <View style={styles.tagPicker}>
              {TIME_TAGS.map((tag) => (
                <Pressable
                  key={tag}
                  style={[
                    styles.tagOption,
                    newTimeTag === tag && {
                      backgroundColor: TAG_COLORS[tag].bg,
                      borderColor: TAG_COLORS[tag].text,
                    },
                  ]}
                  onPress={() => {
                    setNewTimeTag(tag);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text
                    style={[
                      styles.tagOptionText,
                      newTimeTag === tag && {
                        color: TAG_COLORS[tag].text,
                      },
                    ]}
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  !newName.trim() && { opacity: 0.5 },
                ]}
                onPress={handleAdd}
                disabled={!newName.trim()}
              >
                <Text style={styles.confirmBtnText}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: C.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textTertiary,
    textAlign: "center",
  },
  tagHeader: {
    marginBottom: 10,
  },
  tagBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  medCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
  },
  medCardTaken: {
    borderColor: C.tint + "33",
    backgroundColor: C.tintLight,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
  },
  medNameTaken: {
    textDecorationLine: "line-through",
    color: C.textSecondary,
  },
  medDosage: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: C.text,
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 6,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.text,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  tagPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  tagOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceElevated,
  },
  tagOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.tint,
    alignItems: "center",
  },
  confirmBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
});
