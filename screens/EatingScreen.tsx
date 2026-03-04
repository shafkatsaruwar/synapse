import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Modal, TextInput, Platform, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { eatingStorage, type EatingEntry, type EatingAmount } from "@/lib/storage";
import { getToday, getDaysAgo, formatDate } from "@/lib/date-utils";

const C = Colors.dark;

const AMOUNTS: { key: EatingAmount; label: string }[] = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
];

export default function EatingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [entries, setEntries] = useState<EatingEntry[]>([]);
  const [range, setRange] = useState<14 | 30>(14);
  const [showAdd, setShowAdd] = useState(false);
  const [addWhat, setAddWhat] = useState("");
  const [addAmount, setAddAmount] = useState<EatingAmount>("medium");

  const loadData = useCallback(async () => {
    const from = getDaysAgo(range);
    const to = getToday();
    const list = await eatingStorage.getByDateRange(from, to);
    setEntries(list);
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    if (!addWhat.trim()) return;
    await eatingStorage.save({
      date: getToday(),
      what: addWhat.trim(),
      amount: addAmount,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddWhat("");
    setAddAmount("medium");
    setShowAdd(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await eatingStorage.delete(id);
    Haptics.selectionAsync();
    loadData();
  };

  const groupedByDate = entries.reduce<Record<string, EatingEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const topPad = isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16);

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topPad,
            paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Eating habits</Text>
            <Text style={styles.subtitle}>What you ate, roughly how much (doctor-style)</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Add food entry"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.rangeRow}>
          {([14, 30] as const).map((r) => (
            <Pressable
              key={r}
              style={[styles.rangeChip, range === r && styles.rangeChipActive]}
              onPress={() => { setRange(r); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.rangeChipText, range === r && styles.rangeChipTextActive]}>{r} days</Text>
            </Pressable>
          ))}
        </View>

        {sortedDates.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No entries</Text>
            <Text style={styles.emptyDesc}>Tap + to log what you ate</Text>
          </View>
        ) : (
          sortedDates.map((date) => (
            <View key={date} style={styles.dateBlock}>
              <Text style={styles.dateLabel}>{formatDate(date)}</Text>
              {(groupedByDate[date] || []).map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <View style={styles.entryMain}>
                    <Text style={styles.entryWhat}>{e.what}</Text>
                    <Text style={styles.entryAmount}>{e.amount}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(e.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${e.what}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={styles.modalBox} onPress={(ev) => ev.stopPropagation()}>
            <Text style={styles.modalTitle}>Log food</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What did you eat?"
              placeholderTextColor={C.textTertiary}
              value={addWhat}
              onChangeText={setAddWhat}
              autoFocus
            />
            <Text style={styles.modalLabel}>Portion size</Text>
            <View style={styles.amountRow}>
              {AMOUNTS.map(({ key, label }) => (
                <Pressable
                  key={key}
                  style={[styles.amountChip, addAmount === key && styles.amountChipActive]}
                  onPress={() => { setAddAmount(key); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.amountChipText, addAmount === key && styles.amountChipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowAdd(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, !addWhat.trim() && { opacity: 0.5 }]}
                onPress={handleAdd}
                disabled={!addWhat.trim()}
              >
                <Text style={styles.modalSaveText}>Add</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.textSecondary },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  rangeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  rangeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: C.surface },
  rangeChipActive: { backgroundColor: C.tintLight },
  rangeChipText: { fontSize: 14, fontWeight: "500", color: C.textSecondary },
  rangeChipTextActive: { color: C.tint },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontWeight: "600", fontSize: 18, color: C.text, marginTop: 12 },
  emptyDesc: { fontSize: 14, color: C.textTertiary, marginTop: 4 },
  dateBlock: { marginBottom: 20 },
  dateLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  entryMain: { flex: 1 },
  entryWhat: { fontWeight: "500", fontSize: 15, color: C.text },
  entryAmount: { fontSize: 13, color: C.textSecondary, marginTop: 2, textTransform: "capitalize" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalBox: { backgroundColor: C.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
  modalTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 16 },
  modalInput: { backgroundColor: C.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.text, marginBottom: 16 },
  modalLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  amountRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  amountChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: C.background },
  amountChipActive: { backgroundColor: C.tintLight },
  amountChipText: { fontSize: 14, fontWeight: "500", color: C.textSecondary },
  amountChipTextActive: { color: C.tint },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { fontSize: 16, color: C.textSecondary },
  modalSave: { backgroundColor: C.tint, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  modalSaveText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
