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
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

const PRIORITY_COLORS = {
  medications: "#0A84FF",
  appointments: "#BF5AF2",
  dailylog: "#30D158",
};

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  onRefreshKey?: number;
}

function PriorityCard({ color, icon, label, onPress, children }: { color: string; icon: string; label: string; onPress: () => void; children: React.ReactNode }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.priorityCard, { backgroundColor: color, transform: [{ scale }] }]}>
        <View style={styles.priorityHeader}>
          <View style={styles.priorityIconWrap}>
            <Ionicons name={icon as any} size={18} color="#fff" />
          </View>
          <Text style={styles.priorityLabel}>{label}</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
        </View>
        {children}
      </Animated.View>
    </Pressable>
  );
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

  const energyLabels = ["Low", "Fair", "Good", "Great", "Excellent"];

  const priorityCardWidth = isWide ? undefined : width * 0.78;

  const renderMedicationsCard = () => (
    <PriorityCard color={PRIORITY_COLORS.medications} icon="medical" label="Medications Today" onPress={() => onNavigate("medications")}>
      {totalMeds > 0 ? (
        <View>
          <Text style={styles.priBigNum}>{takenCount}<Text style={styles.priBigNumSub}>/{totalMeds}</Text></Text>
          <View style={styles.priProgress}>
            <View style={[styles.priProgressFill, { width: `${totalMeds > 0 ? (takenCount / totalMeds) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.priMeta}>{totalMeds - takenCount === 0 ? "All taken" : `${totalMeds - takenCount} remaining`}</Text>
        </View>
      ) : (
        <Text style={styles.priEmpty}>No medications added</Text>
      )}
    </PriorityCard>
  );

  const renderAppointmentsCard = () => (
    <PriorityCard color={PRIORITY_COLORS.appointments} icon="calendar" label="Upcoming Appointments" onPress={() => onNavigate("appointments")}>
      {nextApt ? (
        <View>
          <Text style={styles.priAptName}>{nextApt.doctorName}</Text>
          <Text style={styles.priAptSpec}>{nextApt.specialty}</Text>
          <View style={styles.priAptDateRow}>
            <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.priAptDate}>{formatDate(nextApt.date)}</Text>
            <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.priAptDate}>{formatTime12h(nextApt.time)}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.priEmpty}>No upcoming visits</Text>
      )}
    </PriorityCard>
  );

  const renderDailyLogCard = () => (
    <PriorityCard color={PRIORITY_COLORS.dailylog} icon="heart" label="Daily Log" onPress={() => onNavigate("log")}>
      {todayLog ? (
        <View>
          <View style={styles.priLogRow}>
            <View style={styles.priLogItem}>
              <Text style={styles.priLogLabel}>Energy</Text>
              <Text style={styles.priLogValue}>{energyLabels[todayLog.energy - 1]}</Text>
            </View>
            <View style={styles.priLogDivider} />
            <View style={styles.priLogItem}>
              <Text style={styles.priLogLabel}>Mood</Text>
              <Text style={styles.priLogValue}>{todayLog.mood}/5</Text>
            </View>
            <View style={styles.priLogDivider} />
            <View style={styles.priLogItem}>
              <Text style={styles.priLogLabel}>Sleep</Text>
              <Text style={styles.priLogValue}>{todayLog.sleep}/5</Text>
            </View>
          </View>
          {todayLog.fasting && <Text style={styles.priMeta}>Fasting today</Text>}
        </View>
      ) : (
        <View>
          <Text style={styles.priEmpty}>Not logged yet</Text>
          <Text style={[styles.priMeta, { marginTop: 6 }]}>Tap to log how you're feeling</Text>
        </View>
      )}
    </PriorityCard>
  );

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
      </View>

      <Text style={styles.sectionLabel}>Today</Text>

      {isWide ? (
        <View style={styles.priorityRowWide}>
          <View style={{ flex: 1 }}>{renderMedicationsCard()}</View>
          <View style={{ flex: 1 }}>{renderAppointmentsCard()}</View>
          <View style={{ flex: 1 }}>{renderDailyLogCard()}</View>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.priorityScroll}
          snapToInterval={priorityCardWidth + 12}
          decelerationRate="fast"
        >
          <View style={{ width: priorityCardWidth }}>{renderMedicationsCard()}</View>
          <View style={{ width: priorityCardWidth }}>{renderAppointmentsCard()}</View>
          <View style={{ width: priorityCardWidth }}>{renderDailyLogCard()}</View>
        </ScrollView>
      )}

      <View style={[styles.grid, isWide && styles.gridWide]}>
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

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("healthdata")}>
          <View style={[styles.cardHeader, { marginBottom: 0 }]}>
            <View style={[styles.cardIcon, { backgroundColor: C.accentLight }]}>
              <Ionicons name="analytics" size={16} color={C.accent} />
            </View>
            <Text style={styles.cardLabel}>Health Trends</Text>
          </View>
          <Text style={styles.reportDesc}>Track weight, BP, blood sugar, sleep and more</Text>
          <View style={styles.reportBtn}>
            <Ionicons name="arrow-forward" size={16} color={C.tint} />
            <Text style={styles.reportBtnText}>View Trends</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("documents")}>
          <View style={[styles.cardHeader, { marginBottom: 0 }]}>
            <View style={[styles.cardIcon, { backgroundColor: C.pinkLight }]}>
              <Ionicons name="scan" size={16} color={C.pink} />
            </View>
            <Text style={styles.cardLabel}>Document Scanner</Text>
          </View>
          <Text style={styles.reportDesc}>Upload lab reports and prescriptions for AI extraction</Text>
          <View style={styles.reportBtn}>
            <Ionicons name="arrow-forward" size={16} color={C.tint} />
            <Text style={styles.reportBtnText}>Scan Documents</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("insights")}>
          <View style={[styles.cardHeader, { marginBottom: 0 }]}>
            <View style={[styles.cardIcon, { backgroundColor: C.accentLight }]}>
              <Ionicons name="sparkles" size={16} color={C.accent} />
            </View>
            <Text style={styles.cardLabel}>AI Health Insights</Text>
          </View>
          <Text style={styles.reportDesc}>Get personalized analysis of your health patterns</Text>
          <View style={styles.reportBtn}>
            <Ionicons name="arrow-forward" size={16} color={C.tint} />
            <Text style={styles.reportBtnText}>View Insights</Text>
          </View>
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
  welcome: { marginBottom: 20 },
  greetingText: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  dateText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  sectionLabel: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, letterSpacing: -0.3, marginBottom: 14 },
  priorityScroll: { gap: 12, paddingRight: 24, marginBottom: 28, marginLeft: 0 },
  priorityRowWide: { flexDirection: "row", gap: 12, marginBottom: 28 },
  priorityCard: {
    borderRadius: 16,
    padding: 20,
    minHeight: 160,
    justifyContent: "space-between",
    boxShadow: "0px 4px 16px rgba(0,0,0,0.3)",
  },
  priorityHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  priorityIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  priorityLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff", flex: 1 },
  priBigNum: { fontFamily: "Inter_700Bold", fontSize: 36, color: "#fff", letterSpacing: -1, marginBottom: 8 },
  priBigNumSub: { fontSize: 20, color: "rgba(255,255,255,0.6)" },
  priProgress: { height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  priProgressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  priMeta: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)" },
  priEmpty: { fontFamily: "Inter_500Medium", fontSize: 14, color: "rgba(255,255,255,0.8)" },
  priAptName: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff", marginBottom: 2 },
  priAptSpec: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 10 },
  priAptDateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  priAptDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)", marginRight: 8 },
  priLogRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  priLogItem: { flex: 1, alignItems: "center" },
  priLogLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  priLogValue: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  priLogDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.2)" },
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
