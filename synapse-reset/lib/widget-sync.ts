import { NativeModules, Platform } from "react-native";
import {
  appointmentStorage,
  healthLogStorage,
  healthProfileStorage,
  hydrationStorage,
  medicationLogStorage,
  medicationStorage,
  mentalHealthModeStorage,
  normalizeMedication,
  sickModeStorage,
  symptomStorage,
  convertHydrationToMl,
  formatHydrationAmount,
  type Appointment,
  type HealthLog,
  type HydrationEntry,
  type Medication,
  type MedicationDose,
  type MentalHealthModeData,
  type SickModeData,
  type Symptom,
  type WidgetAppearancePreference,
} from "@/lib/storage";
import { getToday } from "@/lib/date-utils";

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

function getNextAppointmentSnapshot(appointments: Appointment[]) {
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
  return {
    doctorName: appointment.doctorName || "Appointment",
    detail: simplifyAppointmentDetail(appointment.specialty || appointment.location || "Upcoming visit"),
    startsAt: startsAt.toISOString(),
    whenText: formatAppointmentWhen(startsAt),
  };
}

export async function syncWidgetSnapshot() {
  if (Platform.OS !== "ios" || !APP_WIDGET_BRIDGE?.saveSnapshot) return;

  const today = getToday();
  const [medications, appointments, profile, todayLog, todaySymptoms, todayHydration, sickMode, mentalHealthMode] = await Promise.all([
    medicationStorage.getAll(),
    appointmentStorage.getAll(),
    healthProfileStorage.get(),
    healthLogStorage.getByDate(today),
    symptomStorage.getByDate(today),
    hydrationStorage.getByDateRange(today, today),
    sickModeStorage.get(),
    mentalHealthModeStorage.get(),
  ]);
  const logs = await medicationLogStorage.getByDate(today);
  const hydration = await buildHydrationSnapshot(todayHydration);

  const snapshot: WidgetSnapshot = {
    appearance: profile.widgetAppearance ?? "system",
    medication: getNextMedicationSnapshot(medications, logs),
    appointment: getNextAppointmentSnapshot(appointments),
    prnMedication: getPrnMedicationSnapshot(medications, logs),
    wellness: buildWellnessSnapshot(todayLog, todaySymptoms),
    hydration,
    sickMode: buildSickModeSnapshot(sickMode, medications, logs),
    mentalHealth: buildMentalHealthSnapshot(mentalHealthMode),
    updatedAt: new Date().toISOString(),
  };

  await APP_WIDGET_BRIDGE.saveSnapshot(JSON.stringify(snapshot));
}
