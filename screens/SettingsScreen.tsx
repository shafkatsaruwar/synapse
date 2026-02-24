import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { settingsStorage, vitalStorage, allergyStorage, clearAllData, type UserSettings, type Vital, type AllergyInfo } from "@/lib/storage";

const C = Colors.dark;

const COMMON_CONDITIONS = [
  "Diabetes", "Hypertension", "Asthma", "Arthritis", "IBS",
  "Thyroid", "Migraine", "PCOS", "Heart Disease", "Anemia",
  "Chronic Fatigue", "Fibromyalgia",
];

interface SettingsScreenProps {
  onResetApp?: () => void;
}

export default function SettingsScreen({ onResetApp }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [saved, setSaved] = useState(true);
  const [showVitalModal, setShowVitalModal] = useState(false);
  const [vitalType, setVitalType] = useState("");
  const [vitalValue, setVitalValue] = useState("");
  const [vitalUnit, setVitalUnit] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [allergy, setAllergy] = useState<AllergyInfo>({
    hasAllergies: false, allergyName: "", reactionDescription: "",
    hasEpiPen: false, primaryEpiPenLocation: "", backupEpiPenLocation: "",
    noTreatmentConsequence: "",
  });
  const [allergySaved, setAllergySaved] = useState(true);

  const handleResetApp = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await clearAllData();
    setShowResetConfirm(false);
    if (onResetApp) onResetApp();
  };

  const loadData = useCallback(async () => {
    const [s, v, a] = await Promise.all([settingsStorage.get(), vitalStorage.getAll(), allergyStorage.get()]);
    setSettings(s);
    setVitals(v.sort((a, b) => b.date.localeCompare(a.date)));
    setAllergy(a);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    await Promise.all([settingsStorage.save(settings), allergyStorage.save(allergy)]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setAllergySaved(true);
  };

  const toggleCondition = (c: string) => {
    setSettings((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(c) ? prev.conditions.filter((x) => x !== c) : [...prev.conditions, c],
    }));
    setSaved(false);
    Haptics.selectionAsync();
  };

  const handleAddVital = async () => {
    if (!vitalType.trim() || !vitalValue.trim()) return;
    const today = new Date().toISOString().split("T")[0];
    await vitalStorage.save({ date: today, type: vitalType.trim(), value: vitalValue.trim(), unit: vitalUnit.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setVitalType(""); setVitalValue(""); setVitalUnit("");
    setShowVitalModal(false);
    loadData();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, {
        paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
        paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
      }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Text style={styles.label}>Your Name</Text>
          <TextInput style={styles.input} placeholder="Enter your name" placeholderTextColor={C.textTertiary} value={settings.name} onChangeText={(t) => { setSettings((p) => ({ ...p, name: t })); setSaved(false); }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Conditions</Text>
          <Text style={styles.desc}>Select any conditions you manage</Text>
          <View style={styles.chipGrid}>
            {COMMON_CONDITIONS.map((c) => (
              <Pressable key={c} style={[styles.chip, settings.conditions.includes(c) && { backgroundColor: C.tintLight, borderColor: C.tint }]} onPress={() => toggleCondition(c)} accessibilityRole="button" accessibilityLabel={c} accessibilityState={{ selected: settings.conditions.includes(c) }}>
                <Text style={[styles.chipText, settings.conditions.includes(c) && { color: C.tint }]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={styles.card}
          testID="ramadan-mode-toggle"
          onPress={() => { setSettings((p) => ({ ...p, ramadanMode: !p.ramadanMode })); setSaved(false); Haptics.selectionAsync(); }}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.ramadanMode }}
        >
          <View style={styles.toggleHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Ramadan Mode</Text>
              <Text style={styles.desc}>Enable fasting tracking with suhoor/iftar</Text>
            </View>
            <View style={[styles.toggle, settings.ramadanMode && styles.toggleActive]}>
              <View style={[styles.toggleThumb, settings.ramadanMode && styles.toggleThumbActive]} />
            </View>
          </View>
        </Pressable>

        <Pressable
          style={styles.card}
          testID="high-contrast-toggle"
          onPress={() => { setSettings((p) => ({ ...p, highContrast: !p.highContrast })); setSaved(false); Haptics.selectionAsync(); }}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!settings.highContrast }}
        >
          <View style={styles.toggleHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>High Contrast</Text>
              <Text style={styles.desc}>Increase contrast for better readability</Text>
            </View>
            <View style={[styles.toggle, settings.highContrast && styles.toggleActive]}>
              <View style={[styles.toggleThumb, settings.highContrast && styles.toggleThumbActive]} />
            </View>
          </View>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.vitalsHeader}>
            <Text style={styles.sectionTitle}>Vitals</Text>
            <Pressable style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => setShowVitalModal(true)} accessibilityRole="button" accessibilityLabel="Add vital" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="add" size={18} color="#fff" />
            </Pressable>
          </View>
          {vitals.length === 0 && <Text style={styles.emptyText}>No vitals recorded. Tap + to add.</Text>}
          {vitals.slice(0, 10).map((v) => (
            <View key={v.id} style={styles.vitalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vitalType}>{v.type}</Text>
                <Text style={styles.vitalDate}>{v.date}</Text>
              </View>
              <Text style={styles.vitalValue}>{v.value} {v.unit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Allergy & Emergency Info</Text>
          <Text style={styles.desc}>Important information for emergencies</Text>

          <Pressable
            style={styles.toggleHeader}
            onPress={() => { setAllergy((p) => ({ ...p, hasAllergies: !p.hasAllergies })); setSaved(false); setAllergySaved(false); Haptics.selectionAsync(); }}
            accessibilityRole="switch"
            accessibilityState={{ checked: allergy.hasAllergies }}
          >
            <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>Do you have allergies?</Text>
            <View style={[styles.toggle, allergy.hasAllergies && styles.toggleActive]}>
              <View style={[styles.toggleThumb, allergy.hasAllergies && styles.toggleThumbActive]} />
            </View>
          </Pressable>

          {allergy.hasAllergies && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.label}>Allergy Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Peanuts, Penicillin"
                placeholderTextColor={C.textTertiary}
                value={allergy.allergyName}
                onChangeText={(t) => { setAllergy((p) => ({ ...p, allergyName: t })); setSaved(false); setAllergySaved(false); }}
                accessibilityLabel="Allergy name"
              />
              <View style={{ height: 12 }} />
              <Text style={styles.label}>Reaction Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
                placeholder="Describe the allergic reaction"
                placeholderTextColor={C.textTertiary}
                value={allergy.reactionDescription}
                onChangeText={(t) => { setAllergy((p) => ({ ...p, reactionDescription: t })); setSaved(false); setAllergySaved(false); }}
                multiline
                accessibilityLabel="Reaction description"
              />
            </View>
          )}

          <View style={{ height: 16 }} />

          <Pressable
            style={styles.toggleHeader}
            onPress={() => { setAllergy((p) => ({ ...p, hasEpiPen: !p.hasEpiPen })); setSaved(false); setAllergySaved(false); Haptics.selectionAsync(); }}
            accessibilityRole="switch"
            accessibilityState={{ checked: allergy.hasEpiPen }}
          >
            <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>Do you carry an EpiPen?</Text>
            <View style={[styles.toggle, allergy.hasEpiPen && styles.toggleActive]}>
              <View style={[styles.toggleThumb, allergy.hasEpiPen && styles.toggleThumbActive]} />
            </View>
          </Pressable>

          {allergy.hasEpiPen && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.label}>Primary EpiPen Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Left pocket, backpack"
                placeholderTextColor={C.textTertiary}
                value={allergy.primaryEpiPenLocation}
                onChangeText={(t) => { setAllergy((p) => ({ ...p, primaryEpiPenLocation: t })); setSaved(false); setAllergySaved(false); }}
                accessibilityLabel="Primary EpiPen location"
              />
              <View style={{ height: 12 }} />
              <Text style={styles.label}>Backup EpiPen Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Car glove box, office desk"
                placeholderTextColor={C.textTertiary}
                value={allergy.backupEpiPenLocation}
                onChangeText={(t) => { setAllergy((p) => ({ ...p, backupEpiPenLocation: t })); setSaved(false); setAllergySaved(false); }}
                accessibilityLabel="Backup EpiPen location"
              />
            </View>
          )}

          <View style={{ height: 16 }} />
          <Text style={styles.label}>What happens if no treatment is given?</Text>
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
            placeholder="Describe consequences of no treatment"
            placeholderTextColor={C.textTertiary}
            value={allergy.noTreatmentConsequence}
            onChangeText={(t) => { setAllergy((p) => ({ ...p, noTreatmentConsequence: t })); setSaved(false); setAllergySaved(false); }}
            multiline
            accessibilityLabel="Consequences of no treatment"
          />
        </View>

        <Pressable style={({ pressed }) => [styles.saveBtn, (saved && allergySaved) && styles.saveBtnSaved, { opacity: pressed ? 0.85 : 1 }]} onPress={handleSave} accessibilityRole="button" accessibilityLabel={(saved && allergySaved) ? "Settings saved" : "Save settings"}>
          <Ionicons name={(saved && allergySaved) ? "checkmark-circle" : "save-outline"} size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{(saved && allergySaved) ? "Saved" : "Save Settings"}</Text>
        </Pressable>

        {onResetApp && (
          <Pressable
            style={({ pressed }) => [styles.resetAppBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => setShowResetConfirm(true)}
            testID="reset-app"
            accessibilityRole="button"
            accessibilityLabel="Reset app"
            accessibilityHint="Erases all data and returns to onboarding"
          >
            <Ionicons name="trash-outline" size={16} color={C.red} />
            <Text style={styles.resetAppText}>Reset App</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={showVitalModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowVitalModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Vital</Text>
            <Text style={styles.label}>Type</Text>
            <TextInput style={styles.modalInput} placeholder="e.g. Blood Pressure, Weight" placeholderTextColor={C.textTertiary} value={vitalType} onChangeText={setVitalType} />
            <View style={styles.fieldRow}>
              <View style={{ flex: 2 }}><Text style={styles.label}>Value</Text><TextInput style={styles.modalInput} placeholder="120/80" placeholderTextColor={C.textTertiary} value={vitalValue} onChangeText={setVitalValue} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Unit</Text><TextInput style={styles.modalInput} placeholder="mmHg" placeholderTextColor={C.textTertiary} value={vitalUnit} onChangeText={setVitalUnit} /></View>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowVitalModal(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirmBtn, (!vitalType.trim() || !vitalValue.trim()) && { opacity: 0.5 }]} onPress={handleAddVital} disabled={!vitalType.trim() || !vitalValue.trim()}><Text style={styles.confirmText}>Add</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showResetConfirm} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowResetConfirm(false)}>
          <Pressable style={styles.resetModal} onPress={() => {}}>
            <Text style={styles.resetEmoji}>⚠️</Text>
            <Text style={styles.resetTitle}>Are you sure?</Text>
            <Text style={styles.resetDesc}>This will delete all your data.</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowResetConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.resetConfirmBtn} onPress={handleResetApp}>
                <Text style={styles.resetConfirmText}>Reset</Text>
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
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 24 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  sectionTitle: { fontWeight: "600", fontSize: 15, color: C.text, marginBottom: 4 },
  desc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginBottom: 14 },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated },
  chipText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  toggleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.surfaceElevated, justifyContent: "center", paddingHorizontal: 3 },
  toggleActive: { backgroundColor: C.tint },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  toggleThumbActive: { alignSelf: "flex-end" },
  vitalsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  addBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.cyan, alignItems: "center", justifyContent: "center" },
  emptyText: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  vitalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  vitalType: { fontWeight: "500", fontSize: 13, color: C.text },
  vitalDate: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  vitalValue: { fontWeight: "600", fontSize: 14, color: C.text },
  saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  saveBtnSaved: { backgroundColor: C.green },
  saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 380, borderWidth: 1, borderColor: C.border },
  modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
  modalInput: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  fieldRow: { flexDirection: "row", gap: 10 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
  cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.cyan, alignItems: "center" },
  confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  resetAppBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.red + "30" },
  resetAppText: { fontWeight: "500", fontSize: 14, color: C.red },
  resetModal: { backgroundColor: C.surface, borderRadius: 22, padding: 28, width: "100%", maxWidth: 320, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  resetEmoji: { fontSize: 56, marginBottom: 16 },
  resetTitle: { fontWeight: "700", fontSize: 20, color: C.text, marginBottom: 8, textAlign: "center" },
  resetDesc: { fontWeight: "400", fontSize: 15, color: C.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 22 },
  resetConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.red, alignItems: "center" },
  resetConfirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
});
