import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import TextInput from "@/components/DoneTextInput";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  appointmentStorage,
  healthLogStorage,
  hydrationStorage,
  convertHydrationToMl,
  medicationLogStorage,
  medicationStorage,
  symptomStorage,
  type Appointment,
  type HealthLog,
  type Medication,
  type MedicationLog,
  type Symptom,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";
import {
  formatCaregiverMedicationStatus,
  getCaregiverStatus,
  getCaregiverStatusLabel,
  type CaregiverStatus,
} from "@/lib/caregiver-status";
import {
  acknowledgeCaregiverEvent,
  fetchCaregiverAccountabilityEvents,
  sendCaregiverReminder,
  type CaregiverAccountabilityEvent,
} from "@/lib/caregiver-linking";

type QuickAction = "note" | "symptom" | "appointment";

interface TimelineItem {
  id: string;
  title: string;
  meta: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}

interface CaregiverDashboardScreenProps {
  onNavigate?: (screen: string) => void;
  onAddMedicationForManagedPerson?: () => void;
  onOpenHydration?: () => void;
  launchAction?: "log-med" | "add-note" | null;
  onLaunchActionConsumed?: () => void;
}

function formatTime(value?: string) {
  if (!value) return "Time not set";
  const [hourRaw, minuteRaw] = value.split(":").map((part) => parseInt(part, 10));
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return value;
  const hour = hourRaw % 12 || 12;
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  return `${hour}:${String(minuteRaw).padStart(2, "0")} ${suffix}`;
}

