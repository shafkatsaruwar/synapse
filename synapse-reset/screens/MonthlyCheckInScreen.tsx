import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, useWindowDimensions,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  appointmentStorage,
  doctorNoteStorage,
  monthlyCheckInStorage,
  type Appointment,
  type DoctorNote,
  type MonthlyCheckIn,
} from "@/lib/storage";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";

type ReviewResponseMap = Record<string, boolean | undefined>;

function noteMatchesAppointment(note: DoctorNote, appointment: Appointment) {
  if (note.appointmentId) return note.appointmentId === appointment.id;
  if (note.appointmentDate && note.appointmentDate !== appointment.date) return false;
  if (note.appointmentTime && note.appointmentTime !== appointment.time) return false;
  if (note.doctorId && appointment.doctor_id) return note.doctorId === appointment.doctor_id;
  if (note.doctorName?.trim() && appointment.doctorName?.trim()) {
    return note.doctorName.trim().toLowerCase() === appointment.doctorName.trim().toLowerCase();
  }
  return false;
}

function formatLatestCheckInItems(latest: MonthlyCheckIn | null) {
  if (!latest) return [] as { label: string; value: string }[];
  return [
    latest.bp ? { label: "Blood pressure", value: `${latest.bp} mmHg` } : null,
    latest.weight ? { label: "Weight", value: `${latest.weight} ${latest.weightUnit || ""}`.trim() } : null,
    latest.height ? { label: "Height", value: `${latest.height} ${latest.heightUnit || ""}`.trim() } : null,
    latest.heartRate ? { label: "Heart rate", value: `${latest.heartRate} bpm` } : null,
    latest.ecgNotes ? { label: "ECG", value: latest.ecgNotes } : null,
    latest.mentalHealthNotes ? { label: "Mental health", value: latest.mentalHealthNotes } : null,
    typeof latest.reviewedAppointmentCount === "number"
      ? { label: "Visits reviewed", value: String(latest.reviewedAppointmentCount) }
      : null,
    typeof latest.talkedAboutCount === "number"
      ? { label: "Talked about", value: String(latest.talkedAboutCount) }
      : null,
    typeof latest.notTalkedAboutCount === "number"
      ? { label: "Not talked about", value: String(latest.notTalkedAboutCount) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];
}

export default function MonthlyCheckInScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [latest, setLatest] = useState<MonthlyCheckIn | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);
  const [appointmentResponses, setAppointmentResponses] = useState<ReviewResponseMap>({});
  const [noteResponses, setNoteResponses] = useState<ReviewResponseMap>({});
  const [bp, setBp] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("in");
  const [heartRate, setHeartRate] = useState("");
  const [ecgNotes, setEcgNotes] = useState("");
  const [mentalHealthNotes, setMentalHealthNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const today = getToday();
  const currentMonthKey = today.slice(0, 7);
  const currentMonthDateLabel = useMemo(
    () => new Date(`${currentMonthKey}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [currentMonthKey],
  );

  const loadData = useCallback(async () => {
    const [allCheckIns, allAppointments, allNotes] = await Promise.all([
      monthlyCheckInStorage.getAll(),
      appointmentStorage.getAll(),
      doctorNoteStorage.getAll(),
    ]);

    const sortedCheckIns = [...allCheckIns].sort((a, b) => b.date.localeCompare(a.date));
    setLatest(sortedCheckIns[0] ?? null);

    const reviewableAppointments = allAppointments
      .filter((appointment) => {
        if (appointment.date.slice(0, 7) !== currentMonthKey) return false;
        if (appointment.date > today) return false;
        if (appointment.status === "cancelled" || appointment.status === "rescheduled") return false;
        return true;
      })
      .sort((a, b) => `${a.date}T${a.time || "09:00"}`.localeCompare(`${b.date}T${b.time || "09:00"}`));

    const safeNotes = allNotes
      .filter((note): note is DoctorNote => !!note && typeof note.text === "string")
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

    setAppointments(reviewableAppointments);
    setDoctorNotes(safeNotes);
    setAppointmentResponses((prev) => {
      const next: ReviewResponseMap = {};
      for (const appointment of reviewableAppointments) {
        next[appointment.id] = prev[appointment.id] ?? appointment.monthlyReviewOccurred ?? (appointment.status === "completed" ? true : undefined);
      }
      return next;
    });
    setNoteResponses((prev) => {
      const next: ReviewResponseMap = {};
      for (const note of safeNotes) {
        next[note.id] = prev[note.id] ?? note.talkedAbout;
      }
      return next;
    });
  }, [currentMonthKey, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const notesByAppointment = useMemo(() => {
    const map: Record<string, DoctorNote[]> = {};
    for (const appointment of appointments) {
      map[appointment.id] = doctorNotes.filter((note) => noteMatchesAppointment(note, appointment));
    }
    return map;
  }, [appointments, doctorNotes]);

  const latestSummaryItems = useMemo(() => formatLatestCheckInItems(latest), [latest]);
  const currentMonthCheckInDone = latest?.date.slice(0, 7) === currentMonthKey;

  const setAppointmentResponse = (appointmentId: string, value: boolean) => {
    setAppointmentResponses((prev) => ({ ...prev, [appointmentId]: value }));
    Haptics.selectionAsync();
  };

  const setNoteResponse = (noteId: string, value: boolean) => {
    setNoteResponses((prev) => ({ ...prev, [noteId]: value }));
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    setSaving(true);
    const reviewedAppointments = appointments.filter((appointment) => typeof appointmentResponses[appointment.id] === "boolean");
    const answeredNotes = doctorNotes.filter((note) => typeof noteResponses[note.id] === "boolean");
    const talkedAboutCount = answeredNotes.filter((note) => noteResponses[note.id] === true).length;
    const notTalkedAboutCount = answeredNotes.filter((note) => noteResponses[note.id] === false).length;
    const reviewedAt = new Date().toISOString();

    await monthlyCheckInStorage.save({
      date: today,
      bp: bp.trim() || undefined,
      weight: weight.trim() || undefined,
      weightUnit: weight.trim() ? weightUnit : undefined,
      height: height.trim() || undefined,
      heightUnit: height.trim() ? heightUnit : undefined,
      heartRate: heartRate.trim() || undefined,
      ecgNotes: ecgNotes.trim() || undefined,
      mentalHealthNotes: mentalHealthNotes.trim() || undefined,
      reviewedAppointmentCount: reviewedAppointments.length || undefined,
      talkedAboutCount: talkedAboutCount || undefined,
      notTalkedAboutCount: notTalkedAboutCount || undefined,
    });

    await Promise.all([
      ...reviewedAppointments.map((appointment) => appointmentStorage.update(appointment.id, {
        monthlyReviewOccurred: appointmentResponses[appointment.id],
        monthlyReviewOccurredAt: reviewedAt,
      })),
      ...answeredNotes.map((note) => doctorNoteStorage.update(note.id, {
        talkedAbout: noteResponses[note.id],
        talkedAboutAt: noteResponses[note.id] ? reviewedAt : undefined,
      })),
    ]);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBp("");
    setWeight("");
    setHeight("");
    setHeartRate("");
    setEcgNotes("");
    setMentalHealthNotes("");
    await loadData();
    setSaving(false);
  };

  const topPad = isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad,
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Monthly check-in</Text>
      <Text style={styles.subtitle}>
        {latest
          ? `Last check-in: ${formatDate(latest.date)}`
          : "Record vitals, reflect on how you’re doing, and close the loop on doctor visits once a month."}
      </Text>

      {latest && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Last check-in details</Text>
            <Text style={styles.summaryDate}>{formatDate(latest.date)}</Text>
          </View>
          {latestSummaryItems.length ? (
            <View style={styles.summaryGrid}>
              {latestSummaryItems.map((item) => (
                <View key={item.label} style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={styles.summaryValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.summaryEmpty}>No extra details were recorded in the last check-in.</Text>
          )}
        </View>
      )}

      {currentMonthCheckInDone ? (
        <View style={styles.lockedCard}>
          <View style={styles.lockedIcon}>
            <Ionicons name="checkmark-circle" size={22} color={C.tint} />
          </View>
          <Text style={styles.lockedTitle}>You already checked in for {currentMonthDateLabel}</Text>
          <Text style={styles.lockedText}>
            Monthly check-ins unlock once per month. You’ll be able to log the next one when the new month starts.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.reviewCard}>
            <Text style={styles.sectionTitle}>Doctor visit review</Text>
            <Text style={styles.sectionSubtitle}>Quick yes or no. Did the visit happen, and if it did, were your notes actually discussed?</Text>
            {appointments.length === 0 ? (
              <Text style={styles.reviewEmpty}>No doctor visits to review this month yet.</Text>
            ) : (
              <View style={styles.reviewList}>
                {appointments.map((appointment) => {
                  const relatedNotes = notesByAppointment[appointment.id] ?? [];
                  const happened = appointmentResponses[appointment.id];
                  return (
                    <View key={appointment.id} style={styles.reviewItem}>
                      <Text style={styles.reviewPrompt}>
                        {`Did you see ${appointment.doctorName || "this doctor"} at ${formatTime12h(appointment.time || "09:00")} on ${formatDate(appointment.date)}?`}
                      </Text>
                      <View style={styles.choiceRow}>
                        {[{ label: "Yes", value: true }, { label: "No", value: false }].map((choice) => {
                          const active = happened === choice.value;
                          return (
                            <Pressable
                              key={choice.label}
                              style={[styles.choiceChip, active && styles.choiceChipActive]}
                              onPress={() => setAppointmentResponse(appointment.id, choice.value)}
                              accessibilityRole="button"
                              accessibilityLabel={`${choice.label} for ${appointment.doctorName} appointment`}
                            >
                              <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{choice.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {happened === true ? (
                        relatedNotes.length ? (
                          <View style={styles.noteReviewList}>
                            {relatedNotes.map((note) => {
                              const discussed = noteResponses[note.id];
                              return (
                                <View key={note.id} style={styles.noteReviewCard}>
                                  <Text style={styles.noteReviewQuestion}>Was this talked about?</Text>
                                  <Text style={styles.noteReviewText}>{note.text}</Text>
                                  <View style={styles.choiceRow}>
                                    {[{ label: "Yes", value: true }, { label: "No", value: false }].map((choice) => {
                                      const active = discussed === choice.value;
                                      return (
                                        <Pressable
                                          key={choice.label}
                                          style={[styles.choiceChip, active && styles.choiceChipActive]}
                                          onPress={() => setNoteResponse(note.id, choice.value)}
                                          accessibilityRole="button"
                                          accessibilityLabel={`${choice.label} for note review`}
                                        >
                                          <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{choice.label}</Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          <Text style={styles.reviewHelper}>No linked doctor notes for this visit. Clean slate.</Text>
                        )
                      ) : happened === false ? (
                        <Text style={styles.reviewHelper}>Cool. We’ll leave the linked notes alone for now.</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Blood pressure (mmHg)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 120/80"
              placeholderTextColor={C.textTertiary}
              value={bp}
              onChangeText={setBp}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Weight</Text>
              <TextInput
                style={styles.input}
                placeholder="Value"
                placeholderTextColor={C.textTertiary}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.unitChunk}>
              <Text style={styles.label}>Unit</Text>
              <View style={styles.unitRow}>
                {["lbs", "kg"].map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.unitChip, weightUnit === u && styles.unitChipActive]}
                    onPress={() => { setWeightUnit(u); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.unitChipText, weightUnit === u && styles.unitChipTextActive]}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Height</Text>
              <TextInput
                style={styles.input}
                placeholder="Value"
                placeholderTextColor={C.textTertiary}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.unitChunk}>
              <Text style={styles.label}>Unit</Text>
              <View style={styles.unitRow}>
                {["in", "cm"].map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.unitChip, heightUnit === u && styles.unitChipActive]}
                    onPress={() => { setHeightUnit(u); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.unitChipText, heightUnit === u && styles.unitChipTextActive]}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Heart rate (bpm) — Apple Watch</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 72"
              placeholderTextColor={C.textTertiary}
              value={heartRate}
              onChangeText={setHeartRate}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>ECG — Apple Watch</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Sinus rhythm, normal"
              placeholderTextColor={C.textTertiary}
              value={ecgNotes}
              onChangeText={setEcgNotes}
              multiline
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mental health</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="How are you feeling overall?"
              placeholderTextColor={C.textTertiary}
              value={mentalHealthNotes}
              onChangeText={setMentalHealthNotes}
              multiline
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save monthly check-in"
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>Save check-in</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: 24 },
    title: { fontWeight: "700", fontSize: 28, color: C.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: C.textSecondary, marginBottom: 24 },
    summaryCard: {
      backgroundColor: C.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
      marginBottom: 20,
    },
    summaryHeader: { gap: 4, marginBottom: 14 },
    summaryTitle: { fontSize: 18, fontWeight: "700", color: C.text },
    summaryDate: { fontSize: 13, color: C.textSecondary },
    summaryGrid: { gap: 12 },
    summaryItem: {
      backgroundColor: C.background,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
    },
    summaryLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, marginBottom: 6, textTransform: "uppercase" },
    summaryValue: { fontSize: 15, color: C.text, lineHeight: 22 },
    summaryEmpty: { fontSize: 14, color: C.textSecondary, lineHeight: 20 },
    lockedCard: {
      backgroundColor: C.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
      marginBottom: 12,
    },
    lockedIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.tintLight,
      marginBottom: 12,
    },
    lockedTitle: { fontSize: 18, fontWeight: "700", color: C.text, marginBottom: 8 },
    lockedText: { fontSize: 14, lineHeight: 22, color: C.textSecondary },
    reviewCard: {
      backgroundColor: C.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
      marginBottom: 20,
      gap: 10,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: C.text },
    sectionSubtitle: { fontSize: 14, color: C.textSecondary, lineHeight: 21 },
    reviewEmpty: { fontSize: 14, color: C.textSecondary, lineHeight: 21 },
    reviewList: { gap: 14 },
    reviewItem: {
      backgroundColor: C.background,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
      gap: 10,
    },
    reviewPrompt: { fontSize: 15, fontWeight: "600", color: C.text, lineHeight: 22 },
    choiceRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    choiceChip: {
      minWidth: 72,
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
    },
    choiceChipActive: { backgroundColor: C.tintLight, borderColor: C.tint },
    choiceChipText: { fontSize: 14, fontWeight: "600", color: C.textSecondary },
    choiceChipTextActive: { color: C.tint },
    noteReviewList: { gap: 10 },
    noteReviewCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
      gap: 10,
    },
    noteReviewQuestion: { fontSize: 12, fontWeight: "700", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
    noteReviewText: { fontSize: 14, color: C.text, lineHeight: 22 },
    reviewHelper: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
    field: { marginBottom: 16 },
    label: { fontWeight: "600", fontSize: 13, color: C.textSecondary, marginBottom: 6 },
    input: {
      backgroundColor: C.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: C.text,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
    },
    textArea: { minHeight: 80, textAlignVertical: "top" },
    row: { flexDirection: "row", gap: 12, marginBottom: 16 },
    unitChunk: { width: 100 },
    unitRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    unitChip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.surfaceElevated,
    },
    unitChipActive: { backgroundColor: C.tintLight, borderColor: C.tint },
    unitChipText: { fontSize: 14, fontWeight: "500", color: C.textSecondary },
    unitChipTextActive: { color: C.tint },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: C.tint,
      paddingVertical: 14,
      borderRadius: 14,
      marginTop: 8,
    },
    saveBtnText: { fontWeight: "600", fontSize: 16, color: "#fff" },
  });
}
