import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  medicationStorage, medicationLogStorage, settingsStorage, sickModeStorage,
  type Medication, type MedicationLog, type UserSettings, type SickModeData,
} from "@/lib/storage";
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

const ROUTE_EMOJIS: Record<string, string> = {
  oral: "💊", tablet: "💊", capsule: "💊", chewable: "💊",
  injection: "💉", "IM injection": "💉", "SubQ injection": "💉", subcutaneous: "💉", intramuscular: "💉",
  inhaler: "🫁", diskus: "🫁", nebulizer: "🫁",
  topical: "🧴", cream: "🧴", ointment: "🧴", patch: "🩹",
  drops: "💧", eye: "👁️", ear: "👂",
  suppository: "💊", liquid: "🥤", sublingual: "💊",
};

const EMOJI_OPTIONS = ["💊", "💉", "🫁", "🧴", "🩹", "💧", "🥤", "🧬", "❤️", "🧠", "🦴", "🩺", "⚡", "🌙", "☀️", "🍽️"];

function getAutoEmoji(med: Medication): string {
  if (med.emoji) return med.emoji;
  const searchText = `${med.route || ""} ${med.dosage || ""}`.toLowerCase();
  for (const [key, emoji] of Object.entries(ROUTE_EMOJIS)) {
    if (searchText.includes(key.toLowerCase())) return emoji;
  }
  return "💊";
}

