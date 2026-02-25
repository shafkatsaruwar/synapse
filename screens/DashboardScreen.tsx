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
import { featureFlags } from "@/constants/feature-flags";
import Colors from "@/constants/colors";
import {
  healthLogStorage,
  medicationStorage,
  medicationLogStorage,
  sickModeStorage,
  appointmentStorage,
  symptomStorage,
  fastingLogStorage,
  vitalStorage,
  settingsStorage,
  conditionStorage,
  type HealthLog,
  type Medication,
  type MedicationLog,
  type Appointment,
  type Symptom,
  type FastingLog,
  type Vital,
  type UserSettings,
  type HealthCondition,
} from "@/lib/storage";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";
import { getTodayRamadan } from "@/constants/ramadan-timetable";

const C = Colors.dark;

const PRIORITY_COLORS = {
  medications: "#800020",
  appointments: "#6B3FA0",
  dailylog: "#2D7D46",
};

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  onRefreshKey?: number;
  onActivateSickMode?: () => void;
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
      accessibilityLabel={`${label} card`}
      accessibilityRole="button"
      accessibilityHint={`Opens ${label} screen`}
      style={{ minHeight: 44 }}
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

export default function DashboardScreen({ onNavigate, onRefreshKey, onActivateSickMode }: DashboardScreenProps) {
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
  const [healthConditions, setHealthConditions] = useState<HealthCondition[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const [log, meds, ml, apts, symp, fl, vit, sett, conds] = await Promise.all([
      healthLogStorage.getByDate(today),
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      appointmentStorage.getAll(),
      symptomStorage.getByDate(today),
      fastingLogStorage.getByDate(today),
      vitalStorage.getAll(),
      settingsStorage.get(),
      conditionStorage.getAll(),
    ]);
    setTodayLog(log);
    setMedications(meds.filter((m) => m.active));
    setMedLogs(ml);
    setAppointments(apts.filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date)));
    setTodaySymptoms(symp);
    setFastingLog(fl);
    setVitals(vit);
    setSettings(sett);
    setHealthConditions(conds);
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

  const isSickMode = settings.sickMode;
  const getDoseCount = (med: Medication) => {
    const base = (med as any).doses || 1;
    if (isSickMode && med.name === "Hydrocortisone") return base * 3;
    return base;
  };
  const totalDoses = medications.reduce((s, m) => s + getDoseCount(m), 0);
  const takenDoses = medications.reduce((s, m) => {
    const dc = getDoseCount(m);
    let t = 0;
    for (let i = 0; i < dc; i++) {
      if (medLogs.find((l) => l.medicationId === m.id && (l.doseIndex ?? 0) === i)?.taken) t++;
    }
    return s + t;
  }, 0);
  const nextApt = appointments[0];

  const dateObj = new Date();
  const greeting = dateObj.getHours() < 12 ? "Good morning" : dateObj.getHours() < 17 ? "Good afternoon" : "Good evening";

  const ramadanDay = getTodayRamadan(today);
  const ordinalSuffix = (n: number) => {
    if (n >= 11 && n <= 13) return "th";
    switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
  };

  const recentVitals = vitals
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const energyLabels = ["Low", "Fair", "Good", "Great", "Excellent"];

  const renderMedicationsCard = () => (
    <PriorityCard color={isSickMode ? "#CC2222" : PRIORITY_COLORS.medications} icon="medical" label={isSickMode ? "Stress Dosing" : "Medications Today"} onPress={() => onNavigate("medications")}>
      {totalDoses > 0 ? (
        <View>
          <Text style={styles.priBigNum}>{takenDoses}<Text style={styles.priBigNumSub}>/{totalDoses}</Text></Text>
          <View style={styles.priProgress}>
            <View style={[styles.priProgressFill, { width: `${(takenDoses / totalDoses) * 100}%` }]} />
          </View>
          <Text style={styles.priMeta}>{totalDoses - takenDoses === 0 ? "All taken" : `${totalDoses - takenDoses} doses left`}</Text>
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

  const renderRamadanCard = () => {
    if (isSickMode) {
      return (
        <PriorityCard color="#8B8B8B" icon="moon" label="Ramadan" onPress={() => onNavigate("ramadan")}>
          <View>
            <Text style={[styles.priEmpty, { fontSize: 14, lineHeight: 20 }]}>Focus on recovery today.</Text>
            <Text style={[styles.priMeta, { marginTop: 6 }]}>Your health comes first</Text>
          </View>
        </PriorityCard>
      );
    }

    return (
      <PriorityCard color="#6B6B6B" icon="moon" label="Ramadan" onPress={() => onNavigate("ramadan")}>
        {fastingLog ? (
          <View>
            <View style={styles.priLogRow}>
              <View style={styles.priLogItem}>
                <Text style={styles.priLogLabel}>Suhoor</Text>
                <Text style={styles.priLogValue}>{fastingLog.suhoorTime || "--"}</Text>
              </View>
              <View style={styles.priLogDivider} />
              <View style={styles.priLogItem}>
                <Text style={styles.priLogLabel}>Iftar</Text>
                <Text style={styles.priLogValue}>{fastingLog.iftarTime || "--"}</Text>
              </View>
            </View>
            <Text style={styles.priMeta}>{fastingLog.hydrationGlasses} glasses of water</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.priEmpty}>No fasting log</Text>
            <Text style={[styles.priMeta, { marginTop: 6 }]}>Tap to log today</Text>
          </View>
        )}
      </PriorityCard>
    );
  };

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
          ...(isWide && { alignSelf: "stretch" }),
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />
      }
    >
      {!isSickMode && (
        <Pressable
          style={styles.sickModeActivateBtn}
          onPress={async () => {
            const s = await settingsStorage.get();
            await settingsStorage.save({ ...s, sickMode: true });
            const sd = await sickModeStorage.get();
            await sickModeStorage.save({ ...sd, active: true, startedAt: new Date().toISOString() });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onActivateSickMode?.();
          }}
          accessibilityLabel="Activate Sick Mode"
          accessibilityRole="button"
          accessibilityHint="Activates stress dosing protocol for adrenal crisis"
        >
          <Ionicons name="shield-outline" size={16} color={C.red} />
          <Text style={styles.sickModeActivateBtnText}>Activate Sick Mode</Text>
        </Pressable>
      )}

      <View style={styles.welcome} accessibilityRole="header">
        <Text style={styles.greetingText}>
          {greeting}{settings.name ? `, ${settings.name}` : ""}
        </Text>
        <Text style={styles.dateText}>
          {dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </Text>
      </View>

      {settings.ramadanMode && ramadanDay && (
        <Text style={styles.hijriDate}>
          {ramadanDay.hijriDay}{ordinalSuffix(ramadanDay.hijriDay)} Ramadan, 1447 AH
        </Text>
      )}
      <Text style={styles.sectionLabel}>Today</Text>

      <View style={[styles.priorityGrid, { gap: 12 }]}>
        <View style={[styles.priorityGridItem, isWide ? { flex: 1, flexBasis: "48%" } : { width: "100%" }]}>{renderMedicationsCard()}</View>
        <View style={[styles.priorityGridItem, isWide ? { flex: 1, flexBasis: "48%" } : { width: "100%" }]}>{renderAppointmentsCard()}</View>
        <View style={[styles.priorityGridItem, isWide ? { flex: 1, flexBasis: "48%" } : { width: "100%" }]}>{renderDailyLogCard()}</View>
        {settings.ramadanMode && (
          <View style={[styles.priorityGridItem, isWide ? { flex: 1, flexBasis: "48%" } : { width: "100%" }]}>{renderRamadanCard()}</View>
        )}
      </View>

      <View style={[styles.grid, isWide && styles.gridWide]}>
        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("symptoms")} accessibilityLabel={`Symptoms, ${todaySymptoms.length} today`} accessibilityRole="button" accessibilityHint="Opens symptoms tracker">
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

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("settings")} accessibilityLabel="Vitals and Conditions" accessibilityRole="button" accessibilityHint="Opens vitals and conditions settings">
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: C.cyanLight }]}>
              <Ionicons name="fitness" size={16} color={C.cyan} />
            </View>
            <Text style={styles.cardLabel}>Vitals & Conditions</Text>
          </View>
          {healthConditions.length > 0 || recentVitals.length > 0 ? (
            <View>
              {healthConditions.length > 0 && (
                <View style={styles.conditionsRow}>
                  {healthConditions.slice(0, 3).map((c) => (
                    <View key={c.id} style={styles.conditionChip}>
                      <Text style={styles.conditionText}>{c.name}</Text>
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

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("healthdata")} accessibilityLabel="Health Trends" accessibilityRole="button" accessibilityHint="Track weight, blood pressure, blood sugar, sleep and more">
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

        {featureFlags.documentScannerEnabled && (
          <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("documents")} accessibilityLabel="Document Scanner" accessibilityRole="button" accessibilityHint="Upload lab reports and prescriptions for AI extraction">
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
        )}

        {featureFlags.documentScannerEnabled && (
          <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("insights")} accessibilityLabel="AI Health Insights" accessibilityRole="button" accessibilityHint="Get personalized analysis of your health patterns">
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
        )}

        <Pressable style={[styles.card, isWide && styles.cardWide]} onPress={() => onNavigate("reports")} accessibilityLabel="Generate Report" accessibilityRole="button" accessibilityHint="Create a health summary for your doctor visit">
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
  sickModeActivateBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,69,58,0.08)", borderWidth: 1, borderColor: "rgba(255,69,58,0.2)", marginBottom: 8 },
  sickModeActivateBtnText: { fontWeight: "600", fontSize: 12, color: C.red },
  welcome: { marginBottom: 8 },
  greetingText: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  dateText: { fontWeight: "400", fontSize: 14, color: C.textSecondary },
  hijriDate: { fontWeight: "600", fontSize: 14, color: "#3C2415", marginBottom: 20 },
  sectionLabel: { fontWeight: "700", fontSize: 18, color: C.text, letterSpacing: -0.3, marginBottom: 14 },
  priorityGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20, width: "100%" },
  priorityGridItem: { marginBottom: 12 },
  priorityCard: {
    borderRadius: 16,
    padding: 16,
    aspectRatio: 1.1,
    justifyContent: "space-between",
    boxShadow: "0px 4px 16px rgba(0,0,0,0.08)",
  },
  priorityHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  priorityIconWrap: { width: 28, height: 28, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  priorityLabel: { fontWeight: "600", fontSize: 12, color: "#fff", flex: 1 },
  priBigNum: { fontWeight: "700", fontSize: 28, color: "#fff", letterSpacing: -1, marginBottom: 4 },
  priBigNumSub: { fontSize: 16, color: "rgba(255,255,255,0.6)" },
  priProgress: { height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  priProgressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  priMeta: { fontWeight: "400", fontSize: 12, color: "rgba(255,255,255,0.7)" },
  priEmpty: { fontWeight: "500", fontSize: 14, color: "rgba(255,255,255,0.8)" },
  priAptName: { fontWeight: "600", fontSize: 13, color: "#fff", marginBottom: 2 },
  priAptSpec: { fontWeight: "400", fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 6 },
  priAptDateRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  priAptDate: { fontWeight: "400", fontSize: 11, color: "rgba(255,255,255,0.7)", marginRight: 4 },
  priLogRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  priLogItem: { flex: 1, alignItems: "center" },
  priLogLabel: { fontWeight: "400", fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  priLogValue: { fontWeight: "600", fontSize: 15, color: "#fff" },
  priLogDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.2)" },
  grid: { gap: 12 },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border },
  cardWide: { width: "48.5%", marginRight: "1%" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  cardIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontWeight: "600", fontSize: 14, color: C.text },
  cardBigNum: { fontWeight: "700", fontSize: 36, color: C.text, letterSpacing: -1, marginBottom: 8 },
  cardBigNumSub: { fontSize: 20, color: C.textTertiary },
  progressTrack: { height: 4, backgroundColor: C.surfaceElevated, borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", backgroundColor: C.tint, borderRadius: 2 },
  cardMeta: { fontWeight: "400", fontSize: 12, color: C.textSecondary },
  cardEmpty: { paddingVertical: 8 },
  cardEmptyText: { fontWeight: "400", fontSize: 13, color: C.textTertiary },
  symptomRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  symptomText: { fontWeight: "400", fontSize: 13, color: C.textSecondary, flex: 1 },
  fastingRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  fastingItem: { flex: 1, alignItems: "center" },
  fastingDivider: { width: 1, height: 28, backgroundColor: C.border },
  fastingLabel: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginBottom: 4 },
  fastingValue: { fontWeight: "600", fontSize: 14, color: C.text },
  energyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  energyDots: { flexDirection: "row", gap: 4 },
  energyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.surfaceElevated },
  conditionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  conditionChip: { backgroundColor: C.surfaceElevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  conditionText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
  vitalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  vitalType: { fontWeight: "400", fontSize: 13, color: C.textSecondary },
  vitalValue: { fontWeight: "600", fontSize: 13, color: C.text },
  reportDesc: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginTop: 4, marginBottom: 14 },
  reportBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  reportBtnText: { fontWeight: "600", fontSize: 13, color: C.tint },
});
