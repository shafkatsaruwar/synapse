import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { comfortStorage, type ComfortItem } from "@/lib/storage";

const C = Colors.dark;

export default function ComfortScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [items, setItems] = useState<ComfortItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const loadData = useCallback(async () => {
    const list = await comfortStorage.getAll();
    setItems(list);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    await comfortStorage.save({ label: newLabel.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewLabel("");
    setShowAdd(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await comfortStorage.delete(id);
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
          <Text style={styles.title}>Mood lifters</Text>
          <Text style={styles.subtitle}>
            Things that make you feel better. When you're in sick mode or mental health day, we'll suggest these for a short time.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setShowAdd(true)}
          accessibilityRole="button"
          accessibilityLabel="Add mood lifter"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="happy-outline" size={40} color={C.textTertiary} />
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptyDesc}>Tap + to add what helps you feel better</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Pressable onPress={() => handleDelete(item.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${item.label}`}>
              <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
            </Pressable>
          </View>
        ))
      )}

      <Modal visible={showAdd} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={styles.modalBox} onPress={(ev) => ev.stopPropagation()}>
            <Text style={styles.modalTitle}>Add mood lifter</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Call a friend, short walk"
              placeholderTextColor={C.textTertiary}
              value={newLabel}
              onChangeText={setNewLabel}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowAdd(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalSave, !newLabel.trim() && { opacity: 0.5 }]} onPress={handleAdd} disabled={!newLabel.trim()}>
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  rowLabel: { fontWeight: "500", fontSize: 16, color: C.text, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalBox: { backgroundColor: C.surface, borderRadius: 20, padding: 24 },
  modalTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 16 },
  modalInput: { backgroundColor: C.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.text, marginBottom: 20 },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { fontSize: 16, color: C.textSecondary },
  modalSave: { backgroundColor: C.tint, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  modalSaveText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
