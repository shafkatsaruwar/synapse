import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  useWindowDimensions,
  Animated,
  ScrollView,
  LayoutAnimation,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { featureFlags } from "@/constants/feature-flags";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import GlassView from "@/components/GlassView";
import {
  healthLogStorage,
  medicationStorage,
  medicationLogStorage,
  appointmentStorage,
  fastingLogStorage,
  settingsStorage,
  type HealthLog,
  type Medication,
  type MedicationLog,
  type Appointment,
  type FastingLog,
  type UserSettings,
} from "@/lib/storage";
import { getToday, formatDate, formatTime12h } from "@/lib/date-utils";
import { getTodayRamadan } from "@/constants/ramadan-timetable";
import { useAuth } from "@/contexts/AuthContext";
import { useWalkthroughTargets, measureInWindow } from "@/contexts/WalkthroughContext";

// Gradient pairs: [top (darker), bottom (lighter)]. Soft, desaturated, top-to-bottom.
const PRIORITY_GRADIENTS: Record<string, [string, string]> = {
  medications: ["#6B2835", "#8E5A5A"],
  appointments: ["#4E3570", "#7B6B9E"],
  dailylog: ["#2D5A3D", "#4A7C59"],
  ramadan: ["#4A4A4A", "#6E6E6E"],
  medicationsStress: ["#7B3535", "#9E6A6A"],
};

const RAMADAN_QUOTES = [
  "Ramadan is a chance to reset your body, mind, and soul.",
  "Every small act of patience today is an investment in your health.",
  "Take it gently today. Your body is doing something extraordinary.",
  "Hydrate well between iftar and suhoor — future you will be grateful.",
];

const GOOD_DAY_MESSAGES = [
  // Existing
  "Have a good day.",
  "Good day, matey!",
  "Today is a good day to be kind to your body.",
  "Take it gently today — you're doing enough.",
  // Calm everyday
  "Hope you’re feeling well today.",
  "Take a moment to check in with yourself.",
  "Let’s see how you’re doing today.",
  "One small step for your health today.",
  "A new day to care for yourself.",
  "Let’s keep your health on track today.",
  // Supportive
  "Your health matters today and every day.",
  "Checking in is a powerful habit.",
  "Small steps lead to stronger days.",
  "You’re doing something good for yourself today.",
  "Every check-in helps you understand your health better.",
  // Gentle wellness
  "Be kind to yourself today.",
  "Take it slow and steady today.",
  "A quiet moment for your health.",
  "Your wellbeing starts with a small check-in.",
  // Ramadan-friendly
  "Wishing you strength and ease today.",
  "Take care of your body today.",
  "A gentle day for your health.",
  "May today bring you balance and strength.",
  // Extra suggestions
  "Take a moment to check in with yourself today.",
  "Small steps today build stronger health tomorrow.",
  "Let’s see how you’re doing today.",
  "Your health journey continues today.",
  "A quick check-in can make a big difference.",
  "Your wellbeing starts with a small moment of care.",
  "Let’s take a look at your day so far.",
  "Every day is a chance to care for yourself.",
  "A little attention to your health goes a long way.",
  "Today is a good day to check in with yourself.",
];

const RAMADAN_WELLNESS_MESSAGES = [
  // Ramadan wellness
  "Wishing you strength and ease during your fast today.",
  "Take care of your body and spirit today.",
  "May today bring you patience and balance.",
  "A calm day for reflection and care.",
  "Be gentle with yourself during your fast today.",
  "Small moments of care can bring great reward.",
  "Wishing you health and peace this Ramadan.",
  "May today bring you energy and clarity.",
  "Take a quiet moment to check in with yourself.",
  "Your wellbeing matters during this blessed month.",
  // Subtle spiritual
  "May your fast bring you strength and calm today.",
  "Wishing you ease and barakah today.",
  "May today bring you patience and good health.",
  "A day of reflection, balance, and care.",
  "May your day be filled with strength and peace.",
];

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  onRefreshKey?: number;
}

