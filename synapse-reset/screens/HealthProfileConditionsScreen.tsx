import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { conditionStorage, type HealthCondition } from "@/lib/storage";
import conditionsDatabase from "@/constants/conditions.json";

const C = Colors.dark;

interface Props {
  onBack?: () => void;
}

export default function HealthProfileConditionsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState<HealthCondition | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStressDose, setEditStressDose] = useState(false);
  const [showStressDosePrompt, setShowStressDosePrompt] = useState(false);
  const [pendingCondition, setPendingCondition] = useState<{ name: string; source: "database" | "custom" } | null>(null);

  const loadData = useCallback(async () => {
    const data = await conditionStorage.getAll();
    setConditions(data);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const existingNames = useMemo(() => new Set(conditions.map(c => c.name.toLowerCase())), [conditions]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return conditionsDatabase
      .filter(c => c.name.toLowerCase().includes(q) && !existingNames.has(c.name.toLowerCase()))
      .slice(0, 15);
  }, [searchQuery, existingNames]);

  const hasExactMatch = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.trim().toLowerCase();
    return conditionsDatabase.some(c => c.name.toLowerCase() === q) || existingNames.has(q);
  }, [searchQuery, existingNames]);

  const selectCondition = (name: string, source: "database" | "custom") => {
    setPendingCondition({ name, source });
    setShowAddModal(false);
    setSearchQuery("");
    setShowStressDosePrompt(true);
  };

  const confirmStressDose = async (requiresStressDose: boolean) => {
    if (!pendingCondition) return;
    await conditionStorage.save({
      name: pendingCondition.name,
      source: pendingCondition.source,
      dateAdded: new Date().toISOString(),
      requiresStressDose,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPendingCondition(null);
    setShowStressDosePrompt(false);
    loadData();
  };

  const openEdit = (cond: HealthCondition) => {
    setEditingCondition(cond);
    setEditNotes(cond.notes || "");
    setEditStressDose(cond.requiresStressDose || false);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingCondition) return;
    await conditionStorage.update(editingCondition.id, {
      notes: editNotes.trim() || undefined,
      requiresStressDose: editStressDose,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditModal(false);
    setEditingCondition(null);
    loadData();
  };

  const deleteCondition = async (cond: HealthCondition) => {
    if (Platform.OS === "web") {
      await conditionStorage.delete(cond.id);
      loadData();
      return;
    }
    Alert.alert("Remove Condition", `Remove "${cond.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await conditionStorage.delete(cond.id); loadData(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.backBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
        >
          <Ionicons name="chevron-back" size={20} color={C.tint} />
          <Text style={styles.backText}>Settings</Text>
        </Pressable>

        <Text style={styles.title}>Conditions</Text>
        <Text style={styles.subtitle}>Conditions you manage</Text>

        {conditions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No conditions added</Text>
            <Text style={styles.emptyDesc}>Add your health conditions to keep them organized</Text>
            <Pressable
              style={styles.emptyAddBtn}
              onPress={() => setShowAddModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Add Condition"
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyAddText}>Add Condition</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {conditions.map((cond) => (
              <View key={cond.id} style={styles.conditionCard}>
                <Pressable
                  style={styles.conditionMain}
                  onPress={() => openEdit(cond)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${cond.name}`}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.conditionNameRow}>
                      <Text style={styles.conditionName}>{cond.name}</Text>
                      {cond.requiresStressDose && (
                        <View style={styles.stressBadge}>
                          <Ionicons name="flash" size={10} color={C.orange} />
                          <Text style={styles.stressBadgeText}>Stress Dose</Text>
                        </View>
                      )}
                    </View>
                    {cond.notes ? (
                      <View style={styles.notesIndicator}>
                        <Ionicons name="document-text-outline" size={12} color={C.textTertiary} />
                        <Text style={styles.notesPreview} numberOfLines={1}>{cond.notes}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
                </Pressable>
              </View>
            ))}

            <Pressable
              style={styles.addConditionBtn}
              onPress={() => setShowAddModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Add Condition"
            >
              <Ionicons name="add-circle-outline" size={20} color={C.tint} />
              <Text style={styles.addConditionText}>Add Condition</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => { setShowAddModal(false); setSearchQuery(""); }}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Condition</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={C.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search conditions"
                placeholderTextColor={C.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={C.textTertiary} />
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {searchQuery.trim().length > 0 && searchResults.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.resultItem}
                  onPress={() => selectCondition(item.name, "database")}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.name}`}
                >
                  <Ionicons name="medical-outline" size={16} color={C.tint} />
                  <Text style={styles.resultText}>{item.name}</Text>
                  <Ionicons name="add" size={18} color={C.tint} />
                </Pressable>
              ))}

              {searchQuery.trim().length > 0 && !hasExactMatch && !existingNames.has(searchQuery.trim().toLowerCase()) && (
                <Pressable
                  style={styles.customItem}
                  onPress={() => selectCondition(searchQuery.trim(), "custom")}
                  accessibilityRole="button"
                  accessibilityLabel={`Add custom condition: ${searchQuery.trim()}`}
                >
                  <Ionicons name="add-circle" size={18} color={C.accent} />
                  <Text style={styles.customItemText}>Add "{searchQuery.trim()}" as custom condition</Text>
                </Pressable>
              )}

              {searchQuery.trim().length === 0 && (
                <Text style={styles.searchHint}>Type to search from our conditions database</Text>
              )}

              {searchQuery.trim().length > 0 && searchResults.length === 0 && hasExactMatch && (
                <Text style={styles.searchHint}>Already added or no more results</Text>
              )}
            </ScrollView>

            <Pressable style={styles.cancelBtn} onPress={() => { setShowAddModal(false); setSearchQuery(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showStressDosePrompt} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.stressPromptCard}>
            <Ionicons name="flash-outline" size={28} color={C.orange} style={{ marginBottom: 12 }} />
            <Text style={styles.stressPromptTitle}>Stress Dosing</Text>
            <Text style={styles.stressPromptText}>
              Does {pendingCondition?.name} require stress dosing when you are sick?
            </Text>
            <View style={styles.stressPromptActions}>
              <Pressable
                style={styles.stressPromptNo}
                onPress={() => confirmStressDose(false)}
                accessibilityRole="button"
                accessibilityLabel="No stress dosing required"
              >
                <Text style={styles.stressPromptNoText}>No</Text>
              </Pressable>
              <Pressable
                style={styles.stressPromptYes}
                onPress={() => confirmStressDose(true)}
                accessibilityRole="button"
                accessibilityLabel="Yes, requires stress dosing"
              >
                <Ionicons name="flash" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.stressPromptYesText}>Yes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowEditModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>{editingCondition?.name}</Text>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder="Add any notes about this condition..."
              placeholderTextColor={C.textTertiary}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              accessibilityLabel="Condition notes"
            />

            <Pressable
              style={styles.stressToggleRow}
              onPress={() => { setEditStressDose(!editStressDose); Haptics.selectionAsync(); }}
              accessibilityRole="switch"
              accessibilityState={{ checked: editStressDose }}
              accessibilityLabel="Requires stress dosing when sick"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.stressToggleLabel}>Requires stress dosing</Text>
                <Text style={styles.stressToggleDesc}>When you are sick</Text>
              </View>
              <View style={[styles.toggle, editStressDose && styles.toggleActive]}>
                <View style={[styles.toggleThumb, editStressDose && styles.toggleThumbActive]} />
              </View>
            </Pressable>

            <View style={styles.editActions}>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => { setShowEditModal(false); deleteCondition(editingCondition!); }}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${editingCondition?.name}`}
              >
                <Ionicons name="trash-outline" size={16} color={C.red} />
                <Text style={styles.deleteText}>Remove</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable style={styles.editCancelBtn} onPress={() => setShowEditModal(false)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveEdit}>
                <Text style={styles.saveText}>Save</Text>
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
  content: { paddingHorizontal: 24 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16, minHeight: 44 },
  backText: { fontWeight: "500", fontSize: 15, color: C.tint },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24 },

  emptyState: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 8 },
  emptyDesc: { fontWeight: "400", fontSize: 13, color: C.textTertiary, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.tint, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, minHeight: 44 },
  emptyAddText: { fontWeight: "600", fontSize: 15, color: "#fff" },

  conditionCard: { backgroundColor: C.surface, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  conditionMain: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12, minHeight: 56 },
  conditionNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  conditionName: { fontWeight: "600", fontSize: 15, color: C.text },
  stressBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.orangeLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stressBadgeText: { fontWeight: "600", fontSize: 10, color: C.orange },
  notesIndicator: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  notesPreview: { fontWeight: "400", fontSize: 12, color: C.textTertiary, flex: 1 },

  addConditionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginTop: 8, minHeight: 44 },
  addConditionText: { fontWeight: "600", fontSize: 15, color: C.tint },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { width: "100%", maxWidth: 400, backgroundColor: C.surface, borderRadius: 20, padding: 20, maxHeight: "80%" },
  modalTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 16 },

  searchContainer: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surfaceElevated, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  searchInput: { flex: 1, fontWeight: "400", fontSize: 15, color: C.text, padding: 0 },
  resultsList: { maxHeight: 300 },
  resultItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border, minHeight: 44 },
  resultText: { flex: 1, fontWeight: "500", fontSize: 15, color: C.text },
  customItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: C.border, marginTop: 4, minHeight: 44 },
  customItemText: { flex: 1, fontWeight: "500", fontSize: 14, color: C.accent },
  searchHint: { fontWeight: "400", fontSize: 13, color: C.textTertiary, textAlign: "center", paddingVertical: 24 },
  cancelBtn: { alignItems: "center", paddingVertical: 14, marginTop: 8, minHeight: 44 },
  cancelText: { fontWeight: "600", fontSize: 15, color: C.textSecondary },

  stressPromptCard: { width: "100%", maxWidth: 340, backgroundColor: C.surface, borderRadius: 20, padding: 24, alignItems: "center" },
  stressPromptTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 8 },
  stressPromptText: { fontWeight: "400", fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  stressPromptActions: { flexDirection: "row", gap: 12, width: "100%" },
  stressPromptNo: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, minHeight: 48 },
  stressPromptNoText: { fontWeight: "600", fontSize: 15, color: C.textSecondary },
  stressPromptYes: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: C.orange, minHeight: 48 },
  stressPromptYesText: { fontWeight: "600", fontSize: 15, color: "#fff" },

  label: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 6, marginTop: 8 },
  input: { fontWeight: "400", fontSize: 15, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },

  stressToggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.border, marginTop: 16 },
  stressToggleLabel: { fontWeight: "600", fontSize: 14, color: C.text },
  stressToggleDesc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleActive: { backgroundColor: C.tint, borderColor: C.tint },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  toggleThumbActive: { alignSelf: "flex-end" },

  editActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, minHeight: 44 },
  deleteText: { fontWeight: "600", fontSize: 13, color: C.red },
  editCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, minHeight: 44, justifyContent: "center" },
  editCancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: C.tint, minHeight: 44, justifyContent: "center" },
  saveText: { fontWeight: "600", fontSize: 14, color: "#fff" },
});
