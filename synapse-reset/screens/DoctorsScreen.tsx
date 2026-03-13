import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { doctorsStorage, emergencyDoctorStorage, type Doctor } from "@/lib/storage";
import { fetchDoctorsFromSupabase, createDoctorInSupabase, deleteDoctorFromSupabase } from "@/lib/doctors-api";

interface DoctorsScreenProps {
  onBack: () => void;
}

export default function DoctorsScreen({ onBack }: DoctorsScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSpecialty, setAddSpecialty] = useState("");
  const [emergencyDocId, setEmergencyDocId] = useState<string | null>(null);

  const loadDoctors = useCallback(async () => {
    let list = await doctorsStorage.getAll();
    if (user?.id) {
      const cloud = await fetchDoctorsFromSupabase(user.id);
      if (cloud.length > 0) {
        await doctorsStorage.mergeFromRemote(cloud);
        list = await doctorsStorage.getAll();
      }
    }
    setDoctors(list.sort((a, b) => a.name.localeCompare(b.name)));
    setEmergencyDocId(await emergencyDoctorStorage.getDocId());
  }, [user?.id]);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);

  const handleSetEmergencyDoc = async (doc: Doctor) => {
    const newId = emergencyDocId === doc.id ? null : doc.id;
    await emergencyDoctorStorage.setDocId(newId);
    setEmergencyDocId(newId);
    Haptics.selectionAsync();
  };

  const handleAdd = async () => {
    const name = addName.trim();
    if (!name) return;
    if (user?.id) {
      const { doctor, error } = await createDoctorInSupabase(user.id, name, addSpecialty.trim() || undefined);
      if (doctor) {
        await doctorsStorage.mergeFromRemote([doctor]);
        setDoctors((prev) => [...prev.filter((d) => d.id !== doctor.id), doctor].sort((a, b) => a.name.localeCompare(b.name)));
      }
    } else {
      const doc = await doctorsStorage.addOrGet({ name, specialty: addSpecialty.trim() || undefined });
      setDoctors((prev) => [...prev.filter((d) => d.id !== doc.id), doc].sort((a, b) => a.name.localeCompare(b.name)));
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddName("");
    setAddSpecialty("");
    setShowAddModal(false);
  };

  const handleDelete = (doc: Doctor) => {
    if (Platform.OS === "web") {
      doctorsStorage.delete(doc.id).then(() => loadDoctors());
      if (user?.id) deleteDoctorFromSupabase(user.id, doc.id);
      return;
    }
    Alert.alert("Remove doctor", `Remove ${doc.name} from your list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await doctorsStorage.delete(doc.id);
          if (user?.id) await deleteDoctorFromSupabase(user.id, doc.id);
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
          onPress={() => setShowAddModal(true)}
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
        <Text style={styles.emergencyHint}>Tap the shield icon to designate your emergency contact doctor.</Text>
        {doctors.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="medical-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyText}>No doctors yet</Text>
            <Text style={styles.emptySub}>Tap + to add a doctor</Text>
          </View>
        ) : (
          doctors.map((doc) => {
            const isEmergency = emergencyDocId === doc.id;
            return (
              <View key={doc.id} style={[styles.row, isEmergency && styles.rowEmergency]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doctorName}>{doc.name}</Text>
                  {doc.specialty ? <Text style={styles.doctorSpec}>{doc.specialty}</Text> : null}
                  {isEmergency && (
                    <View style={styles.emergencyBadge}>
                      <Ionicons name="shield-half" size={11} color={C.tint} />
                      <Text style={styles.emergencyBadgeText}>Emergency Doctor</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => handleSetEmergencyDoc(doc)}
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
                <Pressable onPress={() => handleDelete(doc)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${doc.name}`}>
                  <Ionicons name="trash-outline" size={20} color={C.textTertiary} />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add doctor</Text>
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
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, !addName.trim() && { opacity: 0.5 }]} onPress={handleAdd} disabled={!addName.trim()}>
                <Text style={styles.confirmText}>Add</Text>
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
    container: { flex: 1, backgroundColor: C.background },
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
    doctorName: { fontWeight: "600", fontSize: 15, color: C.text },
    doctorSpec: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    emergencyBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
    emergencyBadgeText: { fontSize: 11, fontWeight: "600", color: C.tint },
    emergencyBtn: { padding: 2 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
    modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: C.border },
    modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
    label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
    input: { fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
    modalActions: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
    cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
    confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.tint, alignItems: "center" },
    confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
  });
}