interface DashboardHeroProps {
  ramadanDayLabel: string;
  subtitle: string;
  leftTimeLabel: string;
  rightTimeLabel: string;
  leftTime: string;
  rightTime: string;
  /** Next medication: name + dose lines (e.g. ["15 mg — Morning", "5 mg — Afternoon"]) */
  nextMedication: { name: string; lines: string[] } | null;
  nextApt: Appointment | null;
  onNavigate: (screen: string) => void;
  medicationCardRef?: React.RefObject<View>;
  appointmentCardRef?: React.RefObject<View>;
}

function DashboardHero({
  ramadanDayLabel,
  subtitle,
  leftTimeLabel,
  rightTimeLabel,
  leftTime,
  rightTime,
  nextMedication,
  nextApt,
  onNavigate,
  medicationCardRef,
  appointmentCardRef,
}: DashboardHeroProps) {
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeHeroStyles(C), [C]);

  const heroGradientColors =
    themeId === "dark"
      ? ["#0F0F10", "#0F0F10"]
      : themeId === "calm"
      ? ["#E6D2B8", "#E6D2B8"]
      : ["#E6D3BD", "#E6D3BD"];

  const heroBorderColor = themeId === "dark" ? "#2A2A2A" : "#D6BFA6";

  const miniCardBackground =
    themeId === "dark" ? "rgba(220, 20, 20, 0.45)" : themeId === "light" ? "#FFFFFF" : "#F3E6D8";
  const miniCardBorderColor = themeId === "dark" ? "#2A2A2A" : "#E2CFC0";
  const miniCardSubtitleColor = themeId === "dark" ? "#FFFFFF" : C.textSecondary;

  const renderHeroInner = () => (
    <View style={styles.dashboardHeroGradient}>
      <View style={styles.dashboardHeroHeader}>
        <Text
          style={[
            styles.dashboardHeroRamadan,
            themeId === "light" && { color: "#1F2937" },
          ]}
        >
          {ramadanDayLabel}
        </Text>
        <Text style={styles.dashboardHeroSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.dashboardHeroTimesRow}>
        <View style={styles.dashboardHeroTimeCol}>
          <Text style={styles.dashboardHeroTimeLabel}>{leftTimeLabel}</Text>
          <Text
            style={[
              styles.dashboardHeroTimeValue,
              themeId === "light" && { color: "#2F6FCF" },
            ]}
          >
            {leftTime}
          </Text>
        </View>
        <View style={styles.dashboardHeroTimeCol}>
          <Text style={styles.dashboardHeroTimeLabel}>{rightTimeLabel}</Text>
          <Text
            style={[
              styles.dashboardHeroTimeValue,
              themeId === "light" && { color: "#2F6FCF" },
            ]}
          >
            {rightTime}
          </Text>
        </View>
      </View>

      <View style={styles.dashboardHeroMiniRow}>
        <View ref={medicationCardRef} collapsable={false} style={{ flex: 1 }}>
          <Pressable
            style={[
              styles.dashboardHeroMiniCard,
              { backgroundColor: miniCardBackground, borderColor: miniCardBorderColor },
            ]}
            onPress={() => onNavigate("medications")}
            accessibilityRole="button"
            accessibilityLabel="Open Medications"
          >
            <Text style={styles.dashboardHeroMiniTitle}>
              {nextMedication?.name || "Hydrocortisone"}
            </Text>
            {(nextMedication?.lines?.length ? nextMedication.lines : ["Morning dose"]).map((line, i) => (
              <Text key={i} style={[styles.dashboardHeroMiniSubtitle, { color: miniCardSubtitleColor }]}>
                {line}
              </Text>
            ))}
          </Pressable>
        </View>

        <View ref={appointmentCardRef} collapsable={false} style={{ flex: 1 }}>
          <Pressable
            style={[
              styles.dashboardHeroMiniCard,
              { backgroundColor: miniCardBackground, borderColor: miniCardBorderColor },
            ]}
            onPress={() => onNavigate("appointments")}
            accessibilityRole="button"
            accessibilityLabel="Open Appointments"
          >
          <Text style={styles.dashboardHeroMiniTitle}>Next appointment</Text>
          <Text style={[styles.dashboardHeroMiniSubtitle, { color: miniCardSubtitleColor }]}>
            {nextApt?.doctorName || "Dr. Jordon LICSW"}
          </Text>
          <Text style={[styles.dashboardHeroMiniSubtitle, { color: miniCardSubtitleColor }]}>
            {nextApt
              ? `${formatDate(nextApt.date)} · ${formatTime12h(nextApt.time)}`
              : "Tue Mar 17 · 10:00 AM"}
          </Text>
        </Pressable>
        </View>
      </View>
    </View>
  );

  if (themeId === "light") {
    return (
      <View
        style={[
          styles.dashboardHero,
          {
            backgroundColor: "#FFFFFF",
            borderColor: "rgba(255,255,255,0.9)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 4,
          },
        ]}
      >
        {renderHeroInner()}
      </View>
    );
  }

  return (
    <View style={[styles.dashboardHero, { borderColor: heroBorderColor }]}>
      <LinearGradient
        colors={heroGradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dashboardHeroGradient}
      >
        {renderHeroInner()}
      </LinearGradient>
    </View>
  );
}

