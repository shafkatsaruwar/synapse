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
import { getToday } from "@/lib/date-utils";
import { getAppointmentTravelEstimate } from "@/lib/appointment-travel";
import { buildRecoveryInsights } from "@/lib/recovery-insights";
import { isMedicationScheduledOnDate } from "@/lib/medication-schedule";

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
  };
  recovery: {
    active: boolean;
    title: string;
    statusText: string;
    tone: "green" | "blue" | "orange";
    focusText: string | null;
    nextAction: string;
  };
  pain: {
    hasPain: boolean;
    name: string;
    severity: number | null;
    statusText: string;
    tone: "green" | "orange" | "red";
    nextAction: string;
  };
  medicationDay: {
    taken: number;
    expected: number;
    summaryText: string;
    nextAction: string;
    doses: { name: string; detail: string; timeText: string; taken: boolean }[];
  };
  labs: {
    hasItems: boolean;
    title: string;
    statusText: string;
    tone: "blue" | "orange" | "green";
    nextAction: string;
    items: { name: string; detail: string; pending: boolean }[];
  };
  report14Day: {
    statusLabel: string;
    summaryText: string;
    tone: "green" | "blue" | "orange";
    adherenceText: string;
    nextAction: string;
    insights: string[];
  };
  prnMedication: null | {
    id: string;
    name: string;
    detail: string;
    lastLoggedAt: string | null;
    statusText: string;
    countText: string;
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
  };
  hydration: {
    presetLabel: string;
    sipAmountText: string;
    totalTodayMl: number;
    totalTodayText: string;
    hasEntriesToday: boolean;
    launchHint: string;
  };
  sickMode: {
    active: boolean;
    recoveryMode: boolean;
    latestTemperature: number | null;
    latestTemperatureText: string;
    statusText: string;
    needsStressDose: boolean;
    stressDoseText: string;
    checkInTimer: string | null;
  };
  mentalHealth: {
    active: boolean;
    statusText: string;
    nextCheckInText: string;
    checkInTimer: string | null;
  };
  caregiver: {
    hasProfile: boolean;
    name: string;
    age: number | null;
    relation: string | null;
    status: "all_good" | "attention" | "urgent";
    statusText: string;
    tone: "green" | "yellow" | "red";
    primaryText: string;
    secondaryText: string | null;
    actionText: string | null;
    items: { kind: "missed" | "next" | "nolog" | "setup" | "good"; text: string; tone: "red" | "yellow" | "green" | "muted" }[];
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
    return {
      name: pendingWinner.med.name,
      detail: doseDetail(pendingWinner.dose),
      dueAt: pendingWinner.dueAt.toISOString(),
      windowStart: pendingWinner.windowStart.toISOString(),
      dueText: "Due soon",
      isTaken: false,
      nextText: null,
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

  return {
    id: primaryPrnMed.id,
    name: primaryPrnMed.name,
    detail: doseDetail(primaryPrnMed.doses?.[0] ?? fallbackDose(`prn-${primaryPrnMed.id}`, "As Needed")),
    lastLoggedAt: latestLog?.recordedAt ?? null,
    statusText: latestLog?.recordedAt ? `Logged ${formatRelativeLogTime(latestLog.recordedAt)}` : "Not logged yet today",
    countText: logCountToday > 0
      ? `Logged ${logCountToday} time${logCountToday === 1 ? "" : "s"} today`
      : "Tap Log when you take it",
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

function buildWellnessSnapshot(todayLog: HealthLog | undefined, symptoms: Symptom[]) {
  const topSymptom = pickTopSymptom(symptoms);
  const symptomCountToday = symptoms.length;
  const isFastingToday = !!todayLog?.fasting;
  const overallFeeling = normalizeOverallFeeling(todayLog);
  const detailHighlights = buildWellnessDetailHighlights(todayLog);

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
    };
  }

  return {
    hasTodayLog: true,
    energy: normalizeLegacyFivePoint(todayLog.energy),
    mood: normalizeLegacyFivePoint(todayLog.mood),
    sleep: normalizeLegacyFivePoint(todayLog.sleep),
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
    return {
      presetLabel: preset.what,
      sipAmountText: formatHydrationAmount(preset.amount, preset.unit),
      totalTodayMl,
      totalTodayText: totalTodayMl > 0 ? `${totalTodayMl} mL today` : "Nothing logged yet",
      hasEntriesToday: todayHydration.length > 0,
      launchHint: "Take a Sip",
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
  return {
    active: sickMode.active,
    recoveryMode: sickMode.recoveryMode === true,
    latestTemperature,
    latestTemperatureText: latestTemperature != null ? `${latestTemperature}°F` : "No temp logged",
    statusText: !sickMode.active ? "Tap to start sick mode" : sickMode.recoveryMode ? "Recovery mode" : "Sick mode active",
    needsStressDose,
    stressDoseText: activeStressMeds.length === 0
      ? "No stress-dose meds"
      : needsStressDose
        ? "Stress dose may be needed"
        : "Stress dose logged",
    checkInTimer: sickMode.active && !sickMode.recoveryMode ? formatTimerText(sickMode.checkInTimer) : null,
  };
}

function buildMentalHealthSnapshot(mentalHealthMode: MentalHealthModeData) {
  return {
    active: mentalHealthMode.active,
    statusText: mentalHealthMode.active ? "Mental health day active" : "Tap to start mental health day",
    nextCheckInText: mentalHealthMode.active ? formatTimerText(mentalHealthMode.hourlyCheckInTimer) : "No check-in scheduled",
    checkInTimer: mentalHealthMode.active ? mentalHealthMode.hourlyCheckInTimer ?? null : null,
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

  const items: { kind: "missed" | "next" | "nolog" | "setup" | "good"; text: string; tone: "red" | "yellow" | "green" | "muted" }[] = [];
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
      tone: "yellow" as const,
      primaryText: "Profile needed",
      secondaryText: "Open Synapse",
      actionText: "Open Synapse",
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
      tone: "red" as const,
      primaryText: `${missedDoses.length} missed dose${missedDoses.length === 1 ? "" : "s"}`,
      secondaryText: "Tap to log",
      actionText: "Tap to log",
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
      tone: "yellow" as const,
      primaryText: "Needs attention",
      secondaryText: !hasTodayLog ? "No logs today" : `Next: ${doseTime(nextDose) ?? "soon"}`,
      actionText: "Check in",
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
    tone: "green" as const,
    primaryText: "All good",
    secondaryText: nextDose ? `Next: ${doseTime(nextDose) ?? "soon"}` : "All caught up",
    actionText: null,
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
  return {
    doctorName: appointment.doctorName || "Appointment",
    detail: simplifyAppointmentDetail(appointment.specialty || appointment.location || "Upcoming visit"),
    startsAt: startsAt.toISOString(),
    whenText: formatAppointmentWhen(startsAt),
    travelText,
    location: appointment.location?.trim() || null,
    notes,
    prepHint,
  };
}

function buildRecoverySnapshot(
  sickMode: SickModeData,
  profile: { recoveryTrackingEnabled?: boolean; recoveryFocus?: string },
) {
  const sessionRecovery = sickMode.active && sickMode.recoveryMode === true;
  const tracking = profile.recoveryTrackingEnabled === true;
  const active = sessionRecovery || tracking;
  const focus = profile.recoveryFocus?.trim() || null;
  if (!active) {
    return {
      active: false,
      title: "Recovery Today",
      statusText: "No recovery focus",
      tone: "blue" as const,
      focusText: null,
      nextAction: "Open recovery when you need it",
    };
  }
  return {
    active: true,
    title: "Recovery Today",
    statusText: sessionRecovery ? "Easing back" : "Tracking recovery",
    tone: "green" as const,
    focusText: focus,
    nextAction: sessionRecovery ? "Keep resting · check temp" : "Review how today feels",
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

  if (severity == null || severity <= 0) {
    return {
      hasPain: false,
      name: "Pain",
      severity: null,
      statusText: "Nothing flagged",
      tone: "green" as const,
      nextAction: "Log if something hurts",
    };
  }

  const tone = severity >= 7 ? ("red" as const) : severity >= 4 ? ("orange" as const) : ("green" as const);
  return {
    hasPain: true,
    name,
    severity,
    statusText: severity >= 7 ? "Needs attention" : severity >= 4 ? "Watch today" : "Mild · noted",
    tone,
    nextAction: severity >= 7 ? "Open Symptoms to review" : "Tap to update",
  };
}

function buildMedicationDaySnapshot(
  medications: Medication[],
  logs: { medicationId: string; doseIndex?: number; taken: boolean }[],
  today: string,
) {
  const doses: { name: string; detail: string; timeText: string; taken: boolean }[] = [];
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
      });
    });
  }
  doses.sort((a, b) => a.timeText.localeCompare(b.timeText));
  const expected = doses.length;
  const taken = doses.filter((d) => d.taken).length;
  return {
    taken,
    expected,
    summaryText: expected === 0 ? "No scheduled doses today" : `${taken} of ${expected} taken`,
    nextAction: expected === 0 ? "Add meds in Synapse" : taken >= expected ? "All caught up" : "Log the next dose",
    doses: doses.slice(0, 8),
  };
}

