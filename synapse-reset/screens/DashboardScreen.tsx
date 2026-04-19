import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Alert,
  useWindowDimensions,
  Animated,
  ScrollView,
  LayoutAnimation,
  ActivityIndicator,
  Modal,
} from "react-native";
import TextInput from "@/components/DoneTextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { featureFlags } from "@/constants/feature-flags";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useModeAwareScreen } from "@/contexts/AppModeContext";
import { useDisplaySettings } from "@/contexts/DisplaySettingsContext";
import GlassView from "@/components/GlassView";
import {
  healthLogStorage,
  medicationStorage,
  medicationLogStorage,
  appointmentStorage,
  fastingLogStorage,
  settingsStorage,
  healthProfileStorage,
  symptomStorage,
  vitalStorage,
  sickModeStorage,
  type HealthLog,
  type Medication,
  type MedicationLog,
  type Appointment,
  type FastingLog,
  type UserSettings,
  type HealthProfileInfo,
  type RecordOwner,
  type Symptom,
  type Vital,
  disableRecoveryTracking,
} from "@/lib/storage";
import { getToday, formatDate, formatTime12h, formatTimestamp } from "@/lib/date-utils";
import { getTodayRamadan } from "@/constants/ramadan-timetable";
import { useWalkthroughTargets, measureInWindow } from "@/contexts/WalkthroughContext";
import { buildRecoveryInsights } from "@/lib/recovery-insights";
import { buildTodayAtAGlance } from "@/lib/today-at-a-glance";

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

function normalizeLegacyFivePoint(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return value <= 5 ? Math.max(0, Math.min(10, value * 2)) : Math.max(0, Math.min(10, value));
}

function getTenPointLabel(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value <= 1) return "Very low";
  if (value <= 3) return "Low";
  if (value <= 5) return "Okay";
  if (value <= 7) return "Good";
  if (value <= 9) return "High";
  return "Excellent";
}

