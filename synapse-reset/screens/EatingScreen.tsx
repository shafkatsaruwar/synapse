import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Modal, Platform, useWindowDimensions,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  eatingStorage,
  hydrationStorage,
  sickModeStorage,
  type EatingEntry,
  type EatingAmount,
  type HydrationEntry,
  type HydrationQuickActionPreset,
  type HydrationUnit,
  convertHydrationToMl,
  formatHydrationAmount,
} from "@/lib/storage";
import { getToday, getDaysAgo, formatDate } from "@/lib/date-utils";
import { syncWidgetSnapshot } from "@/lib/widget-sync";

const AMOUNTS: { key: EatingAmount; label: string }[] = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
];

const HYDRATION_UNITS: HydrationUnit[] = ["oz", "ml", "L", "glasses"];

interface EatingScreenProps {
  initialTab?: "food" | "hydration";
  hydrationLaunchToken?: number;
  onHydrationLaunchHandled?: () => void;
}

export default function EatingScreen({ initialTab = "food", hydrationLaunchToken = 0, onHydrationLaunchHandled }: EatingScreenProps) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [tab, setTab] = useState<"food" | "hydration">(initialTab);
  const [range, setRange] = useState<14 | 30>(14);

  const [entries, setEntries] = useState<EatingEntry[]>([]);
  const [showFoodAdd, setShowFoodAdd] = useState(false);
  const [addWhat, setAddWhat] = useState("");
  const [addAmount, setAddAmount] = useState<EatingAmount>("medium");

  const [hydrationEntries, setHydrationEntries] = useState<HydrationEntry[]>([]);
  const [hydrationPreset, setHydrationPreset] = useState<HydrationQuickActionPreset>({ what: "Water", amount: 8, unit: "oz" });
  const [showHydrationAdd, setShowHydrationAdd] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [hydrationWhat, setHydrationWhat] = useState("");
  const [hydrationAmount, setHydrationAmount] = useState("");
  const [hydrationUnit, setHydrationUnit] = useState<HydrationUnit>("oz");
  const [presetWhat, setPresetWhat] = useState("");
  const [presetAmount, setPresetAmount] = useState("");
  const [presetUnit, setPresetUnit] = useState<HydrationUnit>("oz");

  const loadFoodData = useCallback(async () => {
    const from = getDaysAgo(range);
    const to = getToday();
    const list = await eatingStorage.getByDateRange(from, to);
    setEntries(list);
  }, [range]);

  const loadHydrationData = useCallback(async () => {
    const from = getDaysAgo(range);
    const to = getToday();
    const [list, preset] = await Promise.all([
      hydrationStorage.getByDateRange(from, to),
      hydrationStorage.getPreset(),
    ]);
    setHydrationEntries(list);
    setHydrationPreset(preset);
    setPresetWhat(preset.what);
    setPresetAmount(String(preset.amount));
    setPresetUnit(preset.unit);
  }, [range]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadFoodData();
    loadHydrationData();
  }, [loadFoodData, loadHydrationData]);

  const openHydrationComposerFromPreset = useCallback(async () => {
    const preset = await hydrationStorage.getPreset();
    setTab("hydration");
    setHydrationPreset(preset);
    setHydrationWhat(preset.what);
    setHydrationAmount(String(preset.amount));
    setHydrationUnit(preset.unit);
    setShowHydrationAdd(true);
  }, []);

  useEffect(() => {
    if (hydrationLaunchToken <= 0) return;
    void openHydrationComposerFromPreset().finally(() => onHydrationLaunchHandled?.());
  }, [hydrationLaunchToken, onHydrationLaunchHandled, openHydrationComposerFromPreset]);

  const handleAddFood = async () => {
    if (!addWhat.trim()) return;
    await eatingStorage.save({
      date: getToday(),
      what: addWhat.trim(),
      amount: addAmount,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddWhat("");
    setAddAmount("medium");
    setShowFoodAdd(false);
    loadFoodData();
  };

  const handleDeleteFood = async (id: string) => {
    await eatingStorage.delete(id);
    Haptics.selectionAsync();
    loadFoodData();
  };

  const handleAddHydration = async () => {
    const parsedAmount = parseFloat(hydrationAmount);
    if (!hydrationWhat.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

    await hydrationStorage.save({
      date: getToday(),
      time: new Date().toISOString(),
      what: hydrationWhat.trim(),
      amount: parsedAmount,
      unit: hydrationUnit,
    });

    const sickMode = await sickModeStorage.get();
    if (sickMode.active) {
      const hydrationMl = convertHydrationToMl(parsedAmount, hydrationUnit);
      await sickModeStorage.save({
        ...sickMode,
        hydrationMl: sickMode.hydrationMl + hydrationMl,
      });
    }

    await syncWidgetSnapshot().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHydrationWhat("");
    setHydrationAmount("");
    setHydrationUnit(hydrationPreset.unit);
    setShowHydrationAdd(false);
    loadHydrationData();
  };

  const handleDeleteHydration = async (entry: HydrationEntry) => {
    await hydrationStorage.delete(entry.id);
    await syncWidgetSnapshot().catch(() => {});
    Haptics.selectionAsync();
    loadHydrationData();
  };

  const handleSavePreset = async () => {
    const parsedAmount = parseFloat(presetAmount);
    if (!presetWhat.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;
    const nextPreset = {
      what: presetWhat.trim(),
      amount: parsedAmount,
      unit: presetUnit,
    } satisfies HydrationQuickActionPreset;
    await hydrationStorage.savePreset(nextPreset);
    setHydrationPreset(nextPreset);
    await syncWidgetSnapshot().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowPresetModal(false);
  };

  const groupedByDate = entries.reduce<Record<string, EatingEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const hydrationGroupedByDate = hydrationEntries.reduce<Record<string, HydrationEntry[]>>((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});
  const hydrationDates = Object.keys(hydrationGroupedByDate).sort((a, b) => b.localeCompare(a));
  const hydrationTotalMl = hydrationEntries.reduce((sum, entry) => sum + convertHydrationToMl(entry.amount, entry.unit), 0);

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
            <Text style={styles.title}>Eating</Text>
            <Text style={styles.subtitle}>
              {tab === "food" ? "What you ate, roughly how much" : "Track drinks, quick sips, and widget preset"}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              if (tab === "food") {
                setShowFoodAdd(true);
                return;
              }
              setHydrationWhat(hydrationPreset.what);
              setHydrationAmount(String(hydrationPreset.amount));
              setHydrationUnit(hydrationPreset.unit);
              setShowHydrationAdd(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={tab === "food" ? "Add food entry" : "Add hydration entry"}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, tab === "food" && styles.tabBtnActive]}
            onPress={() => { setTab("food"); Haptics.selectionAsync(); }}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === "food" }}
          >
            <Text style={[styles.tabText, tab === "food" && styles.tabTextActive]}>Food</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === "hydration" && styles.tabBtnActive]}
            onPress={() => { setTab("hydration"); Haptics.selectionAsync(); }}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === "hydration" }}
          >
            <Text style={[styles.tabText, tab === "hydration" && styles.tabTextActive]}>Hydration</Text>
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

        {tab === "food" ? (
          sortedDates.length === 0 ? (
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
                      onPress={() => handleDeleteFood(e.id)}
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
          )
        ) : (
          <>
            <View style={styles.presetCard}>
              <View style={styles.presetHeader}>
                <View>
                  <Text style={styles.presetTitle}>Widget quick sip</Text>
                  <Text style={styles.presetMeta}>{hydrationPreset.what} • {formatHydrationAmount(hydrationPreset.amount, hydrationPreset.unit)}</Text>
                </View>
                <Pressable style={styles.presetEditBtn} onPress={() => setShowPresetModal(true)}>
                  <Text style={styles.presetEditText}>Edit</Text>
                </Pressable>
              </View>
              <Text style={styles.presetDesc}>This is what the Hydration widget uses when someone taps Take a Sip.</Text>
            </View>

            <View style={styles.hydrationSummaryCard}>
              <View>
                <Text style={styles.hydrationSummaryLabel}>Total in range</Text>
                <Text style={styles.hydrationSummaryValue}>{Math.round(hydrationTotalMl)} mL</Text>
              </View>
              <Pressable
                style={styles.quickSipBtn}
                onPress={() => {
                  setHydrationWhat(hydrationPreset.what);
                  setHydrationAmount(String(hydrationPreset.amount));
                  setHydrationUnit(hydrationPreset.unit);
                  setShowHydrationAdd(true);
                }}
              >
                <Ionicons name="water-outline" size={16} color="#fff" />
                <Text style={styles.quickSipText}>Take a Sip</Text>
              </Pressable>
            </View>

            {hydrationDates.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="water-outline" size={40} color={C.textTertiary} />
                <Text style={styles.emptyTitle}>No hydration logs</Text>
                <Text style={styles.emptyDesc}>Tap + or Take a Sip to log a drink</Text>
              </View>
            ) : (
              hydrationDates.map((date) => (
                <View key={date} style={styles.dateBlock}>
                  <Text style={styles.dateLabel}>{formatDate(date)}</Text>
                  {(hydrationGroupedByDate[date] || []).map((entry) => (
                    <View key={entry.id} style={styles.entryRow}>
                      <View style={styles.entryMain}>
                        <Text style={styles.entryWhat}>{entry.what}</Text>
                        <Text style={styles.entryAmount}>
                          {formatHydrationAmount(entry.amount, entry.unit)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteHydration(entry)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${entry.what}`}
                      >
                        <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showFoodAdd} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowFoodAdd(false)}>
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
              <Pressable style={styles.modalCancel} onPress={() => setShowFoodAdd(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, !addWhat.trim() && { opacity: 0.5 }]}
                onPress={handleAddFood}
                disabled={!addWhat.trim()}
              >
                <Text style={styles.modalSaveText}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showHydrationAdd} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowHydrationAdd(false)}>
          <Pressable style={styles.modalBox} onPress={(ev) => ev.stopPropagation()}>
            <Text style={styles.modalTitle}>Log hydration</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What did you drink?"
              placeholderTextColor={C.textTertiary}
              value={hydrationWhat}
              onChangeText={setHydrationWhat}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="How much?"
              placeholderTextColor={C.textTertiary}
              value={hydrationAmount}
              onChangeText={setHydrationAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.modalLabel}>Unit</Text>
            <View style={styles.amountRowWrap}>
              {HYDRATION_UNITS.map((unit) => (
                <Pressable
                  key={unit}
                  style={[styles.amountChip, hydrationUnit === unit && styles.amountChipActive]}
                  onPress={() => { setHydrationUnit(unit); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.amountChipText, hydrationUnit === unit && styles.amountChipTextActive]}>{unit}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowHydrationAdd(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, (!hydrationWhat.trim() || !hydrationAmount.trim()) && { opacity: 0.5 }]}
                onPress={handleAddHydration}
                disabled={!hydrationWhat.trim() || !hydrationAmount.trim()}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showPresetModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowPresetModal(false)}>
          <Pressable style={styles.modalBox} onPress={(ev) => ev.stopPropagation()}>
            <Text style={styles.modalTitle}>Hydration widget preset</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Drink name"
              placeholderTextColor={C.textTertiary}
              value={presetWhat}
              onChangeText={setPresetWhat}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Sip amount"
              placeholderTextColor={C.textTertiary}
              value={presetAmount}
              onChangeText={setPresetAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.modalLabel}>Unit</Text>
            <View style={styles.amountRowWrap}>
              {HYDRATION_UNITS.map((unit) => (
                <Pressable
                  key={unit}
                  style={[styles.amountChip, presetUnit === unit && styles.amountChipActive]}
                  onPress={() => { setPresetUnit(unit); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.amountChipText, presetUnit === unit && styles.amountChipTextActive]}>{unit}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowPresetModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, (!presetWhat.trim() || !presetAmount.trim()) && { opacity: 0.5 }]}
                onPress={handleSavePreset}
                disabled={!presetWhat.trim() || !presetAmount.trim()}
              >
                <Text style={styles.modalSaveText}>Save preset</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
    title: { fontWeight: "700", fontSize: 28, color: C.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: C.textSecondary, maxWidth: 250 },
    addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    tabRow: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 10, padding: 3, marginBottom: 16, borderWidth: 1, borderColor: C.border },
    tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    tabBtnActive: { backgroundColor: C.tintLight },
    tabText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
    tabTextActive: { color: C.tint },
    rangeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
    rangeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: C.surface },
    rangeChipActive: { backgroundColor: C.tintLight },
    rangeChipText: { fontSize: 14, fontWeight: "500", color: C.textSecondary },
    rangeChipTextActive: { color: C.tint },
    empty: { alignItems: "center", paddingVertical: 48 },
    emptyTitle: { fontWeight: "600", fontSize: 18, color: C.text, marginTop: 12 },
    emptyDesc: { fontSize: 14, color: C.textTertiary, marginTop: 4, textAlign: "center" },
    dateBlock: { marginBottom: 20 },
    dateLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 8 },
    entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
    entryMain: { flex: 1 },
    entryWhat: { fontWeight: "500", fontSize: 15, color: C.text },
    entryAmount: { fontSize: 13, color: C.textSecondary, marginTop: 2, textTransform: "capitalize" },
    presetCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
    presetHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 8 },
    presetTitle: { fontWeight: "700", fontSize: 16, color: C.text },
    presetMeta: { fontSize: 13, color: C.tint, marginTop: 4 },
    presetDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    presetEditBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.tintLight, alignSelf: "flex-start" },
    presetEditText: { fontWeight: "600", fontSize: 13, color: C.tint },
    hydrationSummaryCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
    hydrationSummaryLabel: { fontSize: 12, fontWeight: "600", color: C.textSecondary, textTransform: "uppercase" },
    hydrationSummaryValue: { fontWeight: "700", fontSize: 24, color: C.text, marginTop: 4 },
    quickSipBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.tint, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
    quickSipText: { fontWeight: "600", fontSize: 14, color: "#fff" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
    modalBox: { backgroundColor: C.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
    modalTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 16 },
    modalInput: { backgroundColor: C.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.text, marginBottom: 16 },
    modalLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 8 },
    amountRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
    amountRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
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
}
