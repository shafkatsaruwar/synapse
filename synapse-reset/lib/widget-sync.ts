import { NativeModules, Platform } from "react-native";
import {
  appointmentStorage,
  caregiverProfileStorage,
  healthLogStorage,
  healthProfileStorage,
  hydrationStorage,
  labWorkStorage,
  medicationLogStorage,
  medicationStorage,
  mentalHealthModeStorage,
  normalizeMedication,
  sickModeStorage,
  symptomStorage,
  vitalStorage,
  convertHydrationToMl,
  formatHydrationAmount,
  type Appointment,
  type CaregiverProfile,
  type HealthLog,
  type HydrationEntry,
  type LabWork,
  type Medication,
  type MedicationDose,
  type MentalHealthModeData,
  type SickModeData,
  type Symptom,
  type WidgetAppearancePreference,
} from "@/lib/storage";
import { getDaysAgo, getToday } from "@/lib/date-utils";
import { getAppointmentTravelEstimate } from "@/lib/appointment-travel";
import { buildRecoveryInsights } from "@/lib/recovery-insights";
import { isMedicationScheduledOnDate } from "@/lib/medication-schedule";

type WidgetTone = "green" | "blue" | "orange" | "red" | "purple" | "yellow" | "muted";

type WidgetGridCell = {
  title: string;
  detail: string;
};

type WidgetActionRow = {
  tone: WidgetTone;
  title: string;
  subtitle: string;
  trailing: string;
};

/** Soft UI hydration goal for widgets only — not a medical recommendation. */
const SOFT_HYDRATION_GOAL_ML = 2000;

type WidgetSnapshot = {
  appearance: WidgetAppearancePreference;
  medication: null | {
    name: string;
    detail: string;
    dueAt: string | null;
    windowStart: string | null;
    dueText: string;
    isTaken: boolean;
    nextText: string | null;
    heroTimeText: string;
    statusLabel: "Next" | "Done";
    secondaryLine: string;
    tone: WidgetTone;
  };
  appointment: null | {
    doctorName: string;
    detail: string;
    startsAt: string | null;
    whenText: string;
    travelText: string | null;
    location: string | null;
    notes: string | null;
    prepHint: string;
    statusLabel: "Ready" | "Soon" | "None";
    tone: WidgetTone;
    headline: string;
    supportText: string;
    rows: WidgetActionRow[];
  };
  recovery: {
    active: boolean;
    title: string;
    statusText: string;
    statusLabel: string;
    tone: WidgetTone;
    focusText: string | null;
    nextAction: string;
    headline: string;
    supportText: string;
    progress: number;
  };
  pain: {
    hasPain: boolean;
    name: string;
    severity: number | null;
    statusText: string;
    statusLabel: "Up" | "Watch" | "Calm";
    tone: WidgetTone;
    nextAction: string;
    lastLoggedText: string;
    progress: number;
  };
  medicationDay: {
    taken: number;
    expected: number;
    summaryText: string;
    nextAction: string;
    doses: { name: string; detail: string; timeText: string; taken: boolean }[];
    statusLabel: string;
    tone: WidgetTone;
    headline: string;
    gridCells: WidgetGridCell[];
    actionRows: WidgetActionRow[];
  };
  labs: {
    hasItems: boolean;
    title: string;
    statusText: string;
    statusLabel: "Review" | "Steady" | "Empty";
    tone: WidgetTone;
    nextAction: string;
    headline: string;
    supportText: string;
    progress: number;
    items: { name: string; detail: string; pending: boolean }[];
  };
  report14Day: {
    statusLabel: string;
    summaryText: string;
    tone: WidgetTone;
    adherenceText: string;
    nextAction: string;
    insights: string[];
    headline: string;
    gridCells: WidgetGridCell[];
    actionRows: WidgetActionRow[];
  };
  prnMedication: null | {
    id: string;
    name: string;
    detail: string;
    lastLoggedAt: string | null;
    statusText: string;
    countText: string;
    hoursSinceLastText: string;
    windowText: string;
    statusLabel: "Watch" | "Clear";
    tone: WidgetTone;
  };
  wellness: {
    hasTodayLog: boolean;
    energy: number | null;
    mood: number | null;
    sleep: number | null;
    overallFeeling: number | null;
    detailHighlights: string[];
    summaryText: string;
    secondaryText: string;
    symptomCountToday: number;
    topSymptomName: string | null;
    isFastingToday: boolean;
    statusLabel: string;
    tone: WidgetTone;
    headline: string;
    gridCells: WidgetGridCell[];
    actionRows: WidgetActionRow[];
  };
  hydration: {
    presetLabel: string;
    sipAmountText: string;
    totalTodayMl: number;
    totalTodayText: string;
    hasEntriesToday: boolean;
    launchHint: string;
    /** Soft UI target (2000 ml default) — not a medical goal. */
    percentToday: number;
    loggedCount: number;
    targetSipsEstimate: number;
    progress: number;
    statusLabel: "Low" | "On track" | "Good";
    tone: WidgetTone;
    secondaryLine: string;
  };
  sleep: {
    hasData: boolean;
    score: number | null;
    heroText: string;
    statusLabel: "Short" | "OK";
    tone: WidgetTone;
    primaryLine: string;
    secondaryLine: string;
  };
  flareForecast: {
    statusLabel: "Watch" | "Calm";
    tone: WidgetTone;
    headline: string;
    supportText: string;
    trendTones: WidgetTone[];
  };
  sickMode: {
    active: boolean;
    recoveryMode: boolean;
    latestTemperature: number | null;
    latestTemperatureText: string;
    statusText: string;
    statusLabel: "Active" | "Easing" | "Off";
    heroAction: string;
    tone: WidgetTone;
    needsStressDose: boolean;
    stressDoseText: string;
    checkInTimer: string | null;
  };
  mentalHealth: {
    active: boolean;
    statusText: string;
    statusLabel: "Logged" | "Open" | "Active";
    tone: WidgetTone;
    headline: string;
    supportText: string;
    nextCheckInText: string;
    checkInTimer: string | null;
    trendTones: WidgetTone[];
  };
  caregiver: {
    hasProfile: boolean;
    name: string;
    age: number | null;
    relation: string | null;
    status: "all_good" | "attention" | "urgent";
    statusText: string;
    statusLabel: "Share" | "Check" | "OK" | "Setup";
    tone: WidgetTone;
    primaryText: string;
    secondaryText: string | null;
    actionText: string | null;
    headline: string;
    items: { kind: "missed" | "next" | "nolog" | "setup" | "good"; text: string; tone: WidgetTone }[];
    missedCount: number;
  };
  updatedAt: string;
};

type NativeWidgetBridge = {
  saveSnapshot?: (payload: string) => Promise<boolean>;
};

const APP_WIDGET_BRIDGE = NativeModules.SynapseWidgetBridge as NativeWidgetBridge | undefined;

