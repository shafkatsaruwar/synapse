import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import {
  healthLogStorage,
  medicationStorage,
  medicationLogStorage,
  appointmentStorage,
  symptomStorage,
  fastingLogStorage,
  vitalStorage,
  settingsStorage,
  type HealthLog,
  type Medication,
  type MedicationLog,
  type Appointment,
  type Symptom,
  type FastingLog,
  type Vital,
  type UserSettings,
} from "@/lib/storage";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";

const C = Colors.dark;

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  onRefreshKey?: number;
}

export default function DashboardScreen({ onNavigate, onRefreshKey }: DashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const today = getToday();

  const [todayLog, setTodayLog] = useState<HealthLog | undefined>();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todaySymptoms, setTodaySymptoms] = useState<Symptom[]>([]);
  const [fastingLog, setFastingLog] = useState<FastingLog | undefined>();
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false });
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const [log, meds, ml, apts, symp, fl, vit, sett] = await Promise.all([
      healthLogStorage.getByDate(today),
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      appointmentStorage.getAll(),
      symptomStorage.getByDate(today),
      fastingLogStorage.getByDate(today),
      vitalStorage.getAll(),
      settingsStorage.get(),
    ]);
    setTodayLog(log);
    setMedications(meds.filter((m) => m.active));
    setMedLogs(ml);
    setAppointments(apts.filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date)));
    setTodaySymptoms(symp);
    setFastingLog(fl);
    setVitals(vit);
    setSettings(sett);
    setLoaded(true);
  }, [today]);

  React.useEffect(() => {
    loadData();
  }, [loadData, onRefreshKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const takenCount = medLogs.filter((l) => l.taken).length;
  const totalMeds = medications.length;
  const nextApt = appointments[0];

  const dateObj = new Date();
  const greeting = dateObj.getHours() < 12 ? "Good morning" : dateObj.getHours() < 17 ? "Good afternoon" : "Good evening";

  const recentVitals = vitals
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + 16),
          paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />
      }
    >
      <View style={styles.welcome}>
        <Text style={styles.greetingText}>
          {greeting}{settings.name ? `, ${settings.name}` : ""}
        </Text>
        <Text style={styles.dateText}>
          {dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </Text>
        {todayLog ? (
          <View style={styles.summaryPill}>
            <View style={[styles.summaryDot, { backgroundColor: C.green }]} />
            <Text style={styles.summaryText}>
              Energy {todayLog.energy}/5 {todayLog.fasting ? " \u00B7 Fasting" : ""}
              {todaySymptoms.length > 0 ? ` \u00B7 ${todaySymptoms.length} symptom${todaySymptoms.length > 1 ? "s" : ""}` : ""}
            </Text>
          </View>
        ) : (
          <Pressable style={styles.summaryPill} onPress={() => onNavigate("log")}>
            <View style={[styles.summaryDot, { backgroundColor: C.textTertiary }]} />
            <Text style={styles.summaryText}>No log today. Tap to log.</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.grid, isWide && styles.gridWide]}>
        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("medications")}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: C.tintLight }]}>
              <Ionicons name="medical" size={16} color={C.tint} />
            </View>
            <Text style={styles.cardLabel}>Medications Today</Text>
          </View>
          {totalMeds > 0 ? (
            <View>
              <Text style={styles.cardBigNum}>{takenCount}<Text style={styles.cardBigNumSub}>/{totalMeds}</Text></Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${totalMeds > 0 ? (takenCount / totalMeds) * 100 : 0}%` }]} />
              </View>
              <Text style={styles.cardMeta}>{totalMeds - takenCount === 0 ? "All taken" : `${totalMeds - takenCount} remaining`}</Text>
            </View>
          ) : (
            <View style={styles.cardEmpty}>
              <Text style={styles.cardEmptyText}>No medications added</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("symptoms")}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: C.orangeLight }]}>
              <Ionicons name="pulse" size={16} color={C.orange} />
            </View>
            <Text style={styles.cardLabel}>Symptoms</Text>
          </View>
          {todaySymptoms.length > 0 ? (
            <View>
              <Text style={styles.cardBigNum}>{todaySymptoms.length}</Text>
              {todaySymptoms.slice(0, 3).map((s) => (
                <View key={s.id} style={styles.symptomRow}>
                  <View style={[styles.severityDot, { backgroundColor: s.severity >= 4 ? C.red : s.severity >= 2 ? C.orange : C.green }]} />
                  <Text style={styles.symptomText} numberOfLines={1}>{s.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.cardEmpty}>
              <Text style={styles.cardEmptyText}>No symptoms today</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("appointments")}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: C.purpleLight }]}>
              <Ionicons name="calendar" size={16} color={C.purple} />
            </View>
            <Text style={styles.cardLabel}>Appointments</Text>
          </View>
          {nextApt ? (
            <View>
              <Text style={styles.aptName}>{nextApt.doctorName}</Text>
              <Text style={styles.aptSpec}>{nextApt.specialty}</Text>
              <View style={styles.aptDateRow}>
                <Ionicons name="calendar-outline" size={13} color={C.textSecondary} />
                <Text style={styles.aptDateText}>{formatDate(nextApt.date)}</Text>
                <Ionicons name="time-outline" size={13} color={C.textSecondary} />
                <Text style={styles.aptDateText}>{formatTime12h(nextApt.time)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.cardEmpty}>
              <Text style={styles.cardEmptyText}>No upcoming visits</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("log")}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: C.yellowLight }]}>
              <Ionicons name="moon" size={16} color={C.yellow} />
            </View>
            <Text style={styles.cardLabel}>Fasting / Ramadan</Text>
          </View>
          {fastingLog ? (
            <View>
              <View style={styles.fastingRow}>
                <View style={styles.fastingItem}>
                  <Text style={styles.fastingLabel}>Suhoor</Text>
                  <Text style={styles.fastingValue}>{fastingLog.suhoorTime || "--"}</Text>
                </View>
                <View style={styles.fastingDivider} />
                <View style={styles.fastingItem}>
                  <Text style={styles.fastingLabel}>Iftar</Text>
                  <Text style={styles.fastingValue}>{fastingLog.iftarTime || "--"}</Text>
                </View>
                <View style={styles.fastingDivider} />
                <View style={styles.fastingItem}>
                  <Text style={styles.fastingLabel}>Water</Text>
                  <Text style={styles.fastingValue}>{fastingLog.hydrationGlasses} gl</Text>
                </View>
              </View>
              <View style={styles.energyRow}>
                <Text style={styles.fastingLabel}>Energy</Text>
                <View style={styles.energyDots}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.energyDot, i <= fastingLog.energyLevel && { backgroundColor: C.yellow }]} />
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.cardEmpty}>
              <Text style={styles.cardEmptyText}>{settings.ramadanMode ? "No fasting log today" : "Enable Ramadan mode in Settings"}</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("settings")}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: C.cyanLight }]}>
              <Ionicons name="fitness" size={16} color={C.cyan} />
            </View>
            <Text style={styles.cardLabel}>Vitals & Conditions</Text>
          </View>
          {settings.conditions.length > 0 || recentVitals.length > 0 ? (
            <View>
              {settings.conditions.length > 0 && (
                <View style={styles.conditionsRow}>
                  {settings.conditions.slice(0, 3).map((c, i) => (
                    <View key={i} style={styles.conditionChip}>
                      <Text style={styles.conditionText}>{c}</Text>
                    </View>
                  ))}
                </View>
              )}
              {recentVitals.slice(0, 2).map((v) => (
                <View key={v.id} style={styles.vitalRow}>
                  <Text style={styles.vitalType}>{v.type}</Text>
                  <Text style={styles.vitalValue}>{v.value} {v.unit}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.cardEmpty}>
              <Text style={styles.cardEmptyText}>Add conditions in Settings</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("reports")}>
          <View style={[styles.cardHeader, { marginBottom: 0 }]}>
            <View style={[styles.cardIcon, { backgroundColor: C.greenLight }]}>
              <Ionicons name="document-text" size={16} color={C.green} />
            </View>
            <Text style={styles.cardLabel}>Generate Report</Text>
          </View>
          <Text style={styles.reportDesc}>Create a health summary for your doctor visit</Text>
          <View style={styles.reportBtn}>
            <Ionicons name="arrow-forward" size={16} color={C.tint} />
            <Text style={styles.reportBtnText}>View Reports</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  welcome: { marginBottom: 28 },
  greetingText: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  dateText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, marginBottom: 14 },
  summaryPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignSelf: "flex-start" },
  summaryDot: { width: 7, height: 7, borderRadius: 4 },
  summaryText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  grid: { gap: 12 },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border },
  cardWide: { width: "48.5%", marginRight: "1%" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  cardIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  cardBigNum: { fontFamily: "Inter_700Bold", fontSize: 36, color: C.text, letterSpacing: -1, marginBottom: 8 },
  cardBigNumSub: { fontSize: 20, color: C.textTertiary },
  progressTrack: { height: 4, backgroundColor: C.surfaceElevated, borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", backgroundColor: C.tint, borderRadius: 2 },
  cardMeta: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  cardEmpty: { paddingVertical: 8 },
  cardEmptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
  symptomRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  symptomText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1 },
  aptName: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text, marginBottom: 2 },
  aptSpec: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginBottom: 10 },
  aptDateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  aptDateText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginRight: 8 },
  fastingRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  fastingItem: { flex: 1, alignItems: "center" },
  fastingDivider: { width: 1, height: 28, backgroundColor: C.border },
  fastingLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 4 },
  fastingValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  energyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  energyDots: { flexDirection: "row", gap: 4 },
  energyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.surfaceElevated },
  conditionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  conditionChip: { backgroundColor: C.surfaceElevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  conditionText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  vitalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  vitalType: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  vitalValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  reportDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 4, marginBottom: 14 },
  reportBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  reportBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.tint },
});
