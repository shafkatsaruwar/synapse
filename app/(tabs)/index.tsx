import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Colors from "@/constants/colors";
import {
  healthLogStorage,
  medicationStorage,
  medicationLogStorage,
  appointmentStorage,
  doctorNoteStorage,
  type HealthLog,
  type Medication,
  type MedicationLog,
  type Appointment,
  type DoctorNote,
} from "@/lib/storage";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";

const C = Colors.dark;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [todayLog, setTodayLog] = useState<HealthLog | undefined>();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const today = getToday();

  const loadData = useCallback(async () => {
    const [log, meds, ml, apts, n] = await Promise.all([
      healthLogStorage.getByDate(today),
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      appointmentStorage.getAll(),
      doctorNoteStorage.getAll(),
    ]);
    setTodayLog(log);
    setMedications(meds.filter((m) => m.active));
    setMedLogs(ml);
    setAppointments(
      apts
        .filter((a) => a.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
    setNotes(n);
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const takenCount = medLogs.filter((l) => l.taken).length;
  const totalMeds = medications.length;
  const nextAppointment = appointments[0];

  const energyLabels = ["", "Low", "Fair", "Good", "Great", "Excellent"];
  const energyColors = ["", C.danger, C.warning, C.tint, C.success, C.accent];

  return (
    <View style={[styles.container]}>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.tint}
          />
        }
      >
        <Text style={styles.greeting}>Seha</Text>
        <Text style={styles.dateText}>{formatDate(today)}</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: C.tintLight }]}>
              <Ionicons name="pulse-outline" size={20} color={C.tint} />
            </View>
            <Text style={styles.cardTitle}>Today's Status</Text>
          </View>
          {todayLog ? (
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Energy</Text>
                <Text
                  style={[
                    styles.statusValue,
                    { color: energyColors[todayLog.energy] },
                  ]}
                >
                  {energyLabels[todayLog.energy]}
                </Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Fasting</Text>
                <Text
                  style={[
                    styles.statusValue,
                    { color: todayLog.fasting ? C.tint : C.textSecondary },
                  ]}
                >
                  {todayLog.fasting ? "Yes" : "No"}
                </Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Symptoms</Text>
                <Text style={styles.statusValue}>
                  {todayLog.symptoms.length || "None"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="add-circle-outline"
                size={28}
                color={C.textTertiary}
              />
              <Text style={styles.emptyText}>No log for today yet</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: C.accentLight }]}>
              <Ionicons name="medkit-outline" size={20} color={C.accent} />
            </View>
            <Text style={styles.cardTitle}>Medications</Text>
          </View>
          {totalMeds > 0 ? (
            <View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        totalMeds > 0
                          ? `${(takenCount / totalMeds) * 100}%`
                          : "0%",
                      backgroundColor: C.accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {takenCount} of {totalMeds} taken today
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="medical-outline"
                size={28}
                color={C.textTertiary}
              />
              <Text style={styles.emptyText}>No medications added</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[styles.iconCircle, { backgroundColor: C.warningLight }]}
            >
              <Ionicons name="calendar-outline" size={20} color={C.warning} />
            </View>
            <Text style={styles.cardTitle}>Next Appointment</Text>
          </View>
          {nextAppointment ? (
            <View>
              <Text style={styles.aptDoctor}>{nextAppointment.doctorName}</Text>
              <Text style={styles.aptSpecialty}>
                {nextAppointment.specialty}
              </Text>
              <View style={styles.aptDetails}>
                <View style={styles.aptDetailItem}>
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={C.textSecondary}
                  />
                  <Text style={styles.aptDetailText}>
                    {formatDate(nextAppointment.date)}
                  </Text>
                </View>
                <View style={styles.aptDetailItem}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={C.textSecondary}
                  />
                  <Text style={styles.aptDetailText}>
                    {formatTime12h(nextAppointment.time)}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="calendar-clear-outline"
                size={28}
                color={C.textTertiary}
              />
              <Text style={styles.emptyText}>No upcoming appointments</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[styles.iconCircle, { backgroundColor: C.successLight }]}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color={C.success}
              />
            </View>
            <Text style={styles.cardTitle}>Doctor Notes</Text>
          </View>
          {notes.length > 0 ? (
            <View>
              {notes.slice(0, 3).map((note) => (
                <View key={note.id} style={styles.noteItem}>
                  <View style={styles.noteDot} />
                  <Text style={styles.noteText} numberOfLines={1}>
                    {note.text}
                  </Text>
                </View>
              ))}
              {notes.length > 3 && (
                <Text style={styles.moreText}>
                  +{notes.length - 3} more questions
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="create-outline"
                size={28}
                color={C.textTertiary}
              />
              <Text style={styles.emptyText}>
                No questions for your doctor yet
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  greeting: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: C.text,
    marginBottom: 4,
  },
  dateText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.textSecondary,
    marginBottom: 24,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.text,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusItem: {
    flex: 1,
    alignItems: "center",
  },
  statusDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.border,
  },
  statusLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 4,
  },
  statusValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textTertiary,
  },
  progressBar: {
    height: 6,
    backgroundColor: C.surfaceElevated,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
  },
  aptDoctor: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.text,
    marginBottom: 2,
  },
  aptSpecialty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 12,
  },
  aptDetails: {
    flexDirection: "row",
    gap: 16,
  },
  aptDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aptDetailText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
  },
  noteItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 10,
  },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  noteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
    flex: 1,
  },
  moreText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textTertiary,
    marginTop: 4,
  },
});
