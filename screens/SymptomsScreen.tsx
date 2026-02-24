import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { symptomStorage, settingsStorage, sickModeStorage, type Symptom } from "@/lib/storage";
import { getToday, getRelativeDay, getDaysAgo } from "@/lib/date-utils";

const C = Colors.dark;

const COMMON_SYMPTOMS = [
  "Fever", "Headache", "Fatigue", "Nausea", "Dizziness", "Joint Pain",
  "Bloating", "Insomnia", "Anxiety", "Back Pain", "Chest Tightness",
  "Shortness of Breath", "Brain Fog", "Muscle Ache", "Stomach Pain",
];

interface SymptomsScreenProps {
  onActivateSickMode?: () => void;
}

export default function SymptomsScreen({ onActivateSickMode }: SymptomsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();

  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState("");
  const [feverTemp, setFeverTemp] = useState("");
  const [showFeverAlert, setShowFeverAlert] = useState(false);

  const isFeverSelected = selectedSymptom === "Fever";

  const loadData = useCallback(async () => {
    const all = await symptomStorage.getAll();
    setSymptoms(all.sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    const name = selectedSymptom || customSymptom.trim();
    if (!name) return;
    const temp = isFeverSelected && feverTemp.trim() ? parseFloat(feverTemp) : undefined;
    await symptomStorage.save({ date: today, name, severity, notes: notes.trim(), temperature: temp });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isFeverSelected && temp && temp >= 100) {
      const settings = await settingsStorage.get();
      if (!settings.sickMode) {
        setShowFeverAlert(true);
      }
    }

    setSelectedSymptom(""); setCustomSymptom(""); setSeverity(3); setNotes(""); setFeverTemp("");
    setShowModal(false);
    loadData();
  };

  const handleActivateSickMode = async () => {
    const settings = await settingsStorage.get();
    await settingsStorage.save({ ...settings, sickMode: true });
    const sd = await sickModeStorage.get();
    await sickModeStorage.save({ ...sd, active: true, startedAt: new Date().toISOString() });
    setShowFeverAlert(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onActivateSickMode?.();
  };

  const handleDelete = async (s: Symptom) => {
    if (Platform.OS === "web") { await symptomStorage.delete(s.id); loadData(); return; }
    Alert.alert("Remove", `Remove ${s.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await symptomStorage.delete(s.id); loadData(); } },
    ]);
  };

  const sevColor = (sev: number) => sev >= 4 ? C.red : sev >= 3 ? C.orange : sev >= 2 ? C.yellow : C.green;
  const sevLabel = (sev: number) => ["Mild", "Low", "Moderate", "High", "Severe"][sev - 1];

  const todaySymptoms = symptoms.filter((s) => s.date === today);
  const recentSymptoms = symptoms.filter((s) => s.date !== today && s.date >= getDaysAgo(7));

  const frequencyMap: Record<string, number> = {};
  symptoms.filter(s => s.date >= getDaysAgo(30)).forEach(s => { frequencyMap[s.name] = (frequencyMap[s.name] || 0) + 1; });
  const topFrequent = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

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
            <Text style={styles.title}>Symptoms</Text>
            <Text style={styles.subtitle}>{todaySymptoms.length} today</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        {todaySymptoms.length === 0 && recentSymptoms.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="pulse-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No symptoms recorded</Text>
            <Text style={styles.emptyDesc}>Tap + to log a symptom</Text>
          </View>
        )}

        {todaySymptoms.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionLabel}>Today</Text>
            {todaySymptoms.map((s) => (
              <View key={s.id} style={styles.symptomCard}>
                <View style={[styles.sevBar, { backgroundColor: sevColor(s.severity) }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.symptomName}>{s.name}</Text>
                    {s.name === "Fever" && s.temperature && (
                      <View style={[styles.tempBadge, s.temperature >= 100 && styles.tempBadgeHigh]}>
                        <Text style={[styles.tempBadgeText, s.temperature >= 100 && { color: C.red }]}>{s.temperature}°F</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.sevText, { color: sevColor(s.severity) }]}>{sevLabel(s.severity)}</Text>
                  {!!s.notes && <Text style={styles.symptomNotes}>{s.notes}</Text>}
                </View>
                <Pressable onPress={() => handleDelete(s)} hitSlop={12}>
                  <Ionicons name="close-circle-outline" size={18} color={C.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {topFrequent.length > 0 && (
          <View style={[styles.card, { marginBottom: 20 }]}>
            <Text style={styles.cardTitle}>Most Frequent (30d)</Text>
            {topFrequent.map(([name, count]) => (
              <View key={name} style={styles.freqRow}>
                <Text style={styles.freqName}>{name}</Text>
                <View style={styles.freqBarOuter}>
                  <View style={[styles.freqBarInner, { width: `${(count / topFrequent[0][1]) * 100}%` }]} />
                </View>
                <Text style={styles.freqCount}>{count}</Text>
              </View>
            ))}
          </View>
        )}

        {recentSymptoms.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>Recent</Text>
            {recentSymptoms.slice(0, 10).map((s) => (
              <View key={s.id} style={styles.recentCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName}>{s.name}</Text>
                  <Text style={styles.recentDate}>{getRelativeDay(s.date)}</Text>
                </View>
                <View style={[styles.sevBadge, { backgroundColor: sevColor(s.severity) + "22" }]}>
                  <Text style={[styles.sevBadgeText, { color: sevColor(s.severity) }]}>{sevLabel(s.severity)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Log Symptom</Text>
            <Text style={styles.label}>Select or type a symptom</Text>
            <View style={styles.chipGrid}>
              {COMMON_SYMPTOMS.map((s) => (
                <Pressable key={s} style={[styles.chip, selectedSymptom === s && { backgroundColor: C.tintLight, borderColor: C.tint }]} onPress={() => { setSelectedSymptom(selectedSymptom === s ? "" : s); setCustomSymptom(""); Haptics.selectionAsync(); }}>
                  <Text style={[styles.chipText, selectedSymptom === s && { color: C.tint }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="Or type custom symptom" placeholderTextColor={C.textTertiary} value={customSymptom} onChangeText={(t) => { setCustomSymptom(t); setSelectedSymptom(""); }} />

            {isFeverSelected && (
              <View style={styles.feverInputWrap}>
                <View style={styles.feverInputRow}>
                  <Text style={{ fontSize: 20 }}>🌡️</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Temperature (°F)"
                    placeholderTextColor={C.textTertiary}
                    value={feverTemp}
                    onChangeText={setFeverTemp}
                    keyboardType="decimal-pad"
                  />
                </View>
                {feverTemp && parseFloat(feverTemp) >= 100 && (
                  <View style={styles.feverWarning}>
                    <Ionicons name="warning" size={14} color={C.red} />
                    <Text style={styles.feverWarningText}>High fever — stress dose may be needed</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.label}>Severity</Text>
            <View style={styles.sevPicker}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable key={i} style={[styles.sevPickBtn, severity === i && { backgroundColor: sevColor(i) + "22", borderColor: sevColor(i) }]} onPress={() => { setSeverity(i); Haptics.selectionAsync(); }}>
                  <Text style={[styles.sevPickNum, severity === i && { color: sevColor(i) }]}>{i}</Text>
                  <Text style={[styles.sevPickLabel, severity === i && { color: sevColor(i) }]}>{sevLabel(i)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Additional details..." placeholderTextColor={C.textTertiary} value={notes} onChangeText={setNotes} multiline textAlignVertical="top" />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirmBtn, !(selectedSymptom || customSymptom.trim()) && { opacity: 0.5 }]} onPress={handleAdd} disabled={!(selectedSymptom || customSymptom.trim())}><Text style={styles.confirmText}>Log</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showFeverAlert} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.feverAlertCard}>
            <View style={styles.feverAlertIcon}>
              <Ionicons name="warning" size={28} color={C.red} />
            </View>
            <Text style={styles.feverAlertTitle}>Stress dose recommended</Text>
            <Text style={styles.feverAlertDesc}>A temperature of 100°F or higher was recorded. Activating Sick Mode will triple your Hydrocortisone dose and start the recovery protocol.</Text>
            <Pressable style={styles.feverAlertBtn} onPress={handleActivateSickMode}>
              <Ionicons name="shield" size={18} color="#fff" />
              <Text style={styles.feverAlertBtnText}>Activate Sick Mode</Text>
            </Pressable>
            <Pressable style={styles.feverAlertDismiss} onPress={() => setShowFeverAlert(false)}>
              <Text style={styles.feverAlertDismissText}>Not now</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.orange, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 8 },
  emptyDesc: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  sectionLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  symptomCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, gap: 12 },
  sevBar: { width: 3, height: 36, borderRadius: 2, marginTop: 2 },
  symptomName: { fontWeight: "600", fontSize: 14, color: C.text },
  sevText: { fontWeight: "500", fontSize: 12, marginTop: 2 },
  symptomNotes: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 4 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontWeight: "600", fontSize: 14, color: C.text, marginBottom: 14 },
  freqRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  freqName: { fontWeight: "500", fontSize: 13, color: C.text, width: 100 },
  freqBarOuter: { flex: 1, height: 6, backgroundColor: C.surfaceElevated, borderRadius: 3, overflow: "hidden" },
  freqBarInner: { height: "100%", backgroundColor: C.orange, borderRadius: 3 },
  freqCount: { fontWeight: "600", fontSize: 12, color: C.textSecondary, width: 20, textAlign: "right" },
  recentCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  recentName: { fontWeight: "500", fontSize: 13, color: C.text },
  recentDate: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sevBadgeText: { fontWeight: "600", fontSize: 11 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: C.border, maxHeight: "90%" },
  modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
  chipText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  sevPicker: { flexDirection: "row", gap: 6, marginBottom: 14 },
  sevPickBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
  sevPickNum: { fontWeight: "700", fontSize: 16, color: C.textSecondary },
  sevPickLabel: { fontWeight: "400", fontSize: 9, color: C.textTertiary, marginTop: 2 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
  cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.orange, alignItems: "center" },
  confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  feverInputWrap: { marginBottom: 14, gap: 8 },
  feverInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  feverWarning: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.redLight, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "rgba(255,69,58,0.25)" },
  feverWarningText: { fontWeight: "500", fontSize: 12, color: C.red },
  tempBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: C.orangeLight },
  tempBadgeHigh: { backgroundColor: C.redLight },
  tempBadgeText: { fontWeight: "600", fontSize: 11, color: C.orange },
  feverAlertCard: { backgroundColor: C.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: "rgba(255,69,58,0.3)", alignItems: "center" },
  feverAlertIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.redLight, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  feverAlertTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 8 },
  feverAlertDesc: { fontWeight: "400", fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  feverAlertBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.red, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: "100%" },
  feverAlertBtnText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  feverAlertDismiss: { paddingVertical: 12 },
  feverAlertDismissText: { fontWeight: "500", fontSize: 13, color: C.textTertiary },
});
