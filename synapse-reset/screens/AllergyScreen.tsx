import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { allergyStorage, type AllergyInfo } from "@/lib/storage";

const C = Colors.dark;

const DEFAULT_ALLERGY: AllergyInfo = {
  hasAllergies: false,
  allergyName: "",
  reactionDescription: "",
  hasEpiPen: false,
  primaryEpiPenLocation: "",
  backupEpiPenLocation: "",
  noTreatmentConsequence: "",
};

interface AllergyScreenProps {
  onBack: () => void;
}

export default function AllergyScreen({ onBack }: AllergyScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [allergy, setAllergy] = useState<AllergyInfo>({ ...DEFAULT_ALLERGY });
  const [saved, setSaved] = useState(true);

  const loadData = useCallback(async () => {
    const a = await allergyStorage.get();
    setAllergy(a);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    await allergyStorage.save(allergy);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topPad,
            paddingBottom: isWide ? 40 : Platform.OS === "web" ? 118 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to Health Profile">
          <Ionicons name="arrow-back" size={22} color={C.text} />
          <Text style={styles.backText}>Health Profile</Text>
        </Pressable>

        <Text style={styles.title}>Allergy & Emergency Info</Text>
        <Text style={styles.subtitle}>Important information for emergencies</Text>

        <View style={styles.card}>
          <Pressable
            style={styles.toggleHeader}
            onPress={() => {
              setAllergy((p) => ({ ...p, hasAllergies: !p.hasAllergies }));
              setSaved(false);
              Haptics.selectionAsync();
            }}
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
                onChangeText={(t) => {
                  setAllergy((p) => ({ ...p, allergyName: t }));
                  setSaved(false);
                }}
                accessibilityLabel="Allergy name"
              />
              <View style={{ height: 12 }} />
              <Text style={styles.label}>Reaction Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
                placeholder="Describe the allergic reaction"
                placeholderTextColor={C.textTertiary}
                value={allergy.reactionDescription}
                onChangeText={(t) => {
                  setAllergy((p) => ({ ...p, reactionDescription: t }));
                  setSaved(false);
                }}
                multiline
                accessibilityLabel="Reaction description"
              />
            </View>
          )}

          <View style={{ height: 16 }} />

          <Pressable
            style={styles.toggleHeader}
            onPress={() => {
              setAllergy((p) => ({ ...p, hasEpiPen: !p.hasEpiPen }));
              setSaved(false);
              Haptics.selectionAsync();
            }}
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
                onChangeText={(t) => {
                  setAllergy((p) => ({ ...p, primaryEpiPenLocation: t }));
                  setSaved(false);
                }}
                accessibilityLabel="Primary EpiPen location"
              />
              <View style={{ height: 12 }} />
              <Text style={styles.label}>Backup EpiPen Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Car glove box, office desk"
                placeholderTextColor={C.textTertiary}
                value={allergy.backupEpiPenLocation}
                onChangeText={(t) => {
                  setAllergy((p) => ({ ...p, backupEpiPenLocation: t }));
                  setSaved(false);
                }}
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
            onChangeText={(t) => {
              setAllergy((p) => ({ ...p, noTreatmentConsequence: t }));
              setSaved(false);
            }}
            multiline
            accessibilityLabel="Consequences of no treatment"
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, saved && styles.saveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Saved" : "Save"}
        >
          <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  backText: { fontWeight: "600", fontSize: 15, color: C.text },
  title: { fontWeight: "700", fontSize: 26, color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  toggleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.surfaceElevated, justifyContent: "center", paddingHorizontal: 3 },
  toggleActive: { backgroundColor: C.tint },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  toggleThumbActive: { alignSelf: "flex-end" },
  saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  saveBtnSaved: { backgroundColor: C.green },
  saveBtnText: { fontWeight: "600", fontSize: 15, color: "#fff" },
});