function formatDateLabel(date: string) {
  if (date === getToday()) return "Today";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CaregiverDashboardScreen({
  onNavigate,
  onAddMedicationForManagedPerson,
  onOpenHydration,
  launchAction,
  onLaunchActionConsumed,
}: CaregiverDashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C, themeId), [C, themeId]);
  const { caregiverProfile } = useRole();
  const { user } = useAuth();
  const authUserId = (user as { id?: string } | null)?.id ?? null;
  const [status, setStatus] = useState<CaregiverStatus | null>(null);
  const [accountabilityEvents, setAccountabilityEvents] = useState<CaregiverAccountabilityEvent[]>([]);
  const [eventBusyId, setEventBusyId] = useState<string | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [hydrationTodayMl, setHydrationTodayMl] = useState(0);
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetail, setDraftDetail] = useState("");
  const [draftTime, setDraftTime] = useState("09:00");
  const today = getToday();

  const loadData = useCallback(async () => {
    const [nextStatus, meds, logs, apts, allHealthLogs, allSymptoms, hydrationToday] = await Promise.all([
      getCaregiverStatus(caregiverProfile),
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      appointmentStorage.getAll(),
      healthLogStorage.getAll(),
      symptomStorage.getAll(),
      hydrationStorage.getByDateRange(today, today),
    ]);
    setStatus(nextStatus);
    setMedications(meds.filter((med) => (med.entryOwner ?? "self") === "care_recipient"));
    setMedLogs(logs);
    setAppointments(apts.filter((apt) => (apt.entryOwner ?? "self") === "care_recipient"));
    setHealthLogs(allHealthLogs.filter((log) => (log.entryOwner ?? "self") === "care_recipient"));
    setSymptoms(allSymptoms);
    setHydrationTodayMl(Math.round(hydrationToday.reduce((sum, entry) => sum + convertHydrationToMl(entry.amount, entry.unit), 0)));
    const eventResult = await fetchCaregiverAccountabilityEvents(authUserId, 8);
    setAccountabilityEvents(eventResult.events);
  }, [authUserId, caregiverProfile, today]);

  useEffect(() => {
    loadData().catch(() => {});
  }, [loadData]);

  const statusLabel = status ? getCaregiverStatusLabel(status) : "pending";
  const statusCopy = {
    good: { dot: "🟢", text: "All good", color: C.green },
    pending: { dot: "🟡", text: "Pending items", color: C.orange },
    urgent: { dot: "🔴", text: "Urgent / missed meds", color: C.red },
  }[statusLabel];

  const scheduledMeds = medications.filter((med) => med.active && (med.medicationType ?? "scheduled") !== "prn");
  const weeklyStart = new Date();
  weeklyStart.setDate(weeklyStart.getDate() - 6);
  const weeklyStartKey = weeklyStart.toISOString().slice(0, 10);
  const weeklyDoseCount = scheduledMeds.reduce((sum, med) => sum + (med.doses?.length || 1) * 7, 0);
  const weeklyTakenCount = useMemo(() => {
    return medLogs.filter((log) => log.taken).length;
  }, [medLogs]);
  const adherence = weeklyDoseCount > 0 ? Math.min(100, Math.round((weeklyTakenCount / weeklyDoseCount) * 100)) : 0;
  const appointmentsThisWeek = appointments.filter((apt) => apt.date >= today && apt.date <= new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10)).length;
  const hydrationValue = hydrationTodayMl > 0 ? `${hydrationTodayMl} mL` : "Log";
  const hydrationLabel = hydrationTodayMl > 0 ? "hydration today" : "hydration";

  const timeline: TimelineItem[] = useMemo(() => {
    const medItems = medLogs
      .filter((log) => log.taken)
      .map((log) => ({
        id: log.id,
        title: medications.find((med) => med.id === log.medicationId)?.name ?? "Medication taken",
        meta: log.recordedAt ? new Date(log.recordedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Today",
        icon: "medical-outline" as const,
      }));
    const symptomItems = symptoms
      .filter((symptom) => symptom.date === today)
      .map((symptom) => ({
        id: symptom.id,
        title: symptom.name,
        meta: `Symptom logged · severity ${symptom.severity}`,
        icon: "pulse-outline" as const,
      }));
    const appointmentItems = appointments
      .filter((apt) => apt.date >= today)
      .slice(0, 2)
      .map((apt) => ({
        id: apt.id,
        title: apt.doctorName || "Appointment",
        meta: `${formatDateLabel(apt.date)} · ${formatTime(apt.time)}`,
        icon: "calendar-outline" as const,
      }));
    const noteItems = healthLogs
      .filter((log) => log.date === today && log.notes.trim())
      .map((log) => ({
        id: log.id,
        title: "Care note",
        meta: log.notes,
        icon: "document-text-outline" as const,
      }));
    return [...medItems, ...symptomItems, ...appointmentItems, ...noteItems].slice(0, 6);
  }, [appointments, healthLogs, medLogs, medications, symptoms, today]);

  const openAction = useCallback((action: QuickAction) => {
    setQuickAction(action);
    setDraftTitle("");
    setDraftDetail("");
    setDraftTime(action === "appointment" ? "09:00" : new Date().toTimeString().slice(0, 5));
  }, []);

  const openAddMedication = () => {
    void Haptics.selectionAsync().catch(() => {});
    onAddMedicationForManagedPerson?.();
  };

  const acknowledgeEvent = async (event: CaregiverAccountabilityEvent) => {
    setEventBusyId(event.id);
    try {
      const result = await acknowledgeCaregiverEvent(event.id, authUserId);
      if (result.error) {
        Alert.alert("Couldn’t acknowledge", result.error.message);
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await loadData();
    } finally {
      setEventBusyId(null);
    }
  };

  const sendReminderForEvent = async (event: CaregiverAccountabilityEvent) => {
    setEventBusyId(event.id);
    try {
      const message =
        event.type === "missed_medication"
          ? "Hey, don't forget your medication."
          : event.type === "missed_appointment"
          ? "Did you mean to miss your appointment?"
          : "Just checking in. How are you feeling?";
      const result = await sendCaregiverReminder(event.patientUserId, message, authUserId);
      if (result.error) {
        Alert.alert("Couldn’t send reminder", result.error.message);
        return;
      }
      Alert.alert(event.type === "missed_medication" ? "Reminder sent" : "Check-in sent", message);
    } finally {
      setEventBusyId(null);
    }
  };

  const eventTone = (event: CaregiverAccountabilityEvent) => {
    if (event.type === "missed_medication") return { icon: "medical-outline" as const, color: C.red, label: "Missed med" };
    if (event.type === "missed_appointment") return { icon: "calendar-outline" as const, color: C.red, label: "Missed visit" };
    if (event.type === "sick_mode_activated" || event.type === "recovery_mode_active") return { icon: "pulse-outline" as const, color: C.orange, label: "Sick Mode" };
    return { icon: "document-text-outline" as const, color: C.orange, label: "No activity" };
  };

  const eventActionLabel = (event: CaregiverAccountabilityEvent) => {
    if (event.type === "missed_medication") return "Remind";
    return "Check in";
  };

  useEffect(() => {
    if (!launchAction) return;
    if (launchAction === "add-note") {
      openAction("note");
    } else if (launchAction === "log-med") {
      onNavigate?.("medications");
    }
    onLaunchActionConsumed?.();
  }, [launchAction, onLaunchActionConsumed, onNavigate, openAction]);

  const saveQuickAction = async () => {
    if (!quickAction) return;
    try {
      if (quickAction === "note") {
        await healthLogStorage.save({
          date: today,
          recordedAt: new Date().toISOString(),
          energy: 3,
          mood: 3,
          sleep: 3,
          notes: draftDetail.trim() || draftTitle.trim() || "Caregiver note",
          fasting: false,
          entryOwner: "care_recipient",
        });
      }
      if (quickAction === "symptom") {
        if (!draftTitle.trim()) return;
        await symptomStorage.save({
          date: today,
          recordedAt: new Date().toISOString(),
          name: draftTitle.trim(),
          severity: 3,
          notes: draftDetail.trim(),
        });
      }
      if (quickAction === "appointment") {
        if (!draftTitle.trim()) return;
        await appointmentStorage.save({
          doctorName: draftTitle.trim(),
          specialty: draftDetail.trim() || "Care appointment",
          date: today,
          time: draftTime,
          location: "",
          notes: "",
          entryOwner: "care_recipient",
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setQuickAction(null);
      await loadData();
    } catch {
      Alert.alert("Couldn’t save", "Try that again.");
    }
  };

  const modalTitle = quickAction === "note" ? "Add note" : quickAction === "symptom" ? "Add symptom" : "Add appointment";
  const topPad = isWide ? 28 : Platform.OS === "web" ? 40 : insets.top + 10;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: isWide ? 40 : insets.bottom + 118 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Caregiver</Text>
            <Text style={styles.title}>Dashboard</Text>
          </View>
          <Pressable style={styles.profileButton} onPress={() => onNavigate?.("managedperson")}>
            <Ionicons name="person-outline" size={18} color={C.tint} />
          </Pressable>
        </View>

        <View style={styles.overviewCard}>
          <View style={styles.overviewTop}>
            <View>
              <Text style={styles.personName}>{caregiverProfile?.name || "Managed person"}</Text>
              <Text style={styles.personMeta}>
                {caregiverProfile?.age ? `${caregiverProfile.age} years old` : "Age not set"}
                {caregiverProfile?.relation ? ` · ${caregiverProfile.relation}` : ""}
              </Text>
            </View>
            <View style={[styles.statusPill, { borderColor: statusCopy.color + "55" }]}>
              <Text style={styles.statusText}>{statusCopy.dot} {statusCopy.text}</Text>
            </View>
          </View>
        </View>

        <View style={styles.criticalCard}>
          <Text style={styles.sectionLabel}>Critical info</Text>
          <View style={styles.criticalRow}>
            <Ionicons name="medical-outline" size={20} color={status?.missedMedications.length ? C.red : C.tint} />
            <View style={styles.criticalText}>
              <Text style={styles.criticalTitle}>Medications</Text>
              <Text style={styles.criticalMeta}>Next dose: {formatCaregiverMedicationStatus(status?.nextMedication ?? null)}</Text>
              <Text style={[styles.criticalMeta, status?.missedMedications.length ? styles.alertText : null]}>
                Missed doses: {status?.missedMedications.length ?? 0}
              </Text>
            </View>
          </View>
          <View style={styles.criticalRow}>
            <Ionicons name="calendar-outline" size={20} color={status?.nextAppointment?.date === today ? C.orange : C.tint} />
            <View style={styles.criticalText}>
              <Text style={styles.criticalTitle}>Appointments</Text>
              <Text style={styles.criticalMeta}>
                {status?.nextAppointment ? `${status.nextAppointment.doctorName} · ${formatDateLabel(status.nextAppointment.date)} ${formatTime(status.nextAppointment.time)}` : "None scheduled"}
              </Text>
              {status?.nextAppointment?.date === today ? <Text style={styles.todayBadge}>Today</Text> : null}
            </View>
          </View>
          {(status?.alerts ?? []).map((alert) => (
            <View key={alert} style={styles.alertRow}>
              <Ionicons name="alert-circle-outline" size={18} color={alert.includes("missed") ? C.red : C.orange} />
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          ))}
        </View>

        {accountabilityEvents.length > 0 ? (
          <View style={styles.eventSection}>
            <View style={styles.eventSectionHeader}>
              <Text style={styles.sectionLabel}>Shared alerts</Text>
              <Pressable style={styles.dashboardMiniButton} onPress={() => onNavigate?.("caregiverdashboard")}>
                <Text style={styles.dashboardMiniButtonText}>Dashboard</Text>
              </Pressable>
            </View>
            {accountabilityEvents.slice(0, 4).map((event) => {
              const tone = eventTone(event);
              const acknowledged = Boolean(event.acknowledgedAt);
              return (
                <View key={event.id} style={[styles.eventCard, acknowledged && styles.eventCardAcknowledged]}>
                  <View style={[styles.eventIcon, { backgroundColor: tone.color + "18" }]}>
                    <Ionicons name={tone.icon} size={18} color={tone.color} />
                  </View>
                  <View style={styles.eventText}>
                    <Text style={styles.eventType}>{tone.label}</Text>
                    <Text style={styles.eventMessage} numberOfLines={2}>
                      {event.payload.message || "Something needs attention"}
                    </Text>
                    <Text style={styles.eventMeta}>
                      {new Date(event.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {acknowledged ? " · acknowledged" : ""}
                    </Text>
                  </View>
                  <View style={styles.eventActions}>
                    <Pressable
                      style={[styles.eventActionButton, eventBusyId === event.id && { opacity: 0.5 }]}
                      onPress={() => sendReminderForEvent(event)}
                      disabled={eventBusyId === event.id}
                    >
                      <Text style={styles.eventActionText}>{eventActionLabel(event)}</Text>
                    </Pressable>
                    {!acknowledged ? (
                      <Pressable
                        style={[styles.eventActionButton, eventBusyId === event.id && { opacity: 0.5 }]}
                        onPress={() => acknowledgeEvent(event)}
                        disabled={eventBusyId === event.id}
                      >
                        <Text style={styles.eventActionText}>Ack</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.actionsGrid}>
          {[
            ["medication", "Add medication", "medical-outline"],
            ["note", "Add note", "document-text-outline"],
            ["symptom", "Add symptom", "pulse-outline"],
            ["appointment", "Add appointment", "calendar-outline"],
          ].map(([action, label, icon]) => (
            <Pressable
              key={action}
              style={styles.actionButton}
              onPress={() => action === "medication" ? openAddMedication() : openAction(action as QuickAction)}
            >
              <Ionicons name={icon as React.ComponentProps<typeof Ionicons>["name"]} size={20} color={C.tint} />
              <Text style={styles.actionText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recent activity</Text>
          {timeline.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet today.</Text>
          ) : timeline.map((item) => (
            <View key={item.id} style={styles.timelineRow}>
              <Ionicons name={item.icon} size={18} color={C.textSecondary} />
              <View style={styles.timelineText}>
                <Text style={styles.timelineTitle}>{item.title}</Text>
                <Text style={styles.timelineMeta} numberOfLines={2}>{item.meta}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.snapshotRow}>
          <View style={styles.snapshotTile}>
            <Text style={styles.snapshotValue}>{adherence}%</Text>
            <Text style={styles.snapshotLabel}>weekly adherence</Text>
          </View>
          <Pressable style={styles.snapshotTile} onPress={onOpenHydration} accessibilityRole="button" accessibilityLabel="Open hydration log">
            <Text style={styles.snapshotValue}>{hydrationValue}</Text>
            <Text style={styles.snapshotLabel}>{hydrationLabel}</Text>
          </Pressable>
          <View style={styles.snapshotTile}>
            <Text style={styles.snapshotValue}>{appointmentsThisWeek}</Text>
            <Text style={styles.snapshotLabel}>visits this week</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={quickAction != null} transparent animationType="fade" onRequestClose={() => setQuickAction(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <TextInput
              style={styles.input}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder={quickAction === "appointment" ? "Doctor or appointment name" : quickAction === "symptom" ? "Symptom" : "Short title"}
              placeholderTextColor={C.textTertiary}
            />
            {quickAction === "appointment" ? (
              <TextInput style={styles.input} value={draftTime} onChangeText={setDraftTime} placeholder="09:00" placeholderTextColor={C.textTertiary} />
            ) : null}
            <TextInput
              style={[styles.input, styles.textArea]}
              value={draftDetail}
              onChangeText={setDraftDetail}
              placeholder={quickAction === "appointment" ? "Specialty or reason" : "Details"}
              placeholderTextColor={C.textTertiary}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setQuickAction(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={saveQuickAction}>
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: Theme, themeId: string) {
  const solidSurface = themeId === "dark" ? "#1B1719" : "#FFFCF8";
  const solidElevated = themeId === "dark" ? "#241F22" : "#FFFFFF";
  return StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: 18, gap: 14 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    eyebrow: { fontSize: 12, fontWeight: "800", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.6 },
    title: { fontSize: 30, fontWeight: "900", color: C.text },
    profileButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    overviewCard: { backgroundColor: solidSurface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
    overviewTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
    personName: { fontSize: 22, fontWeight: "900", color: C.text },
    personMeta: { marginTop: 4, fontSize: 13, fontWeight: "700", color: C.textSecondary },
    statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
    statusText: { fontSize: 12, fontWeight: "900", color: C.text },
    criticalCard: { backgroundColor: solidElevated, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
    sectionLabel: { fontSize: 12, fontWeight: "900", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.6 },
    criticalRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    criticalText: { flex: 1, minWidth: 0 },
    criticalTitle: { fontSize: 15, fontWeight: "900", color: C.text },
    criticalMeta: { marginTop: 3, fontSize: 13, fontWeight: "600", color: C.textSecondary },
    todayBadge: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: C.orangeLight, color: C.orange, fontWeight: "900", fontSize: 11 },
    alertRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 2 },
    alertText: { color: C.red, fontWeight: "900", fontSize: 13 },
    eventSection: { backgroundColor: solidSurface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
    eventSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    dashboardMiniButton: { minHeight: 30, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: solidElevated },
    dashboardMiniButtonText: { fontSize: 11, fontWeight: "900", color: C.tint },
    eventCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: solidElevated, padding: 10 },
    eventCardAcknowledged: { opacity: 0.62 },
    eventIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    eventText: { flex: 1, minWidth: 0 },
    eventType: { fontSize: 11, fontWeight: "900", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
    eventMessage: { marginTop: 2, fontSize: 13, fontWeight: "900", color: C.text, lineHeight: 18 },
    eventMeta: { marginTop: 3, fontSize: 11, fontWeight: "700", color: C.textSecondary },
    eventActions: { gap: 6, alignItems: "flex-end" },
    eventActionButton: { minHeight: 30, paddingHorizontal: 9, borderRadius: 999, backgroundColor: C.tintLight, alignItems: "center", justifyContent: "center" },
    eventActionText: { fontSize: 11, fontWeight: "900", color: C.tint },
    actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    actionButton: { width: "48%", minHeight: 72, backgroundColor: solidSurface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, justifyContent: "space-between" },
    actionText: { fontSize: 13, fontWeight: "900", color: C.text },
    section: { backgroundColor: solidSurface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
    emptyText: { color: C.textSecondary, fontWeight: "700" },
    timelineRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 3 },
    timelineText: { flex: 1, minWidth: 0 },
    timelineTitle: { fontSize: 14, fontWeight: "900", color: C.text },
    timelineMeta: { marginTop: 2, fontSize: 12, fontWeight: "600", color: C.textSecondary },
    snapshotRow: { flexDirection: "row", gap: 10 },
    snapshotTile: { flex: 1, backgroundColor: solidSurface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, minHeight: 84 },
    snapshotValue: { fontSize: 20, fontWeight: "900", color: C.text },
    snapshotLabel: { marginTop: 4, fontSize: 11, fontWeight: "800", color: C.textSecondary },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 18 },
    modalCard: { width: "100%", maxWidth: 420, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: C.border, backgroundColor: solidSurface },
    modalTitle: { fontSize: 20, fontWeight: "900", color: C.text },
    modalBody: { fontSize: 14, fontWeight: "700", color: C.textSecondary },
    input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: C.text, fontWeight: "700", backgroundColor: solidElevated },
    textArea: { minHeight: 92, textAlignVertical: "top" },
    modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
    secondaryButton: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: solidElevated },
    secondaryButtonText: { fontWeight: "900", color: C.textSecondary },
    primaryButton: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: C.tint },
    primaryButtonText: { fontWeight: "900", color: "#fff" },
  });
}