function getDoseSortMinutes(dose: MedicationDose) {
  if (dose.reminderTime?.includes(":")) {
    const [h, m] = dose.reminderTime.split(":").map((part) => parseInt(part, 10));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }
  const label = dose.timeOfDay.toLowerCase();
  if (label.includes("morning")) return 8 * 60;
  if (label.includes("afternoon")) return 13 * 60;
  if (label.includes("evening")) return 18 * 60;
  if (label.includes("night")) return 21 * 60;
  return 9 * 60;
}

function doseDetail(dose: MedicationDose) {
  if (dose.amount?.trim()) {
    return `${dose.amount.trim()} ${dose.unit?.trim() || ""} • ${dose.timeOfDay}`.trim();
  }
  return dose.timeOfDay;
}

function formatWidgetTime(value?: string) {
  if (!value?.includes(":")) return null;
  const [rawHour, rawMinute] = value.split(":").map((part) => parseInt(part, 10));
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return null;
  const hour = rawHour % 12 || 12;
  const suffix = rawHour >= 12 ? "PM" : "AM";
  return `${hour}:${String(rawMinute).padStart(2, "0")} ${suffix}`;
}

function fallbackDose(id: string, timeOfDay: string): MedicationDose {
  return {
    id,
    amount: "",
    unit: "",
    timeOfDay,
  };
}

function formatTakenTime(recordedAt?: string) {
  if (!recordedAt) return "Taken";
  const parsed = new Date(recordedAt);
  if (Number.isNaN(parsed.getTime())) return "Taken";
  return `Taken at ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)}`;
}

function formatRelativeLogTime(recordedAt?: string) {
  if (!recordedAt) return "just now";
  const diffMs = Date.now() - new Date(recordedAt).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function tomorrowAt(hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function buildMedicationWindow(sortedDoses: MedicationDose[], index: number, dueAt: Date) {
  const previousDose = index > 0 ? sortedDoses[index - 1] : sortedDoses[sortedDoses.length - 1];
  const [prevHour, prevMinute] = (previousDose.reminderTime || "09:00").split(":").map((part) => parseInt(part, 10));
  const previousDate = new Date(dueAt);
  previousDate.setHours(Number.isFinite(prevHour) ? prevHour : 9, Number.isFinite(prevMinute) ? prevMinute : 0, 0, 0);
  if (index === 0) previousDate.setDate(previousDate.getDate() - 1);
  return previousDate;
}

function getNextMedicationSnapshot(
  medications: Medication[],
  logs: { medicationId: string; doseIndex?: number; taken: boolean; recordedAt?: string }[],
) {
  const now = new Date();
  const pendingCandidates: Array<{
    dueAt: Date;
    windowStart: Date;
    med: Medication;
    dose: MedicationDose;
    doseIndex: number;
  }> = [];
  const prnTakenCandidates: Array<{
    med: Medication;
    detail: string;
    recordedAt: string;
  }> = [];
  let takenWinner: null | {
    dueAt: Date;
    windowStart: Date;
    med: Medication;
    dose: MedicationDose;
  } = null;

  for (const rawMed of medications) {
    const med = normalizeMedication(rawMed);
    if (!med.active) continue;

    if (med.medicationType === "prn") {
      const latestPrnLog = logs
        .filter((log) => log.medicationId === med.id && (log.doseIndex ?? -1) === -1 && log.taken && !!log.recordedAt)
        .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""))[0];

      if (latestPrnLog?.recordedAt) {
        prnTakenCandidates.push({
          med,
          detail: doseDetail(med.doses?.[0] ?? fallbackDose(`prn-${med.id}`, "As Needed")),
          recordedAt: latestPrnLog.recordedAt,
        });
      }
      continue;
    }

    const doses = (med.doses || [])
      .filter((dose) => !!dose.reminderTime)
      .sort((a, b) => getDoseSortMinutes(a) - getDoseSortMinutes(b));
    if (!doses.length) continue;

    for (let index = 0; index < doses.length; index++) {
      const dose = doses[index];
      const [hour, minute] = (dose.reminderTime || "09:00").split(":").map((part) => parseInt(part, 10));
      const safeHour = Number.isFinite(hour) ? hour : 9;
      const safeMinute = Number.isFinite(minute) ? minute : 0;
      const takenToday = logs.some((log) => log.medicationId === med.id && (log.doseIndex ?? 0) === index && log.taken);

      if (!takenToday) {
        const dueAt = new Date(now);
        dueAt.setHours(safeHour, safeMinute, 0, 0);
        const windowStart = buildMedicationWindow(doses, index, dueAt);
        pendingCandidates.push({ dueAt, windowStart, med, dose, doseIndex: index });
      } else {
        const dueAt = tomorrowAt(safeHour, safeMinute);
        const windowStart = buildMedicationWindow(doses, index, dueAt);
        if (!takenWinner || dueAt < takenWinner.dueAt) {
          takenWinner = { dueAt, windowStart, med, dose };
        }
      }
    }
  }

  const pendingWinner =
    pendingCandidates
      .filter((candidate) => candidate.dueAt.getTime() <= now.getTime())
      .sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime())[0] ??
    pendingCandidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0] ??
    null;

  if (pendingWinner) {
    const heroTimeText = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(pendingWinner.dueAt);
    return {
      name: pendingWinner.med.name,
      detail: doseDetail(pendingWinner.dose),
      dueAt: pendingWinner.dueAt.toISOString(),
      windowStart: pendingWinner.windowStart.toISOString(),
      dueText: "Due soon",
      isTaken: false,
      nextText: null,
      heroTimeText,
      statusLabel: "Next" as const,
      secondaryLine: "quiet reminder set",
      tone: "green" as const,
    };
  }

  if (takenWinner) {
    return {
      name: takenWinner.med.name,
      detail: doseDetail(takenWinner.dose),
      dueAt: takenWinner.dueAt.toISOString(),
      windowStart: takenWinner.windowStart.toISOString(),
      dueText: "Taken ✓",
      isTaken: true,
      nextText: "Next: tomorrow",
      heroTimeText: "Done",
      statusLabel: "Done" as const,
      secondaryLine: "next dose tomorrow",
      tone: "green" as const,
    };
  }

  const latestPrnWinner = prnTakenCandidates.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null;
  if (latestPrnWinner) {
    return {
      name: latestPrnWinner.med.name,
      detail: latestPrnWinner.detail,
      dueAt: null,
      windowStart: null,
      dueText: formatTakenTime(latestPrnWinner.recordedAt),
      isTaken: true,
      nextText: null,
      heroTimeText: "Done",
      statusLabel: "Done" as const,
      secondaryLine: formatTakenTime(latestPrnWinner.recordedAt),
      tone: "green" as const,
    };
  }

  return null;
}