const DEFAULT_MEDICATIONS: Omit<Medication, "id">[] = [
  { name: "Testosterone Cypionate", dosage: "50 mg", unit: "mg", route: "IM injection", frequency: "Once weekly", timeTag: "Morning", active: true, doses: 1, emoji: "💉" },
  { name: "Sograya (Semaglutide)", dosage: "10 mg", unit: "mg", route: "SubQ injection", frequency: "Once weekly", timeTag: "Morning", active: true, doses: 1, emoji: "💉" },
  { name: "Levothyroxine", dosage: "200 mcg", unit: "mcg", route: "tablet", frequency: "Daily, before breakfast", timeTag: "Morning", active: true, doses: 1, emoji: "💊" },
  { name: "Fluticasone/Salmeterol (Advair)", dosage: "250-50 mcg", unit: "mcg", route: "diskus inhaler", frequency: "Twice daily (morning & bedtime)", timeTag: "Morning", active: true, doses: 2, emoji: "🫁" },
  { name: "Hydrocortisone", dosage: "5 mg", unit: "mg", route: "tablet", frequency: "Daily (AM + PM)", timeTag: "Morning", active: true, doses: 2, emoji: "⚡" },
  { name: "Simethicone", dosage: "80 mg", unit: "mg", route: "chewable tablet", frequency: "As needed, with Levothyroxine", timeTag: "Morning", active: true, doses: 1, emoji: "💊" },
];

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [sickData, setSickData] = useState<SickModeData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [nudgeMedId, setNudgeMedId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formDose, setFormDose] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formRoute, setFormRoute] = useState("");
  const [formFreq, setFormFreq] = useState("");
  const [formTimeTag, setFormTimeTag] = useState<Medication["timeTag"]>("Morning");
  const [formEmoji, setFormEmoji] = useState("");
  const [formDoses, setFormDoses] = useState("1");

  const loadData = useCallback(async () => {
    let meds = await medicationStorage.getAll();
    const defaultNames = DEFAULT_MEDICATIONS.map((d) => d.name);
    const hasAllDefaults = defaultNames.every((n) => meds.some((m) => m.name === n));
    if (meds.length === 0 || !hasAllDefaults) {
      for (const def of DEFAULT_MEDICATIONS) {
        if (!meds.some((m) => m.name === def.name)) {
          await medicationStorage.save(def);
        }
      }
      meds = await medicationStorage.getAll();
    }
    const logs = await medicationLogStorage.getByDate(today);
    const s = await settingsStorage.get();
    const sd = await sickModeStorage.get();
    setMedications(meds);
    setMedLogs(logs);
    setSettings(s);
    setSickData(sd);
  }, [today]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const openAddModal = () => {
    setEditingMed(null);
    setFormName(""); setFormDose(""); setFormUnit(""); setFormRoute("");
    setFormFreq(""); setFormTimeTag("Morning"); setFormEmoji(""); setFormDoses("1");
    setShowModal(true);
  };

  const openEditModal = (med: Medication) => {
    setEditingMed(med);
    setFormName(med.name);
    setFormDose(med.dosage);
    setFormUnit(med.unit || "");
    setFormRoute(med.route || "");
    setFormFreq(med.frequency);
    setFormTimeTag(med.timeTag);
    setFormEmoji(med.emoji || "");
    setFormDoses(String(med.doses || 1));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const data: Omit<Medication, "id"> = {
      name: formName.trim(), dosage: formDose.trim(), unit: formUnit.trim(),
      route: formRoute.trim(), frequency: formFreq.trim(), timeTag: formTimeTag,
      emoji: formEmoji || "", doses: Math.max(1, parseInt(formDoses) || 1), active: true,
    };
    if (editingMed) {
      await medicationStorage.update(editingMed.id, data);
    } else {
      await medicationStorage.save(data);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (med: Medication) => {
    if (Platform.OS === "web") { await medicationStorage.delete(med.id); loadData(); return; }
    Alert.alert("Remove", `Remove ${med.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await medicationStorage.delete(med.id); loadData(); } },
    ]);
  };

  const handleDoseToggle = async (medId: string, doseIdx: number) => {
    const log = medLogs.find((l) => l.medicationId === medId && (l.doseIndex ?? 0) === doseIdx);
    if (log?.taken) {
      await medicationLogStorage.toggle(medId, today, doseIdx);
      Haptics.selectionAsync();
    } else {
      await medicationLogStorage.toggle(medId, today, doseIdx);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    loadData();
  };

  const handleNotYet = (medId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setNudgeMedId(medId);
  };

  const handleAlrightTookIt = async () => {
    if (nudgeMedId) {
      const med = medications.find((m) => m.id === nudgeMedId);
      const doseCount = getDoseCount(med);
      for (let i = 0; i < doseCount; i++) {
        const log = medLogs.find((l) => l.medicationId === nudgeMedId && (l.doseIndex ?? 0) === i);
        if (!log?.taken) {
          await medicationLogStorage.toggle(nudgeMedId, today, i);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNudgeMedId(null);
      loadData();
    }
  };

  const isDoseTaken = (medId: string, doseIdx: number) =>
    medLogs.find((l) => l.medicationId === medId && (l.doseIndex ?? 0) === doseIdx)?.taken || false;

  const isSickMode = settings.sickMode;

  const getDoseCount = (med?: Medication | null) => {
    if (!med) return 1;
    const base = med.doses || 1;
    if (isSickMode && med.name === "Hydrocortisone") return base * 3;
    return base;
  };

  const grouped = TIME_TAGS.map((tag) => ({
    tag, meds: medications.filter((m) => m.timeTag === tag && m.active),
  })).filter((g) => g.meds.length > 0);

  const totalDoses = medications.filter((m) => m.active).reduce((sum, m) => sum + getDoseCount(m), 0);
  const takenDoses = medications.filter((m) => m.active).reduce((sum, m) => {
    const dc = getDoseCount(m);
    let taken = 0;
    for (let i = 0; i < dc; i++) {
      if (isDoseTaken(m.id, i)) taken++;
    }
    return sum + taken;
  }, 0);

  const isHydrocortisone = (med: Medication) => med.name === "Hydrocortisone";

  const doseLabels = (med: Medication): string[] => {
    const count = getDoseCount(med);
    if (count === 1) return ["Dose"];
    if (isHydrocortisone(med) && isSickMode) {
      return Array.from({ length: count }, (_, i) => `Stress Dose ${i + 1}`);
    }
    if (count === 2) return ["AM Dose", "PM Dose"];
    return Array.from({ length: count }, (_, i) => `Dose ${i + 1}`);
  };

  return (
    <View style={[styles.container, isSickMode && { backgroundColor: "#1A0A0A" }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, {
          paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        }]}
        showsVerticalScrollIndicator={false}
      >
        {isSickMode && (
          <View style={styles.sickBanner}>
            <View style={styles.sickBannerInner}>
              <Ionicons name="warning" size={16} color={C.red} />
              <Text style={styles.sickBannerText}>Recovery protocol active</Text>
            </View>
          </View>
        )}

        <View style={styles.header}>
          <View>
            <Text style={[styles.title, isSickMode && { color: "#FF6B6B" }]}>Medications</Text>
            <Text style={styles.subtitle}>{takenDoses}/{totalDoses} doses taken today</Text>
          </View>
          <Pressable testID="add-medication" style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={openAddModal}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        {totalDoses > 0 && (
          <View style={[styles.progressBar, isSickMode && { backgroundColor: "rgba(255,69,58,0.15)" }]}>
            <View style={[styles.progressFill, { width: `${(takenDoses / totalDoses) * 100}%` }, isSickMode && { backgroundColor: C.red }]} />
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
              const doseCount = getDoseCount(med);
              const allTaken = Array.from({ length: doseCount }, (_, i) => isDoseTaken(med.id, i)).every(Boolean);
              const labels = doseLabels(med);
              const emoji = getAutoEmoji(med);
              const isStressDosing = isSickMode && isHydrocortisone(med);

              return (
                <Pressable
                  key={med.id}
                  style={[
                    styles.medCard,
                    allTaken && styles.medCardTaken,
                    isStressDosing && styles.medCardStress,
                  ]}
                  onPress={() => openEditModal(med)}
                >
                  <View style={styles.medInfo}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={{ fontSize: 18 }}>{emoji}</Text>
                        <Text style={[styles.medName, allTaken && styles.medNameTaken]}>{med.name}</Text>
                        {isStressDosing && (
                          <View style={styles.stressBadge}>
                            <Text style={styles.stressBadgeText}>STRESS DOSING</Text>
                          </View>
                        )}
                      </View>
                      {!!med.dosage && (
                        <Text style={styles.medDose}>
                          {med.dosage}{med.unit && !med.dosage.includes(med.unit) ? ` ${med.unit}` : ""}
                          {med.route ? ` · ${med.route}` : ""}
                          {isStressDosing ? " (3x dose)" : ""}
                        </Text>
                      )}
                      {!!med.frequency && <Text style={styles.medFreq}>{med.frequency}</Text>}
                    </View>
                    <Pressable onPress={() => handleDelete(med)} hitSlop={12}>
                      <Ionicons name="trash-outline" size={16} color={C.textTertiary} />
                    </Pressable>
                  </View>

                  {doseCount === 1 ? (
                    allTaken ? (
                      <Pressable style={styles.takenBanner} onPress={() => handleDoseToggle(med.id, 0)}>
                        <Ionicons name="checkmark-circle" size={18} color={C.green} />
                        <Text style={styles.takenText}>Taken</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.actionRow}>
                        <Pressable style={[styles.yesBtn, isStressDosing && { backgroundColor: C.red }]} onPress={() => handleDoseToggle(med.id, 0)} testID={`taken-${med.name}`}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={styles.yesBtnText}>Yes, took it</Text>
                        </Pressable>
                        <Pressable style={styles.notYetBtn} onPress={() => handleNotYet(med.id)} testID={`notyet-${med.name}`}>
                          <Text style={styles.notYetText}>Not yet</Text>
                        </Pressable>
                      </View>
                    )
                  ) : (
                    <View style={styles.dosesContainer}>
                      {Array.from({ length: doseCount }, (_, i) => {
                        const taken = isDoseTaken(med.id, i);
                        return (
                          <Pressable
                            key={i}
                            style={[styles.doseRow, taken && styles.doseRowTaken]}
                            onPress={() => handleDoseToggle(med.id, i)}
                          >
                            <Ionicons
                              name={taken ? "checkmark-circle" : "ellipse-outline"}
                              size={20}
                              color={taken ? C.green : (isStressDosing ? C.red : C.textTertiary)}
                            />
                            <Text style={[styles.doseLabel, taken && { color: C.green }]}>{labels[i]}</Text>
                            {!taken && (
                              <Pressable style={styles.doseNotYet} onPress={() => handleNotYet(med.id)}>
                                <Text style={styles.doseNotYetText}>skip</Text>
                              </Pressable>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingMed ? "Edit Medication" : "Add Medication"}</Text>

              <Text style={styles.label}>Emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((e) => (
                  <Pressable key={e} style={[styles.emojiOpt, formEmoji === e && styles.emojiOptActive]} onPress={() => { setFormEmoji(e); Haptics.selectionAsync(); }}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} placeholder="e.g. Metformin" placeholderTextColor={C.textTertiary} value={formName} onChangeText={setFormName} />

              <View style={styles.fieldRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.label}>Dose</Text>
                  <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor={C.textTertiary} value={formDose} onChangeText={setFormDose} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput style={styles.input} placeholder="mg" placeholderTextColor={C.textTertiary} value={formUnit} onChangeText={setFormUnit} />
                </View>
              </View>

              <Text style={styles.label}>Route</Text>
              <TextInput style={styles.input} placeholder="e.g. tablet, injection, inhaler" placeholderTextColor={C.textTertiary} value={formRoute} onChangeText={setFormRoute} />

              <Text style={styles.label}>Frequency</Text>
              <TextInput style={styles.input} placeholder="e.g. Once daily" placeholderTextColor={C.textTertiary} value={formFreq} onChangeText={setFormFreq} />

              <Text style={styles.label}>Daily Doses</Text>
              <View style={styles.doseCountRow}>
                {[1, 2, 3, 4].map((n) => (
                  <Pressable key={n} style={[styles.doseCountBtn, formDoses === String(n) && styles.doseCountActive]} onPress={() => { setFormDoses(String(n)); Haptics.selectionAsync(); }}>
                    <Text style={[styles.doseCountText, formDoses === String(n) && styles.doseCountTextActive]}>{n}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Time of Day</Text>
              <View style={styles.tagPicker}>
                {TIME_TAGS.map((tag) => (
                  <Pressable key={tag} style={[styles.tagOpt, formTimeTag === tag && { backgroundColor: TAG_COLORS[tag].bg, borderColor: TAG_COLORS[tag].text }]} onPress={() => { setFormTimeTag(tag); Haptics.selectionAsync(); }}>
                    <Text style={[styles.tagOptText, formTimeTag === tag && { color: TAG_COLORS[tag].text }]}>{tag}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                <Pressable style={[styles.confirmBtn, !formName.trim() && { opacity: 0.5 }]} onPress={handleSave} disabled={!formName.trim()}>
                  <Text style={styles.confirmText}>{editingMed ? "Save" : "Add"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!nudgeMedId} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.nudgeCard}>
            <Text style={styles.nudgeEmoji}>😤</Text>
            <Text style={styles.nudgeText}>What, you expecting an invite from Amma?</Text>
            <Pressable style={styles.nudgeBtn} testID="alright-took-it" onPress={handleAlrightTookIt}>
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
  sickBanner: { marginBottom: 16, backgroundColor: "rgba(255,69,58,0.12)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(255,69,58,0.3)" },
  sickBannerInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  sickBannerText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.red },
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
  medCardStress: { borderColor: "rgba(255,69,58,0.4)", backgroundColor: "rgba(255,69,58,0.06)" },
  medInfo: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  medName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  medNameTaken: { color: C.textSecondary },
  medDose: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 4, marginLeft: 26 },
  medFreq: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.tint, marginTop: 3, marginLeft: 26 },
  stressBadge: { backgroundColor: C.red, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stressBadgeText: { fontFamily: "Inter_700Bold", fontSize: 8, color: "#fff", letterSpacing: 0.8 },
  actionRow: { flexDirection: "row", gap: 8 },
  yesBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.green },
  yesBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  notYetBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  notYetText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  takenBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(48,209,88,0.1)" },
  takenText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.green },
  dosesContainer: { gap: 6 },
  doseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.surfaceElevated },
  doseRowTaken: { backgroundColor: "rgba(48,209,88,0.08)" },
  doseLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, flex: 1 },
  doseNotYet: { paddingHorizontal: 8, paddingVertical: 4 },
  doseNotYetText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textTertiary },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 400, maxHeight: "85%", borderWidth: 1, borderColor: C.border },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginBottom: 20 },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  fieldRow: { flexDirection: "row", gap: 10 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  emojiOpt: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  emojiOptActive: { borderColor: C.tint, backgroundColor: C.tintLight },
  doseCountRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  doseCountBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  doseCountActive: { backgroundColor: C.tintLight, borderColor: C.tint },
  doseCountText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  doseCountTextActive: { color: C.tint },
  tagPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  tagOpt: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
  tagOptText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
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