function parseAppointmentDateTime(appointment: Pick<Appointment, "date" | "time">) {
  const parsed = new Date(`${appointment.date}T${appointment.time || "09:00"}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimeToMinutes(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return (hours * 60) + minutes;
}

function fallbackMinutesForTimeOfDay(timeOfDay?: string) {
  switch ((timeOfDay ?? "").toLowerCase()) {
    case "morning":
      return 8 * 60;
    case "afternoon":
      return 13 * 60;
    case "night":
      return 20 * 60;
    case "before fajr":
      return 5 * 60;
    case "after iftar":
      return 19 * 60;
    default:
      return null;
  }
}

function formatAppointmentPreview(appointment: Pick<Appointment, "doctorName" | "date" | "time">, today: string) {
  const timeLabel = formatTime12h(appointment.time || "09:00");
  const doctorName = appointment.doctorName || "Appointment";
  const appointmentDate = appointment.date;
  const tomorrow = (() => {
    const date = new Date(`${today}T00:00:00`);
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  })();

  if (appointmentDate === today) {
    return `Next: ${doctorName} • ${timeLabel} today`;
  }
  if (appointmentDate === tomorrow) {
    return `Next: ${doctorName} • Tomorrow at ${timeLabel}`;
  }
  return `Next: ${doctorName} • ${formatDate(appointmentDate)} at ${timeLabel}`;
}

function formatDueMedicationPrompt(timeOfDay?: string, ownerLabel?: string, isSelfOwner?: boolean) {
  if (!isSelfOwner && ownerLabel?.trim()) {
    return `${ownerLabel.trim()} needs medication now`;
  }
  const normalized = (timeOfDay ?? "").trim().toLowerCase();
  if (!normalized) return "Your medication is due";
  return `Take your ${normalized} dose`;
}

function formatDueMedicationStatus(currentMinutes: number, dueMinutes: number) {
  const delta = currentMinutes - dueMinutes;
  if (delta <= 5) return "Due now";
  return `Missed ${delta} min${delta === 1 ? "" : "s"} ago`;
}

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  onRefreshKey?: number;
}

interface DashboardHeroProps {
  ramadanDayLabel?: string;
  subtitle: string;
  leftTimeLabel: string;
  rightTimeLabel: string;
  leftTime: string;
  rightTime: string;
  /** Next medication: name + dose lines (e.g. ["15 mg — Morning", "5 mg — Afternoon"]) */
  nextMedication: { name: string; lines: string[]; owner?: RecordOwner } | null;
  nextApt: Appointment | null;
  getOwnerMeta: (owner?: RecordOwner) => { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] };
  onNavigate: (screen: string) => void;
  medicationCardRef?: React.RefObject<View | null>;
  appointmentCardRef?: React.RefObject<View | null>;
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
  getOwnerMeta,
  onNavigate,
  medicationCardRef,
  appointmentCardRef,
}: DashboardHeroProps) {
  const { colors: C, themeId } = useTheme();
  const styles = useMemo(() => makeHeroStyles(C), [C]);

  const heroGradientColors: [string, string] =
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
        {ramadanDayLabel ? (
          <Text
            style={[
              styles.dashboardHeroRamadan,
              themeId === "light" && { color: "#1F2937" },
            ]}
          >
            {ramadanDayLabel}
          </Text>
        ) : null}
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
            {nextMedication ? (
              <View style={styles.dashboardHeroOwnerChip}>
                <Ionicons name={getOwnerMeta(nextMedication.owner).icon} size={11} color={themeId === "dark" ? "#D8D8D8" : C.textSecondary} />
                <Text style={[styles.dashboardHeroOwnerText, { color: miniCardSubtitleColor }]}>{getOwnerMeta(nextMedication.owner).label}</Text>
              </View>
            ) : null}
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
          {nextApt ? (
            <View style={styles.dashboardHeroOwnerChip}>
              <Ionicons name={getOwnerMeta(nextApt.entryOwner).icon} size={11} color={themeId === "dark" ? "#D8D8D8" : C.textSecondary} />
              <Text style={[styles.dashboardHeroOwnerText, { color: miniCardSubtitleColor }]}>{getOwnerMeta(nextApt.entryOwner).label}</Text>
            </View>
          ) : null}
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
  const { colors: C, themeId } = useTheme();
  const { textScale } = useDisplaySettings();
  const styles = useMemo(() => makeStyles(C, textScale), [C, textScale]);
  const modeUI = useModeAwareScreen("dashboard");
  const isWide = width >= 768;
  const today = getToday();
  const walkthrough = useWalkthroughTargets();
  const registerTarget = walkthrough?.registerTarget;
  const unregisterTarget = walkthrough?.unregisterTarget;
  const refMed = useRef<View>(null);
  const refApt = useRef<View>(null);
  const refDailyLog = useRef<View>(null);

  useEffect(() => {
    if (!registerTarget || !unregisterTarget) return;
    registerTarget("medication", () => measureInWindow(refMed));
    registerTarget("appointments", () => measureInWindow(refApt));
    registerTarget("dailylog", () => measureInWindow(refDailyLog));
    return () => {
      unregisterTarget("medication");
      unregisterTarget("appointments");
      unregisterTarget("dailylog");
    };
  }, [registerTarget, unregisterTarget]);

  const [todayLog, setTodayLog] = useState<HealthLog | undefined>();
  const [allLogs, setAllLogs] = useState<HealthLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medLogs, setMedLogs] = useState<MedicationLog[]>([]);
  const [allMedLogs, setAllMedLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [fastingLog, setFastingLog] = useState<FastingLog | undefined>();
  const [settings, setSettings] = useState<UserSettings>({ name: "", conditions: [], ramadanMode: false, sickMode: false });
  const [profile, setProfile] = useState<HealthProfileInfo>({ userRole: "self", backupCriticalMedications: [] });
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [recoveryFocusInput, setRecoveryFocusInput] = useState("");

  const loadData = useCallback(async () => {
    const [logsData, meds, ml, apts, fl, sett, profileInfo, symptomsData, vitalsData] = await Promise.all([
      healthLogStorage.getAll(),
      medicationStorage.getAll(),
      medicationLogStorage.getAll(),
      appointmentStorage.getAll(),
      fastingLogStorage.getByDate(today),
      settingsStorage.get(),
      healthProfileStorage.get(),
      symptomStorage.getAll(),
      vitalStorage.getAll(),
    ]);
    setTodayLog(logsData.find((log) => log.date === today));
    setAllLogs(logsData);
    setMedications(meds.filter((m) => m.active));
    setMedLogs(ml.filter((log) => log.date === today));
    setAllMedLogs(ml);
    setAppointments(apts.sort((a, b) => {
      const aTime = parseAppointmentDateTime(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = parseAppointmentDateTime(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }));
    setFastingLog(fl);
    setSettings(sett);
    setProfile(profileInfo);
    setSymptoms(symptomsData);
    setVitals(vitalsData);
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
  const upcomingAppointments = useMemo(
    () => appointments.filter((appointment) => !appointment.status && (parseAppointmentDateTime(appointment)?.getTime() ?? -1) >= Date.now()),
    [appointments]
  );
  const nextApt = upcomingAppointments[0] ?? null;

  const dateObj = new Date();
  const settingsFirstName = settings.firstName?.trim() || (settings.name?.trim() ? settings.name.trim().split(/\s+/)[0] : "");
  const displayFirstName = settingsFirstName || "";
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

  const getOwnerMeta = useCallback((owner?: RecordOwner) => {
    if (owner === "care_recipient" && profile.userRole === "caregiver" && profile.caredForName?.trim()) {
      return { label: profile.caredForName.trim(), icon: "people-outline" as const };
    }
    return { label: "You", icon: "person-outline" as const };
  }, [profile.caredForName, profile.userRole]);

  const getNextMedicationInfo = (): { name: string; lines: string[]; owner?: RecordOwner } | null => {
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
      return { name, lines, owner: med.entryOwner };
    }
    return null;
  };

  const currentMinutes = (hour * 60) + dateObj.getMinutes();
  const dueMedication = useMemo(() => {
    for (const med of medications) {
      if (med.medicationType === "prn") continue;
      const doses = Array.isArray(med.doses) && med.doses.length > 0 ? med.doses : [];
      for (let index = 0; index < doses.length; index += 1) {
        const dose = doses[index];
        const alreadyTaken = medLogs.some((log) => log.medicationId === med.id && (log.doseIndex ?? 0) === index && log.taken);
        if (alreadyTaken) continue;
        const dueAt = parseTimeToMinutes(dose.reminderTime) ?? fallbackMinutesForTimeOfDay(dose.timeOfDay);
        if (dueAt == null || dueAt > currentMinutes) continue;
        return {
          name: med.name || "Medication due",
          timeOfDay: dose.timeOfDay,
          dueMinutes: dueAt,
          subtitle: dose.amount && dose.unit ? `${dose.amount} ${dose.unit} • ${dose.timeOfDay}` : dose.timeOfDay,
          owner: med.entryOwner,
        };
      }
    }
    return null;
  }, [currentMinutes, medLogs, medications]);
  const nextMedication = getNextMedicationInfo();
  const todayAppointments = useMemo(
    () => upcomingAppointments
      .filter((appointment) => appointment.date === today)
      .sort((a, b) => (parseAppointmentDateTime(a)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (parseAppointmentDateTime(b)?.getTime() ?? Number.MAX_SAFE_INTEGER)),
    [today, upcomingAppointments]
  );
  const todayAppointment = todayAppointments[0] ?? null;
  const simpleGreeting = (() => {
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 22) return "Good evening";
    return "Good night";
  })();
  const simpleDashboardState = dueMedication
    ? {
      title: formatDueMedicationPrompt(
        dueMedication.timeOfDay,
        getOwnerMeta(dueMedication.owner).label,
        (dueMedication.owner ?? "self") === "self",
      ),
      primary: dueMedication.name,
      secondary: formatDueMedicationStatus(currentMinutes, dueMedication.dueMinutes),
      tertiary: nextApt ? formatAppointmentPreview(nextApt, today) : null,
      detail: dueMedication.subtitle,
      ctaLabel: "Take Medication",
      ctaTarget: "medications",
    }
    : todayAppointment
      ? {
        title: "You have an appointment",
        primary: todayAppointment.doctorName,
        secondary: formatTime12h(todayAppointment.time),
        tertiary: todayAppointment.specialty || null,
        detail: null,
        ctaLabel: "View Details",
        ctaTarget: "appointments",
      }
      : {
        title: "You're all good",
        primary: "No medications or appointments today",
        secondary: null,
        tertiary: null,
        detail: null,
        ctaLabel: "Log how you feel",
        ctaTarget: "symptoms",
      };
  const recoverySummary = useMemo(() => buildRecoveryInsights({
    logs: allLogs,
    vitals,
    symptoms,
    medications,
    medicationLogs: allMedLogs,
    rangeDays: 7,
    today,
  }), [allLogs, vitals, symptoms, medications, allMedLogs, today]);

  const recoveryStatusTone =
    recoverySummary.statusLabel === "Improving"
      ? C.green
      : recoverySummary.statusLabel === "Worsening"
        ? C.red
        : C.tint;
  const latestSymptomText = recoverySummary.latestSymptom
    ? `${recoverySummary.latestSymptom.name} · ${recoverySummary.latestSymptom.severity}/10`
    : "No recent symptoms";
  const todayVitalsText = [
    recoverySummary.todayVitals.bloodPressure,
    recoverySummary.todayVitals.heartRate,
    recoverySummary.todayVitals.temperature,
    recoverySummary.todayVitals.oxygenSaturation,
  ].filter(Boolean).slice(0, 2).join(" · ") || "No vitals logged";
  const latestCheckInText = recoverySummary.latestCheckIn?.recordedAt
    ? formatTimestamp(recoverySummary.latestCheckIn.recordedAt)
    : recoverySummary.latestCheckIn?.date
      ? formatDate(recoverySummary.latestCheckIn.date)
      : "No check-in yet";
  const hasRecoveryTracking = !!profile.recoveryTrackingEnabled && !!profile.recoveryFocus?.trim();
  const todayAtAGlance = useMemo(() => buildTodayAtAGlance({
    medications,
    medicationLogs: medLogs,
    symptoms: symptoms.filter((symptom) => symptom.date === today),
    vitals: vitals.filter((vital) => vital.date === today),
  }), [medications, medLogs, symptoms, vitals, today]);

  const openRecoverySetup = () => {
    setRecoveryFocusInput(profile.recoveryFocus?.trim() ?? "");
    setShowRecoverySetup(true);
  };

  const handleSaveRecoverySetup = async () => {
    const trimmed = recoveryFocusInput.trim();
    if (!trimmed) return;
    const nextProfile = {
      ...profile,
      recoveryTrackingEnabled: true,
      recoveryFocus: trimmed,
    };
    await healthProfileStorage.save(nextProfile);
    setProfile(nextProfile);
    setShowRecoverySetup(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleEndRecovery = async () => {
    Alert.alert(
      settings.sickMode ? "You're feeling better?" : "End recovery tracking?",
      settings.sickMode
        ? "This will turn off Sick Mode and end recovery tracking."
        : "This will hide recovery tracking until you turn it on again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: settings.sickMode ? "I'm better" : "End recovery",
          style: "destructive",
          onPress: async () => {
            const nextProfile = await disableRecoveryTracking();
            setProfile(nextProfile);

            if (settings.sickMode) {
              const nextSettings = { ...settings, sickMode: false };
              await settingsStorage.save(nextSettings);
              await sickModeStorage.reset();
              setSettings(nextSettings);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  const renderRecoverySummaryCard = () => (
    <GlassView intensity={50} tint={themeId === "dark" ? "dark" : "light"} style={[styles.recoveryCardGlass, themeId === "light" && styles.recoveryCardLight]}>
      <View style={styles.recoveryCardInner}>
        <View style={styles.recoveryCardHeader}>
          <View>
            <Text style={styles.recoveryCardTitle}>Recovery Summary</Text>
            <Text style={styles.recoveryCardSubtitle}>
              {profile.recoveryFocus?.trim()
                ? `Recovering from ${profile.recoveryFocus.trim()}. ${recoverySummary.summaryText}`
                : recoverySummary.summaryText}
            </Text>
          </View>
          <View style={[styles.recoveryStatusPill, { backgroundColor: recoveryStatusTone + "1F", borderColor: recoveryStatusTone + "44" }]}>
            <Text style={styles.recoveryStatusText}>{recoverySummary.statusLabel}</Text>
          </View>
        </View>

        <View style={styles.recoveryMetricsGrid}>
          <Pressable
            style={({ pressed }) => [styles.recoveryMetricCard, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => onNavigate("healthdata")}
            accessibilityRole="button"
            accessibilityLabel="Open vitals"
          >
            <Text style={styles.recoveryMetricLabel}>Today’s vitals</Text>
            <Text style={styles.recoveryMetricValue}>{todayVitalsText}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.recoveryMetricCard, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => onNavigate("symptoms")}
            accessibilityRole="button"
            accessibilityLabel="Open symptoms"
          >
            <Text style={styles.recoveryMetricLabel}>Last symptom</Text>
            <Text style={styles.recoveryMetricValue}>{latestSymptomText}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.recoveryMetricCard, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => onNavigate("medications")}
            accessibilityRole="button"
            accessibilityLabel="Open medications"
          >
            <Text style={styles.recoveryMetricLabel}>Meds today</Text>
            <Text style={styles.recoveryMetricValue}>
              {recoverySummary.todayMedicationExpected > 0
                ? `${recoverySummary.todayMedicationTaken}/${recoverySummary.todayMedicationExpected} taken`
                : "No meds scheduled"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.recoveryMetricCard, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => onNavigate("logtoday")}
            accessibilityRole="button"
            accessibilityLabel="Open today's check-in"
          >
            <Text style={styles.recoveryMetricLabel}>Last check-in</Text>
            <Text style={styles.recoveryMetricValue}>{latestCheckInText}</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.recoveryInsightBanner, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => onNavigate("reports")}
          accessibilityRole="button"
          accessibilityLabel="Open recovery reports"
        >
          <Ionicons name="sparkles-outline" size={16} color={C.tint} />
        <Text style={styles.recoveryInsightText}>{recoverySummary.insights[0]}</Text>
        </Pressable>
        <Text style={styles.recoverySafetyText}>This app helps track symptoms and trends. It does not replace medical care.</Text>
        <View style={styles.recoveryActionRow}>
          <Pressable
            style={({ pressed }) => [styles.recoverySecondaryButton, { opacity: pressed ? 0.88 : 1 }]}
            onPress={openRecoverySetup}
            accessibilityRole="button"
            accessibilityLabel="Edit what you're recovering from"
          >
            <Text style={styles.recoverySecondaryButtonText}>Edit focus</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.recoveryEndButton, { opacity: pressed ? 0.88 : 1 }]}
            onPress={handleEndRecovery}
            accessibilityRole="button"
            accessibilityLabel={settings.sickMode ? "I'm better" : "End recovery tracking"}
          >
            <Text style={styles.recoveryEndButtonText}>{settings.sickMode ? "I’m better" : "End recovery"}</Text>
          </Pressable>
        </View>
      </View>
    </GlassView>
  );

  const renderRecoverySetupCard = () => (
    <GlassView intensity={50} tint={themeId === "dark" ? "dark" : "light"} style={[styles.recoveryCardGlass, themeId === "light" && styles.recoveryCardLight]}>
      <View style={styles.recoveryCardInner}>
        <View style={styles.recoveryCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recoveryCardTitle}>Recovery Tracking</Text>
            <Text style={styles.recoveryCardSubtitle}>
              Turn this on only when it’s actually relevant. We’ll use it to connect your vitals, symptoms, meds, and daily check-ins.
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.recoverySetupButton, { opacity: pressed ? 0.88 : 1 }]}
          onPress={openRecoverySetup}
          accessibilityRole="button"
          accessibilityLabel="Set up recovery tracking"
        >
          <Ionicons name="bandage-outline" size={18} color="#fff" />
          <Text style={styles.recoverySetupButtonText}>What are you recovering from?</Text>
        </Pressable>
      </View>
    </GlassView>
  );

  const renderTodayAtAGlanceCard = () => (
    <GlassView intensity={50} tint={themeId === "dark" ? "dark" : "light"} style={[styles.glanceCardGlass, themeId === "light" && styles.glanceCardLight]}>
      <View style={styles.glanceCardInner}>
        <View style={styles.glanceCardHeader}>
          <View style={styles.glanceCardTitleWrap}>
            <Text style={styles.glanceCardTitle}>Today at a glance</Text>
            <Text style={styles.glanceCardSubtitle}>A quick reflection based on what you logged today.</Text>
          </View>
        </View>

        <View style={styles.glanceLines}>
          <Text style={styles.glanceLine}>{todayAtAGlance.medicationLine}</Text>
          {todayAtAGlance.symptomsLine ? (
            <Text style={styles.glanceLine}>{todayAtAGlance.symptomsLine}</Text>
          ) : null}
          <Text style={styles.glanceInsight}>{todayAtAGlance.insightLine}</Text>
        </View>
      </View>
    </GlassView>
  );

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
              <Text style={styles.priLogValue}>{getTenPointLabel(normalizeLegacyFivePoint(todayLog.energy))}</Text>
            </View>
            <View style={styles.priLogDivider} />
            <View style={styles.priLogItem}>
              <Text style={styles.priLogLabel}>Mood</Text>
              <Text style={styles.priLogValue}>{normalizeLegacyFivePoint(todayLog.mood)}/10</Text>
            </View>
            <View style={styles.priLogDivider} />
            <View style={styles.priLogItem}>
              <Text style={styles.priLogLabel}>Sleep</Text>
              <Text style={styles.priLogValue}>{normalizeLegacyFivePoint(todayLog.sleep)}/10</Text>
            </View>
          </View>
          {todayLog.fasting && <Text style={styles.priMeta}>Fasting today</Text>}
        </View>
      ) : (
        <View>
          <Text style={styles.priEmpty}>Not logged yet</Text>
          <Text style={[styles.priMeta, { marginTop: 6 }]}>Tap to log how you&apos;re feeling</Text>
        </View>
      )}
    </PriorityCard>
  );

  const contentPadding = {
    paddingTop: isWide ? 40 : (Platform.OS === "web" ? 67 : insets.top + (modeUI.isSimpleMode ? 18 : 12)),
    paddingBottom: isWide ? 40 : (Platform.OS === "web" ? 118 : insets.bottom + 100),
  };
  const fabBottom = Platform.OS === "web"
    ? (modeUI.isSimpleMode ? 132 : 100)
    : modeUI.isSimpleMode ? insets.bottom + 108 : insets.bottom + 8;
  const fab = modeUI.isSimpleMode ? null : (
    <Pressable
      style={({ pressed }) => [styles.fab, { bottom: fabBottom, opacity: pressed ? 0.85 : 1 }]}
      onPress={() => {
        Haptics.selectionAsync();
        onNavigate("emergency");
      }}
      accessibilityRole="button"
      accessibilityLabel="Emergency Protocol"
      accessibilityHint="View critical medical information"
    >
      <Ionicons name="medkit" size={28} color="#fff" />
    </Pressable>
  );
  const isLightTheme = themeId === "light";

  if (!loaded) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.tint} />
        <Text style={[styles.dateText, { marginTop: 12 }]}>Loading…</Text>
      </View>
    );
  }

  if (modeUI.isSimpleMode) {
    const simpleContent = (
      <View style={[styles.container, { backgroundColor: isLightTheme ? "transparent" : C.background }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            contentPadding,
            styles.scrollViewContent,
            styles.simpleDashboardContent,
            { paddingHorizontal: isWide ? 28 : 18 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
        >
          <View style={styles.simpleDashboardHeader}>
            <Text style={styles.simpleDashboardGreeting}>
              {simpleGreeting}
              {displayFirstName ? `, ${displayFirstName}` : ""}
            </Text>
            <Text style={styles.simpleDashboardSubtext}>
              {simpleDashboardState.title}
            </Text>
          </View>

          <View style={styles.simpleDashboardCard}>
            <Text style={styles.simpleDashboardCardTitle}>Today</Text>
            <Text style={styles.simpleDashboardLead}>{simpleDashboardState.title}</Text>
            <Text style={styles.simpleDashboardAppointmentName}>{simpleDashboardState.primary}</Text>
            {simpleDashboardState.detail ? (
              <Text style={styles.simpleDashboardAppointmentMeta}>{simpleDashboardState.detail}</Text>
            ) : null}
            {simpleDashboardState.secondary ? (
              <Text style={simpleDashboardState.detail ? styles.simpleDashboardAppointmentSubtle : styles.simpleDashboardAppointmentMeta}>
                {simpleDashboardState.secondary}
              </Text>
            ) : null}
            {simpleDashboardState.tertiary ? (
              <Text style={styles.simpleDashboardAppointmentSubtle}>{simpleDashboardState.tertiary}</Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.simpleDashboardPrimaryButton,
                pressed && styles.simpleDashboardPrimaryButtonPressed,
              ]}
              onPress={() => onNavigate(simpleDashboardState.ctaTarget)}
              accessibilityRole="button"
              accessibilityLabel={simpleDashboardState.ctaLabel}
            >
              <Text style={styles.simpleDashboardPrimaryButtonText}>{simpleDashboardState.ctaLabel}</Text>
            </Pressable>
          </View>
        </ScrollView>
        {fab}
      </View>
    );

    if (isLightTheme) {
      return (
        <LinearGradient
          colors={["#d7ddff", "#c8d6fb", "#d7ebff"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          {simpleContent}
        </LinearGradient>
      );
    }

    return simpleContent;
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
            ramadanDayLabel={isRamadanMode ? `Ramadan ${ramadanDay.hijriDay}${ordinalSuffix(ramadanDay.hijriDay)}, 1447 AH` : undefined}
            subtitle={goodDayMessage}
            leftTimeLabel={leftLabel}
            rightTimeLabel={rightLabel}
            leftTime={leftTime}
            rightTime={rightTime}
            nextMedication={nextMedication ? { name: nextMedication.name, lines: nextMedication.lines, owner: nextMedication.owner } : null}
            nextApt={nextApt ?? null}
            getOwnerMeta={getOwnerMeta}
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
                <Text style={styles.feelingSubtitle}>Tap to log today&apos;s energy, mood, and sleep.</Text>
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

      {hasRecoveryTracking ? renderRecoverySummaryCard() : renderRecoverySetupCard()}

      {renderTodayAtAGlanceCard()}

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
      <Modal visible={showRecoverySetup} animationType="fade" transparent onRequestClose={() => setShowRecoverySetup(false)}>
        <View style={styles.recoveryModalBackdrop}>
          <View style={styles.recoveryModalCard}>
            <Text style={styles.recoveryModalTitle}>Recovery Tracking</Text>
            <Text style={styles.recoveryModalSubtitle}>What are you recovering from?</Text>
            <TextInput
              value={recoveryFocusInput}
              onChangeText={setRecoveryFocusInput}
              placeholder="Surgery, illness, flare-up, injury..."
              placeholderTextColor={C.textTertiary}
              keyboardAppearance={themeId === "dark" ? "dark" : "default"}
              style={[styles.recoveryModalInput, { color: C.text }]}
            />
            <Text style={styles.recoveryModalHint}>You can change this later. Recovery tracking stays focused and local to your device.</Text>
            <View style={styles.recoveryModalActions}>
              <Pressable
                style={({ pressed }) => [styles.recoveryModalButtonSecondary, { opacity: pressed ? 0.88 : 1 }]}
                onPress={() => setShowRecoverySetup(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel recovery setup"
              >
                <Text style={styles.recoveryModalButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.recoveryModalButtonPrimary,
                  { opacity: pressed || !recoveryFocusInput.trim() ? 0.88 : 1 },
                  !recoveryFocusInput.trim() && styles.recoveryModalButtonDisabled,
                ]}
                onPress={handleSaveRecoverySetup}
                disabled={!recoveryFocusInput.trim()}
                accessibilityRole="button"
                accessibilityLabel="Save recovery setup"
              >
                <Text style={styles.recoveryModalButtonPrimaryText}>{hasRecoveryTracking ? "Save changes" : "Start tracking"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    dashboardHeroOwnerChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      marginBottom: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(127,127,127,0.12)",
    },
    dashboardHeroOwnerText: {
      fontWeight: "700",
      fontSize: 10,
      letterSpacing: 0.4,
      textTransform: "uppercase",
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

function makeStyles(C: Theme, textScale: number) {
  const size = (base: number) => Math.round(base * textScale * 100) / 100;
  return StyleSheet.create({
    gradientContainer: { flex: 1, width: "100%", height: "100%" },
    container: { flex: 1, minHeight: 1, backgroundColor: C.background },
    scrollView: { flex: 1, minHeight: 1 },
    scrollViewContent: { flexGrow: 1 },
    content: { paddingHorizontal: 0 },
    simpleDashboardContent: {
      gap: 16,
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
    },
    simpleDashboardHeader: {
      paddingTop: 6,
      marginBottom: 4,
    },
    simpleDashboardGreeting: {
      fontWeight: "800",
      fontSize: size(26),
      lineHeight: size(34),
      color: C.text,
      letterSpacing: -0.8,
    },
    simpleDashboardSubtext: {
      fontWeight: "500",
      fontSize: size(18),
      lineHeight: size(24),
      color: C.textSecondary,
    },
    simpleDashboardCard: {
      borderRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 18,
      backgroundColor: "rgba(255,255,255,0.82)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.72)",
      shadowColor: "#6A7BB4",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
      elevation: 6,
      gap: 14,
    },
    simpleAddSheet: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 24,
      backgroundColor: C.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: C.border,
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 8,
    },
    simpleAddSheetTitle: {
      fontWeight: "800",
      fontSize: size(22),
      lineHeight: size(28),
      color: C.text,
      letterSpacing: -0.4,
    },
    simpleAddSheetButton: {
      minHeight: 56,
      borderRadius: 18,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    simpleAddSheetButtonPressed: {
      opacity: 0.95,
      transform: [{ scale: 0.99 }],
    },
    simpleAddSheetButtonText: {
      fontWeight: "700",
      fontSize: size(18),
      color: C.text,
    },
    simpleAddSheetCancelButton: {
      minHeight: 56,
      borderRadius: 18,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    simpleAddSheetCancelText: {
      fontWeight: "700",
      fontSize: size(18),
      color: C.textSecondary,
    },
    simpleDashboardCardTitle: {
      fontWeight: "800",
      fontSize: size(22),
      lineHeight: size(28),
      color: C.text,
      letterSpacing: -0.5,
    },
    simpleDashboardLead: {
      fontWeight: "500",
      fontSize: size(18),
      lineHeight: size(25),
      color: C.text,
    },
    simpleDashboardList: {
      gap: 8,
    },
    simpleDashboardListRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    simpleDashboardBullet: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: C.textSecondary,
      marginTop: 9,
      opacity: 0.7,
    },
    simpleDashboardListText: {
      flex: 1,
      fontWeight: "500",
      fontSize: size(17),
      lineHeight: size(24),
      color: C.text,
    },
    simpleDashboardPrimaryButton: {
      minHeight: 58,
      borderRadius: 18,
      backgroundColor: "#3F6EE8",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      shadowColor: "#3F6EE8",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 4,
    },
    simpleDashboardPrimaryButtonPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.99 }],
    },
    simpleDashboardPrimaryButtonText: {
      fontWeight: "800",
      fontSize: size(18),
      color: "#fff",
      letterSpacing: -0.2,
    },
    simpleDashboardButtonRow: {
      flexDirection: "row",
      gap: 10,
    },
    simpleDashboardSecondaryButton: {
      minHeight: 58,
      borderRadius: 18,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      flex: 1,
    },
    simpleDashboardSecondaryButtonText: {
      fontWeight: "800",
      fontSize: size(18),
      color: C.text,
      letterSpacing: -0.2,
    },
    simpleDashboardTodayBadge: {
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: "#3F6EE8",
    },
    simpleDashboardTodayBadgeText: {
      fontWeight: "800",
      fontSize: size(12),
      color: "#fff",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    simpleDashboardAppointmentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    simpleDashboardAvatar: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: "#E9F0FF",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#D5E1FF",
    },
    simpleDashboardAppointmentTextWrap: {
      flex: 1,
      gap: 2,
    },
    simpleDashboardAppointmentName: {
      fontWeight: "800",
      fontSize: size(20),
      lineHeight: size(25),
      color: C.text,
      letterSpacing: -0.4,
    },
    simpleDashboardAppointmentMeta: {
      fontWeight: "500",
      fontSize: size(18),
      lineHeight: size(24),
      color: C.textSecondary,
    },
    simpleDashboardAppointmentSubtle: {
      fontWeight: "500",
      fontSize: size(15),
      lineHeight: size(20),
      color: C.textTertiary,
    },
    simpleDashboardEmptyTitle: {
      fontWeight: "800",
      fontSize: size(20),
      lineHeight: size(26),
      color: C.text,
    },
    simpleDashboardEmptyBody: {
      fontWeight: "500",
      fontSize: size(16),
      lineHeight: size(23),
      color: C.textSecondary,
    },
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
    recoveryCardGlass: {
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 6,
      overflow: "hidden",
    },
    recoveryCardLight: {},
    recoveryCardInner: {},
    recoveryCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 },
    recoveryCardTitle: { fontWeight: "700", fontSize: 18, color: C.text, letterSpacing: -0.3 },
    recoveryCardSubtitle: { marginTop: 4, fontWeight: "400", fontSize: 13, color: C.textSecondary, lineHeight: 18, maxWidth: 230 },
    recoveryStatusPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
    recoveryStatusText: { fontWeight: "700", fontSize: 11, color: C.text },
    recoveryMetricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    recoveryMetricCard: { width: "48%", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, minHeight: 88 },
    recoveryMetricLabel: { fontWeight: "600", fontSize: 11, color: C.textSecondary, marginBottom: 6 },
    recoveryMetricValue: { fontWeight: "600", fontSize: 13, color: C.text, lineHeight: 18 },
    recoveryInsightBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 10 },
    recoveryInsightText: { flex: 1, fontWeight: "500", fontSize: 13, color: C.text, lineHeight: 18 },
    recoverySafetyText: { fontWeight: "400", fontSize: 12, color: C.textTertiary, lineHeight: 17 },
    recoveryActionRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
    recoverySecondaryButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    recoverySecondaryButtonText: { fontWeight: "700", fontSize: 13, color: C.text },
    recoveryEndButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    recoveryEndButtonText: { fontWeight: "700", fontSize: 13, color: C.red },
    recoverySetupButton: { marginTop: 6, backgroundColor: C.tint, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    recoverySetupButtonText: { fontWeight: "700", fontSize: 14, color: "#fff" },
    recoveryModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center", padding: 24 },
    recoveryModalCard: { width: "100%", maxWidth: 420, backgroundColor: C.surface, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: C.border },
    recoveryModalTitle: { fontWeight: "700", fontSize: 24, color: C.text, letterSpacing: -0.4, marginBottom: 8 },
    recoveryModalSubtitle: { fontWeight: "600", fontSize: 14, color: C.textSecondary, marginBottom: 14 },
    recoveryModalInput: { marginBottom: 12 },
    recoveryModalHint: { fontWeight: "400", fontSize: 12, color: C.textTertiary, lineHeight: 18, marginBottom: 16 },
    recoveryModalActions: { flexDirection: "row", gap: 10 },
    recoveryModalButtonSecondary: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
    recoveryModalButtonSecondaryText: { fontWeight: "700", fontSize: 14, color: C.text },
    recoveryModalButtonPrimary: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.tint },
    recoveryModalButtonPrimaryText: { fontWeight: "700", fontSize: 14, color: "#fff" },
    recoveryModalButtonDisabled: { opacity: 0.5 },
    glanceCardGlass: {
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 6,
      overflow: "hidden",
    },
    glanceCardLight: {},
    glanceCardInner: {},
    glanceCardHeader: { marginBottom: 12 },
    glanceCardTitleWrap: { gap: 4 },
    glanceCardTitle: { fontWeight: "700", fontSize: 18, color: C.text, letterSpacing: -0.3 },
    glanceCardSubtitle: { fontWeight: "400", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    glanceLines: { gap: 8 },
    glanceLine: { fontWeight: "500", fontSize: 13, color: C.text, lineHeight: 18 },
    glanceInsight: { fontWeight: "600", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
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
      zIndex: 30,
    },
  });
}