function buildLabsSnapshot(labs: LabWork[]) {
  const pending = labs
    .filter((lab) => (lab.status ?? "completed") === "pending")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const recent = labs
    .filter((lab) => (lab.status ?? "completed") !== "pending")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (!labs.length) {
    return {
      hasItems: false,
      title: "Labs",
      statusText: "No labs yet",
      tone: "blue" as const,
      nextAction: "Add or scan a result",
      items: [] as { name: string; detail: string; pending: boolean }[],
    };
  }

  if (pending.length) {
    return {
      hasItems: true,
      title: "Labs",
      statusText: `${pending.length} pending review`,
      tone: "orange" as const,
      nextAction: "Review pending labs",
      items: pending.slice(0, 3).map((lab) => ({
        name: lab.testName || "Lab",
        detail: lab.date || "Date TBD",
        pending: true,
      })),
    };
  }

  const top = recent[0];
  return {
    hasItems: true,
    title: "Labs",
    statusText: "Latest on file",
    tone: "green" as const,
    nextAction: "Open reports",
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
}) {
  const summary = buildRecoveryInsights({
    logs: input.logs,
    vitals: input.vitals,
    symptoms: input.symptoms,
    medications: input.medications,
    medicationLogs: input.medicationLogs,
    rangeDays: 14,
  });
  const tone =
    summary.statusLabel === "Worsening"
      ? ("orange" as const)
      : summary.statusLabel === "Improving"
        ? ("green" as const)
        : ("blue" as const);
  const adherence =
    summary.todayMedicationExpected > 0
      ? `Meds today ${summary.todayMedicationTaken}/${summary.todayMedicationExpected}`
      : "No med schedule today";
  return {
    statusLabel: summary.statusLabel,
    summaryText: summary.summaryText || "Pattern over the last 14 days",
    tone,
    adherenceText: adherence,
    nextAction: "Open 14-day report",
    insights: (summary.insights || []).slice(0, 2),
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

  const snapshot: WidgetSnapshot = {
    appearance: profile.widgetAppearance ?? "system",
    medication: getNextMedicationSnapshot(medications, logs),
    appointment: await getNextAppointmentSnapshot(appointments),
    prnMedication: getPrnMedicationSnapshot(medications, logs),
    wellness: buildWellnessSnapshot(todayLog, todaySymptoms),
    hydration,
    sickMode: buildSickModeSnapshot(sickMode, medications, logs),
    mentalHealth: buildMentalHealthSnapshot(mentalHealthMode),
    caregiver: buildCaregiverWidgetSnapshot(caregiverProfile, medications, logs, caregiverTodayLog),
    recovery: buildRecoverySnapshot(sickMode, profile),
    pain: buildPainSnapshot(todaySymptoms, todayLog),
    medicationDay: buildMedicationDaySnapshot(medications, logs, today),
    labs: buildLabsSnapshot(allLabs),
    report14Day: buildReport14DaySnapshot({
      logs: allLogs,
      vitals: allVitals,
      symptoms: allSymptoms,
      medications,
      medicationLogs: allMedLogs,
    }),
    updatedAt: new Date().toISOString(),
  };

  await APP_WIDGET_BRIDGE.saveSnapshot(JSON.stringify(snapshot));
}