function getPrnMedicationSnapshot(
  medications: Medication[],
  logs: { medicationId: string; doseIndex?: number; taken: boolean; recordedAt?: string }[],
) {
  const prnMeds = medications
    .map((med) => normalizeMedication(med))
    .filter((med) => med.active && med.medicationType === "prn");

  if (!prnMeds.length) return null;

  const primaryPrnMed = prnMeds.reduce((winner, med) => {
    const winnerLatest = logs
      .filter((log) => log.medicationId === winner.id && (log.doseIndex ?? -1) === -1 && log.taken && !!log.recordedAt)
      .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""))[0]?.recordedAt;
    const medLatest = logs
      .filter((log) => log.medicationId === med.id && (log.doseIndex ?? -1) === -1 && log.taken && !!log.recordedAt)
      .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""))[0]?.recordedAt;

    if (!winnerLatest && medLatest) return med;
    if (winnerLatest && medLatest && medLatest > winnerLatest) return med;
    return winner;
  });

  const todayLogs = logs
    .filter((log) => log.medicationId === primaryPrnMed.id && (log.doseIndex ?? -1) === -1 && log.taken)
    .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""));
  const latestLog = todayLogs[0];
  const logCountToday = todayLogs.length;

  let hoursSinceLastText = "—";
  let hoursSince = Infinity;
  if (latestLog?.recordedAt) {
    const diffMs = Date.now() - new Date(latestLog.recordedAt).getTime();
    if (!Number.isNaN(diffMs) && diffMs >= 0) {
      hoursSince = diffMs / 3600000;
      const wholeHours = Math.floor(hoursSince);
      if (wholeHours < 1) {
        const mins = Math.max(1, Math.floor(diffMs / 60000));
        hoursSinceLastText = `${mins}m`;
      } else {
        hoursSinceLastText = `${wholeHours}h`;
      }
    }
  }

  const recentlyLogged = hoursSince < 4;
  const watching = Number.isFinite(hoursSince) && hoursSince < 24;
  return {
    id: primaryPrnMed.id,
    name: primaryPrnMed.name,
    detail: doseDetail(primaryPrnMed.doses?.[0] ?? fallbackDose(`prn-${primaryPrnMed.id}`, "As Needed")),
    lastLoggedAt: latestLog?.recordedAt ?? null,
    statusText: latestLog?.recordedAt ? `Logged ${formatRelativeLogTime(latestLog.recordedAt)}` : "Not logged yet today",
    countText: logCountToday > 0
      ? `Logged ${logCountToday} time${logCountToday === 1 ? "" : "s"} today`
      : "Tap Log when you take it",
    hoursSinceLastText,
    windowText: !latestLog?.recordedAt
      ? "safe window clear"
      : recentlyLogged
        ? "logged recently"
        : "safe window clear",
    statusLabel: watching ? ("Watch" as const) : ("Clear" as const),
    tone: watching ? ("orange" as const) : ("green" as const),
  };
}

function parseAppointmentDateTime(appointment: Appointment) {
  const date = appointment.date?.trim();
  if (!date) return null;
  const rawTime = appointment.time?.trim() || "09:00";

  let hours = 9;
  let minutes = 0;

  const amPmMatch = rawTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    hours = parseInt(amPmMatch[1], 10) % 12;
    minutes = parseInt(amPmMatch[2], 10);
    if (amPmMatch[3].toUpperCase() === "PM") hours += 12;
  } else {
    const twentyFourHourMatch = rawTime.match(/^(\d{1,2}):(\d{2})$/);
    if (twentyFourHourMatch) {
      hours = parseInt(twentyFourHourMatch[1], 10);
      minutes = parseInt(twentyFourHourMatch[2], 10);
    }
  }

  const parsed = new Date(`${date}T00:00:00`);
  parsed.setHours(hours, minutes, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAppointmentWhen(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date) + " • " + new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function simplifyAppointmentDetail(detail?: string) {
  const raw = detail?.trim();
  if (!raw) return "Visit";
  let normalized = raw
    .replace(/physician/gi, "")
    .replace(/doctor/gi, "")
    .replace(/provider/gi, "")
    .replace(/clinic/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) normalized = raw;

  const words = normalized.split(" ");
  if (words.length > 2) {
    normalized = words.slice(0, 2).join(" ");
  }

  return normalized;
}

function normalizeLegacyFivePoint(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 5;
  return value <= 5 ? Math.max(0, Math.min(10, value * 2)) : Math.max(0, Math.min(10, value));
}

function normalizeOverallFeeling(todayLog: HealthLog | undefined) {
  if (!todayLog) return null;
  if (typeof todayLog.overallFeeling === "number" && !Number.isNaN(todayLog.overallFeeling)) {
    return Math.max(0, Math.min(10, todayLog.overallFeeling));
  }
  const values = [todayLog.energy, todayLog.mood, todayLog.sleep].filter(
    (value): value is number => typeof value === "number" && !Number.isNaN(value),
  );
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + normalizeLegacyFivePoint(value), 0) / values.length);
}

function buildWellnessDetailHighlights(todayLog: HealthLog | undefined) {
  if (!todayLog) return [] as string[];

  const symptomHighlights = [
    { label: "Shortness of breath", value: todayLog.shortnessOfBreath ?? 0 },
    { label: "Chest pain", value: todayLog.chestPain ?? 0 },
    { label: "Dizziness", value: todayLog.dizziness ?? 0 },
    { label: "Fatigue", value: todayLog.fatigue ?? 0 },
  ]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item) => `${item.label} ${item.value}`);

  const baselineHighlights = [
    { label: "Energy", value: normalizeLegacyFivePoint(todayLog.energy) },
    { label: "Mood", value: normalizeLegacyFivePoint(todayLog.mood) },
    { label: "Sleep", value: normalizeLegacyFivePoint(todayLog.sleep) },
  ].map((item) => `${item.label} ${item.value}`);

  return [...symptomHighlights, ...baselineHighlights].slice(0, 3);
}

function summarizeSymptomCount(count: number) {
  if (count <= 0) return "No symptoms logged today";
  if (count === 1) return "1 symptom logged today";
  return `${count} symptoms logged today`;
}

function pickTopSymptom(symptoms: Symptom[]) {
  return symptoms.slice().sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    return (b.recordedAt ?? "").localeCompare(a.recordedAt ?? "");
  })[0] ?? null;
}

