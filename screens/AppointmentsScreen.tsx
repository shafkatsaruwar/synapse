import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { appointmentStorage, doctorNoteStorage, type Appointment, type DoctorNote } from "@/lib/storage";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";

const C = Colors.dark;

function CalendarView({ appointments, selectedDate, onSelectDate }: { appointments: Appointment[]; selectedDate: string; onSelectDate: (d: string) => void }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const monthName = new Date(viewMonth.year, viewMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = getToday();

  const aptDates = new Set(appointments.map((a) => a.date));
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setViewMonth((v) => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () => setViewMonth((v) => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });

  return (
    <View style={calStyles.cal}>
      <View style={calStyles.calHeader}>
        <Pressable onPress={prevMonth} hitSlop={12}><Ionicons name="chevron-back" size={18} color={C.textSecondary} /></Pressable>
        <Text style={calStyles.calMonth}>{monthName}</Text>
        <Pressable onPress={nextMonth} hitSlop={12}><Ionicons name="chevron-forward" size={18} color={C.textSecondary} /></Pressable>
      </View>
      <View style={calStyles.calWeekRow}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <Text key={d} style={calStyles.calWeekDay}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.calGrid}>
        {days.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={calStyles.calCell} />;
          const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === today;
          const hasApt = aptDates.has(dateStr);
          const isSelected = dateStr === selectedDate;
          return (
            <Pressable key={i} style={[calStyles.calCell, isSelected && calStyles.calCellSelected, isToday && !isSelected && calStyles.calCellToday]} onPress={() => onSelectDate(dateStr)}>
              <Text style={[calStyles.calDay, isSelected && { color: "#fff" }, isToday && !isSelected && { color: C.tint }]}>{day}</Text>
              {hasApt && <View style={[calStyles.calDot, isSelected && { backgroundColor: "#fff" }]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  cal: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  calHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  calMonth: { fontWeight: "600", fontSize: 15, color: C.text },
  calWeekRow: { flexDirection: "row", marginBottom: 6 },
  calWeekDay: { flex: 1, textAlign: "center", fontWeight: "500", fontSize: 11, color: C.textTertiary },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.28%", alignItems: "center", paddingVertical: 6 },
  calCellSelected: { backgroundColor: C.tint, borderRadius: 8 },
  calCellToday: { backgroundColor: C.tintLight, borderRadius: 8 },
  calDay: { fontWeight: "500", fontSize: 13, color: C.text },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.purple, marginTop: 2 },
});

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [showAptModal, setShowAptModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTab] = useState<"calendar" | "notes">("calendar");

  const [aptDoctor, setAptDoctor] = useState("");
  const [aptSpecialty, setAptSpecialty] = useState("");
  const [aptDate, setAptDate] = useState("");
  const [aptTime, setAptTime] = useState("");
  const [aptLocation, setAptLocation] = useState("");
  const [noteText, setNoteText] = useState("");

  const loadData = useCallback(async () => {
    const [apts, n] = await Promise.all([appointmentStorage.getAll(), doctorNoteStorage.getAll()]);
    setAppointments(apts.sort((a, b) => a.date.localeCompare(b.date)));
    setNotes(n.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleAddApt = async () => {
    if (!aptDoctor.trim() || !aptDate.trim()) return;
    await appointmentStorage.save({ doctorName: aptDoctor.trim(), specialty: aptSpecialty.trim(), date: aptDate.trim(), time: aptTime.trim() || "09:00", location: aptLocation.trim(), notes: "" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAptDoctor(""); setAptSpecialty(""); setAptDate(""); setAptTime(""); setAptLocation("");
    setShowAptModal(false); loadData();
  };

  const handleDeleteApt = async (apt: Appointment) => {
    if (Platform.OS === "web") { await appointmentStorage.delete(apt.id); loadData(); return; }
    Alert.alert("Delete", `Remove appointment with ${apt.doctorName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await appointmentStorage.delete(apt.id); loadData(); } },
    ]);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await doctorNoteStorage.save({ text: noteText.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNoteText(""); setShowNoteModal(false); loadData();
  };

  const handleDeleteNote = async (note: DoctorNote) => {
    if (Platform.OS === "web") { await doctorNoteStorage.delete(note.id); loadData(); return; }
    Alert.alert("Delete", "Remove this note?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await doctorNoteStorage.delete(note.id); loadData(); } },
    ]);
  };

  const selectedApts = appointments.filter((a) => a.date === selectedDate);
  const upcoming = appointments.filter((a) => a.date >= today);

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, {
        paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
        paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
      }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Appointments</Text>
          <Pressable style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => tab === "calendar" ? setShowAptModal(true) : setShowNoteModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tabBtn, tab === "calendar" && styles.tabBtnActive]} onPress={() => setTab("calendar")}>
            <Text style={[styles.tabText, tab === "calendar" && styles.tabTextActive]}>Calendar</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, tab === "notes" && styles.tabBtnActive]} onPress={() => setTab("notes")}>
            <Text style={[styles.tabText, tab === "notes" && styles.tabTextActive]}>Doctor Notes</Text>
          </Pressable>
        </View>

        {tab === "calendar" ? (
          <View style={isWide ? styles.calLayout : undefined}>
            <View style={isWide ? { flex: 1, marginRight: 16 } : undefined}>
              <CalendarView appointments={appointments} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            </View>
            <View style={isWide ? { flex: 1 } : undefined}>
              {selectedApts.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>{formatDate(selectedDate)}</Text>
                  {selectedApts.map((apt) => (
                    <View key={apt.id} style={styles.aptCard}>
                      <View style={styles.aptDateBadge}>
                        <Text style={styles.aptDateDay}>{new Date(apt.date + "T00:00:00").getDate()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aptDoctor}>{apt.doctorName}</Text>
                        {!!apt.specialty && <Text style={styles.aptSpec}>{apt.specialty}</Text>}
                        <View style={styles.aptMeta}>
                          <Ionicons name="time-outline" size={12} color={C.textSecondary} />
                          <Text style={styles.aptMetaText}>{formatTime12h(apt.time)}</Text>
                          {!!apt.location && <>
                            <Ionicons name="location-outline" size={12} color={C.textSecondary} />
                            <Text style={styles.aptMetaText}>{apt.location}</Text>
                          </>}
                        </View>
                      </View>
                      <Pressable onPress={() => handleDeleteApt(apt)} hitSlop={12}><Ionicons name="trash-outline" size={16} color={C.textTertiary} /></Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noAptForDate}>
                  <Text style={styles.noAptText}>No appointments on {formatDate(selectedDate)}</Text>
                </View>
              )}

              {upcoming.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.sectionLabel}>Upcoming</Text>
                  {upcoming.slice(0, 5).map((apt) => (
                    <Pressable key={apt.id} style={styles.aptCard} onPress={() => setSelectedDate(apt.date)} onLongPress={() => handleDeleteApt(apt)}>
                      <View style={styles.aptDateBadge}>
                        <Text style={styles.aptDateDay}>{new Date(apt.date + "T00:00:00").getDate()}</Text>
                        <Text style={styles.aptDateMonth}>{new Date(apt.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aptDoctor}>{apt.doctorName}</Text>
                        {!!apt.specialty && <Text style={styles.aptSpec}>{apt.specialty}</Text>}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <>
            {notes.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={40} color={C.textTertiary} />
                <Text style={styles.emptyTitle}>No doctor notes</Text>
                <Text style={styles.emptyDesc}>Write questions for your next visit</Text>
              </View>
            )}
            {notes.map((note, i) => (
              <View key={note.id} style={styles.noteCard}>
                <View style={styles.noteBullet}><Text style={styles.noteBulletNum}>{i + 1}</Text></View>
                <Text style={styles.noteText}>{note.text}</Text>
                <Pressable onPress={() => handleDeleteNote(note)} hitSlop={12}><Ionicons name="close-circle-outline" size={16} color={C.textTertiary} /></Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showAptModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowAptModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Appointment</Text>
            <Text style={styles.label}>Doctor *</Text>
            <TextInput style={styles.input} placeholder="Dr. Smith" placeholderTextColor={C.textTertiary} value={aptDoctor} onChangeText={setAptDoctor} />
            <Text style={styles.label}>Specialty</Text>
            <TextInput style={styles.input} placeholder="e.g. Cardiologist" placeholderTextColor={C.textTertiary} value={aptSpecialty} onChangeText={setAptSpecialty} />
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Date * (YYYY-MM-DD)</Text><TextInput style={styles.input} placeholder="2026-03-15" placeholderTextColor={C.textTertiary} value={aptDate} onChangeText={setAptDate} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Time (HH:MM)</Text><TextInput style={styles.input} placeholder="09:00" placeholderTextColor={C.textTertiary} value={aptTime} onChangeText={setAptTime} /></View>
            </View>
            <Text style={styles.label}>Location</Text>
            <TextInput style={styles.input} placeholder="Hospital name" placeholderTextColor={C.textTertiary} value={aptLocation} onChangeText={setAptLocation} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAptModal(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirmBtn, (!aptDoctor.trim() || !aptDate.trim()) && { opacity: 0.5 }]} onPress={handleAddApt} disabled={!aptDoctor.trim() || !aptDate.trim()}><Text style={styles.confirmText}>Add</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showNoteModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowNoteModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Doctor Note</Text>
            <TextInput style={[styles.input, { minHeight: 80 }]} placeholder="Question for your doctor..." placeholderTextColor={C.textTertiary} value={noteText} onChangeText={setNoteText} multiline textAlignVertical="top" />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowNoteModal(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirmBtn, !noteText.trim() && { opacity: 0.5 }]} onPress={handleAddNote} disabled={!noteText.trim()}><Text style={styles.confirmText}>Add</Text></Pressable>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5 },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 10, padding: 3, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabBtnActive: { backgroundColor: C.surfaceElevated },
  tabText: { fontWeight: "500", fontSize: 13, color: C.textSecondary },
  tabTextActive: { color: C.text },
  calLayout: { flexDirection: "row" },
  sectionLabel: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  aptCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 12 },
  aptDateBadge: { width: 42, height: 42, borderRadius: 10, backgroundColor: C.purpleLight, alignItems: "center", justifyContent: "center" },
  aptDateDay: { fontWeight: "700", fontSize: 16, color: C.purple, lineHeight: 20 },
  aptDateMonth: { fontWeight: "500", fontSize: 9, color: C.purple, textTransform: "uppercase" },
  aptDoctor: { fontWeight: "600", fontSize: 14, color: C.text },
  aptSpec: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 1 },
  aptMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  aptMetaText: { fontWeight: "400", fontSize: 11, color: C.textSecondary, marginRight: 8 },
  noAptForDate: { backgroundColor: C.surface, borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: C.border },
  noAptText: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 8 },
  emptyDesc: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  noteCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, gap: 10 },
  noteBullet: { width: 24, height: 24, borderRadius: 7, backgroundColor: C.greenLight, alignItems: "center", justifyContent: "center" },
  noteBulletNum: { fontWeight: "700", fontSize: 12, color: C.green },
  noteText: { fontWeight: "400", fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 400, borderWidth: 1, borderColor: C.border },
  modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  fieldRow: { flexDirection: "row", gap: 10 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
  cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.purple, alignItems: "center" },
  confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
});
