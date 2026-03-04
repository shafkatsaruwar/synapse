import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, TextInput, Modal, Platform, Alert, useWindowDimensions, KeyboardAvoidingView, Keyboard, TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  appointmentStorage,
  doctorNoteStorage,
  doctorsStorage,
  type Appointment,
  type Doctor,
  type DoctorNote,
  type RepeatUnit,
} from "@/lib/storage";
import { fetchDoctorsFromSupabase, createDoctorInSupabase } from "@/lib/doctors-api";
import {
  fetchAppointmentsFromSupabase,
  replaceAppointmentsInSupabase,
  insertAppointmentsToSupabase,
  updateAppointmentInSupabase,
  deleteAppointmentFromSupabase,
} from "@/lib/appointments-api";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";

const C = Colors.dark;

const REPEAT_OPTIONS: { value: "none" | "week" | "2weeks" | "month" | "custom"; label: string; interval?: number; unit?: RepeatUnit }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "week", label: "Every week", interval: 1, unit: "week" },
  { value: "2weeks", label: "Every 2 weeks", interval: 2, unit: "week" },
  { value: "month", label: "Every month", interval: 1, unit: "month" },
  { value: "custom", label: "Custom" },
];

function getRecurrenceLabel(apt: Appointment, allAppointments: Appointment[]): string | null {
  const source = apt.parent_recurring_id
    ? allAppointments.find((a) => a.id === apt.parent_recurring_id) ?? apt
    : apt;
  if (!source.is_recurring && !apt.parent_recurring_id) return null;
  const i = source.repeat_interval;
  const u = source.repeat_unit;
  if (i == null || !u) return apt.parent_recurring_id ? "Part of series" : null;
  if (i === 1 && u === "week") return "Repeats every week";
  if (i === 2 && u === "week") return "Repeats every 2 weeks";
  if (i === 1 && u === "month") return "Repeats every month";
  if (i === 1 && u === "day") return "Repeats daily";
  return `Repeats every ${i} ${u}s`;
}

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
        <Pressable onPress={prevMonth} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous month"><Ionicons name="chevron-back" size={18} color={C.textSecondary} /></Pressable>
        <Text style={calStyles.calMonth} accessibilityRole="header">{monthName}</Text>
        <Pressable onPress={nextMonth} hitSlop={12} accessibilityRole="button" accessibilityLabel="Next month"><Ionicons name="chevron-forward" size={18} color={C.textSecondary} /></Pressable>
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
            <Pressable key={i} style={[calStyles.calCell, isSelected && calStyles.calCellSelected, isToday && !isSelected && calStyles.calCellToday]} onPress={() => onSelectDate(dateStr)} accessibilityRole="button" accessibilityLabel={`${new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}${hasApt ? ", has appointment" : ""}${isToday ? ", today" : ""}`} accessibilityState={{ selected: isSelected }}>
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
  const { user } = useAuth();
  const isWide = width >= 768;
  const today = getToday();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [showAptModal, setShowAptModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [editMode, setEditMode] = useState<"one" | "all">("one");
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTab] = useState<"calendar" | "notes">("calendar");

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [addDoctorName, setAddDoctorName] = useState("");
  const [addDoctorSpecialty, setAddDoctorSpecialty] = useState("");
  const [aptSpecialty, setAptSpecialty] = useState("");
  const [aptDate, setAptDate] = useState("");
  const [aptTime, setAptTime] = useState("");
  const [aptLocation, setAptLocation] = useState("");
  const [aptNotes, setAptNotes] = useState("");
  const [repeatOption, setRepeatOption] = useState<typeof REPEAT_OPTIONS[0]["value"]>("none");
  const [customInterval, setCustomInterval] = useState("1");
  const [customUnit, setCustomUnit] = useState<RepeatUnit>("week");
  const [noteText, setNoteText] = useState("");

  const loadData = useCallback(async () => {
    let apts: Appointment[];
    if (user?.id) {
      const cloud = await fetchAppointmentsFromSupabase(user.id);
      if (cloud.length > 0) {
        await appointmentStorage.setAll(cloud);
        apts = cloud;
      } else {
        apts = await appointmentStorage.getAll();
        if (apts.length > 0) await replaceAppointmentsInSupabase(user.id, apts);
      }
    } else {
      apts = await appointmentStorage.getAll();
    }
    const [docs, n] = await Promise.all([doctorsStorage.getAll(), doctorNoteStorage.getAll()]);
    setAppointments(apts.sort((a, b) => a.date.localeCompare(b.date)));
    setDoctors(docs);
    setNotes(n.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!user?.id) return;
    fetchDoctorsFromSupabase(user.id).then((remote) => {
      if (remote.length === 0) return;
      doctorsStorage.mergeFromRemote(remote).then(() => loadData());
    });
  }, [user?.id, loadData]);

  const selectedDoctor = selectedDoctorId ? doctors.find((d) => d.id === selectedDoctorId) : null;

  const handleAddDoctorFromForm = async () => {
    const name = addDoctorName.trim();
    if (!name) return;
    let doc: Doctor;
    if (user?.id) {
      const result = await createDoctorInSupabase(user.id, name, addDoctorSpecialty.trim() || undefined);
      if (!result.doctor) return;
      doc = result.doctor;
      await doctorsStorage.mergeFromRemote([doc]);
    } else {
      doc = await doctorsStorage.addOrGet({ name, specialty: addDoctorSpecialty.trim() || undefined });
    }
    setDoctors((prev) => [...prev.filter((d) => d.id !== doc.id), doc].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedDoctorId(doc.id);
    setAptSpecialty(doc.specialty ?? (addDoctorSpecialty ?? "").trim());
    setAddDoctorName("");
    setAddDoctorSpecialty("");
    setShowAddDoctorModal(false);
    setShowDoctorPicker(false);
    Haptics.selectionAsync();
  };

  const handleAddApt = async () => {
    if (!selectedDoctorId || !aptDate.trim()) return;
    const doc = doctors.find((d) => d.id === selectedDoctorId);
    const doctorName = doc?.name ?? "";
    const specialty = (aptSpecialty ?? "").trim() || (doc?.specialty ?? "");

    const base: Omit<Appointment, "id"> = {
      doctor_id: selectedDoctorId,
      doctorName,
      specialty,
      date: aptDate.trim(),
      time: aptTime.trim() || "09:00",
      location: aptLocation.trim(),
      notes: aptNotes.trim(),
    };

    const opt = REPEAT_OPTIONS.find((o) => o.value === repeatOption);
    if (opt && opt.value !== "none" && opt.interval != null && opt.unit) {
      base.is_recurring = true;
      base.repeat_interval = opt.interval;
      base.repeat_unit = opt.unit;
      const end = new Date(aptDate + "T12:00:00");
      end.setMonth(end.getMonth() + 6);
      base.repeat_end_date = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    } else if (repeatOption === "custom" && customInterval && customUnit) {
      const n = parseInt(customInterval, 10);
      if (!isNaN(n) && n > 0) {
        base.is_recurring = true;
        base.repeat_interval = n;
        base.repeat_unit = customUnit;
        const end = new Date(aptDate + "T12:00:00");
        end.setMonth(end.getMonth() + 6);
        base.repeat_end_date = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      }
    }

    await appointmentStorage.save(base);
    if (user?.id) {
      const all = await appointmentStorage.getAll();
      await replaceAppointmentsInSupabase(user.id, all);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetAptForm();
    setShowAptModal(false);
    loadData();
  };

  const resetAptForm = () => {
    setSelectedDoctorId(null);
    setShowDoctorPicker(false);
    setShowAddDoctorModal(false);
    setAptSpecialty("");
    setAptDate("");
    setAptTime("");
    setAptLocation("");
    setAptNotes("");
    setRepeatOption("none");
    setCustomInterval("1");
    setCustomUnit("week");
    setEditingApt(null);
  };

  const handleEditApt = async (apt: Appointment) => {
    setEditingApt(apt);
    let doctorId: string | null = apt.doctor_id ?? null;
    if (!doctorId && apt.doctorName) {
      const doc = await doctorsStorage.addOrGet({ name: apt.doctorName, specialty: apt.specialty ?? undefined });
      doctorId = doc.id;
      setDoctors((prev) => [...prev.filter((d) => d.id !== doc.id), doc].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setSelectedDoctorId(doctorId);
    setAptSpecialty(apt.specialty ?? "");
    setAptDate(apt.date);
    setAptTime(apt.time);
    setAptLocation(apt.location ?? "");
    setAptNotes(apt.notes ?? "");
    setRepeatOption("none");
    setShowAptModal(true);
  };

  const handleUpdateApt = async () => {
    if (!editingApt) return;
    const doc = selectedDoctorId ? doctors.find((d) => d.id === selectedDoctorId) : null;
    if (!doc || !aptDate.trim()) return;
    const updates: Partial<Appointment> = {
      doctor_id: selectedDoctorId ?? undefined,
      doctorName: doc.name,
      specialty: ((aptSpecialty ?? "").trim() || doc?.specialty) ?? "",
      date: aptDate.trim(),
      time: aptTime.trim() || "09:00",
      location: aptLocation.trim(),
      notes: aptNotes.trim(),
    };
    if (editMode === "one") {
      await appointmentStorage.update(editingApt.id, updates);
      if (user?.id) await updateAppointmentInSupabase(user.id, editingApt.id, updates);
    } else {
      const parentId = editingApt.parent_recurring_id ?? editingApt.id;
      const toUpdate = appointments.filter((a) => a.id === editingApt.id || (a.parent_recurring_id === parentId && a.date >= editingApt.date));
      for (const a of toUpdate) {
        await appointmentStorage.update(a.id, { ...updates, date: a.date });
        if (user?.id) await updateAppointmentInSupabase(user.id, a.id, { ...updates, date: a.date });
      }
    }
    if (user?.id) {
      const all = await appointmentStorage.getAll();
      await replaceAppointmentsInSupabase(user.id, all);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetAptForm();
    setShowAptModal(false);
    loadData();
  };

  const handleDeleteApt = async (apt: Appointment) => {
    const doDelete = async () => {
      await appointmentStorage.delete(apt.id);
      if (user?.id) {
        await deleteAppointmentFromSupabase(user.id, apt.id);
      }
      loadData();
    };
    if (Platform.OS === "web") { await doDelete(); return; }
    Alert.alert("Delete", `Remove appointment with ${apt.doctorName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
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
    if (Platform.OS === "web") { await doctorNoteStorage.delete(note.id); loadData(); return; }
    Alert.alert("Delete", "Remove this note?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await doctorNoteStorage.delete(note.id); loadData(); } },
    ]);
  };

  const selectedApts = appointments.filter((a) => a.date === selectedDate);
  const upcoming = appointments.filter((a) => a.date >= today);
  const isRecurringApt = (a: Appointment) => a.is_recurring || a.parent_recurring_id;

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, {
        paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
        paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
      }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Appointments</Text>
          <Pressable style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => { resetAptForm(); tab === "calendar" ? setShowAptModal(true) : setShowNoteModal(true); }} accessibilityRole="button" accessibilityLabel={tab === "calendar" ? "Add appointment" : "Add doctor note"} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tabBtn, tab === "calendar" && styles.tabBtnActive]} onPress={() => setTab("calendar")} accessibilityRole="button" accessibilityLabel="Calendar" accessibilityState={{ selected: tab === "calendar" }}>
            <Text style={[styles.tabText, tab === "calendar" && styles.tabTextActive]}>Calendar</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, tab === "notes" && styles.tabBtnActive]} onPress={() => setTab("notes")} accessibilityRole="button" accessibilityLabel="Doctor Notes" accessibilityState={{ selected: tab === "notes" }}>
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
                        {getRecurrenceLabel(apt, appointments) && <Text style={styles.aptRecurrence}>{getRecurrenceLabel(apt, appointments)}</Text>}
                        <View style={styles.aptMeta}>
                          <Ionicons name="time-outline" size={12} color={C.textSecondary} />
                          <Text style={styles.aptMetaText}>{formatTime12h(apt.time)}</Text>
                          {!!apt.location && <>
                            <Ionicons name="location-outline" size={12} color={C.textSecondary} />
                            <Text style={styles.aptMetaText}>{apt.location}</Text>
                          </>}
                        </View>
                      </View>
                      <Pressable onPress={() => handleEditApt(apt)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Edit appointment with ${apt.doctorName}`}><Ionicons name="pencil-outline" size={16} color={C.textSecondary} /></Pressable>
                      <Pressable onPress={() => handleDeleteApt(apt)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Delete appointment with ${apt.doctorName}`}><Ionicons name="trash-outline" size={16} color={C.textTertiary} /></Pressable>
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
                    <Pressable key={apt.id} style={styles.aptCard} onPress={() => setSelectedDate(apt.date)} onLongPress={() => handleDeleteApt(apt)} accessibilityRole="button" accessibilityLabel={`${apt.doctorName}${apt.specialty ? `, ${apt.specialty}` : ""}, ${formatDate(apt.date)}`} accessibilityHint="Tap to view, long press to delete">
                      <View style={styles.aptDateBadge}>
                        <Text style={styles.aptDateDay}>{new Date(apt.date + "T00:00:00").getDate()}</Text>
                        <Text style={styles.aptDateMonth}>{new Date(apt.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aptDoctor}>{apt.doctorName}</Text>
                        {!!apt.specialty && <Text style={styles.aptSpec}>{apt.specialty}</Text>}
                        {getRecurrenceLabel(apt, appointments) && <Text style={styles.aptRecurrence}>{getRecurrenceLabel(apt, appointments)}</Text>}
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
                <Pressable onPress={() => handleDeleteNote(note)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Delete note"><Ionicons name="close-circle-outline" size={16} color={C.textTertiary} /></Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showAptModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setShowAptModal(false); resetAptForm(); }} accessibilityLabel="Close" />
          <KeyboardAvoidingView
            pointerEvents="box-none"
            style={{ flex: 1, justifyContent: "center" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
          >
            <ScrollView
              contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: "center" }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              style={Platform.OS !== "web" ? { maxHeight: "85%" } : undefined}
            >
              <View style={styles.modal}>
              <Text style={styles.modalTitle}>{editingApt ? "Edit Appointment" : "New Appointment"}</Text>
              <Text style={styles.label}>Doctor *</Text>
              <Pressable
                style={styles.doctorSelect}
                onPress={() => setShowDoctorPicker((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={selectedDoctor ? `${selectedDoctor.name}${selectedDoctor.specialty ? `, ${selectedDoctor.specialty}` : ""}` : "Select doctor"}
              >
                <Text style={[styles.doctorSelectText, !selectedDoctor && { color: C.textTertiary }]}>
                  {selectedDoctor ? `${selectedDoctor.name}${selectedDoctor.specialty ? ` · ${selectedDoctor.specialty}` : ""}` : "Select doctor"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={C.textSecondary} />
              </Pressable>
              {showDoctorPicker && (
                <View style={styles.dropdown}>
                  {doctors.map((d) => (
                    <Pressable
                      key={d.id}
                      style={[styles.dropdownRow, selectedDoctorId === d.id && styles.dropdownRowSelected]}
                      onPress={() => { setSelectedDoctorId(d.id); setAptSpecialty(d.specialty ?? ""); setShowDoctorPicker(false); Haptics.selectionAsync(); }}
                    >
                      <Text style={styles.dropdownText}>{d.name}</Text>
                      {d.specialty ? <Text style={styles.dropdownSub}>{d.specialty}</Text> : null}
                    </Pressable>
                  ))}
                  <TouchableOpacity
                    style={[styles.dropdownRow, styles.addNewRow, styles.addNewDoctorBtn]}
                    onPress={() => { setShowDoctorPicker(false); setShowAddDoctorModal(true); Keyboard.dismiss(); }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Add new doctor"
                  >
                    <Ionicons name="add-circle-outline" size={20} color={C.tint} />
                    <Text style={styles.addNewText}>+ Add new doctor</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.label}>Specialty</Text>
              <TextInput style={styles.input} placeholder="e.g. Cardiologist" placeholderTextColor={C.textTertiary} value={aptSpecialty} onChangeText={setAptSpecialty} />
              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}><Text style={styles.label}>Date * (YYYY-MM-DD)</Text><TextInput style={styles.input} placeholder="2026-03-15" placeholderTextColor={C.textTertiary} value={aptDate} onChangeText={setAptDate} /></View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Time (HH:MM)</Text><TextInput style={styles.input} placeholder="09:00" placeholderTextColor={C.textTertiary} value={aptTime} onChangeText={setAptTime} /></View>
              </View>
              <Text style={styles.label}>Location</Text>
              <TextInput style={styles.input} placeholder="Hospital name" placeholderTextColor={C.textTertiary} value={aptLocation} onChangeText={setAptLocation} />
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Optional notes" placeholderTextColor={C.textTertiary} value={aptNotes} onChangeText={setAptNotes} multiline />

              {!editingApt && (
                <>
                  <Text style={styles.label}>Repeat</Text>
                  <View style={styles.repeatRow}>
                    {REPEAT_OPTIONS.map((o) => (
                      <Pressable key={o.value} style={[styles.repeatChip, repeatOption === o.value && styles.repeatChipActive]} onPress={() => setRepeatOption(o.value)}>
                        <Text style={[styles.repeatChipText, repeatOption === o.value && styles.repeatChipTextActive]}>{o.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {repeatOption === "custom" && (
                    <View style={styles.customRepeat}>
                      <TextInput style={[styles.input, { width: 56 }]} placeholder="1" value={customInterval} onChangeText={setCustomInterval} keyboardType="number-pad" />
                      <Pressable style={[styles.unitBtn, customUnit === "day" && styles.unitBtnActive]} onPress={() => setCustomUnit("day")}><Text style={styles.unitBtnText}>days</Text></Pressable>
                      <Pressable style={[styles.unitBtn, customUnit === "week" && styles.unitBtnActive]} onPress={() => setCustomUnit("week")}><Text style={styles.unitBtnText}>weeks</Text></Pressable>
                      <Pressable style={[styles.unitBtn, customUnit === "month" && styles.unitBtnActive]} onPress={() => setCustomUnit("month")}><Text style={styles.unitBtnText}>months</Text></Pressable>
                    </View>
                  )}
                </>
              )}

              {editingApt && isRecurringApt(editingApt) && (
                <View style={styles.editModeRow}>
                  <Text style={styles.label}>Edit</Text>
                  <View style={styles.editModeChips}>
                    <Pressable style={[styles.repeatChip, editMode === "one" && styles.repeatChipActive]} onPress={() => setEditMode("one")}>
                      <Text style={[styles.repeatChipText, editMode === "one" && styles.repeatChipTextActive]}>Only this occurrence</Text>
                    </Pressable>
                    <Pressable style={[styles.repeatChip, editMode === "all" && styles.repeatChipActive]} onPress={() => setEditMode("all")}>
                      <Text style={[styles.repeatChipText, editMode === "all" && styles.repeatChipTextActive]}>All future occurrences</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => { setShowAptModal(false); resetAptForm(); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                {editingApt ? (
                  <Pressable style={[styles.confirmBtn, (!selectedDoctorId || !aptDate.trim()) && { opacity: 0.5 }]} onPress={handleUpdateApt} disabled={!selectedDoctorId || !aptDate.trim()}><Text style={styles.confirmText}>Save</Text></Pressable>
                ) : (
                  <Pressable style={[styles.confirmBtn, (!selectedDoctorId || !aptDate.trim()) && { opacity: 0.5 }]} onPress={handleAddApt} disabled={!selectedDoctorId || !aptDate.trim()}><Text style={styles.confirmText}>Add</Text></Pressable>
                )}
              </View>
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showAddDoctorModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowAddDoctorModal(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add doctor</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} placeholder="Dr. Smith" placeholderTextColor={C.textTertiary} value={addDoctorName} onChangeText={setAddDoctorName} />
            <Text style={styles.label}>Specialty</Text>
            <TextInput style={styles.input} placeholder="e.g. Cardiologist" placeholderTextColor={C.textTertiary} value={addDoctorSpecialty} onChangeText={setAddDoctorSpecialty} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAddDoctorModal(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.confirmBtn, !addDoctorName.trim() && { opacity: 0.5 }]} onPress={handleAddDoctorFromForm} disabled={!addDoctorName.trim()}><Text style={styles.confirmText}>Add</Text></Pressable>
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
  aptRecurrence: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2, fontStyle: "italic" },
  aptMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  aptMetaText: { fontWeight: "400", fontSize: 11, color: C.textSecondary, marginRight: 8 },
  noAptForDate: { backgroundColor: C.surface, borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: C.border },
  noAptText: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 8 },
  emptyDesc: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  noteCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, gap: 10 },
  noteBullet: { width: 24, height: 24, borderRadius: 7, backgroundColor: C.greenLight, alignItems: "center", justifyContent: "center" },
  noteText: { fontWeight: "400", fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 400, borderWidth: 1, borderColor: C.border },
  modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  fieldRow: { flexDirection: "row", gap: 10 },
  doctorSelect: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14, minHeight: 48 },
  doctorSelectText: { fontWeight: "500", fontSize: 14, color: C.text },
  dropdown: { marginBottom: 14, maxHeight: 200, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: "hidden", backgroundColor: C.surfaceElevated },
  dropdownRow: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownRowSelected: { backgroundColor: C.tintLight },
  dropdownText: { fontWeight: "500", fontSize: 14, color: C.text },
  dropdownSub: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  addNewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addNewDoctorBtn: { minHeight: 48, justifyContent: "center" },
  addNewText: { fontWeight: "500", fontSize: 13, color: C.tint },
  repeatRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  repeatChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  repeatChipActive: { backgroundColor: C.purpleLight, borderColor: C.purple },
  repeatChipText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  repeatChipTextActive: { color: C.purple },
  customRepeat: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  unitBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  unitBtnActive: { backgroundColor: C.purpleLight, borderColor: C.purple },
  unitBtnText: { fontWeight: "500", fontSize: 12, color: C.text },
  editModeRow: { marginBottom: 14 },
  editModeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated, alignItems: "center" },
  cancelText: { fontWeight: "600", fontSize: 14, color: C.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.purple, alignItems: "center" },
  confirmText: { fontWeight: "600", fontSize: 14, color: "#fff" },
});