function buildWellnessSnapshot(
  todayLog: HealthLog | undefined,
  symptoms: Symptom[],
  context: {
    hydration: WidgetSnapshot["hydration"];
    medicationDay: WidgetSnapshot["medicationDay"];
    pain: WidgetSnapshot["pain"];
  },
) {
  const topSymptom = pickTopSymptom(symptoms);
  const symptomCountToday = symptoms.length;
  const isFastingToday = !!todayLog?.fasting;
  const overallFeeling = normalizeOverallFeeling(todayLog);
  const detailHighlights = buildWellnessDetailHighlights(todayLog);
  const dosesLeft = Math.max(0, context.medicationDay.expected - context.medicationDay.taken);
  const hydrationBehind = context.hydration.statusLabel === "Low";

  // Large widget: care context first, then the one or two things worth doing next.
  const buildGrid = (moodDetail: string) => [
    { title: "symptoms active", detail: String(symptomCountToday) },
    { title: "med due soon", detail: String(dosesLeft) },
    { title: "hydration", detail: `${context.hydration.percentToday}%` },
    { title: "mood check", detail: moodDetail },
  ];

  const buildActionRows = (): WidgetActionRow[] => {
    const rows: WidgetActionRow[] = [];
    if (context.pain.hasPain && context.pain.statusLabel !== "Calm") {
      rows.push({
        tone: context.pain.tone,
        title: "Update symptoms",
        subtitle: context.pain.lastLoggedText.replace(/^./, (c) => c.toUpperCase()),
        trailing: "next",
      });
    } else if (symptomCountToday > 0 && topSymptom) {
      rows.push({ tone: "orange", title: "Review symptoms", subtitle: topSymptom.name, trailing: "next" });
    } else if (!todayLog) {
      rows.push({ tone: "blue", title: "Log check-in", subtitle: "Energy, mood, sleep", trailing: "open" });
    }
    if (hydrationBehind) {
      rows.push({
        tone: "blue",
        title: "Hydration check",
        subtitle: `${context.hydration.percentToday}% of today’s target so far`,
        trailing: "now",
      });
    } else if (dosesLeft > 0) {
      rows.push({
        tone: "blue",
        title: "Next dose",
        subtitle: `${dosesLeft} dose${dosesLeft === 1 ? "" : "s"} left today`,
        trailing: "soon",
      });
    }
    if (rows.length === 0) {
      rows.push({ tone: "green", title: "Nothing pending", subtitle: "Today’s log is up to date", trailing: "ok" });
    }
    return rows.slice(0, 2);
  };

  if (!todayLog) {
    return {
      hasTodayLog: false,
      energy: null,
      mood: null,
      sleep: null,
      overallFeeling: null,
      detailHighlights: [],
      summaryText: "Check in today",
      secondaryText: topSymptom
        ? `Latest symptom: ${topSymptom.name}`
        : isFastingToday
          ? "Fasting today"
          : "Log energy, mood, and sleep",
      symptomCountToday,
      topSymptomName: topSymptom?.name ?? null,
      isFastingToday,
      statusLabel: "Open",
      tone: "blue" as const,
      headline: "Ready when you are.",
      gridCells: buildGrid("—"),
      actionRows: buildActionRows(),
    };
  }

  const energy = normalizeLegacyFivePoint(todayLog.energy);
  const mood = normalizeLegacyFivePoint(todayLog.mood);
  const sleep = normalizeLegacyFivePoint(todayLog.sleep);
  return {
    hasTodayLog: true,
    energy,
    mood,
    sleep,
    overallFeeling,
    detailHighlights,
    summaryText: "Logged today",
    secondaryText: topSymptom
      ? `${summarizeSymptomCount(symptomCountToday)} • ${topSymptom.name}`
      : isFastingToday
        ? "Fasting today"
        : "No symptoms logged today",
    symptomCountToday,
    topSymptomName: topSymptom?.name ?? null,
    isFastingToday,
    statusLabel: "Logged",
    tone: "green" as const,
    headline: overallFeeling != null && overallFeeling >= 6 ? "Day looks steadier." : "Keep notes gentle today.",
    gridCells: buildGrid(mood != null ? `${mood}/10` : "—"),
    actionRows: buildActionRows(),
  };
}

