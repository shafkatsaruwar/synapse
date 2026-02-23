import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  appointmentStorage,
  doctorNoteStorage,
  type Appointment,
  type DoctorNote,
} from "@/lib/storage";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";

const C = Colors.dark;

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const today = getToday();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [showAptModal, setShowAptModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "notes">("upcoming");

  const [aptDoctor, setAptDoctor] = useState("");
  const [aptSpecialty, setAptSpecialty] = useState("");
  const [aptDate, setAptDate] = useState("");
  const [aptTime, setAptTime] = useState("");
  const [aptLocation, setAptLocation] = useState("");
  const [aptNotes, setAptNotes] = useState("");

  const [noteText, setNoteText] = useState("");

  const loadData = useCallback(async () => {
    const [apts, n] = await Promise.all([
      appointmentStorage.getAll(),
      doctorNoteStorage.getAll(),
    ]);
    setAppointments(apts.sort((a, b) => a.date.localeCompare(b.date)));
    setNotes(n.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleAddAppointment = async () => {
    if (!aptDoctor.trim() || !aptDate.trim()) return;
    await appointmentStorage.save({
      doctorName: aptDoctor.trim(),
      specialty: aptSpecialty.trim(),
      date: aptDate.trim(),
      time: aptTime.trim() || "09:00",
      location: aptLocation.trim(),
      notes: aptNotes.trim(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAptDoctor("");
    setAptSpecialty("");
    setAptDate("");
    setAptTime("");
    setAptLocation("");
    setAptNotes("");
    setShowAptModal(false);
    loadData();
  };

  const handleDeleteAppointment = async (apt: Appointment) => {
    if (Platform.OS === "web") {
      await appointmentStorage.delete(apt.id);
      loadData();
      return;
    }
    Alert.alert("Delete Appointment", `Remove appointment with ${apt.doctorName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await appointmentStorage.delete(apt.id);
          loadData();
        },
      },
    ]);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await doctorNoteStorage.save({ text: noteText.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNoteText("");
    setShowNoteModal(false);
    loadData();
  };

  const handleDeleteNote = async (note: DoctorNote) => {
    if (Platform.OS === "web") {
      await doctorNoteStorage.delete(note.id);
      loadData();
      return;
    }
    Alert.alert("Delete Note", "Remove this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await doctorNoteStorage.delete(note.id);
          loadData();
        },
      },
    ]);
  };

  const upcoming = appointments.filter((a) => a.date >= today);
  const past = appointments.filter((a) => a.date < today);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 118 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Appointments</Text>
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() =>
              tab === "upcoming" ? setShowAptModal(true) : setShowNoteModal(true)
            }
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, tab === "upcoming" && styles.tabBtnActive]}
            onPress={() => setTab("upcoming")}
          >
            <Text
              style={[
                styles.tabBtnText,
                tab === "upcoming" && styles.tabBtnTextActive,
              ]}
            >
              Visits
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === "notes" && styles.tabBtnActive]}
            onPress={() => setTab("notes")}
          >
            <Text
              style={[
                styles.tabBtnText,
                tab === "notes" && styles.tabBtnTextActive,
              ]}
            >
              Doctor Notes
            </Text>
          </Pressable>
        </View>

        {tab === "upcoming" ? (
          <>
            {upcoming.length === 0 && past.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="calendar-outline"
                  size={48}
                  color={C.textTertiary}
                />
                <Text style={styles.emptyTitle}>No appointments</Text>
                <Text style={styles.emptySubtitle}>
                  Tap + to schedule a visit
                </Text>
              </View>
            )}

            {upcoming.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.sectionLabel}>Upcoming</Text>
                {upcoming.map((apt) => (
                  <Pressable
                    key={apt.id}
                    style={styles.aptCard}
                    onLongPress={() => handleDeleteAppointment(apt)}
                  >
                    <View style={styles.aptDateBadge}>
                      <Text style={styles.aptDateDay}>
                        {new Date(apt.date + "T00:00:00").getDate()}
                      </Text>
                      <Text style={styles.aptDateMonth}>
                        {new Date(apt.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short" },
                        )}
                      </Text>
                    </View>
                    <View style={styles.aptInfo}>
                      <Text style={styles.aptDoctor}>{apt.doctorName}</Text>
                      {!!apt.specialty && (
                        <Text style={styles.aptSpecialty}>{apt.specialty}</Text>
                      )}
                      <View style={styles.aptMeta}>
                        <View style={styles.aptMetaItem}>
                          <Ionicons
                            name="time-outline"
                            size={13}
                            color={C.textSecondary}
                          />
                          <Text style={styles.aptMetaText}>
                            {formatTime12h(apt.time)}
                          </Text>
                        </View>
                        {!!apt.location && (
                          <View style={styles.aptMetaItem}>
                            <Ionicons
                              name="location-outline"
                              size={13}
                              color={C.textSecondary}
                            />
                            <Text style={styles.aptMetaText}>
                              {apt.location}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleDeleteAppointment(apt)}
                      hitSlop={12}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={C.textTertiary}
                      />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}

            {past.length > 0 && (
              <View>
                <Text style={styles.sectionLabel}>Past</Text>
                {past.map((apt) => (
                  <View key={apt.id} style={[styles.aptCard, styles.aptCardPast]}>
                    <View style={[styles.aptDateBadge, { opacity: 0.5 }]}>
                      <Text style={styles.aptDateDay}>
                        {new Date(apt.date + "T00:00:00").getDate()}
                      </Text>
                      <Text style={styles.aptDateMonth}>
                        {new Date(apt.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short" },
                        )}
                      </Text>
                    </View>
                    <View style={styles.aptInfo}>
                      <Text style={[styles.aptDoctor, { color: C.textSecondary }]}>
                        {apt.doctorName}
                      </Text>
                      {!!apt.specialty && (
                        <Text style={styles.aptSpecialty}>{apt.specialty}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {notes.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="document-text-outline"
                  size={48}
                  color={C.textTertiary}
                />
                <Text style={styles.emptyTitle}>No notes yet</Text>
                <Text style={styles.emptySubtitle}>
                  Write down questions for your next doctor visit
                </Text>
              </View>
            )}

            {notes.map((note, i) => (
              <Pressable
                key={note.id}
                style={styles.noteCard}
                onLongPress={() => handleDeleteNote(note)}
              >
                <View style={styles.noteBullet}>
                  <Text style={styles.noteBulletNum}>{i + 1}</Text>
                </View>
                <Text style={styles.noteCardText}>{note.text}</Text>
                <Pressable onPress={() => handleDeleteNote(note)} hitSlop={12}>
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color={C.textTertiary}
                  />
                </Pressable>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showAptModal} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAptModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Appointment</Text>

            <Text style={styles.inputLabel}>Doctor Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Dr. Smith"
              placeholderTextColor={C.textTertiary}
              value={aptDoctor}
              onChangeText={setAptDoctor}
            />

            <Text style={styles.inputLabel}>Specialty</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cardiologist"
              placeholderTextColor={C.textTertiary}
              value={aptSpecialty}
              onChangeText={setAptSpecialty}
            />

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Date * (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2025-03-15"
                  placeholderTextColor={C.textTertiary}
                  value={aptDate}
                  onChangeText={setAptDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Time (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="09:00"
                  placeholderTextColor={C.textTertiary}
                  value={aptTime}
                  onChangeText={setAptTime}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="Hospital or clinic name"
              placeholderTextColor={C.textTertiary}
              value={aptLocation}
              onChangeText={setAptLocation}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowAptModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  (!aptDoctor.trim() || !aptDate.trim()) && { opacity: 0.5 },
                ]}
                onPress={handleAddAppointment}
                disabled={!aptDoctor.trim() || !aptDate.trim()}
              >
                <Text style={styles.confirmBtnText}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showNoteModal} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowNoteModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Note</Text>
            <Text style={styles.inputLabel}>Question for your doctor</Text>
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              placeholder="What would you like to ask?"
              placeholderTextColor={C.textTertiary}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowNoteModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  !noteText.trim() && { opacity: 0.5 },
                ]}
                onPress={handleAddNote}
                disabled={!noteText.trim()}
              >
                <Text style={styles.confirmBtnText}>Add</Text>
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: C.surfaceElevated,
  },
  tabBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.textSecondary,
  },
  tabBtnTextActive: {
    color: C.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: C.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textTertiary,
    textAlign: "center",
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  aptCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
  },
  aptCardPast: {
    opacity: 0.6,
  },
  aptDateBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.warningLight,
    alignItems: "center",
    justifyContent: "center",
  },
  aptDateDay: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.warning,
    lineHeight: 22,
  },
  aptDateMonth: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.warning,
    textTransform: "uppercase",
  },
  aptInfo: {
    flex: 1,
  },
  aptDoctor: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
  },
  aptSpecialty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 1,
  },
  aptMeta: {
    flexDirection: "row",
    gap: 14,
    marginTop: 6,
  },
  aptMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aptMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  noteBullet: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.successLight,
    alignItems: "center",
    justifyContent: "center",
  },
  noteBulletNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: C.success,
  },
  noteCardText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
    flex: 1,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: C.text,
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 6,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.text,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.surfaceElevated,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.tint,
    alignItems: "center",
  },
  confirmBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
});