function PriorityCard({ colors, icon, label, onPress, children }: { colors: [string, string]; icon: string; label: string; onPress: () => void; children: React.ReactNode }) {
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
      <Animated.View style={[priorityCardStyle, { transform: [{ scale }], overflow: "hidden" }]}>
        <LinearGradient colors={colors} style={StyleSheet.absoluteFillObject} />
        <View style={priorityCardContentStyle}>
          <View style={priorityHeaderStyle}>
            <View style={priorityIconWrapStyle}>
              <Ionicons name={icon as any} size={18} color="#fff" />
            </View>
            <Text style={priorityLabelStyle}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
          </View>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// Static styles for PriorityCard (no theme colors needed — gradient covers everything)
const priorityCardStyle = {
  borderRadius: 16,
  aspectRatio: 1.1,
  justifyContent: "space-between" as const,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 4,
};
const priorityCardContentStyle = { flex: 1, padding: 16, justifyContent: "space-between" as const };
const priorityHeaderStyle = { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, marginBottom: 10 };
const priorityIconWrapStyle = { width: 28, height: 28, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center" as const, justifyContent: "center" as const };
const priorityLabelStyle = { fontWeight: "600" as const, fontSize: 12, color: "#fff", flex: 1 };

export default function DashboardScreen({ onNavigate, onRefreshKey }: DashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const isWide = width >= 768;
  const today = getToday();
  const walkthrough = useWalkthroughTargets();
  const refMed = useRef<View>(null);
  const refApt = useRef<View>(null);
  const refDailyLog = useRef<View>(null);

  useEffect(() => {
    if (!walkthrough) return;
    walkthrough.registerTarget("medication", () => measureInWindow(refMed));
    walkthrough.registerTarget("appointments", () => measureInWindow(refApt));
    walkthrough.registerTarget("dailylog", () => measureInWindow(refDailyLog));
    return () => {
      walkthrough.unregisterTarget("medication");
      walkthrough.unregisterTarget("appointments");
      walkthrough.unregisterTarget("dailylog");
    };
  }, [walkthrough]);

  const [todayLog, setTodayLog] = useState<HealthLog | undefined>();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [fastingLog, setFastingLog] = useState<FastingLog | undefined>();
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const [log, meds, ml, apts, fl, sett] = await Promise.all([
      healthLogStorage.getByDate(today),
      medicationStorage.getAll(),
      medicationLogStorage.getByDate(today),
      appointmentStorage.getAll(),
      fastingLogStorage.getByDate(today),
      settingsStorage.get(),
    ]);
    setTodayLog(log);
    setMedications(meds.filter((m) => m.active));
    setMedLogs(ml);
    setAppointments(apts.filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date)));
    setFastingLog(fl);
    setSettings(sett);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLoaded(true);
  }, [today]);

  React.useEffect(() => {
    loadData();
  }, [loadData, onRefreshKey]);

  const isSickMode = settings.sickMode;
  const getDoseCount = (med: Medication) => {
    if (Array.isArray(med.doses) && med.doses.length > 0) return med.doses.length;
    const base = (med as { doses?: number }).doses ?? 1;
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
  const authNameRaw =
    user?.user_metadata?.first_name ??
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined) ??
    (user?.email ? user.email.split("@")[0] : undefined);
  const settingsFirstName = settings.firstName?.trim() || (settings.name?.trim() ? settings.name.trim().split(/\s+/)[0] : "");
  const displayFirstName = (typeof authNameRaw === "string" ? authNameRaw.trim().split(/\s+/)[0] : "") || settingsFirstName || "";
  const hour = dateObj.getHours();
  let greeting: string;
  if (hour < 12) {
    greeting = displayFirstName
      ? `Good morning, ${displayFirstName}. Let’s start the day well.`
      : "Good morning. Let’s start the day well.";
  } else if (hour < 17) {
    greeting = displayFirstName
      ? `Good afternoon, ${displayFirstName}. How are you feeling today?`
      : "Good afternoon. How are you feeling today?";
  } else if (hour < 22) {
    greeting = displayFirstName
      ? `Good evening, ${displayFirstName}. Time for a quick check-in.`
      : "Good evening. Time for a quick check-in.";
  } else {
    greeting = displayFirstName
      ? `Good night, ${displayFirstName}. How was today for your health?`
      : "Good night. How was today for your health?";
  }

  const ramadanDay = getTodayRamadan(today);
  const ordinalSuffix = (n: number) => {
    if (n >= 11 && n <= 13) return "th";
    switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
  };

  const energyLabels = ["Low", "Fair", "Good", "Great", "Excellent"];

  const isRamadanMode = settings.ramadanMode;
  const leftLabel = isRamadanMode ? "Fajr" : "Sunrise";
  const rightLabel = isRamadanMode ? "Iftar" : "Sunset";
  const leftTimeRaw = ramadanDay?.fajr ?? null;
  const rightTimeRaw = ramadanDay?.maghrib ?? null;
  const leftTime = leftTimeRaw ? `${leftTimeRaw} AM` : (fastingLog?.suhoorTime ?? "—");
  const rightTime = rightTimeRaw ? `${rightTimeRaw} PM` : (fastingLog?.iftarTime ?? "—");
  const sunriseTime = leftTime;
  const sunsetTime = rightTime;

  const getIftarCountdown = () => {
    if (!fastingLog?.iftarTime) return null;
    const match = fastingLog.iftarTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!match) return null;
    const [, hh, mm, suffixRaw] = match;
    let hours = Number(hh);
    const minutes = Number(mm);
    const suffix = suffixRaw?.toLowerCase();
    if (suffix === "pm" && hours < 12) hours += 12;
    if (suffix === "am" && hours === 12) hours = 0;
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return "Iftar time has passed for today";
    const diffMinutesTotal = Math.round(diffMs / 60000);
    const diffHours = Math.floor(diffMinutesTotal / 60);
    const remMinutes = diffMinutesTotal % 60;
    if (diffHours <= 0) return `${remMinutes} min until iftar`;
    return `${diffHours} hr ${remMinutes.toString().padStart(2, "0")} min until iftar`;
  };

  const ramadanQuote =
    ramadanDay ? RAMADAN_QUOTES[(ramadanDay.hijriDay - 1) % RAMADAN_QUOTES.length] : RAMADAN_QUOTES[0];

  const goodDayMessage =
    ramadanDay && settings.ramadanMode
      ? RAMADAN_WELLNESS_MESSAGES[dateObj.getDate() % RAMADAN_WELLNESS_MESSAGES.length]
      : GOOD_DAY_MESSAGES[dateObj.getDate() % GOOD_DAY_MESSAGES.length];

  const getNextMedicationInfo = (): { name: string; lines: string[] } | null => {
    if (!medications.length) return null;
    for (const med of medications) {
      const doseCount = getDoseCount(med);
      if (doseCount <= 0) continue;
      const takenForMed = medLogs.filter((l) => l.medicationId === med.id && l.taken).length;
      if (takenForMed >= doseCount) continue;
      const doses = Array.isArray(med.doses) && med.doses.length > 0 ? med.doses : [];
      const untakenIndices = Array.from({ length: doseCount }, (_, i) => i).filter((i) => !medLogs.some((l) => l.medicationId === med.id && (l.doseIndex ?? 0) === i && l.taken));
      const name = med.name || "Next medication";
      const lines: string[] = [];
      if (doses.length > 0) {
        untakenIndices.forEach((idx) => {
          const d = doses[idx];
          if (d) {
            const text = d.amount && d.unit ? `${d.amount} ${d.unit} — ${d.timeOfDay}` : d.timeOfDay;
            lines.push(text);
          }
        });
      } else {
        const dosage = (med as { dosage?: string }).dosage ? `${(med as { dosage?: string }).dosage}${(med as { unit?: string }).unit ? ` ${(med as { unit?: string }).unit}` : ""}` : "";
        const timeTag = Array.isArray(med.timeTag) ? med.timeTag[0] : (med as { timeTag?: string }).timeTag;
        const timeLabel = typeof timeTag === "string" && timeTag.trim().length > 0 ? timeTag.trim() : "Today";
        lines.push(dosage ? `${dosage} — ${timeLabel}` : timeLabel);
      }
      if (lines.length === 0) lines.push("Morning dose");
      return { name, lines };
    }
    return null;
  };

  const nextMedication = getNextMedicationInfo();

  const renderMedicationsCard = () => (
    <PriorityCard colors={isSickMode ? PRIORITY_GRADIENTS.medicationsStress : PRIORITY_GRADIENTS.medications} icon="medical" label={isSickMode ? "Stress Dosing" : "Medications Today"} onPress={() => onNavigate("medications")}>
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
    <PriorityCard colors={PRIORITY_GRADIENTS.appointments} icon="calendar" label="Upcoming Appointments" onPress={() => onNavigate("appointments")}>
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
        <PriorityCard colors={PRIORITY_GRADIENTS.ramadan} icon="moon" label="Ramadan" onPress={() => onNavigate("ramadan")}>
          <View>
            <Text style={[styles.priEmpty, { fontSize: 14, lineHeight: 20 }]}>Focus on recovery today.</Text>
            <Text style={[styles.priMeta, { marginTop: 6 }]}>Your health comes first</Text>
          </View>
        </PriorityCard>
      );
    }

    return (
      <PriorityCard colors={PRIORITY_GRADIENTS.ramadan} icon="moon" label="Ramadan" onPress={() => onNavigate("ramadan")}>
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
    <PriorityCard colors={PRIORITY_GRADIENTS.dailylog} icon="heart" label="Daily Log" onPress={() => onNavigate("log")}>
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

  const contentPadding = {
    paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : 12),
    paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
  };

  if (!loaded) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.tint} />
        <Text style={[styles.dateText, { marginTop: 12 }]}>Loading…</Text>
      </View>
    );
  }

  const cardStackPadding = isWide ? 0 : 16;
  const inner = (
    <View style={{ marginHorizontal: cardStackPadding, gap: 16 }}>
      <View style={styles.welcome} accessibilityRole="header">
        <Text style={styles.greetingText}>
          {greeting}
        </Text>
        <Text style={styles.dateText}>
          {dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </Text>
      </View>

      {ramadanDay && (
        <View style={styles.ramadanSection}>
          <DashboardHero
            ramadanDayLabel={`Ramadan ${ramadanDay.hijriDay}${ordinalSuffix(ramadanDay.hijriDay)}, 1447 AH`}
            subtitle={goodDayMessage}
            leftTimeLabel={leftLabel}
            rightTimeLabel={rightLabel}
            leftTime={leftTime}
            rightTime={rightTime}
            nextMedication={nextMedication ? { name: nextMedication.name, lines: nextMedication.lines } : null}
            nextApt={nextApt ?? null}
            onNavigate={onNavigate}
            medicationCardRef={refMed}
            appointmentCardRef={refApt}
          />

          <View ref={refDailyLog} collapsable={false}>
          <GlassView
            intensity={50}
            tint={themeId === "dark" ? "dark" : "light"}
            style={[styles.moodCardGlass, themeId === "light" && styles.moodCardLight]}
          >
            <View style={styles.ramadanWeekStrip}>
              {Array.from({ length: 7 }).map((_, idx) => {
                const start = Math.max(1, (ramadanDay.hijriDay ?? 1) - 3);
                const dayNum = start + idx;
                if (dayNum > 30) return null;
                const isToday = dayNum === ramadanDay.hijriDay;
                return (
                  <View
                    key={dayNum}
                    style={[
                      styles.ramadanWeekDay,
                      isToday && styles.ramadanWeekDayActive,
                    ]}
                  >
                    <Ionicons
                      name="sunny-outline"
                      size={13}
                      color={isToday ? "#2D1340" : C.textTertiary}
                      style={{ marginBottom: 2 }}
                    />
                    <Text style={isToday ? styles.ramadanWeekDayTextActive : styles.ramadanWeekDayText}>{dayNum}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.moodDivider} />

            <Pressable
              style={styles.moodFeelingRow}
              onPress={() => onNavigate("log")}
              accessibilityRole="button"
              accessibilityLabel="How are you feeling today?"
              accessibilityHint="Opens the daily log screen"
            >
              <View>
                <Text style={styles.feelingTitle}>How are you feeling today?</Text>
                <Text style={styles.feelingSubtitle}>Tap to log today's energy, mood, and sleep.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.tint} />
            </Pressable>
          </GlassView>
          </View>

          {settings.ramadanMode && (
            <GlassView intensity={50} tint={themeId === "dark" ? "dark" : "light"} style={[styles.feelingCardGlass, themeId === "light" && styles.feelingCardLight]}>
            <Pressable
              style={styles.feelingCardInner}
              onPress={() => onNavigate("ramadandailylog")}
              accessibilityRole="button"
              accessibilityLabel="Ramadan Daily Log"
              accessibilityHint="Opens the Ramadan daily log screen"
            >
              <View>
                <Text style={styles.feelingTitle}>Ramadan Daily Log</Text>
                <Text style={styles.feelingSubtitle}>Log your fast, water, energy, mood & motivation.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.tint} />
            </Pressable>
          </GlassView>
          )}

          {settings.ramadanMode && (
            <GlassView intensity={50} tint={themeId === "dark" ? "dark" : "light"} style={[styles.ramadanQuoteCardGlass, themeId === "light" && styles.ramadanQuoteCardLight]}>
              <View style={styles.ramadanQuoteRow}>
                <Ionicons name="sparkles" size={16} color={C.pink} />
                <Text style={styles.ramadanQuoteText}>{ramadanQuote}</Text>
              </View>
            </GlassView>
          )}
        </View>
      )}

      <View style={[styles.grid, isWide && styles.gridWide]}>
        {featureFlags.documentScannerEnabled && (
          <GlassView intensity={50} tint={themeId === "dark" ? "dark" : "light"} style={[styles.cardGlass, isWide && styles.cardWide]}>
            <Pressable style={[styles.cardInner, isWide && styles.cardWide]} onPress={() => onNavigate("documents")} accessibilityLabel="Document Scanner" accessibilityRole="button" accessibilityHint="Upload lab reports and prescriptions for AI extraction">
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
          </GlassView>
        )}

        {featureFlags.documentScannerEnabled && (
          <GlassView intensity={50} tint={themeId === "dark" ? "dark" : "light"} style={[styles.cardGlass, isWide && styles.cardWide]}>
            <Pressable style={[styles.cardInner, isWide && styles.cardWide]} onPress={() => onNavigate("insights")} accessibilityLabel="AI Health Insights" accessibilityRole="button" accessibilityHint="Get personalized analysis of your health patterns">
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
          </GlassView>
        )}
      </View>

    </View>
  );

  const fabBottom = Platform.OS === "web"
    ? 100
    : isWide ? insets.bottom + 32 : insets.bottom + 96;

  const fab = (
    <Pressable
      style={({ pressed }) => [styles.fab, { bottom: fabBottom, opacity: pressed ? 0.85 : 1 }]}
      onPress={() => { Haptics.selectionAsync(); onNavigate("emergency"); }}
      accessibilityRole="button"
      accessibilityLabel="Emergency Protocol"
      accessibilityHint="View critical medical information"
    >
      <Ionicons name="medkit" size={28} color="#fff" />
    </Pressable>
  );

  const isLightTheme = themeId === "light";

  if (isWide) {
    const content = (
      <View style={[styles.container, styles.content, contentPadding, { alignSelf: "stretch", backgroundColor: isLightTheme ? "transparent" : C.background, paddingHorizontal: 16 }]}>
        {inner}
        {fab}
      </View>
    );

    if (isLightTheme) {
      return (
        <LinearGradient
          colors={["#C9D8F6", "#BFD2F0", "#B7E3D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          {content}
        </LinearGradient>
      );
    }

    return content;
  }

  const main = (
    <View style={[styles.container, { backgroundColor: isLightTheme ? "transparent" : C.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[contentPadding, styles.scrollViewContent, { paddingHorizontal: 0 }]}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {inner}
      </ScrollView>
      {fab}
    </View>
  );

  if (isLightTheme) {
    return (
      <LinearGradient
        colors={["#C9D8F6", "#BFD2F0", "#B7E3D9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        {main}
      </LinearGradient>
    );
  }

  return main;
}

function makeHeroStyles(C: Theme) {
  return StyleSheet.create({
    dashboardHero: {
      marginTop: 12,
      marginBottom: 16,
      borderRadius: 20,
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 6,
      overflow: "hidden",
    },
    dashboardHeroGradient: {
      borderRadius: 20,
      padding: 20,
    },
    dashboardHeroHeader: {
      marginBottom: 16,
    },
    dashboardHeroRamadan: {
      fontWeight: "700",
      fontSize: 16,
      color: C.text,
      marginBottom: 4,
    },
    dashboardHeroSubtitle: {
      fontWeight: "400",
      fontSize: 13,
      color: C.textSecondary,
    },
    dashboardHeroTimesRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    dashboardHeroTimeCol: {
      flex: 1,
    },
    dashboardHeroTimeLabel: {
      fontWeight: "500",
      fontSize: 12,
      color: C.textSecondary,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    dashboardHeroTimeValue: {
      fontWeight: "700",
      fontSize: 18,
      color: C.text,
    },
    dashboardHeroMiniRow: {
      flexDirection: "row",
      gap: 12,
    },
    dashboardHeroMiniCard: {
      flex: 1,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    dashboardHeroMiniTitle: {
      fontWeight: "600",
      fontSize: 14,
      color: C.text,
      marginBottom: 2,
    },
    dashboardHeroMiniSubtitle: {
      fontWeight: "400",
      fontSize: 12,
      color: C.textSecondary,
    },
  });
}

function makeStyles(C: Theme) {
  return StyleSheet.create({
    gradientContainer: { flex: 1, width: "100%", height: "100%" },
    container: { flex: 1, minHeight: 1, backgroundColor: C.background },
    scrollView: { flex: 1, minHeight: 1 },
    scrollViewContent: { flexGrow: 1 },
    content: { paddingHorizontal: 0 },
    welcome: { marginBottom: 4 },
    greetingText: { fontWeight: "700", fontSize: 28, color: C.text, letterSpacing: -0.5, marginBottom: 4 },
    dateText: { fontWeight: "400", fontSize: 14, color: C.textSecondary },
    hijriDate: { fontWeight: "600", fontSize: 14, color: C.text, marginBottom: 20 },
    ramadanSection: { marginTop: 8, marginBottom: 16 },
    ramadanHero: {
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      gap: 12,
      backgroundColor: C.heroCardBackground,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 4,
    },
    ramadanHeroTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    ramadanDateText: { fontWeight: "600", fontSize: 14, color: C.text },
    ramadanLocationText: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 2 },
    ramadanCountdownPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.12)",
      gap: 6,
    },
    ramadanCountdownLabel: { fontWeight: "500", fontSize: 11, color: "#FBE9FF" },
    ramadanHeroBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      marginBottom: 4,
    },
    ramadanTimeCard: { flex: 1 },
    ramadanTimeLabel: { fontWeight: "400", fontSize: 11, color: C.textSecondary },
    ramadanTimeValue: { fontWeight: "600", fontSize: 16, color: C.text, marginTop: 2 },
    ramadanDivider: { width: 1, height: 32, backgroundColor: C.border, marginHorizontal: 12 },
    ramadanCountdownText: { fontWeight: "400", fontSize: 12, color: C.textSecondary, marginTop: 4 },
    ramadanWeekStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: C.surface,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      width: "100%",
    },
    ramadanWeekDay: {
      width: 28,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    ramadanWeekDayActive: { backgroundColor: "#F6C94D" },
    ramadanWeekDayText: { fontWeight: "500", fontSize: 12, color: C.textSecondary },
    ramadanWeekDayTextActive: { fontWeight: "700", fontSize: 12, color: "#2D1340" },
    ramadanQuoteCard: {},
    ramadanQuoteCardGlass: {
      marginTop: 12,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 6,
      overflow: "hidden",
    },
    ramadanQuoteCardLight: {},
    ramadanQuoteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    ramadanQuoteText: { flex: 1, fontWeight: "400", fontSize: 13, color: C.textSecondary },
    ramadanNextMedPill: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    ramadanNextMedName: { fontWeight: "600", fontSize: 11, color: C.text },
    ramadanNextMedDose: { fontWeight: "500", fontSize: 11, color: C.textSecondary, marginTop: 2 },
    ramadanNextMedTime: { fontWeight: "500", fontSize: 11, color: C.tint, marginTop: 2 },
    ramadanInfoRow: {
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
      marginTop: 8,
      gap: 8,
    },
    ramadanNextAptPill: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    ramadanNextAptTitle: { fontWeight: "600", fontSize: 11, color: C.text },
    ramadanNextAptName: { fontWeight: "500", fontSize: 11, color: C.textSecondary, marginTop: 2 },
    ramadanNextAptMeta: { fontWeight: "500", fontSize: 11, color: C.textSecondary, marginTop: 2 },
    ramadanNextAptLocation: { fontWeight: "500", fontSize: 11, color: C.tint, marginTop: 2 },
    moodCard: {},
    moodCardGlass: {
      marginTop: 12,
      marginBottom: 12,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 6,
      overflow: "hidden",
    },
    moodCardLight: {},
    moodDivider: {
      height: 1,
      backgroundColor: "rgba(0,0,0,0.08)",
      marginVertical: 10,
    },
    moodFeelingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    feelingCard: {},
    feelingCardGlass: {
      marginTop: 0,
      marginBottom: 12,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 6,
      overflow: "hidden",
    },
    feelingCardLight: {},
    feelingCardInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    feelingTitle: { fontWeight: "600", fontSize: 14, color: C.text },
    feelingSubtitle: { marginTop: 4, fontWeight: "400", fontSize: 12, color: C.textSecondary },
    sectionLabel: { fontWeight: "700", fontSize: 18, color: C.text, letterSpacing: -0.3, marginBottom: 14 },
    priorityGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12, width: "100%" },
    priorityGridItem: { marginBottom: 12 },
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
    cardGlass: {
      borderRadius: 20,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 6,
      overflow: "hidden",
    },
    cardInner: { backgroundColor: "transparent", borderRadius: 20 },
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
    fastingRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    fastingItem: { flex: 1, alignItems: "center" },
    fastingDivider: { width: 1, height: 28, backgroundColor: C.border },
    fastingLabel: { fontWeight: "400", fontSize: 11, color: C.textTertiary, marginBottom: 4 },
    fastingValue: { fontWeight: "600", fontSize: 14, color: C.text },
    energyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    energyDots: { flexDirection: "row", gap: 4 },
    energyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.surfaceElevated },
    reportDesc: { fontWeight: "400", fontSize: 13, color: C.textSecondary, marginTop: 4, marginBottom: 14 },
    reportBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    reportBtnText: { fontWeight: "600", fontSize: 13, color: C.tint },
    fab: {
      position: "absolute",
      right: 20,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.tint,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 8,
    },
  });
}