function formatTimerText(isoString?: string | null) {
  if (!isoString) return "No timer";
  const target = new Date(isoString).getTime();
  if (Number.isNaN(target)) return "No timer";
  const remainingMs = target - Date.now();
  if (remainingMs <= 0) return "Due now";
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function buildHydrationSnapshot(todayHydration: HydrationEntry[]) {
  return hydrationStorage.getPreset().then((preset) => {
    const totalTodayMl = Math.round(todayHydration.reduce((sum, entry) => sum + convertHydrationToMl(entry.amount, entry.unit), 0));
    const sipMl = Math.max(1, Math.round(convertHydrationToMl(preset.amount, preset.unit)));
    // Soft UI target only — not a clinical hydration recommendation.
    const goalMl = SOFT_HYDRATION_GOAL_ML;
    const percentToday = Math.max(0, Math.min(100, Math.round((totalTodayMl / goalMl) * 100)));
    const progress = Math.max(0, Math.min(1, totalTodayMl / goalMl));
    const loggedCount = todayHydration.length;
    const targetSipsEstimate = Math.max(1, Math.ceil(goalMl / sipMl));
    let statusLabel: "Low" | "On track" | "Good" = "Low";
    let tone: WidgetTone = "orange";
    let secondaryLine = "nudge in 20m";
    if (percentToday >= 80) {
      statusLabel = "Good";
      tone = "green";
      secondaryLine = "nice pacing today";
    } else if (percentToday >= 40) {
      statusLabel = "On track";
      tone = "blue";
      secondaryLine = "keep sipping steadily";
    }
    return {
      presetLabel: preset.what,
      sipAmountText: formatHydrationAmount(preset.amount, preset.unit),
      totalTodayMl,
      totalTodayText: totalTodayMl > 0 ? `${totalTodayMl} mL today` : "Nothing logged yet",
      hasEntriesToday: loggedCount > 0,
      launchHint: "Take a Sip",
      percentToday,
      loggedCount,
      targetSipsEstimate,
      progress,
      statusLabel,
      tone,
      secondaryLine,
    };
  });
}

function buildSickModeSnapshot(
  sickMode: SickModeData,
  medications: Medication[],
  logs: { medicationId: string; doseIndex?: number; taken: boolean }[],
) {
  const activeStressMeds = medications
    .map((med) => normalizeMedication(med))
    .filter((med) => med.active && med.hasStressDose);
  const needsStressDose =
    sickMode.active &&
    activeStressMeds.length > 0 &&
    activeStressMeds.some((med) => !logs.some((log) => log.medicationId === med.id && log.taken));
  const latestTemperature = sickMode.temperatures.length > 0
    ? sickMode.temperatures[sickMode.temperatures.length - 1]?.value ?? null
    : null;
  const escalate = needsStressDose || (sickMode.active && !sickMode.recoveryMode);
  let statusLabel: "Active" | "Easing" | "Off" = "Off";
  let tone: WidgetTone = "blue";
  let heroAction = "Stay ready";
  if (sickMode.recoveryMode) {
    statusLabel = "Easing";
    tone = "green";
    heroAction = "Ease back";
  } else if (sickMode.active) {
    statusLabel = "Active";
    tone = escalate ? "red" : "orange";
    heroAction = needsStressDose ? "Check stress dose" : "Check symptoms";
  }
  return {
    active: sickMode.active,
    recoveryMode: sickMode.recoveryMode === true,
    latestTemperature,
    latestTemperatureText: latestTemperature != null ? `${latestTemperature}°F` : "No temp logged",
    statusText: !sickMode.active ? "tap to start" : sickMode.recoveryMode ? "easing back" : "sick mode on",
    statusLabel,
    heroAction,
    tone,
    needsStressDose,
    stressDoseText: activeStressMeds.length === 0
      ? "no stress-dose meds"
      : needsStressDose
        ? "stress dose may be needed"
        : "stress dose logged",
    checkInTimer: sickMode.active && !sickMode.recoveryMode ? formatTimerText(sickMode.checkInTimer) : null,
  };
}

function feelingTone(value: number | null | undefined): WidgetTone {
  if (value == null || Number.isNaN(value)) return "muted";
  if (value >= 7) return "green";
  if (value >= 5) return "blue";
  if (value >= 3) return "orange";
  return "purple";
}

function buildMentalHealthSnapshot(
  mentalHealthMode: MentalHealthModeData,
  todayLog: HealthLog | undefined,
  dailyPoints: { overallFeeling: number | null }[],
) {
  const energy = todayLog ? normalizeLegacyFivePoint(todayLog.energy) : null;
  const mood = todayLog ? normalizeLegacyFivePoint(todayLog.mood) : null;
  const trendTones: WidgetTone[] = dailyPoints
    .slice(-9)
    .map((point) => feelingTone(point.overallFeeling));
  while (trendTones.length < 3) {
    trendTones.push(feelingTone(mood ?? energy));
  }
  // Qualitative on purpose — the app does not calculate a stress score, so the
  // widget describes what was logged instead of inventing a number.
  const energyWord = energy == null ? null : energy <= 4 ? "low" : energy >= 7 ? "up" : "steady";
  const stressWord = mood == null ? null : mood <= 4 ? "up" : mood >= 7 ? "down" : "steady";
  const headline =
    energyWord && stressWord
      ? `Energy is ${energyWord}, stress is ${stressWord}.`
      : mentalHealthMode.active
        ? "Support day in progress."
        : "Space for a gentle check-in.";
  return {
    active: mentalHealthMode.active,
    statusText: mentalHealthMode.active ? "Support day on" : "Tap when you need support",
    statusLabel: todayLog ? ("Logged" as const) : mentalHealthMode.active ? ("Active" as const) : ("Open" as const),
    tone: "purple" as const,
    headline,
    supportText: mentalHealthMode.active
      ? `Next check-in ${formatTimerText(mentalHealthMode.hourlyCheckInTimer)}`
      : "Purple accents mark recent energy notes",
    nextCheckInText: mentalHealthMode.active ? formatTimerText(mentalHealthMode.hourlyCheckInTimer) : "No check-in yet",
    checkInTimer: mentalHealthMode.active ? mentalHealthMode.hourlyCheckInTimer ?? null : null,
    trendTones: trendTones.slice(-9),
  };
}

function buildCaregiverWidgetSnapshot(
  profile: CaregiverProfile | null,
  medications: Medication[],
  logs: { medicationId: string; doseIndex?: number; taken: boolean }[],
  todayLog: HealthLog | undefined,
) {
  const name = profile?.name?.trim() || "Managed person";
  const hasProfile = !!profile?.name?.trim();
  const age = typeof profile?.age === "number" && Number.isFinite(profile.age) ? profile.age : null;
  const relation = profile?.relation?.trim() || null;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const careRecipientMeds = medications
    .map((med) => normalizeMedication(med))
    .filter((med) => med.active && (med.entryOwner ?? "self") === "care_recipient" && (med.medicationType ?? "scheduled") !== "prn");

  const doseStatuses = careRecipientMeds.flatMap((medication) =>
    (medication.doses ?? []).map((dose, doseIndex) => {
      const scheduledMinutes = getDoseSortMinutes(dose);
      const taken = logs.some((log) => log.medicationId === medication.id && (log.doseIndex ?? 0) === doseIndex && log.taken);
      return { medication, dose, doseIndex, scheduledMinutes, taken };
    })
  );

  const missedDoses = doseStatuses
    .filter((item) => !item.taken && item.scheduledMinutes < currentMinutes)
    .sort((a, b) => a.scheduledMinutes - b.scheduledMinutes);
  const nextDose = doseStatuses
    .filter((item) => !item.taken && item.scheduledMinutes >= currentMinutes)
    .sort((a, b) => a.scheduledMinutes - b.scheduledMinutes)[0] ?? null;
  const hasTodayLog = !!todayLog;

  const doseTime = (item: NonNullable<typeof nextDose>) => formatWidgetTime(item.dose.reminderTime);

  const items: { kind: "missed" | "next" | "nolog" | "setup" | "good"; text: string; tone: WidgetTone }[] = [];
  if (missedDoses.length > 0) {
    items.push({
      kind: "missed",
      text: `${missedDoses.length} missed dose${missedDoses.length === 1 ? "" : "s"}`,
      tone: "red",
    });
  }
  if (nextDose) {
    items.push({
      kind: "next",
      text: `Next dose: ${doseTime(nextDose) ?? "soon"}`,
      tone: "muted",
    });
  }
  if (!hasTodayLog) {
    items.push({ kind: "nolog", text: "No logs today", tone: "yellow" });
  }

  if (!hasProfile) {
    return {
      hasProfile,
      name,
      age,
      relation,
      status: "attention" as const,
      statusText: "Set up profile",
      statusLabel: "Setup" as const,
      tone: "yellow" as const,
      primaryText: "Profile needed",
      secondaryText: "Open Synapse",
      actionText: "Open Synapse",
      headline: "Add a managed person",
      items: [{ kind: "setup" as const, text: "Managed person missing", tone: "yellow" as const }],
      missedCount: 0,
    };
  }

  if (missedDoses.length > 0) {
    return {
      hasProfile,
      name,
      age,
      relation,
      status: "urgent" as const,
      statusText: "Urgent",
      statusLabel: "Share" as const,
      tone: "red" as const,
      primaryText: `${missedDoses.length} missed dose${missedDoses.length === 1 ? "" : "s"}`,
      secondaryText: "Tap to log",
      actionText: "Tap to log",
      headline: "Send today summary?",
      items: items.slice(0, 3),
      missedCount: missedDoses.length,
    };
  }

  if (nextDose || !hasTodayLog) {
    return {
      hasProfile,
      name,
      age,
      relation,
      status: "attention" as const,
      statusText: "Needs attention",
      statusLabel: "Check" as const,
      tone: "yellow" as const,
      primaryText: "Needs attention",
      secondaryText: !hasTodayLog ? "No logs today" : `Next: ${doseTime(nextDose) ?? "soon"}`,
      actionText: "Check in",
      headline: "A gentle check-in helps",
      items: items.slice(0, 3),
      missedCount: 0,
    };
  }

  return {
    hasProfile,
    name,
    age,
    relation,
    status: "all_good" as const,
    statusText: "All good",
    statusLabel: "OK" as const,
    tone: "green" as const,
    primaryText: "All good",
    secondaryText: nextDose ? `Next: ${doseTime(nextDose) ?? "soon"}` : "All caught up",
    actionText: null,
    headline: "Today looks covered",
    items: [
      { kind: "good" as const, text: nextDose ? `Next: ${doseTime(nextDose) ?? "soon"}` : "All caught up", tone: "green" as const },
    ],
    missedCount: 0,
  };
}

async function getNextAppointmentSnapshot(appointments: Appointment[]) {
  const now = new Date();
  const graceWindowMs = 1000 * 60 * 60 * 2;
  const upcoming = appointments
    .filter((appointment) => appointment.status === undefined || appointment.status === "rescheduled")
    .map((appointment) => ({ appointment, startsAt: parseAppointmentDateTime(appointment) }))
    .filter(
      (item): item is { appointment: Appointment; startsAt: Date } =>
        !!item.startsAt && item.startsAt.getTime() >= now.getTime() - graceWindowMs
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  if (!upcoming.length) return null;
  const { appointment, startsAt } = upcoming[0];
  const travelText = await getAppointmentTravelEstimate(appointment, null, { allowPermissionPrompt: false });
  const notes = appointment.notes?.trim() || appointment.arrivalInstructions?.trim() || null;
  const prepHint = travelText
    ? "Leave with time to spare"
    : notes
      ? "Review notes before you go"
      : "Open Synapse to prep";
  const clockTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(startsAt);
  const rows: WidgetActionRow[] = [
    {
      tone: "blue",
      title: appointment.doctorName || "Upcoming visit",
      subtitle: formatAppointmentWhen(startsAt),
      trailing: clockTime,
    },
    {
      tone: notes ? "green" : "orange",
      title: "Report packet",
      subtitle: notes ? "Notes ready to review" : "Build packet in Synapse",
      trailing: notes ? "ok" : "prep",
    },
  ];
  return {
    doctorName: appointment.doctorName || "Appointment",
    detail: simplifyAppointmentDetail(appointment.specialty || appointment.location || "Upcoming visit"),
    startsAt: startsAt.toISOString(),
    whenText: formatAppointmentWhen(startsAt),
    travelText,
    location: appointment.location?.trim() || null,
    notes,
    prepHint,
    statusLabel: "Ready" as const,
    tone: "green" as const,
    headline: "Prep looks ready.",
    supportText: travelText || prepHint,
    rows,
  };
}

function buildRecoverySnapshot(
  sickMode: SickModeData,
  profile: { recoveryTrackingEnabled?: boolean; recoveryFocus?: string },
  reportStatus: string,
  hydration: WidgetSnapshot["hydration"],
  prn: WidgetSnapshot["prnMedication"],
) {
  const sessionRecovery = sickMode.active && sickMode.recoveryMode === true;
  const tracking = profile.recoveryTrackingEnabled === true;
  const active = sessionRecovery || tracking;
  const focus = profile.recoveryFocus?.trim() || null;
  const calmer = reportStatus === "Improving" || reportStatus === "Stable" || !active;
  const statusLabel = reportStatus === "Worsening" ? "Watch" : reportStatus === "Improving" ? "Rising" : "Stable";
  const tone: WidgetTone = reportStatus === "Worsening" ? "orange" : "green";
  const headline = calmer
    ? "You are trending calmer."
    : "Take the day a little slower.";
  const hydrationBit =
    hydration.statusLabel === "Low"
      ? "Hydration is low"
      : hydration.statusLabel === "Good"
        ? "Hydration looks good"
        : "Hydration on track";
  const prnBit = prn
    ? prn.statusLabel === "Watch"
      ? "PRN logged recently"
      : "PRN window clear"
    : "No PRN logged";
  const supportText = `${hydrationBit} · ${prnBit}`;
  const progress =
    reportStatus === "Improving" ? 0.78 : reportStatus === "Worsening" ? 0.35 : 0.62;

  if (!active) {
    return {
      active: false,
      title: "Recovery Today",
      statusText: "No recovery focus",
      statusLabel,
      tone,
      focusText: null,
      nextAction: "Open recovery when you need it",
      headline,
      supportText,
      progress,
    };
  }
  return {
    active: true,
    title: "Recovery Today",
    statusText: sessionRecovery ? "Easing back" : "Tracking recovery",
    statusLabel,
    tone,
    focusText: focus,
    nextAction: sessionRecovery ? "Keep resting · check temp" : "Review how today feels",
    headline,
    supportText: focus ? `${supportText} · Focus: ${focus}` : supportText,
    progress,
  };
}

function buildPainSnapshot(symptoms: Symptom[], todayLog: HealthLog | undefined) {
  const topSymptom = pickTopSymptom(symptoms);
  const chestPain = typeof todayLog?.chestPain === "number" ? todayLog.chestPain : 0;
  const fromSymptom = topSymptom && /pain|ache|migraine|headache/i.test(topSymptom.name)
    ? topSymptom
    : null;
  const severity = fromSymptom?.severity ?? (chestPain > 0 ? chestPain : null);
  const name = fromSymptom?.name ?? (chestPain > 0 ? "Chest discomfort" : "Pain");
  const lastLoggedText = fromSymptom?.recordedAt
    ? `last log ${formatRelativeLogTime(fromSymptom.recordedAt)}`
    : severity != null && severity > 0
      ? "noted in today’s log"
      : "no recent pain log";

  if (severity == null || severity <= 0) {
    return {
      hasPain: false,
      name: "Pain",
      severity: null,
      statusText: "Nothing flagged",
      statusLabel: "Calm" as const,
      tone: "green" as const,
      nextAction: "Log if something hurts",
      lastLoggedText,
      progress: 0,
    };
  }

  const statusLabel = severity >= 7 ? ("Up" as const) : severity >= 4 ? ("Watch" as const) : ("Calm" as const);
  const tone: WidgetTone = severity >= 7 ? "red" : severity >= 4 ? "orange" : "green";
  return {
    hasPain: true,
    name,
    severity,
    statusText: severity >= 7 ? "Needs attention" : severity >= 4 ? "Watch today" : "Mild · noted",
    statusLabel,
    tone,
    nextAction: severity >= 7 ? "Open Symptoms to review" : "Tap to update",
    lastLoggedText,
    progress: Math.max(0, Math.min(1, severity / 10)),
  };
}

/**
 * Weekday the first medication is estimated to run out, from logged supply only.
 * Meds without inventory data are skipped rather than guessed at. Non-daily
 * schedules are treated as daily, so the estimate errs early.
 */
function buildRefillCheckText(medications: Medication[], today: string) {
  let soonestDays: number | null = null;
  for (const raw of medications) {
    const med = normalizeMedication(raw);
    if (!med.active) continue;
    const supply = med.currentSupplyAmount;
    if (typeof supply !== "number" || supply <= 0) continue;
    const perDose = typeof med.supplyPerDose === "number" && med.supplyPerDose > 0 ? med.supplyPerDose : 1;
    const dosesPerDay = Math.max(1, (med.doses ?? []).length);
    const days = Math.floor(supply / (perDose * dosesPerDay));
    if (soonestDays == null || days < soonestDays) soonestDays = days;
  }
  if (soonestDays == null) return "—";
  if (soonestDays > 14) return "ok";
  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() + soonestDays);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function buildMedicationDaySnapshot(
  medications: Medication[],
  logs: { medicationId: string; doseIndex?: number; taken: boolean }[],
  today: string,
  prnMedication: WidgetSnapshot["prnMedication"],
) {
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const doses: { name: string; detail: string; timeText: string; taken: boolean; missed: boolean }[] = [];
  for (const raw of medications) {
    const med = normalizeMedication(raw);
    if (!med.active || (med.medicationType ?? "scheduled") === "prn") continue;
    if (!isMedicationScheduledOnDate(med, today)) continue;
    (med.doses ?? []).forEach((dose, doseIndex) => {
      const taken = logs.some((log) => log.medicationId === med.id && (log.doseIndex ?? 0) === doseIndex && log.taken);
      doses.push({
        name: med.name || "Medication",
        detail: doseDetail(dose),
        timeText: formatWidgetTime(dose.reminderTime) || dose.timeOfDay,
        taken,
        missed: !taken && getDoseSortMinutes(dose) < nowMinutes,
      });
    });
  }
  doses.sort((a, b) => a.timeText.localeCompare(b.timeText));
  const expected = doses.length;
  const taken = doses.filter((d) => d.taken).length;
  const remaining = Math.max(0, expected - taken);
  const nextOpen = doses.find((d) => !d.taken);
  const statusLabel = expected === 0 ? "None" : taken >= expected ? "Done" : "Active";
  const tone: WidgetTone = taken >= expected && expected > 0 ? "green" : remaining > 0 ? "orange" : "blue";
  const gridCells: WidgetGridCell[] = [
    { title: "next med", detail: nextOpen?.timeText || "—" },
    { title: "PRN window", detail: prnMedication?.hoursSinceLastText || "—" },
    { title: "missed today", detail: String(doses.filter((d) => d.missed).length) },
    { title: "refill check", detail: buildRefillCheckText(medications, today) },
  ];
  const actionRows: WidgetActionRow[] = nextOpen
    ? [
        {
          tone: nextOpen.missed ? "orange" : "blue",
          title: nextOpen.name,
          subtitle: nextOpen.missed ? "Past its usual time" : nextOpen.detail,
          trailing: nextOpen.timeText,
        },
      ]
    : [
        {
          tone: "green",
          title: expected === 0 ? "No schedule" : "All doses logged",
          subtitle: expected === 0 ? "Add meds in Synapse" : "Medication day",
          trailing: "ok",
        },
      ];
  // Cautious, non-prescriptive: says the rescue med exists, never tells anyone to take it.
  if (prnMedication) {
    actionRows.push({
      tone: "orange",
      title: "PRN safety note",
      subtitle: "Available if symptoms escalate",
      trailing: prnMedication.windowText,
    });
  } else if (doses.length > 1) {
    const second = doses.find((d) => d !== nextOpen && !d.taken) || doses[doses.length - 1];
    if (second && second !== nextOpen) {
      actionRows.push({
        tone: second.taken ? "green" : "blue",
        title: second.name,
        subtitle: second.detail,
        trailing: second.taken ? "done" : second.timeText,
      });
    }
  }
  return {
    taken,
    expected,
    summaryText: expected === 0 ? "No scheduled doses today" : `${taken} of ${expected} taken`,
    nextAction: expected === 0 ? "Add meds in Synapse" : taken >= expected ? "All caught up" : "Log the next dose",
    doses: doses.slice(0, 8),
    statusLabel,
    tone,
    headline: expected === 0 ? "Nothing scheduled." : taken >= expected ? "Medication day complete." : "Keep today’s doses moving.",
    gridCells,
    actionRows: actionRows.slice(0, 2),
  };
}

function buildLabsSnapshot(labs: LabWork[]) {
  const pending = labs
    .filter((lab) => (lab.status ?? "completed") === "pending")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const recent = labs
    .filter((lab) => (lab.status ?? "completed") !== "pending")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const flagged = recent.find((lab) =>
    /crp|c-reactive|elevated|high/i.test(`${lab.testName || ""} ${lab.notes || ""}`),
  );

  if (!labs.length) {
    return {
      hasItems: false,
      title: "Labs",
      statusText: "No labs yet",
      statusLabel: "Empty" as const,
      tone: "blue" as const,
      nextAction: "Add or scan a result",
      headline: "Nothing on file yet.",
      supportText: "Add or scan a result when ready.",
      progress: 0.15,
      items: [] as { name: string; detail: string; pending: boolean }[],
    };
  }

  if (pending.length) {
    return {
      hasItems: true,
      title: "Labs",
      statusText: `${pending.length} pending review`,
      statusLabel: "Review" as const,
      tone: "orange" as const,
      nextAction: "Review pending labs",
      headline: "Results need a look.",
      supportText: "Not an emergency — open when you can.",
      progress: 0.55,
      items: pending.slice(0, 3).map((lab) => ({
        name: lab.testName || "Lab",
        detail: lab.date || "Date TBD",
        pending: true,
      })),
    };
  }

  const top = flagged || recent[0];
  const movedUp = !!flagged;
  return {
    hasItems: true,
    title: "Labs",
    statusText: movedUp ? "Change noted" : "Latest on file",
    statusLabel: movedUp ? ("Review" as const) : ("Steady" as const),
    tone: movedUp ? ("orange" as const) : ("green" as const),
    nextAction: "Open reports",
    headline: movedUp
      ? `${top?.testName || "Marker"} moved up.`
      : "Latest labs look filed.",
    supportText: movedUp
      ? "Not an emergency — review with your clinician."
      : "Open Synapse for the full packet.",
    progress: movedUp ? 0.6 : 0.4,
    items: top
      ? [{ name: top.testName || "Lab", detail: top.date || "Recent", pending: false }]
      : [],
  };
}

function buildReport14DaySnapshot(input: {
  logs: HealthLog[];
  vitals: Awaited<ReturnType<typeof vitalStorage.getAll>>;
  symptoms: Symptom[];
  medications: Medication[];
  medicationLogs: Awaited<ReturnType<typeof medicationLogStorage.getAll>>;
  labs: LabWork[];
}) {
  const summary = buildRecoveryInsights({
    logs: input.logs,
    vitals: input.vitals,
    symptoms: input.symptoms,
    medications: input.medications,
    medicationLogs: input.medicationLogs,
    rangeDays: 14,
  });
  const tone: WidgetTone =
    summary.statusLabel === "Worsening"
      ? "orange"
      : summary.statusLabel === "Improving"
        ? "green"
        : "blue";
  const adherence =
    summary.todayMedicationExpected > 0
      ? `Meds today ${summary.todayMedicationTaken}/${summary.todayMedicationExpected}`
      : "No med schedule today";
  const insights = (summary.insights || []).slice(0, 2);
  // Counts of what was logged over the window — no scores the app does not calculate.
  const rangeStart = getDaysAgo(13);
  const symptomSpikes = summary.dailyPoints.filter(
    (point) => point.symptomSeverity != null && point.symptomSeverity >= 7,
  ).length;
  const adherenceValues = summary.dailyPoints
    .map((point) => point.medicationAdherence)
    .filter((value): value is number => value != null);
  const adherencePercentText =
    adherenceValues.length > 0
      ? `${Math.round(adherenceValues.reduce((sum, value) => sum + value, 0) / adherenceValues.length)}%`
      : "—";
  const poorSleepNights = input.logs.filter(
    (log) =>
      log.date >= rangeStart
      && typeof log.sleep === "number"
      && !Number.isNaN(log.sleep)
      && normalizeLegacyFivePoint(log.sleep) < 6,
  ).length;
  const labChanges = input.labs.filter((lab) => (lab.date || "") >= rangeStart).length;
  const gridCells: WidgetGridCell[] = [
    { title: "symptom spikes", detail: String(symptomSpikes) },
    { title: "med adherence", detail: adherencePercentText },
    { title: "poor sleep nights", detail: String(poorSleepNights) },
    { title: "lab changes", detail: String(labChanges) },
  ];
  const actionRows: WidgetActionRow[] = [];
  if (insights[0]) {
    actionRows.push({
      tone: "orange",
      title: insights[0],
      subtitle: "Correlation, not diagnosis",
      trailing: "note",
    });
  }
  actionRows.push({
    tone: "blue",
    title: "Export summary packet",
    subtitle: "Ready for your next visit",
    trailing: "prep",
  });
  return {
    statusLabel: summary.statusLabel,
    summaryText: summary.summaryText || "Pattern over the last 14 days",
    tone,
    adherenceText: adherence,
    nextAction: "Open 14-day report",
    insights,
    headline:
      summary.statusLabel === "Improving"
        ? "Two-week pattern looks calmer."
        : summary.statusLabel === "Worsening"
          ? "Two-week pattern looks noisier."
          : "Two-week pattern looks steady.",
    gridCells,
    actionRows: actionRows.slice(0, 2),
    dailyPoints: summary.dailyPoints,
  };
}

function buildSleepSnapshot(todayLog: HealthLog | undefined): WidgetSnapshot["sleep"] {
  if (!todayLog || typeof todayLog.sleep !== "number" || Number.isNaN(todayLog.sleep)) {
    return {
      hasData: false,
      score: null,
      heroText: "—",
      statusLabel: "OK",
      tone: "green",
      primaryLine: "no sleep note yet",
      secondaryLine: "log tonight when you can",
    };
  }
  const score = normalizeLegacyFivePoint(todayLog.sleep);
  const short = score < 6;
  return {
    hasData: true,
    score,
    heroText: `${score}/10`,
    statusLabel: short ? "Short" : "OK",
    tone: short ? "orange" : "green",
    primaryLine: short ? "flare risk factor" : "rest looks steadier",
    secondaryLine: short ? "pace the day" : "keep a gentle rhythm",
  };
}

function buildFlareForecastSnapshot(input: {
  pain: WidgetSnapshot["pain"];
  hydration: WidgetSnapshot["hydration"];
  sleep: WidgetSnapshot["sleep"];
  dailyPoints: { overallFeeling: number | null; symptomSeverity: number | null }[];
}): WidgetSnapshot["flareForecast"] {
  const factors: string[] = [];
  if (input.pain.hasPain && input.pain.statusLabel !== "Calm") {
    factors.push(input.pain.statusLabel === "Up" ? "pain up" : "pain watch");
  }
  if (input.hydration.statusLabel === "Low") factors.push("hydration low");
  if (input.sleep.statusLabel === "Short") factors.push("sleep short");

  const watch = factors.length > 0;
  let trendTones: WidgetTone[] = input.dailyPoints.slice(-9).map((point) => {
    if (point.symptomSeverity != null && point.symptomSeverity >= 6) return "orange";
    if (point.overallFeeling != null) return feelingTone(point.overallFeeling);
    return "muted";
  });
  if (trendTones.length === 0) {
    trendTones = [
      input.pain.tone,
      input.hydration.tone,
      input.sleep.tone,
    ];
  }

  return {
    statusLabel: watch ? "Watch" : "Calm",
    tone: watch ? "orange" : "green",
    headline: watch ? "Pattern looks a little noisy." : "Pattern looks quieter today.",
    supportText: watch
      ? `${factors.join(", ").replace(/^./, (c) => c.toUpperCase())}.`
      : "No strong flare cues in today’s notes.",
    trendTones: trendTones.slice(-9),
  };
}

export async function syncWidgetSnapshot() {
  if (Platform.OS !== "ios" || !APP_WIDGET_BRIDGE?.saveSnapshot) return;

  const today = getToday();
  const [
    medications,
    appointments,
    profile,
    caregiverProfile,
    todayLog,
    caregiverTodayLog,
    todaySymptoms,
    todayHydration,
    sickMode,
    mentalHealthMode,
    allLabs,
    allLogs,
    allVitals,
    allSymptoms,
    allMedLogs,
  ] = await Promise.all([
    medicationStorage.getAll(),
    appointmentStorage.getAll(),
    healthProfileStorage.get(),
    caregiverProfileStorage.get(),
    healthLogStorage.getByDate(today),
    healthLogStorage.getByDate(today, "care_recipient"),
    symptomStorage.getByDate(today),
    hydrationStorage.getByDateRange(today, today),
    sickModeStorage.get(),
    mentalHealthModeStorage.get(),
    labWorkStorage.getAll(),
    healthLogStorage.getAll(),
    vitalStorage.getAll(),
    symptomStorage.getAll(),
    medicationLogStorage.getAll(),
  ]);
  const logs = await medicationLogStorage.getByDate(today);
  const hydration = await buildHydrationSnapshot(todayHydration);
  const reportBuilt = buildReport14DaySnapshot({
    logs: allLogs,
    vitals: allVitals,
    symptoms: allSymptoms,
    medications,
    medicationLogs: allMedLogs,
    labs: allLabs,
  });
  const { dailyPoints, ...report14Day } = reportBuilt;
  const pain = buildPainSnapshot(todaySymptoms, todayLog);
  const sleep = buildSleepSnapshot(todayLog);
  const prnMedication = getPrnMedicationSnapshot(medications, logs);
  const medicationDay = buildMedicationDaySnapshot(medications, logs, today, prnMedication);
  const recovery = buildRecoverySnapshot(
    sickMode,
    profile,
    report14Day.statusLabel,
    hydration,
    prnMedication,
  );
  const flareForecast = buildFlareForecastSnapshot({
    pain,
    hydration,
    sleep,
    dailyPoints,
  });

  const snapshot: WidgetSnapshot = {
    appearance: profile.widgetAppearance ?? "system",
    medication: getNextMedicationSnapshot(medications, logs),
    appointment: await getNextAppointmentSnapshot(appointments),
    prnMedication,
    wellness: buildWellnessSnapshot(todayLog, todaySymptoms, { hydration, medicationDay, pain }),
    hydration,
    sleep,
    flareForecast,
    sickMode: buildSickModeSnapshot(sickMode, medications, logs),
    mentalHealth: buildMentalHealthSnapshot(mentalHealthMode, todayLog, dailyPoints),
    caregiver: buildCaregiverWidgetSnapshot(caregiverProfile, medications, logs, caregiverTodayLog),
    recovery,
    pain,
    medicationDay,
    labs: buildLabsSnapshot(allLabs),
    report14Day,
    updatedAt: new Date().toISOString(),
  };

  await APP_WIDGET_BRIDGE.saveSnapshot(JSON.stringify(snapshot));
}
