import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Modal, TextInput, Platform, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { vitalStorage, healthLogStorage, type Vital, type HealthLog } from "@/lib/storage";
import { getDaysAgo, formatDate, getToday } from "@/lib/date-utils";

const C = Colors.dark;

type Category = "weight" | "blood_pressure" | "blood_sugar" | "heart_rate" | "sleep" | "hydration" | "labs";

const CATEGORIES: { key: Category; label: string; icon: string; color: string; unit: string }[] = [
  { key: "weight", label: "Weight", icon: "scale-outline", color: C.cyan, unit: "kg" },
  { key: "blood_pressure", label: "Blood Pressure", icon: "heart-outline", color: C.red, unit: "mmHg" },
  { key: "blood_sugar", label: "Blood Sugar", icon: "water-outline", color: C.orange, unit: "mg/dL" },
  { key: "heart_rate", label: "Heart Rate", icon: "pulse-outline", color: C.pink, unit: "bpm" },
  { key: "sleep", label: "Sleep", icon: "moon-outline", color: C.purple, unit: "hours" },
  { key: "hydration", label: "Hydration", icon: "cafe-outline", color: C.tint, unit: "glasses" },
  { key: "labs", label: "Labs", icon: "flask-outline", color: C.green, unit: "" },
];

export default function HealthDataScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [vitals, setVitals] = useState<Vital[]>([]);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [selected, setSelected] = useState<Category>("weight");
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [showAdd, setShowAdd] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addUnit, setAddUnit] = useState("");
  const [addLabel, setAddLabel] = useState("");

  const loadData = useCallback(async () => {
    const [v, l] = await Promise.all([vitalStorage.getAll(), healthLogStorage.getAll()]);
    setVitals(v);
    setLogs(l);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const cutoff = getDaysAgo(range);
  const cat = CATEGORIES.find((c) => c.key === selected)!;

  const filteredVitals = vitals
    .filter((v) => v.type.toLowerCase().includes(selected.replace("_", " ")) || v.type.toLowerCase() === selected.replace("_", " "))
    .filter((v) => v.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  const sleepData = selected === "sleep"
    ? logs.filter((l) => l.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const dataPoints = selected === "sleep"
    ? sleepData.map((l) => ({ date: l.date, value: l.sleep, label: `${l.sleep}/5` }))
    : filteredVitals.map((v) => ({ date: v.date, value: parseFloat(v.value) || 0, label: `${v.value} ${v.unit}` }));

  const maxVal = dataPoints.length > 0 ? Math.max(...dataPoints.map((d) => d.value)) : 1;
  const minVal = dataPoints.length > 0 ? Math.min(...dataPoints.map((d) => d.value)) : 0;
  const valRange = maxVal - minVal || 1;

  const handleAdd = async () => {
    if (!addValue.trim()) return;
    const today = getToday();
    const type = selected === "labs" ? addLabel.trim() : cat.label;
    const unit = selected === "labs" ? addUnit.trim() : cat.unit;
    await vitalStorage.save({ date: today, type, value: addValue.trim(), unit });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddValue("");
    setAddLabel("");
    setAddUnit("");
    setShowAdd(false);
    loadData();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, {
        paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
        paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
      }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Health Data</Text>
          <Pressable testID="add-health-data" style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>Add</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.key} style={[styles.catChip, selected === c.key && { backgroundColor: c.color + "22", borderColor: c.color }]} onPress={() => { setSelected(c.key); Haptics.selectionAsync(); }}>
              <Ionicons name={c.icon as any} size={14} color={selected === c.key ? c.color : C.textSecondary} />
              <Text style={[styles.catText, selected === c.key && { color: c.color }]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.rangeRow}>
          {([7, 14, 30] as const).map((r) => (
            <Pressable key={r} style={[styles.rangeBtn, range === r && styles.rangeBtnActive]} onPress={() => setRange(r)}>
              <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r}d</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{cat.label} Trend</Text>
          {dataPoints.length === 0 ? (
            <View style={styles.emptyChart}>
              <Ionicons name="analytics-outline" size={40} color={C.textTertiary} />
              <Text style={styles.emptyText}>No data yet for this period</Text>
              <Text style={styles.emptySubtext}>Tap + to record your first entry</Text>
            </View>
          ) : (
            <View style={styles.chart}>
              {dataPoints.map((dp, i) => {
                const h = ((dp.value - minVal) / valRange) * 100 + 10;
                return (
                  <View key={i} style={styles.barCol}>
                    <Text style={styles.barValue}>{dp.label}</Text>
                    <View style={[styles.bar, { height: h, backgroundColor: cat.color }]} />
                    <Text style={styles.barDate}>{formatDate(dp.date).split(",")[0]}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {dataPoints.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Latest</Text>
                <Text style={[styles.statValue, { color: cat.color }]}>{dataPoints[dataPoints.length - 1].label}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Average</Text>
                <Text style={[styles.statValue, { color: cat.color }]}>{(dataPoints.reduce((s, d) => s + d.value, 0) / dataPoints.length).toFixed(1)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Min</Text>
                <Text style={styles.statValue}>{minVal.toFixed(1)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Max</Text>
                <Text style={styles.statValue}>{maxVal.toFixed(1)}</Text>
              </View>
            </View>
            {dataPoints.length >= 2 && (
              <View style={styles.trendRow}>
                <Ionicons name={dataPoints[dataPoints.length - 1].value >= dataPoints[dataPoints.length - 2].value ? "trending-up" : "trending-down"} size={18} color={dataPoints[dataPoints.length - 1].value >= dataPoints[dataPoints.length - 2].value ? C.green : C.red} />
                <Text style={styles.trendText}>
                  {dataPoints[dataPoints.length - 1].value >= dataPoints[dataPoints.length - 2].value ? "Trending up" : "Trending down"} from last entry
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>History</Text>
          {dataPoints.length === 0 ? (
            <Text style={styles.emptyText}>No entries recorded</Text>
          ) : (
            [...dataPoints].reverse().slice(0, 20).map((dp, i) => (
              <View key={i} style={styles.histRow}>
                <Text style={styles.histDate}>{formatDate(dp.date)}</Text>
                <Text style={[styles.histVal, { color: cat.color }]}>{dp.label}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowAdd(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add {cat.label}</Text>
            {selected === "labs" && (
              <>
                <Text style={styles.label}>Test Name</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. HbA1c, TSH" placeholderTextColor={C.textTertiary} value={addLabel} onChangeText={setAddLabel} />
              </>
            )}
            <Text style={styles.label}>Value</Text>
            <TextInput style={styles.modalInput} placeholder={selected === "blood_pressure" ? "120/80" : "Enter value"} placeholderTextColor={C.textTertiary} value={addValue} onChangeText={setAddValue} keyboardType={selected === "blood_pressure" ? "default" : "numeric"} />
            {selected === "labs" && (
              <>
                <Text style={styles.label}>Unit</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. %, mIU/L" placeholderTextColor={C.textTertiary} value={addUnit} onChangeText={setAddUnit} />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAdd(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirmBtn, { backgroundColor: cat.color }, !addValue.trim() && { opacity: 0.5 }]} onPress={handleAdd} disabled={!addValue.trim()}>
                <Text style={styles.confirmText}>Save</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5 },
  addBtn: { flexDirection: "row", gap: 4, paddingHorizontal: 14, height: 36, borderRadius: 10, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  catRow: { gap: 6, marginBottom: 16, paddingRight: 24 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  catText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  rangeRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  rangeBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  rangeBtnActive: { backgroundColor: C.tintLight, borderColor: C.tint },
  rangeText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  rangeTextActive: { color: C.tint },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 14 },
  emptyChart: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontWeight: "400", fontSize: 13, color: C.textTertiary, marginTop: 8 },
  emptySubtext: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 4 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 160 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barValue: { fontWeight: "500", fontSize: 8, color: C.textSecondary, marginBottom: 4, textAlign: "center" },
  bar: { width: "80%", minWidth: 6, borderRadius: 4 },
  barDate: { fontWeight: "400", fontSize: 8, color: C.textTertiary, marginTop: 4, textAlign: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statItem: { flex: 1, minWidth: 70, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, alignItems: "center" },
  statLabel: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginBottom: 4 },
  statValue: { fontWeight: "600", fontSize: 16, color: C.text },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  trendText: { fontWeight: "400", fontSize: 13, color: C.textSecondary },
  histRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  histDate: { fontWeight: "400", fontSize: 13, color: C.textSecondary },
  histVal: { fontWeight: "600", fontSize: 14, color: C.text },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 380, borderWidth: 1, borderColor: C.border },
  modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  modalInput: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
  cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
});
