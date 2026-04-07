import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Modal, Platform, Alert, useWindowDimensions, KeyboardAvoidingView,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  appointmentStorage,
  doctorNoteStorage,
  doctorsStorage,
  healthProfileStorage,
  type Appointment,
  type Doctor,
  type DoctorNote,
  type RepeatUnit,
  type HealthProfileInfo,
  type RecordOwner,
} from "@/lib/storage";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";

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

function dateStringFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function reminderTimeToDate(value: string) {
  const [hours, minutes] = (value || "09:00").split(":").map((part) => parseInt(part, 10));
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

function dateToReminderTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

type CalendarCell = {
  key: string;
  date: string;
  day: number;
  isCurrentMonth: boolean;
};

function CalendarView({
  appointments,
  selectedDate,
  onSelectDate,
  onJumpToToday,
  calStyles,
  colors: C,
}: {
  appointments: Appointment[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onJumpToToday: () => void;
  calStyles: ReturnType<typeof makeCalStyles>;
  colors: Theme;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    const selected = new Date(`${selectedDate}T00:00:00`);
    if (!Number.isNaN(selected.getTime())) {
      setViewMonth((prev) => {
        if (prev.year === selected.getFullYear() && prev.month === selected.getMonth()) return prev;
        return { year: selected.getFullYear(), month: selected.getMonth() };
      });
    }
  }, [selectedDate]);

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const monthName = new Date(viewMonth.year, viewMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = getToday();
  const isViewingTodayMonth = today.startsWith(`${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}`);

  const aptDates = new Set(appointments.map((a) => a.date));
  const prevMonthDate = viewMonth.month === 0
    ? { year: viewMonth.year - 1, month: 11 }
    : { year: viewMonth.year, month: viewMonth.month - 1 };
  const nextMonthDate = viewMonth.month === 11
    ? { year: viewMonth.year + 1, month: 0 }
    : { year: viewMonth.year, month: viewMonth.month + 1 };
  const prevMonthDays = new Date(prevMonthDate.year, prevMonthDate.month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    cells.push({
      key: `prev-${day}`,
      day,
      date: dateStringFromParts(prevMonthDate.year, prevMonthDate.month, day),
      isCurrentMonth: false,
    });
  }
  for (let i = 1; i <= daysInMonth; i += 1) {
    cells.push({
      key: `current-${i}`,
      day: i,
      date: dateStringFromParts(viewMonth.year, viewMonth.month, i),
      isCurrentMonth: true,
    });
  }
  const trailingCells = Math.ceil(cells.length / 7) * 7 - cells.length;
  for (let i = 1; i <= trailingCells; i += 1) {
    cells.push({
      key: `next-${i}`,
      day: i,
      date: dateStringFromParts(nextMonthDate.year, nextMonthDate.month, i),
      isCurrentMonth: false,
    });
  }

  const prevMonth = () => setViewMonth((v) => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () => setViewMonth((v) => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });

  return (
    <View style={calStyles.cal}>
      <View style={calStyles.calHeader}>
        <Pressable onPress={prevMonth} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous month"><Ionicons name="chevron-back" size={18} color={C.textSecondary} /></Pressable>
        <Text style={calStyles.calMonth} accessibilityRole="header">{monthName}</Text>
        <View style={calStyles.calHeaderActions}>
          {!isViewingTodayMonth && (
            <Pressable
              onPress={onJumpToToday}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Jump back to today"
              style={calStyles.todayBtn}
            >
              <Text style={calStyles.todayBtnText}>Today</Text>
            </Pressable>
          )}
          <Pressable onPress={nextMonth} hitSlop={12} accessibilityRole="button" accessibilityLabel="Next month"><Ionicons name="chevron-forward" size={18} color={C.textSecondary} /></Pressable>
        </View>
      </View>
      <View style={calStyles.calWeekRow}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <Text key={d} style={calStyles.calWeekDay}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.calGrid}>
        {cells.map((cell) => {
          const dateStr = cell.date;
          const isToday = dateStr === today;
          const hasApt = aptDates.has(dateStr);
          const isSelected = dateStr === selectedDate;
          return (
            <Pressable
              key={cell.key}
              style={[
                calStyles.calCell,
                !cell.isCurrentMonth && calStyles.calCellOutsideMonth,
                isSelected && calStyles.calCellSelected,
                isToday && !isSelected && calStyles.calCellToday,
              ]}
              onPress={() => onSelectDate(dateStr)}
              accessibilityRole="button"
              accessibilityLabel={`${new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}${!cell.isCurrentMonth ? ", other month" : ""}${hasApt ? ", has appointment" : ""}${isToday ? ", today" : ""}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  calStyles.calDay,
                  !cell.isCurrentMonth && calStyles.calDayOutsideMonth,
                  isSelected && { color: "#fff" },
                  isToday && !isSelected && { color: C.tint },
                ]}
              >
                {cell.day}
              </Text>
              {hasApt && <View style={[calStyles.calDot, isSelected && { backgroundColor: "#fff" }]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeCalStyles(C: Theme) {
  return StyleSheet.create({
    cal: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
    calHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    calHeaderActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    calMonth: { fontWeight: "600", fontSize: 15, color: C.text },
    todayBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.tintLight, borderWidth: 1, borderColor: C.border },
    todayBtnText: { fontWeight: "600", fontSize: 11, color: C.tint, textTransform: "uppercase", letterSpacing: 0.4 },
    calWeekRow: { flexDirection: "row", marginBottom: 6 },
    calWeekDay: { flex: 1, textAlign: "center", fontWeight: "500", fontSize: 11, color: C.textTertiary },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: { width: "14.28%", alignItems: "center", paddingVertical: 6 },
    calCellOutsideMonth: { opacity: 0.5 },
    calCellSelected: { backgroundColor: C.tint, borderRadius: 8 },
    calCellToday: { backgroundColor: C.tintLight, borderRadius: 8 },
    calDay: { fontWeight: "500", fontSize: 13, color: C.text },
    calDayOutsideMonth: { color: C.textSecondary },
    calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.purple, marginTop: 2 },
  });
}

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: C } = useTheme();
  const calStyles = useMemo(() => makeCalStyles(C), [C]);
  const styles = useMemo(() => makeStyles(C), [C]);
  const isWide = width >= 768;
  const today = getToday();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [profile, setProfile] = useState<HealthProfileInfo>({ userRole: "self", backupCriticalMedications: [] });
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [showAptModal, setShowAptModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [editMode, setEditMode] = useState<"one" | "all">("one");
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTab] = useState<"calendar" | "notes">("calendar");

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);
  const [showInlineDoctorForm, setShowInlineDoctorForm] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState("");
  const [newDoctorHospital, setNewDoctorHospital] = useState("");
  const [newDoctorPhone, setNewDoctorPhone] = useState("");
  const [newDoctorAddress, setNewDoctorAddress] = useState("");
  const [aptDate, setAptDate] = useState("");
  const [aptTime, setAptTime] = useState("");
  const [aptNotes, setAptNotes] = useState("");
  const [aptEntryOwner, setAptEntryOwner] = useState<RecordOwner>("self");
  const [repeatOption, setRepeatOption] = useState<typeof REPEAT_OPTIONS[0]["value"]>("none");
  const [customInterval, setCustomInterval] = useState("1");
  const [customUnit, setCustomUnit] = useState<RepeatUnit>("week");
  const [noteText, setNoteText] = useState("");
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);

  const loadData = useCallback(async () => {
    const apts = await appointmentStorage.getAll();
    const [docs, n, profileInfo] = await Promise.all([doctorsStorage.getAll(), doctorNoteStorage.getAll(), healthProfileStorage.get()]);
    setAppointments(apts.sort((a, b) => a.date.localeCompare(b.date)));
    setDoctors(docs);
    setProfile(profileInfo);
    setNotes(n.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedDoctor = selectedDoctorId ? doctors.find((d) => d.id === selectedDoctorId) : null;

  const resetInlineDoctorForm = () => {
    setNewDoctorName("");
    setNewDoctorSpecialty("");
    setNewDoctorHospital("");
    setNewDoctorPhone("");
    setNewDoctorAddress("");
    setShowInlineDoctorForm(false);
  };

  const handleAddApt = async () => {
    if (!selectedDoctorId || !aptDate.trim()) return;
    const doc = doctors.find((d) => d.id === selectedDoctorId);
    const doctorName = doc?.name ?? "";
    const specialty = doc?.specialty ?? "";
    const location = doc?.hospital ?? "";

    const base: Omit<Appointment, "id"> = {
      doctor_id: selectedDoctorId,
      doctorName,
      specialty,
      date: aptDate.trim(),
      time: aptTime.trim() || "09:00",
      location,
      notes: aptNotes.trim(),
      entryOwner: aptEntryOwner,
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetAptForm();
    setShowAptModal(false);
    loadData();
  };

  const resetAptForm = () => {
    setSelectedDoctorId(null);
    setShowDoctorPicker(false);
    resetInlineDoctorForm();
    setAptDate("");
    setAptTime("09:00");
    setAptNotes("");
    setAptEntryOwner("self");
    setRepeatOption("none");
    setCustomInterval("1");
    setCustomUnit("week");
    setEditingApt(null);
    setShowTimePicker(false);
  };

  const openAppointmentModalForDate = useCallback((date: string) => {
    setSelectedDate(date);
    setEditingApt(null);
    setSelectedDoctorId(null);
    setShowDoctorPicker(false);
    resetInlineDoctorForm();
    setAptDate(date);
    setAptTime("09:00");
    setAptNotes("");
    setAptEntryOwner("self");
    setRepeatOption("none");
    setCustomInterval("1");
    setCustomUnit("week");
    setShowTimePicker(false);
    setShowAptModal(true);
  }, []);

  const handleAddDoctorInline = async () => {
    if (!newDoctorName.trim()) return;
    const doctor = await doctorsStorage.save({
      name: newDoctorName.trim(),
      specialty: newDoctorSpecialty.trim() || undefined,
      hospital: newDoctorHospital.trim() || undefined,
      phone: newDoctorPhone.trim() || undefined,
      address: newDoctorAddress.trim() || undefined,
    });
    const refreshed = [...doctors.filter((d) => d.id !== doctor.id), doctor].sort((a, b) => a.name.localeCompare(b.name));
    setDoctors(refreshed);
    setSelectedDoctorId(doctor.id);
    setShowDoctorPicker(false);
    resetInlineDoctorForm();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    setShowDoctorPicker(false);
    resetInlineDoctorForm();
    setAptDate(apt.date);
    setAptTime(apt.time || "09:00");
    setAptNotes(apt.notes ?? "");
    setAptEntryOwner(apt.entryOwner ?? "self");
    setRepeatOption("none");
    setShowTimePicker(false);
    setShowAptModal(true);
  };

  const handleUpdateApt = async () => {
    if (!editingApt) return;
    const doc = selectedDoctorId ? doctors.find((d) => d.id === selectedDoctorId) : null;
    if (!doc || !aptDate.trim()) return;
    const updates: Partial<Appointment> = {
      doctor_id: selectedDoctorId ?? undefined,
      doctorName: doc.name,
      specialty: doc.specialty ?? "",
      date: aptDate.trim(),
      time: aptTime.trim() || "09:00",
      location: doc.hospital ?? "",
      notes: aptNotes.trim(),
      entryOwner: aptEntryOwner,
    };
    if (editMode === "one") {
      await appointmentStorage.update(editingApt.id, updates);
    } else {
      const parentId = editingApt.parent_recurring_id ?? editingApt.id;
      const toUpdate = appointments.filter((a) => a.id === editingApt.id || (a.parent_recurring_id === parentId && a.date >= editingApt.date));
      for (const a of toUpdate) {
        await appointmentStorage.update(a.id, { ...updates, date: a.date });
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetAptForm();
    setShowAptModal(false);
    loadData();
  };

  const handleDeleteApt = async (apt: Appointment) => {
    const doDelete = async () => {
      await appointmentStorage.delete(apt.id);
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
  const todayApts = appointments.filter((a) => a.date === today && (a.status === undefined || a.status === "completed"));
  const currentMonthPrefix = today.slice(0, 7);
  const upcoming = appointments.filter((a) => a.date > today && a.status === undefined && a.date.startsWith(currentMonthPrefix));
  const isRecurringApt = (a: Appointment) => a.is_recurring || a.parent_recurring_id;

  const markAppointmentStatus = useCallback(async (apt: Appointment, status: "completed" | "rescheduled" | "cancelled") => {
    await appointmentStorage.update(apt.id, { status });
    loadData();
  }, [loadData]);

  const handleCompleteToday = useCallback(async (apt: Appointment) => {
    await markAppointmentStatus(apt, "completed");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [markAppointmentStatus]);

  const openRescheduleFor = useCallback((apt: Appointment) => {
    setRescheduleApt(apt);
    setRescheduleDate("");
    setRescheduleTime(apt.time || "09:00");
    setShowRescheduleModal(true);
  }, []);

  const handleRescheduleConfirm = useCallback(async () => {
    if (!rescheduleApt || !rescheduleDate.trim()) return;
    const newDate = rescheduleDate.trim();
    const newTime = rescheduleTime.trim() || "09:00";
    const base: Omit<Appointment, "id"> = {
      doctor_id: rescheduleApt.doctor_id,
      doctorName: rescheduleApt.doctorName,
      specialty: rescheduleApt.specialty,
      date: newDate,
      time: newTime,
      location: rescheduleApt.location ?? "",
      notes: rescheduleApt.notes ?? "",
      entryOwner: rescheduleApt.entryOwner ?? "self",
    };
    await appointmentStorage.save(base);
    await markAppointmentStatus(rescheduleApt, "rescheduled");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowRescheduleModal(false);
    setRescheduleApt(null);
    setRescheduleDate("");
    setRescheduleTime("");
    loadData();
  }, [rescheduleApt, rescheduleDate, rescheduleTime, markAppointmentStatus, loadData]);

  const overdueApts = useMemo(
    () => appointments.filter((a) => a.date < today && a.status === undefined),
    [appointments, today]
  );
  const isCaregiver = profile.userRole === "caregiver" && !!profile.caredForName?.trim();
  const ownerOptions: { value: RecordOwner; label: string }[] = [
    { value: "self", label: "You" },
    ...(isCaregiver ? [{ value: "care_recipient" as const, label: profile.caredForName!.trim() }] : []),
  ];
  const getOwnerLabel = (owner?: RecordOwner) => owner === "care_recipient" && isCaregiver ? profile.caredForName!.trim() : "You";
  const firstOverdueApt = overdueApts[0] ?? null;
  useEffect(() => {
    if (!firstOverdueApt || showRescheduleModal) return;
    const apt = firstOverdueApt;
    const title = "Past appointment";
    const message = `${apt.doctorName}${apt.specialty ? ` (${apt.specialty})` : ""} on ${formatDate(apt.date)} was not marked.`;
    Alert.alert(title, message, [
      { text: "Completed", onPress: () => { markAppointmentStatus(apt, "completed"); } },
      { text: "Rescheduled", onPress: () => { openRescheduleFor(apt); } },
      { text: "Cancelled", onPress: () => { markAppointmentStatus(apt, "cancelled"); } },
    ]);
  }, [firstOverdueApt, showRescheduleModal, markAppointmentStatus, openRescheduleFor]);

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, {
        paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
        paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
      }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Appointments</Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => {
              resetAptForm();
              if (tab === "calendar") {
                setAptTime("09:00");
                setShowAptModal(true);
              } else {
                setShowNoteModal(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={tab === "calendar" ? "Add appointment" : "Add doctor note"}
            hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
          >
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
              <CalendarView
                appointments={appointments}
                selectedDate={selectedDate}
                onSelectDate={openAppointmentModalForDate}
                onJumpToToday={() => setSelectedDate(today)}
                calStyles={calStyles}
                colors={C}
              />
              {appointments.length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="calendar-outline" size={40} color={C.textTertiary} />
                  <Text style={styles.emptyTitle}>No appointments scheduled</Text>
                  <Text style={styles.emptyDesc}>Tap + to add an appointment</Text>
                </View>
              )}
              {todayApts.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionLabel}>Today</Text>
                  {todayApts.map((apt) => (
                    <View key={apt.id} style={[styles.aptCard, apt.status === "completed" && styles.aptCardCompleted]}>
                      <Pressable onPress={() => apt.status !== "completed" && handleCompleteToday(apt)} style={styles.aptCompleteBtn} accessibilityRole="button" accessibilityLabel={apt.status === "completed" ? "Completed" : "Mark as completed"}>
                        {apt.status === "completed" ? <Ionicons name="checkmark-circle" size={24} color={C.green} /> : <Ionicons name="ellipse-outline" size={24} color={C.textTertiary} />}
                      </Pressable>
                      <View style={styles.aptDateBadge}>
                        <Text style={styles.aptDateDay}>{new Date(apt.date + "T00:00:00").getDate()}</Text>
                      </View>
                      <View style={styles.aptCardContent}>
                        <Text style={styles.aptDoctor} numberOfLines={1} ellipsizeMode="tail">{apt.doctorName}</Text>
                        {isCaregiver && <Text style={styles.ownerMeta}>{getOwnerLabel(apt.entryOwner)}</Text>}
                        {!!apt.specialty && <Text style={styles.aptSpec} numberOfLines={1} ellipsizeMode="tail">{apt.specialty}</Text>}
                        <View style={styles.aptMeta}>
                          <Ionicons name="time-outline" size={12} color={C.textSecondary} />
                          <Text style={styles.aptMetaText}>{formatTime12h(apt.time)}</Text>
                          {!!apt.location && (
                            <>
                              <Ionicons name="location-outline" size={12} color={C.textSecondary} />
                              <Text style={styles.aptMetaLocation} numberOfLines={1} ellipsizeMode="tail">{apt.location}</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <Pressable onPress={() => handleEditApt(apt)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Edit appointment with ${apt.doctorName}`}><Ionicons name="pencil-outline" size={16} color={C.textSecondary} /></Pressable>
                      <Pressable onPress={() => handleDeleteApt(apt)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Delete appointment with ${apt.doctorName}`}><Ionicons name="trash-outline" size={16} color={C.textTertiary} /></Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={isWide ? { flex: 1 } : undefined}>
              {selectedDate !== today && selectedApts.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>{formatDate(selectedDate)}</Text>
                  {selectedApts.map((apt) => (
                    <View key={apt.id} style={styles.aptCard}>
                      <View style={styles.aptDateBadge}>
                        <Text style={styles.aptDateDay}>{new Date(apt.date + "T00:00:00").getDate()}</Text>
                      </View>
                      <View style={styles.aptCardContent}>
                        <Text style={styles.aptDoctor} numberOfLines={1} ellipsizeMode="tail">{apt.doctorName}</Text>
                        {isCaregiver && <Text style={styles.ownerMeta}>{getOwnerLabel(apt.entryOwner)}</Text>}
                        {!!apt.specialty && <Text style={styles.aptSpec} numberOfLines={1} ellipsizeMode="tail">{apt.specialty}</Text>}
                        {getRecurrenceLabel(apt, appointments) && <Text style={styles.aptRecurrence}>{getRecurrenceLabel(apt, appointments)}</Text>}
                        <View style={styles.aptMeta}>
                          <Ionicons name="time-outline" size={12} color={C.textSecondary} />
                          <Text style={styles.aptMetaText}>{formatTime12h(apt.time)}</Text>
                          {!!apt.location && (
                            <>
                              <Ionicons name="location-outline" size={12} color={C.textSecondary} />
                              <Text style={styles.aptMetaLocation} numberOfLines={1} ellipsizeMode="tail">{apt.location}</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <Pressable onPress={() => handleEditApt(apt)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Edit appointment with ${apt.doctorName}`}><Ionicons name="pencil-outline" size={16} color={C.textSecondary} /></Pressable>
                      <Pressable onPress={() => handleDeleteApt(apt)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Delete appointment with ${apt.doctorName}`}><Ionicons name="trash-outline" size={16} color={C.textTertiary} /></Pressable>
                    </View>
                  ))}
                </View>
              ) : selectedDate !== today ? (
                <View style={styles.noAptForDate}>
                  <Text style={styles.noAptText}>No appointments on {formatDate(selectedDate)}</Text>
                </View>
              ) : null}

              {upcoming.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.sectionLabel}>Upcoming</Text>
                  {upcoming.slice(0, 5).map((apt) => (
                    <Pressable key={apt.id} style={styles.aptCard} onPress={() => setSelectedDate(apt.date)} onLongPress={() => handleDeleteApt(apt)} accessibilityRole="button" accessibilityLabel={`${apt.doctorName}${apt.specialty ? `, ${apt.specialty}` : ""}, ${formatDate(apt.date)}`} accessibilityHint="Tap to view, long press to delete">
                      <View style={styles.aptDateBadge}>
                        <Text style={styles.aptDateDay}>{new Date(apt.date + "T00:00:00").getDate()}</Text>
                        <Text style={styles.aptDateMonth}>{new Date(apt.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</Text>
                      </View>
                      <View style={styles.aptCardContent}>
                        <Text style={styles.aptDoctor} numberOfLines={1} ellipsizeMode="tail">{apt.doctorName}</Text>
                        {isCaregiver && <Text style={styles.ownerMeta}>{getOwnerLabel(apt.entryOwner)}</Text>}
                        {!!apt.specialty && <Text style={styles.aptSpec} numberOfLines={1} ellipsizeMode="tail">{apt.specialty}</Text>}
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
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}>
          <Pressable style={styles.overlay} onPress={() => { setShowAptModal(false); resetAptForm(); }} accessibilityLabel="Close">
            <Pressable style={styles.modal} onPress={() => {}}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                contentContainerStyle={styles.modalScrollContent}
              >
              <Text style={styles.modalTitle}>{editingApt ? "Edit Appointment" : "New Appointment"}</Text>
              {isCaregiver && (
                <>
                  <Text style={styles.label}>Who is this appointment for?</Text>
                  <View style={styles.ownerRow}>
                    {ownerOptions.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[styles.ownerChip, aptEntryOwner === option.value && styles.ownerChipActive]}
                        onPress={() => {
                          setAptEntryOwner(option.value);
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text style={[styles.ownerChipText, aptEntryOwner === option.value && styles.ownerChipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Text style={styles.label}>Doctor *</Text>
              <Pressable
                style={styles.doctorSelect}
                onPress={() => {
                  setShowDoctorPicker((prev) => !prev);
                  setShowInlineDoctorForm(false);
                }}
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
                  {doctors.length > 0 ? (
                    <ScrollView style={styles.pickerScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {doctors.map((d) => (
                        <Pressable
                          key={d.id}
                          style={[styles.dropdownRow, selectedDoctorId === d.id && styles.dropdownRowSelected]}
                          onPress={() => {
                            setSelectedDoctorId(d.id);
                            setShowDoctorPicker(false);
                            Haptics.selectionAsync();
                          }}
                        >
                          <Text style={styles.dropdownText}>{d.name}</Text>
                          {d.specialty ? <Text style={styles.dropdownSub}>{d.specialty}</Text> : null}
                          {d.hospital ? <Text style={styles.dropdownSub}>{d.hospital}</Text> : null}
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.emptyPickerText}>No doctors yet. Add one below.</Text>
                  )}
                  <Pressable
                    style={styles.inlineAddDoctorBtn}
                    onPress={() => setShowInlineDoctorForm((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel="Add doctor here"
                  >
                    <Ionicons name={showInlineDoctorForm ? "remove" : "add"} size={16} color={C.purple} />
                    <Text style={styles.inlineAddDoctorText}>{showInlineDoctorForm ? "Hide add doctor" : "Add doctor here"}</Text>
                  </Pressable>
                  {showInlineDoctorForm && (
                    <ScrollView
                      style={styles.inlineDoctorForm}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      <Text style={styles.label}>Doctor name *</Text>
                      <TextInput style={styles.input} placeholder="e.g. Dr. Smith" placeholderTextColor={C.textTertiary} value={newDoctorName} onChangeText={setNewDoctorName} />
                      <Text style={styles.label}>Specialty</Text>
                      <TextInput style={styles.input} placeholder="e.g. Endocrinologist" placeholderTextColor={C.textTertiary} value={newDoctorSpecialty} onChangeText={setNewDoctorSpecialty} />
                      <Text style={styles.label}>Hospital</Text>
                      <TextInput style={styles.input} placeholder="e.g. Boston Medical Center" placeholderTextColor={C.textTertiary} value={newDoctorHospital} onChangeText={setNewDoctorHospital} />
                      <Text style={styles.label}>Phone</Text>
                      <TextInput style={styles.input} placeholder="e.g. (555) 123-4567" placeholderTextColor={C.textTertiary} value={newDoctorPhone} onChangeText={setNewDoctorPhone} keyboardType="phone-pad" />
                      <Text style={styles.label}>Address</Text>
                      <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Office address" placeholderTextColor={C.textTertiary} value={newDoctorAddress} onChangeText={setNewDoctorAddress} multiline />
                      <View style={styles.modalActions}>
                        <Pressable style={styles.cancelBtn} onPress={resetInlineDoctorForm}>
                          <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable style={[styles.confirmBtn, !newDoctorName.trim() && { opacity: 0.5 }]} onPress={handleAddDoctorInline} disabled={!newDoctorName.trim()}>
                          <Text style={styles.confirmText}>Save Doctor</Text>
                        </Pressable>
                      </View>
                    </ScrollView>
                  )}
                </View>
              )}
              <Text style={styles.label}>Specialty</Text>
              <View style={styles.readonlyField}>
                <Text style={[styles.readonlyFieldText, !selectedDoctor?.specialty && { color: C.textTertiary }]}>
                  {selectedDoctor?.specialty || "Will fill in after you pick a doctor"}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
                  <TextInput style={styles.input} placeholder="2026-03-15" placeholderTextColor={C.textTertiary} value={aptDate} onChangeText={setAptDate} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Time</Text>
                  <Pressable
                    style={styles.inputButton}
                    onPress={() => setShowTimePicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Appointment time ${formatTime12h(aptTime || "09:00")}`}
                  >
                    <Text style={styles.inputButtonText}>{formatTime12h(aptTime || "09:00")}</Text>
                    <Ionicons name="time-outline" size={18} color={C.textSecondary} />
                  </Pressable>
                </View>
              </View>
              {Platform.OS === "ios" && showTimePicker && (
                <View style={styles.inlineTimePicker}>
                  <View style={styles.timePickerBleed}>
                    <DateTimePicker
                      value={reminderTimeToDate(aptTime || "09:00")}
                      mode="time"
                      display="spinner"
                      minuteInterval={1}
                      onChange={(_, date) => {
                        if (date) {
                          setAptTime(dateToReminderTime(date));
                        }
                      }}
                      style={styles.timePicker}
                    />
                  </View>
                  <Pressable style={[styles.confirmBtn, { marginTop: 8 }]} onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.confirmText}>Done</Text>
                  </Pressable>
                </View>
              )}
              <Text style={styles.label}>Location</Text>
              <View style={styles.readonlyField}>
                <Text style={[styles.readonlyFieldText, !selectedDoctor?.hospital && { color: C.textTertiary }]}>
                  {selectedDoctor?.hospital || "Will fill in after you pick a doctor"}
                </Text>
              </View>
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
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showRescheduleModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => { setShowRescheduleModal(false); setRescheduleApt(null); }}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Reschedule</Text>
            {rescheduleApt && (
              <>
                <Text style={styles.label}>New date (YYYY-MM-DD) *</Text>
                <TextInput style={styles.input} placeholder="2026-03-20" placeholderTextColor={C.textTertiary} value={rescheduleDate} onChangeText={setRescheduleDate} />
                <Text style={styles.label}>New time (HH:MM)</Text>
                <TextInput style={styles.input} placeholder="09:00" placeholderTextColor={C.textTertiary} value={rescheduleTime} onChangeText={setRescheduleTime} />
                <View style={styles.modalActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => { setShowRescheduleModal(false); setRescheduleApt(null); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                  <Pressable style={[styles.confirmBtn, !rescheduleDate.trim() && { opacity: 0.5 }]} onPress={handleRescheduleConfirm} disabled={!rescheduleDate.trim()}><Text style={styles.confirmText}>Confirm</Text></Pressable>
                </View>
              </>
            )}
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

      {Platform.OS !== "ios" && (
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowTimePicker(false)} accessibilityLabel="Close time picker">
          <Pressable style={[styles.modal, styles.pickerModal]} onPress={() => {}}>
            <Text style={styles.modalTitle}>Appointment Time</Text>
            <DateTimePicker
              value={reminderTimeToDate(aptTime || "09:00")}
              mode="time"
              display="default"
              minuteInterval={1}
              onChange={(_, date) => {
                if (date) {
                  setAptTime(dateToReminderTime(date));
                }
                setShowTimePicker(false);
              }}
              style={styles.timePicker}
            />
          </Pressable>
        </Pressable>
      </Modal>
      )}
    </View>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
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
  aptCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 12 },
  aptCardCompleted: { backgroundColor: "rgba(48,209,88,0.08)", borderColor: "rgba(48,209,88,0.25)" },
  aptCompleteBtn: { padding: 4, marginRight: 2 },
  aptCardContent: { flex: 1, minWidth: 0, justifyContent: "center" },
  aptDateBadge: { width: 42, height: 42, borderRadius: 10, backgroundColor: C.purpleLight, alignItems: "center", justifyContent: "center" },
  aptDateDay: { fontWeight: "700", fontSize: 16, color: C.purple, lineHeight: 20 },
  aptDateMonth: { fontWeight: "500", fontSize: 9, color: C.purple, textTransform: "uppercase" },
  aptDoctor: { fontWeight: "600", fontSize: 14, color: C.text },
  ownerMeta: { fontWeight: "700", fontSize: 10, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 },
  aptSpec: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 1 },
  aptRecurrence: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginTop: 2, fontStyle: "italic" },
  aptMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, flex: 1, minWidth: 0 },
  aptMetaText: { fontWeight: "400", fontSize: 11, color: C.textSecondary, marginRight: 8 },
  aptMetaLocation: { fontWeight: "400", fontSize: 11, color: C.textSecondary, flex: 1, minWidth: 0 },
  noAptForDate: { backgroundColor: C.surface, borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: C.border },
  noAptText: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontWeight: "600", fontSize: 17, color: C.text, marginTop: 8 },
  emptyDesc: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  noteCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, gap: 10 },
  noteBullet: { width: 24, height: 24, borderRadius: 7, backgroundColor: C.greenLight, alignItems: "center", justifyContent: "center" },
  noteBulletNum: { fontWeight: "600", fontSize: 12, color: C.text },
  noteText: { fontWeight: "400", fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { backgroundColor: C.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 400, maxHeight: "88%", borderWidth: 1, borderColor: C.border },
  modalScrollContent: { paddingBottom: 28 },
  modalTitle: { fontWeight: "700", fontSize: 18, color: C.text, marginBottom: 16 },
  label: { fontWeight: "500", fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  ownerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  ownerChip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
  ownerChipActive: { backgroundColor: C.purpleLight, borderColor: C.purple },
  ownerChipText: { fontWeight: "600", fontSize: 13, color: C.textSecondary },
  ownerChipTextActive: { color: C.purple },
  input: { fontWeight: "400", fontSize: 14, color: C.text, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  readonlyField: { backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14, minHeight: 48, justifyContent: "center" },
  readonlyFieldText: { fontWeight: "400", fontSize: 14, color: C.text },
  fieldRow: { flexDirection: "row", gap: 10 },
  doctorSelect: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14, minHeight: 48 },
  doctorSelectText: { fontWeight: "500", fontSize: 14, color: C.text },
  inputButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14, minHeight: 48 },
  inputButtonText: { fontWeight: "400", fontSize: 14, color: C.text },
  dropdown: { marginBottom: 14, maxHeight: 200, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: "hidden", backgroundColor: C.surfaceElevated },
  dropdownRow: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownRowSelected: { backgroundColor: C.tintLight },
  dropdownText: { fontWeight: "500", fontSize: 14, color: C.text },
  dropdownSub: { fontWeight: "400", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  pickerScroll: { maxHeight: 280, marginBottom: 14 },
  emptyPickerText: { fontWeight: "400", fontSize: 14, color: C.textSecondary, marginBottom: 16, lineHeight: 20 },
  inlineTimePicker: { backgroundColor: C.surfaceElevated, borderRadius: 12, paddingTop: 8, paddingBottom: 8, paddingHorizontal: 0, borderWidth: 1, borderColor: C.border, marginTop: -2, marginBottom: 14, overflow: "hidden" },
  timePickerBleed: { marginHorizontal: -24, alignItems: "center" },
  timePicker: { alignSelf: "center", marginBottom: 12, width: Platform.OS === "ios" ? 320 : undefined },
  inlineAddDoctorBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  inlineAddDoctorText: { fontWeight: "600", fontSize: 13, color: C.purple },
  inlineDoctorForm: { paddingTop: 8, maxHeight: 280 },
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
}
