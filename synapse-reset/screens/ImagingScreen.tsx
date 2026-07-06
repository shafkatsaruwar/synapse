import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { appointmentStorage, doctorsStorage, imagingStorage, type Appointment, type Doctor, type Imaging } from "@/lib/storage";
import { formatDate, getToday } from "@/lib/date-utils";
import { raised } from "@/constants/raised";
import { modalOverlay, modalSurface } from "@/lib/modal-colors";

const IMAGING_TYPES = ["X-ray", "MRI", "CT", "Ultrasound"];

export default function ImagingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [records, setRecords] = useState<Imaging[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [editing, setEditing] = useState<Imaging | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("");
  const [bodyArea, setBodyArea] = useState("");
  const [date, setDate] = useState(getToday());
  const [doctorId, setDoctorId] = useState<string | undefined>(undefined);
  const [appointmentId, setAppointmentId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    const [imagingRecords, doctorRecords, appointmentRecords] = await Promise.all([imagingStorage.getAll(), doctorsStorage.getAll(), appointmentStorage.getAll()]);
    setRecords(imagingRecords.sort((a, b) => b.date.localeCompare(a.date)));
    setDoctors(doctorRecords.sort((a, b) => a.name.localeCompare(b.name)));
    setAppointments(appointmentRecords.sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const resetForm = () => {
    setEditing(null);
    setType("");
    setBodyArea("");
    setDate(getToday());
    setDoctorId(undefined);
    setAppointmentId(undefined);
    setNotes("");
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (record: Imaging) => {
    setEditing(record);
    setType(record.type);
    setBodyArea(record.bodyArea ?? "");
    setDate(record.date);
    setDoctorId(record.doctorId);
    setAppointmentId(record.appointmentId);
    setNotes(record.notes);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const saveRecord = async () => {
    const imagingType = type.trim();
    if (!imagingType || !date.trim()) return;
    const payload = { type: imagingType, bodyArea, date: date.trim(), doctorId, appointmentId, notes };
    if (editing) {
      await imagingStorage.update(editing.id, payload);
    } else {
      await imagingStorage.save(payload);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeForm();
    await loadData();
  };

  const deleteRecord = () => {
    if (!editing) return;
    Alert.alert("Delete imaging record?", "This removes the imaging record from Synapse.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await imagingStorage.delete(editing.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          closeForm();
          await loadData();
        },
      },
    ]);
  };

  const getDoctorName = (id?: string) => doctors.find((doctor) => doctor.id === id)?.name;
  const getAppointmentName = (appointment: Appointment) => `${appointment.date} · ${appointment.doctorName || "Appointment"}`;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: isWide ? 28 : Platform.OS === "web" ? 40 : 14, paddingBottom: isWide ? 40 : insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Imaging</Text>
          <Pressable style={styles.addBtn} onPress={openAdd} accessibilityRole="button" accessibilityLabel="Add imaging">
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="scan-outline" size={34} color={C.textSecondary} />
            <Text style={styles.emptyTitle}>No imaging records yet</Text>
            <Pressable style={styles.primaryButton} onPress={openAdd}>
              <Text style={styles.primaryButtonText}>Add Imaging</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {records.map((record) => {
              const doctorName = getDoctorName(record.doctorId);
              return (
                <Pressable key={record.id} style={styles.card} onPress={() => openEdit(record)}>
                  <View style={styles.datePill}>
                    <Text style={styles.datePillDay}>{new Date(`${record.date}T12:00:00`).getDate()}</Text>
                    <Text style={styles.datePillMonth}>{new Date(`${record.date}T12:00:00`).toLocaleString("en-US", { month: "short" })}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{record.type}</Text>
                    <Text style={styles.cardMeta}>{formatDate(record.date)}</Text>
                    {record.bodyArea ? <Text style={styles.cardSub}>{record.bodyArea}</Text> : null}
                    {doctorName ? <Text style={styles.cardSub}>Doctor: {doctorName}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={C.textSecondary} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={closeForm}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? "Edit imaging" : "Add imaging"}</Text>
              <Pressable style={styles.closeBtn} onPress={closeForm}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
            </View>
            <Text style={styles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {IMAGING_TYPES.map((option) => (
                <PickerChip key={option} label={option} selected={type === option} onPress={() => setType(option)} />
              ))}
            </ScrollView>
            <TextInput style={[styles.input, { marginTop: 8 }]} value={type} onChangeText={setType} placeholder="X-ray, MRI, CT, Ultrasound..." placeholderTextColor={C.textTertiary} />
            <Text style={styles.label}>Body Area</Text>
            <TextInput style={styles.input} value={bodyArea} onChangeText={setBodyArea} placeholder="Chest, knee, abdomen..." placeholderTextColor={C.textTertiary} />
            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.textTertiary} />
            <Text style={styles.label}>Doctor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <PickerChip label="None" selected={!doctorId} onPress={() => setDoctorId(undefined)} />
              {doctors.map((doctor) => (
                <PickerChip key={doctor.id} label={doctor.name} selected={doctorId === doctor.id} onPress={() => setDoctorId(doctor.id)} />
              ))}
            </ScrollView>
            <Text style={styles.label}>Related Appointment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <PickerChip label="None" selected={!appointmentId} onPress={() => setAppointmentId(undefined)} />
              {appointments.map((appointment) => (
                <PickerChip key={appointment.id} label={getAppointmentName(appointment)} selected={appointmentId === appointment.id} onPress={() => setAppointmentId(appointment.id)} />
              ))}
            </ScrollView>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes} multiline placeholder="Findings, facility, follow-up..." placeholderTextColor={C.textTertiary} />
            <View style={styles.modalActions}>
              {editing ? (
                <Pressable style={styles.deleteBtn} onPress={deleteRecord}>
                  <Ionicons name="trash-outline" size={18} color={C.red} />
                </Pressable>
              ) : null}
              <Pressable style={styles.cancelBtn} onPress={closeForm}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.saveBtn, (!type.trim() || !date.trim()) && { opacity: 0.5 }]} onPress={saveRecord} disabled={!type.trim() || !date.trim()}>
                <Text style={styles.saveText}>{editing ? "Save" : "Add"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  function PickerChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    return (
      <Pressable style={[styles.chip, selected && styles.chipActive]} onPress={onPress}>
        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    );
  }
}

function makeStyles(C: Theme) {
  const solidModalSurface = modalSurface(C);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 22 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
    title: { fontSize: 36, fontWeight: "900", color: C.text },
    addBtn: { width: 58, height: 58, borderRadius: 18, backgroundColor: C.tint, alignItems: "center", justifyContent: "center", ...raised("md", C.tint) },
    emptyCard: { minHeight: 260, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", gap: 14, padding: 24, ...raised("md") },
    emptyTitle: { fontSize: 20, fontWeight: "800", color: C.text },
    primaryButton: { borderRadius: 16, backgroundColor: C.tint, paddingHorizontal: 18, paddingVertical: 13 },
    primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    list: { gap: 14 },
    card: { minHeight: 98, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, ...raised("sm") },
    datePill: { width: 58, height: 66, borderRadius: 16, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    datePillDay: { color: C.tint, fontSize: 24, fontWeight: "900" },
    datePillMonth: { color: C.tint, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
    cardTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
    cardMeta: { color: C.textSecondary, fontSize: 14, fontWeight: "600", marginTop: 4 },
    cardSub: { color: C.textSecondary, fontSize: 13, marginTop: 3 },
    overlay: { flex: 1, backgroundColor: modalOverlay(), alignItems: "center", justifyContent: "center", padding: 20 },
    modal: { width: "100%", maxWidth: 430, borderRadius: 24, backgroundColor: solidModalSurface, padding: 18, borderWidth: 1, borderColor: C.border, ...raised("lg") },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    modalTitle: { fontSize: 22, fontWeight: "900", color: C.text },
    closeBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: C.surfaceElevated, alignItems: "center", justifyContent: "center" },
    label: { fontSize: 12, fontWeight: "800", color: C.textSecondary, marginTop: 12, marginBottom: 6, textTransform: "uppercase" },
    input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, paddingHorizontal: 14, color: C.text, fontSize: 16 },
    notesInput: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" },
    chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, paddingHorizontal: 12, paddingVertical: 8 },
    chipActive: { backgroundColor: C.tint, borderColor: C.tint },
    chipText: { color: C.textSecondary, fontSize: 13, fontWeight: "700" },
    chipTextActive: { color: "#fff" },
    modalActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 18 },
    deleteBtn: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.red + "12", marginRight: "auto" },
    cancelBtn: { minHeight: 46, borderRadius: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceElevated },
    cancelText: { color: C.text, fontWeight: "800" },
    saveBtn: { minHeight: 46, borderRadius: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.tint },
    saveText: { color: "#fff", fontWeight: "900" },
  }) as any;
}
