import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Modal, Platform, Alert,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { doctorsStorage, emergencyDoctorStorage, primaryDoctorStorage, type Doctor } from "@/lib/storage";

interface DoctorsScreenProps {
  onBack: () => void;
}

export default function DoctorsScreen({ onBack }: DoctorsScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSpecialty, setAddSpecialty] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addHospital, setAddHospital] = useState("");
  const [emergencyDocId, setEmergencyDocId] = useState<string | null>(null);
  const [primaryDocId, setPrimaryDocId] = useState<string | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

  const loadDoctors = useCallback(async () => {
    const list = await doctorsStorage.getAll();
    setDoctors(list.sort((a, b) => a.name.localeCompare(b.name)));
    const [emergencyId, primaryId] = await Promise.all([
      emergencyDoctorStorage.getDocId(),
      primaryDoctorStorage.getDocId(),
    ]);
    setEmergencyDocId(emergencyId);
    setPrimaryDocId(primaryId);
  }, []);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);

  const handleSetEmergencyDoc = async (doc: Doctor) => {
    const newId = emergencyDocId === doc.id ? null : doc.id;
    await emergencyDoctorStorage.setDocId(newId);
    setEmergencyDocId(newId);
    Haptics.selectionAsync();
  };

  const handleSetPrimaryDoc = async (doc: Doctor) => {
    const newId = primaryDocId === doc.id ? null : doc.id;
    await primaryDoctorStorage.setDocId(newId);
    setPrimaryDocId(newId);
    Haptics.selectionAsync();
  };

  const resetDoctorForm = () => {
    setAddName("");
    setAddSpecialty("");
    setAddPhone("");
    setAddAddress("");
    setAddHospital("");
    setEditingDoctor(null);
  };

  const openAddModal = () => {
    resetDoctorForm();
    setShowAddModal(true);
  };

  const openEditModal = (doc: Doctor) => {
    setEditingDoctor(doc);
    setAddName(doc.name);
    setAddSpecialty(doc.specialty ?? "");
    setAddPhone(doc.phone ?? "");
    setAddAddress(doc.address ?? "");
    setAddHospital(doc.hospital ?? "");
    setShowAddModal(true);
  };

  const closeDoctorModal = () => {
    setShowAddModal(false);
    resetDoctorForm();
  };

  const handleSaveDoctor = async () => {
    const name = addName.trim();
    if (!name) return;
    const specialty = addSpecialty.trim() || undefined;
    const phone = addPhone.trim() || undefined;
    const address = addAddress.trim() || undefined;
    const hospital = addHospital.trim() || undefined;

    if (editingDoctor) {
      await doctorsStorage.update(editingDoctor.id, { name, specialty, phone, address, hospital });
    } else {
      await doctorsStorage.addOrGet({ name, specialty, phone, address, hospital });
    }

    await loadDoctors();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeDoctorModal();
  };

  const handleDelete = (doc: Doctor) => {
    if (Platform.OS === "web") {
      doctorsStorage.delete(doc.id).then(() => loadDoctors());
      return;
    }
    Alert.alert("Remove doctor", `Remove ${doc.name} from your list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await doctorsStorage.delete(doc.id);
          loadDoctors();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 16 }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Doctors</Text>
        <Pressable
          style={styles.addBtn}
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel="Add doctor"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.hint}>These doctors appear when you create an appointment. Add or remove names here.</Text>
        <Text style={styles.emergencyHint}>Tap the shield for your emergency doctor. Tap the person icon for your primary doctor.</Text>
        {doctors.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="medical-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyText}>No doctors yet</Text>
            <Text style={styles.emptySub}>Tap + to add a doctor</Text>
          </View>
        ) : (
          doctors.map((doc) => {
            const isEmergency = emergencyDocId === doc.id;
            const isPrimary = primaryDocId === doc.id;
            return (
              <Pressable
                key={doc.id}
                style={[styles.row, isEmergency && styles.rowEmergency, isPrimary && styles.rowPrimary]}
                onPress={() => openEditModal(doc)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${doc.name}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.doctorName}>{doc.name}</Text>
                  {doc.specialty ? <Text style={styles.doctorSpec}>{doc.specialty}</Text> : null}
                  {doc.hospital ? <Text style={styles.doctorMeta}>{doc.hospital}</Text> : null}
                  {doc.phone ? <Text style={styles.doctorMeta}>{doc.phone}</Text> : null}
                  {doc.address ? <Text style={styles.doctorMeta} numberOfLines={2}>{doc.address}</Text> : null}
                  {isEmergency && (
                    <View style={styles.emergencyBadge}>
                      <Ionicons name="shield-half" size={11} color={C.tint} />
                      <Text style={styles.emergencyBadgeText}>Emergency Doctor</Text>
                    </View>
                  )}
                  {isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Ionicons name="person" size={11} color={C.accent} />
                      <Text style={styles.primaryBadgeText}>Primary Doctor</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={(event) => { event.stopPropagation(); handleSetPrimaryDoc(doc); }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={isPrimary ? `Remove ${doc.name} as primary doctor` : `Set ${doc.name} as primary doctor`}
                  style={styles.primaryBtn}
                >
                  <Ionicons
                    name={isPrimary ? "person" : "person-outline"}
                    size={22}
                    color={isPrimary ? C.accent : C.textTertiary}
                  />
                </Pressable>
                <Pressable
                  onPress={(event) => { event.stopPropagation(); handleSetEmergencyDoc(doc); }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={isEmergency ? `Remove ${doc.name} as emergency doctor` : `Set ${doc.name} as emergency doctor`}
                  style={styles.emergencyBtn}
                >
                  <Ionicons
                    name={isEmergency ? "shield-half" : "shield-half-outline"}
                    size={22}
                    color={isEmergency ? C.tint : C.textTertiary}
                  />
                </Pressable>
                <Pressable onPress={(event) => { event.stopPropagation(); handleDelete(doc); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${doc.name}`}>
                  <Ionicons name="trash-outline" size={20} color={C.textTertiary} />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={closeDoctorModal}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>{editingDoctor ? "Edit doctor" : "Add doctor"}</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Dr. Smith"
              placeholderTextColor={C.textTertiary}
              value={addName}
              onChangeText={setAddName}
              autoFocus
            />
            <Text style={styles.label}>Specialty</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cardiologist"
              placeholderTextColor={C.textTertiary}
              value={addSpecialty}
              onChangeText={setAddSpecialty}
            />
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. (555) 123-4567"
              placeholderTextColor={C.textTertiary}
              value={addPhone}
              onChangeText={setAddPhone}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Clinic or office address"
              placeholderTextColor={C.textTertiary}
              value={addAddress}
              onChangeText={setAddAddress}
              multiline
            />
            <Text style={styles.label}>Hospital</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mount Sinai"
              placeholderTextColor={C.textTertiary}
              value={addHospital}
              onChangeText={setAddHospital}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeDoctorModal}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, !addName.trim() && { opacity: 0.5 }]} onPress={handleSaveDoctor} disabled={!addName.trim()}>
                <Text style={styles.confirmText}>{editingDoctor ? "Save" : "Add"}</Text>
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
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    backBtn: { marginRight: 8 },
    title: { flex: 1, fontWeight: "700", fontSize: 20, color: C.text },
    addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
    scroll: { flex: 1 },
    content: { padding: 24 },
    hint: { fontSize: 13, color: C.textTertiary, marginBottom: 20 },
    empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
    emptyText: { fontWeight: "600", fontSize: 16, color: C.text },
    emptySub: { fontSize: 13, color: C.textTertiary },
    emergencyHint: { fontSize: 12, color: C.textTertiary, marginBottom: 16, marginTop: -12 },
    row: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 12 },
    rowEmergency: { borderColor: C.tint, borderWidth: 1.5, backgroundColor: C.tintLight },
    rowPrimary: { borderColor: C.blue, borderWidth: 1.5 },
    doctorName: { fontWeight: "600", fontSize: 15, color: C.text },
    doctorSpec: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    doctorMeta: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
    emergencyBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
    emergencyBadgeText: { fontSize: 11, fontWeight: "600", color: C.tint },
    primaryBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
    primaryBadgeText: { fontSize: 11, fontWeight: "600", color: C.accent },
    primaryBtn: { padding: 2 },
    emergencyBtn: { padding: 2 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
    modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: C.border },
    modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    input: { fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
    inputMultiline: { minHeight: 74, textAlignVertical: "top" },
    modalActions: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
    cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
    confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.tint, alignItems: "center" },
    confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  });
}
