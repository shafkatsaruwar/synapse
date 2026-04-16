import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Modal, Alert, Image, KeyboardAvoidingView } from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { conditionStorage, healthProfileStorage, settingsStorage, type HealthProfileInfo, type SurgeryRecord, type VaccineRecord } from "@/lib/storage";
import { syncAllFromSettings } from "@/lib/notification-manager";

interface HealthProfileScreenProps {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

const EMPTY_PROFILE: HealthProfileInfo = {
  userRole: "self",
  widgetAppearance: "system",
  backupCriticalMedications: [],
  vaccines: [],
  surgeries: [],
};

export default function HealthProfileScreen({ onBack, onNavigate }: HealthProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [conditionsCount, setConditionsCount] = useState(0);
  const [profile, setProfile] = useState<HealthProfileInfo>(EMPTY_PROFILE);
  const [nameText, setNameText] = useState("");
  const [nameSaved, setNameSaved] = useState(true);
  const [ageText, setAgeText] = useState("");
  const [ageSaved, setAgeSaved] = useState(true);
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [showSurgeryModal, setShowSurgeryModal] = useState(false);
  const [vaccineName, setVaccineName] = useState("");
  const [vaccineDate, setVaccineDate] = useState("");
  const [vaccineLocation, setVaccineLocation] = useState("");
  const [vaccineLotNumber, setVaccineLotNumber] = useState("");
  const [vaccineRecordImageUri, setVaccineRecordImageUri] = useState("");
  const [surgeryProcedure, setSurgeryProcedure] = useState("");
  const [surgeryEstimatedWhen, setSurgeryEstimatedWhen] = useState("");
  const [surgeryLocation, setSurgeryLocation] = useState("");

  const loadData = useCallback(async () => {
    const [conds, nextProfile, settings] = await Promise.all([
      conditionStorage.getAll(),
      healthProfileStorage.get(),
      settingsStorage.get(),
    ]);
    setConditionsCount(conds.length);
    setProfile(nextProfile);
    setNameText(settings.name ?? "");
    setAgeText(nextProfile.age != null ? String(nextProfile.age) : "");
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const persistProfile = async (nextProfile: HealthProfileInfo) => {
    setProfile(nextProfile);
    await healthProfileStorage.save(nextProfile);
    await syncAllFromSettings().catch(() => {});
  };

  const handleSaveName = async () => {
    const trimmed = nameText.trim();
    const settings = await settingsStorage.get();
    await settingsStorage.save({ ...settings, name: trimmed || settings.name || "You" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNameSaved(true);
  };

  const handleSaveAge = async () => {
    const parsed = ageText.trim() === "" ? undefined : parseInt(ageText, 10);
    const nextProfile = { ...profile, age: Number.isNaN(parsed as number) ? undefined : parsed };
    await persistProfile(nextProfile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAgeSaved(true);
  };

  const resetVaccineForm = () => {
    setVaccineName("");
    setVaccineDate("");
    setVaccineLocation("");
    setVaccineLotNumber("");
    setVaccineRecordImageUri("");
  };

  const resetSurgeryForm = () => {
    setSurgeryProcedure("");
    setSurgeryEstimatedWhen("");
    setSurgeryLocation("");
  };

  const handlePickVaccineImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Please allow photo library access to attach a vaccine record photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    setVaccineRecordImageUri(result.assets[0].uri);
    Haptics.selectionAsync();
  };

  const handleAddVaccine = async () => {
    if (!vaccineName.trim() || !vaccineDate.trim()) return;
    const nextVaccines: VaccineRecord[] = [
      {
        id: `${Date.now()}`,
        vaccine: vaccineName.trim(),
        receivedAt: vaccineDate.trim(),
        location: vaccineLocation.trim() || undefined,
        lotNumber: vaccineLotNumber.trim() || undefined,
        recordImageUri: vaccineRecordImageUri || undefined,
      },
      ...(profile.vaccines ?? []),
    ];
    await persistProfile({ ...profile, vaccines: nextVaccines });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetVaccineForm();
    setShowVaccineModal(false);
  };

  const handleDeleteVaccine = async (id: string) => {
    const nextVaccines = (profile.vaccines ?? []).filter((item) => item.id !== id);
    await persistProfile({ ...profile, vaccines: nextVaccines });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAddSurgery = async () => {
    if (!surgeryProcedure.trim() || !surgeryEstimatedWhen.trim()) return;
    const nextSurgeries: SurgeryRecord[] = [
      {
        id: `${Date.now()}`,
        procedure: surgeryProcedure.trim(),
        estimatedWhen: surgeryEstimatedWhen.trim(),
        location: surgeryLocation.trim() || undefined,
      },
      ...(profile.surgeries ?? []),
    ];
    await persistProfile({ ...profile, surgeries: nextSurgeries });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetSurgeryForm();
    setShowSurgeryModal(false);
  };

  const handleDeleteSurgery = async (id: string) => {
    const nextSurgeries = (profile.surgeries ?? []).filter((item) => item.id !== id);
    await persistProfile({ ...profile, surgeries: nextSurgeries });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const vaccineSummary = (profile.vaccines ?? []).length > 0
    ? `${profile.vaccines!.length} vaccine${profile.vaccines!.length === 1 ? "" : "s"} recorded`
    : "No vaccines added yet";
  const surgerySummary = (profile.surgeries ?? []).length > 0
    ? `${profile.surgeries!.length} surger${profile.surgeries!.length === 1 ? "y" : "ies"} recorded`
    : "No surgeries added yet";

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to Settings">
          <Ionicons name="arrow-back" size={22} color={C.text} />
          <Text style={styles.backText}>Settings</Text>
        </Pressable>

        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Name, age, conditions, allergies, vaccines, surgeries, and emergency info</Text>

        <View style={styles.ageCard}>
          <Text style={styles.ageLabel}>Name</Text>
          <TextInput
            style={styles.ageInput}
            value={nameText}
            onChangeText={(t) => {
              setNameText(t);
              setNameSaved(false);
            }}
            placeholder="What should we call you?"
            placeholderTextColor={C.textTertiary}
            accessibilityLabel="Name"
            autoCapitalize="words"
          />
          <Pressable
            style={({ pressed }) => [styles.ageSaveBtn, nameSaved && styles.ageSaveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSaveName}
            accessibilityRole="button"
            accessibilityLabel={nameSaved ? "Name saved" : "Save name"}
          >
            <Ionicons name={nameSaved ? "checkmark-circle" : "save-outline"} size={16} color="#fff" />
            <Text style={styles.ageSaveBtnText}>{nameSaved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        <View style={styles.blockSpacer} />

        <View style={styles.ageCard}>
          <Text style={styles.ageLabel}>Age</Text>
          <TextInput
            style={styles.ageInput}
            value={ageText}
            onChangeText={(t) => {
              setAgeText(t.replace(/[^0-9]/g, ""));
              setAgeSaved(false);
            }}
            keyboardType="number-pad"
            placeholder="Enter your age"
            placeholderTextColor={C.textTertiary}
            maxLength={3}
            accessibilityLabel="Age"
          />
          <Pressable
            style={({ pressed }) => [styles.ageSaveBtn, ageSaved && styles.ageSaveBtnSaved, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSaveAge}
            accessibilityRole="button"
            accessibilityLabel={ageSaved ? "Age saved" : "Save age"}
          >
            <Ionicons name={ageSaved ? "checkmark-circle" : "save-outline"} size={16} color="#fff" />
            <Text style={styles.ageSaveBtnText}>{ageSaved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        <View style={styles.blockSpacer} />

        <View style={styles.card}>
          <Pressable
            style={styles.profileRow}
            onPress={() => {
              Haptics.selectionAsync();
              onNavigate("healthprofileconditions");
            }}
            accessibilityRole="button"
            accessibilityLabel={`Conditions, ${conditionsCount} added`}
          >
            <View style={[styles.profileIcon, { backgroundColor: C.tintLight }]}>
              <Ionicons name="clipboard-outline" size={16} color={C.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileRowTitle}>Conditions</Text>
              <Text style={styles.profileRowDesc}>
                {conditionsCount > 0 ? `${conditionsCount} condition${conditionsCount !== 1 ? "s" : ""} added` : "None added yet"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.profileRow}
            onPress={() => {
              Haptics.selectionAsync();
              onNavigate("allergy");
            }}
            accessibilityRole="button"
            accessibilityLabel="Allergy and emergency info"
          >
            <View style={[styles.profileIcon, { backgroundColor: C.orangeLight }]}>
              <Ionicons name="warning-outline" size={16} color={C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileRowTitle}>Allergy & Emergency Info</Text>
              <Text style={styles.profileRowDesc}>Allergies, EpiPen, emergency details</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.blockSpacer} />

        <View style={styles.card}>
          <Pressable
            style={styles.profileRow}
            onPress={() => {
              Haptics.selectionAsync();
              setShowVaccineModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Vaccines"
          >
            <View style={[styles.profileIcon, { backgroundColor: C.tintLight }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={C.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileRowTitle}>Vaccines</Text>
              <Text style={styles.profileRowDesc}>{vaccineSummary}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.profileRow}
            onPress={() => {
              Haptics.selectionAsync();
              setShowSurgeryModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Surgeries"
          >
            <View style={[styles.profileIcon, { backgroundColor: C.orangeLight }]}>
              <Ionicons name="bandage-outline" size={16} color={C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileRowTitle}>Surgeries</Text>
              <Text style={styles.profileRowDesc}>{surgerySummary}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={showVaccineModal} transparent animationType="fade" onRequestClose={() => setShowVaccineModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.overlay} onPress={() => { setShowVaccineModal(false); resetVaccineForm(); }}>
            <Pressable style={styles.modal} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Vaccines</Text>
                  <Pressable style={styles.recordAddBtn} onPress={resetVaccineForm} accessibilityRole="button" accessibilityLabel="Clear vaccine form">
                    <Ionicons name="add" size={18} color="#fff" />
                  </Pressable>
                </View>
                {(profile.vaccines ?? []).length > 0 && (
                  <View style={styles.modalRecordList}>
                    {(profile.vaccines ?? []).map((item) => (
                      <View key={item.id} style={styles.modalRecordRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalRecordTitle}>{item.vaccine}</Text>
                          <Text style={styles.modalRecordText}>
                            {item.receivedAt}
                            {item.location ? ` • ${item.location}` : ""}
                            {item.lotNumber ? ` • Lot ${item.lotNumber}` : ""}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleDeleteVaccine(item.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete ${item.vaccine}`}>
                          <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.modalSectionLabel}>Add vaccine</Text>
                <Text style={styles.ageLabel}>Vaccine *</Text>
                <TextInput style={styles.modalInput} value={vaccineName} onChangeText={setVaccineName} placeholder="e.g. COVID-19 booster" placeholderTextColor={C.textTertiary} />
                <Text style={styles.ageLabel}>Date taken *</Text>
                <TextInput style={styles.modalInput} value={vaccineDate} onChangeText={setVaccineDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.textTertiary} />
                <Text style={styles.ageLabel}>Where taken</Text>
                <TextInput style={styles.modalInput} value={vaccineLocation} onChangeText={setVaccineLocation} placeholder="Clinic, pharmacy, hospital..." placeholderTextColor={C.textTertiary} />
                <Text style={styles.ageLabel}>Lot number</Text>
                <TextInput style={styles.modalInput} value={vaccineLotNumber} onChangeText={setVaccineLotNumber} placeholder="If you have it" placeholderTextColor={C.textTertiary} />
                <Text style={styles.ageLabel}>Vaccine record photo</Text>
                <Pressable style={styles.imagePickerBtn} onPress={handlePickVaccineImage} accessibilityRole="button" accessibilityLabel="Attach vaccine record photo">
                  <Ionicons name="image-outline" size={18} color={C.purple} />
                  <Text style={styles.imagePickerText}>{vaccineRecordImageUri ? "Change photo" : "Attach photo"}</Text>
                </Pressable>
                {vaccineRecordImageUri ? <Image source={{ uri: vaccineRecordImageUri }} style={styles.modalImagePreview} /> : null}
                <View style={styles.modalActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => { setShowVaccineModal(false); resetVaccineForm(); }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmBtn, (!vaccineName.trim() || !vaccineDate.trim()) && { opacity: 0.5 }]} onPress={handleAddVaccine} disabled={!vaccineName.trim() || !vaccineDate.trim()}>
                    <Text style={styles.confirmText}>Save</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showSurgeryModal} transparent animationType="fade" onRequestClose={() => setShowSurgeryModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.overlay} onPress={() => { setShowSurgeryModal(false); resetSurgeryForm(); }}>
            <Pressable style={styles.modal} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Surgeries</Text>
                  <Pressable style={styles.recordAddBtn} onPress={resetSurgeryForm} accessibilityRole="button" accessibilityLabel="Clear surgery form">
                    <Ionicons name="add" size={18} color="#fff" />
                  </Pressable>
                </View>
                {(profile.surgeries ?? []).length > 0 && (
                  <View style={styles.modalRecordList}>
                    {(profile.surgeries ?? []).map((item) => (
                      <View key={item.id} style={styles.modalRecordRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalRecordTitle}>{item.procedure}</Text>
                          <Text style={styles.modalRecordText}>
                            {item.estimatedWhen}
                            {item.location ? ` • ${item.location}` : ""}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleDeleteSurgery(item.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete ${item.procedure}`}>
                          <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.modalSectionLabel}>Add surgery</Text>
                <Text style={styles.ageLabel}>What was done? *</Text>
                <TextInput style={styles.modalInput} value={surgeryProcedure} onChangeText={setSurgeryProcedure} placeholder="e.g. Appendectomy" placeholderTextColor={C.textTertiary} />
                <Text style={styles.ageLabel}>Estimated when? *</Text>
                <TextInput style={styles.modalInput} value={surgeryEstimatedWhen} onChangeText={setSurgeryEstimatedWhen} placeholder="e.g. Summer 2022" placeholderTextColor={C.textTertiary} />
                <Text style={styles.ageLabel}>Where</Text>
                <TextInput style={styles.modalInput} value={surgeryLocation} onChangeText={setSurgeryLocation} placeholder="Hospital or clinic" placeholderTextColor={C.textTertiary} />
                <View style={styles.modalActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => { setShowSurgeryModal(false); resetSurgeryForm(); }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmBtn, (!surgeryProcedure.trim() || !surgeryEstimatedWhen.trim()) && { opacity: 0.5 }]} onPress={handleAddSurgery} disabled={!surgeryProcedure.trim() || !surgeryEstimatedWhen.trim()}>
                    <Text style={styles.confirmText}>Save</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
    backText: { fontWeight: "600", fontSize: 15, color: C.text },
    title: { fontWeight: "700", fontSize: 26, color: C.text, letterSpacing: -0.5, marginBottom: 8 },
    subtitle: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 24 },
    card: { backgroundColor: C.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
    recordAddBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.purple, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    profileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    profileRowTitle: { fontWeight: "600", fontSize: 15, color: C.text },
    profileRowDesc: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
    divider: { height: 1, backgroundColor: C.border, marginLeft: 16, marginRight: 16 },
    ageCard: { backgroundColor: C.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border },
    ageLabel: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 8 },
    ageInput: { fontWeight: "400", fontSize: 16, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
    ageSaveBtn: { backgroundColor: C.tint, borderRadius: 10, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    ageSaveBtnSaved: { backgroundColor: C.green },
    ageSaveBtnText: { fontWeight: "600", fontSize: 14, color: "#fff" },
    blockSpacer: { height: 12 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
    modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 420, maxHeight: "88%", borderWidth: 1, borderColor: C.border },
    modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
    modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
    modalSectionLabel: { fontWeight: "700", fontSize: 12, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12, marginTop: 4 },
    modalInput: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
    modalRecordList: { marginBottom: 16, gap: 10 },
    modalRecordRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: C.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12 },
    modalRecordTitle: { fontWeight: "600", fontSize: 14, color: C.text },
    modalRecordText: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 4, lineHeight: 18 },
    imagePickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, marginBottom: 14 },
    imagePickerText: { fontWeight: "600", fontSize: 13, color: C.purple },
    modalImagePreview: { width: "100%", height: 180, borderRadius: 14, marginBottom: 14, backgroundColor: C.surfaceElevated },
    modalActions: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
    cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
    confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.purple, alignItems: "center" },
    confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  });
}
