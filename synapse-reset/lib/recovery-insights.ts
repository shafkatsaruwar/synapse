import type { HealthLog, Medication, MedicationLog, Symptom, Vital } from "@/lib/storage";
import { getDaysAgo, getToday } from "@/lib/date-utils";

export type RecoveryStatusLabel = "Improving" | "Stable" | "Worsening";

export interface RecoveryDailyPoint {
  date: string;
  overallFeeling: number | null;
  symptomSeverity: number | null;
  heartRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  temperature: number | null;
  oxygenSaturation: number | null;
  medicationAdherence: number | null;
  statusSummary: string;
}

export interface RecoveryInsightSummary {
  statusLabel: RecoveryStatusLabel;
  insights: string[];
  dailyPoints: RecoveryDailyPoint[];
  latestSymptom: Symptom | null;
  latestCheckIn: HealthLog | null;
  todayMedicationTaken: number;
  todayMedicationExpected: number;
  todayVitals: {
    heartRate: number | null;
    bloodPressure: string | null;
    temperature: string | null;
    oxygenSaturation: string | null;
    source: string | null;
  };
  summaryText: string;
}

interface BuildRecoveryInsightsInput {
  logs: HealthLog[];
  vitals: Vital[];
  symptoms: Symptom[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
  rangeDays?: number;
  today?: string;
}

const MOVEMENT_TRIGGERS = new Set(["Walking", "Standing", "Sitting up"]);

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number | null, digits = 1): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getSortTime(value?: string, fallbackDate?: string): number {
  if (value) {
    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (fallbackDate) {
    const parsed = new Date(`${fallbackDate}T12:00:00`).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function getDoseCount(medication: Medication): number {
  if (Array.isArray(medication.doses) && medication.doses.length > 0) return medication.doses.length;
  const legacyDoseCount = (medication as { doses?: number }).doses;
  return typeof legacyDoseCount === "number" && legacyDoseCount > 0 ? legacyDoseCount : 1;
}

function normalizeHeartRate(vital: Vital): number | null {
  if (typeof vital.heartRate === "number") return vital.heartRate;
  if (vital.type === "heart_rate") {
    const parsed = Number(vital.value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTemperature(vital: Vital): number | null {
  if (typeof vital.bodyTemperature === "number") return vital.bodyTemperature;
  if (vital.type === "body_temperature") {
    const parsed = Number(vital.value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeOxygenSaturation(vital: Vital): number | null {
  if (typeof vital.oxygenSaturation === "number") return vital.oxygenSaturation;
  if (vital.type === "oxygen_saturation") {
    const parsed = Number(vital.value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBloodPressure(vital: Vital): { systolic: number | null; diastolic: number | null } {
  if (typeof vital.bloodPressureSystolic === "number" || typeof vital.bloodPressureDiastolic === "number") {
    return {
      systolic: typeof vital.bloodPressureSystolic === "number" ? vital.bloodPressureSystolic : null,
      diastolic: typeof vital.bloodPressureDiastolic === "number" ? vital.bloodPressureDiastolic : null,
    };
  }

  if (vital.type === "blood_pressure") {
    const parts = vital.value.split("/");
    if (parts.length === 2) {
      const systolic = Number(parts[0]);
      const diastolic = Number(parts[1]);
      return {
        systolic: Number.isFinite(systolic) ? systolic : null,
        diastolic: Number.isFinite(diastolic) ? diastolic : null,
      };
    }
  }

  return { systolic: null, diastolic: null };
}

function normalizeOverallFeeling(log: HealthLog): number | null {
  if (typeof log.overallFeeling === "number") return log.overallFeeling;
  if (typeof log.energy !== "number" || Number.isNaN(log.energy)) return null;
  return log.energy <= 5 ? Math.min(10, log.energy * 2) : Math.max(0, Math.min(10, log.energy));
}

function buildStatusSummary(point: Omit<RecoveryDailyPoint, "statusSummary">): string {
  const parts: string[] = [];
  if (point.overallFeeling != null) parts.push(`Feeling ${Math.round(point.overallFeeling)}/10`);
  if (point.symptomSeverity != null) parts.push(`Symptoms ${Math.round(point.symptomSeverity)}/10`);
  if (point.heartRate != null) parts.push(`HR ${Math.round(point.heartRate)}`);
  if (point.bloodPressureSystolic != null && point.bloodPressureDiastolic != null) {
    parts.push(`BP ${Math.round(point.bloodPressureSystolic)}/${Math.round(point.bloodPressureDiastolic)}`);
  }
  if (point.temperature != null) parts.push(`Temp ${point.temperature.toFixed(1)}°`);
  if (point.medicationAdherence != null) parts.push(`Meds ${Math.round(point.medicationAdherence)}%`);
  return parts.length ? parts.join(" · ") : "No recovery data logged";
}

function getStatusLabel(points: RecoveryDailyPoint[]): RecoveryStatusLabel {
  const withSignal = points.filter((point) => point.overallFeeling != null || point.symptomSeverity != null);
  if (withSignal.length < 3) return "Stable";

  const midpoint = Math.ceil(withSignal.length / 2);
  const firstHalf = withSignal.slice(0, midpoint);
  const lastHalf = withSignal.slice(-midpoint);

  const firstSymptoms = average(firstHalf.map((point) => point.symptomSeverity).filter((value): value is number => value != null));
  const lastSymptoms = average(lastHalf.map((point) => point.symptomSeverity).filter((value): value is number => value != null));
  const firstFeeling = average(firstHalf.map((point) => point.overallFeeling).filter((value): value is number => value != null));
  const lastFeeling = average(lastHalf.map((point) => point.overallFeeling).filter((value): value is number => value != null));

  const symptomDelta = (lastSymptoms ?? 0) - (firstSymptoms ?? 0);
  const feelingDelta = (lastFeeling ?? 0) - (firstFeeling ?? 0);

  if (symptomDelta <= -1 || feelingDelta >= 1) return "Improving";
  if (symptomDelta >= 1 || feelingDelta <= -1) return "Worsening";
  return "Stable";
}

function getPossibleInsights(
  symptoms: Symptom[],
  medicationLogs: MedicationLog[],
  dailyPoints: RecoveryDailyPoint[],
): string[] {
  const insights: string[] = [];

  const chestPainEvents = symptoms.filter((symptom) => symptom.name === "Chest pain");
  const chestPainWithMovement = chestPainEvents.filter((symptom) => MOVEMENT_TRIGGERS.has(symptom.trigger ?? ""));
  if (chestPainEvents.length >= 2 && chestPainWithMovement.length / chestPainEvents.length >= 0.6) {
    insights.push("Chest pain appears more often with movement.");
  }

  const symptomEventsWithTimes = symptoms.filter((symptom) => symptom.recordedAt);
  const medicationEventsWithTimes = medicationLogs.filter((log) => log.taken && log.recordedAt);
  if (symptomEventsWithTimes.length >= 3 && medicationEventsWithTimes.length >= 2) {
    const afterMedication = symptomEventsWithTimes.filter((symptom) => {
      const symptomTime = getSortTime(symptom.recordedAt, symptom.date);
      return medicationEventsWithTimes.some((log) => {
        const medTime = getSortTime(log.recordedAt, log.date);
        return symptomTime >= medTime && symptomTime - medTime <= 3 * 60 * 60 * 1000;
      });
    });
    const afterAvg = average(afterMedication.map((symptom) => symptom.severity));
    const outsideAvg = average(
      symptomEventsWithTimes
        .filter((symptom) => !afterMedication.some((candidate) => candidate.id === symptom.id))
        .map((symptom) => symptom.severity),
    );
    if (afterAvg != null && outsideAvg != null && afterAvg + 1 <= outsideAvg) {
      insights.push("Symptoms seem lower after medication.");
    }
  }

  const feverDays = new Set(
    symptoms
      .filter((symptom) => symptom.name === "Fever" || (typeof symptom.temperature === "number" && symptom.temperature >= 99))
      .map((symptom) => symptom.date),
  );
  if (feverDays.size > 0) {
    const heartRateOnFeverDays = dailyPoints
      .filter((point) => feverDays.has(point.date) && point.heartRate != null)
      .map((point) => point.heartRate as number);
    const heartRateOnOtherDays = dailyPoints
      .filter((point) => !feverDays.has(point.date) && point.heartRate != null)
      .map((point) => point.heartRate as number);
    const feverHrAvg = average(heartRateOnFeverDays);
    const otherHrAvg = average(heartRateOnOtherDays);
    if (feverHrAvg != null && otherHrAvg != null && feverHrAvg >= otherHrAvg + 5) {
      insights.push("Heart rate is higher on days with fever.");
    }
  }

  const dizzinessDays = new Set(symptoms.filter((symptom) => symptom.name === "Dizziness").map((symptom) => symptom.date));
  const normalBpDizzinessDays = dailyPoints.filter((point) => {
    const sys = point.bloodPressureSystolic;
    const dia = point.bloodPressureDiastolic;
    return (
      dizzinessDays.has(point.date) &&
      sys != null &&
      dia != null &&
      sys >= 90 &&
      sys <= 120 &&
      dia >= 60 &&
      dia <= 80
    );
  });
  if (normalBpDizzinessDays.length >= 2) {
    insights.push("Dizziness has continued even when blood pressure entries were normal.");
  }

  if (!insights.length) {
    const latestPoint = [...dailyPoints].reverse().find((point) => point.symptomSeverity != null || point.heartRate != null || point.overallFeeling != null);
    if (latestPoint?.symptomSeverity != null && latestPoint.symptomSeverity <= 3) {
      insights.push("Recent symptom entries look lighter than earlier logs.");
    } else {
      insights.push("Keep logging recovery check-ins, vitals, and symptom events to unlock more useful patterns.");
    }
  }

  return insights.slice(0, 4);
}

export function buildRecoveryInsights({
  logs,
  vitals,
  symptoms,
  medications,
  medicationLogs,
  rangeDays = 7,
  today = getToday(),
}: BuildRecoveryInsightsInput): RecoveryInsightSummary {
  const cutoff = getDaysAgo(rangeDays - 1);
  const activeMedications = medications.filter((medication) => medication.active);
  const logsInRange = logs.filter((log) => log.date >= cutoff && log.date <= today);
  const vitalsInRange = vitals.filter((vital) => vital.date >= cutoff && vital.date <= today);
  const symptomsInRange = symptoms.filter((symptom) => symptom.date >= cutoff && symptom.date <= today);
  const medicationLogsInRange = medicationLogs.filter((log) => log.date >= cutoff && log.date <= today);

  const dates: string[] = [];
  const cursor = new Date(`${cutoff}T00:00:00`);
  const end = new Date(`${today}T00:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const dailyPoints = dates.map((date) => {
    const dayLogs = logsInRange.filter((log) => log.date === date);
    const daySymptoms = symptomsInRange.filter((symptom) => symptom.date === date);
    const dayVitals = vitalsInRange.filter((vital) => vital.date === date);
    const dayMedicationLogs = medicationLogsInRange.filter((log) => log.date === date && log.taken);

    const heartRates = dayVitals.map(normalizeHeartRate).filter((value): value is number => value != null);
    const temperatures = dayVitals.map(normalizeTemperature).filter((value): value is number => value != null);
    const oxygenValues = dayVitals.map(normalizeOxygenSaturation).filter((value): value is number => value != null);
    const bloodPressures = dayVitals.map(normalizeBloodPressure);
    const systolics = bloodPressures.map((bp) => bp.systolic).filter((value): value is number => value != null);
    const diastolics = bloodPressures.map((bp) => bp.diastolic).filter((value): value is number => value != null);

    const expectedMedicationCount = activeMedications.reduce((sum, medication) => sum + getDoseCount(medication), 0);
    const medicationAdherence = expectedMedicationCount > 0
      ? (dayMedicationLogs.length / expectedMedicationCount) * 100
      : null;

    const pointBase = {
      date,
      overallFeeling: round(average(dayLogs.map(normalizeOverallFeeling).filter((value): value is number => value != null))),
      symptomSeverity: round(average(daySymptoms.map((symptom) => symptom.severity))),
      heartRate: round(average(heartRates)),
      bloodPressureSystolic: round(average(systolics)),
      bloodPressureDiastolic: round(average(diastolics)),
      temperature: round(average(temperatures)),
      oxygenSaturation: round(average(oxygenValues)),
      medicationAdherence: round(medicationAdherence),
    };

    return {
      ...pointBase,
      statusSummary: buildStatusSummary(pointBase),
    };
  });

  const statusLabel = getStatusLabel(dailyPoints);
  const sortedSymptoms = [...symptomsInRange].sort(
    (a, b) => getSortTime(b.recordedAt, b.date) - getSortTime(a.recordedAt, a.date),
  );
  const sortedLogs = [...logsInRange].sort(
    (a, b) => getSortTime(b.recordedAt, b.date) - getSortTime(a.recordedAt, a.date),
  );
  const sortedVitals = [...vitalsInRange].sort(
    (a, b) => getSortTime(b.recordedAt, b.date) - getSortTime(a.recordedAt, a.date),
  );
  const latestSymptom = sortedSymptoms[0] ?? null;
  const latestCheckIn = sortedLogs[0] ?? null;

  const todayVitals = sortedVitals.filter((vital) => vital.date === today);
  const latestHeartRate = todayVitals.map(normalizeHeartRate).find((value) => value != null) ?? null;
  const latestTemperature = todayVitals.map(normalizeTemperature).find((value) => value != null) ?? null;
  const latestOxygen = todayVitals.map(normalizeOxygenSaturation).find((value) => value != null) ?? null;
  const latestBp = todayVitals
    .map(normalizeBloodPressure)
    .find((bp) => bp.systolic != null && bp.diastolic != null) ?? { systolic: null, diastolic: null };
  const latestVitalSource = todayVitals.find((vital) => vital.source)?.source ?? null;

  const todayMedicationTaken = medicationLogs.filter((log) => log.date === today && log.taken).length;
  const todayMedicationExpected = activeMedications.reduce((sum, medication) => sum + getDoseCount(medication), 0);

  const summaryText =
    statusLabel === "Improving"
      ? "Recent check-ins suggest symptoms may be easing a bit."
      : statusLabel === "Worsening"
        ? "Recent entries look a little heavier, so keeping an eye on the pattern makes sense."
        : "Your recent entries look fairly steady right now.";

  return {
    statusLabel,
    insights: getPossibleInsights(symptomsInRange, medicationLogsInRange, dailyPoints),
    dailyPoints,
    latestSymptom,
    latestCheckIn,
    todayMedicationTaken,
    todayMedicationExpected,
    todayVitals: {
      heartRate: latestHeartRate != null ? `${Math.round(latestHeartRate)} bpm` : null,
      bloodPressure:
        latestBp.systolic != null && latestBp.diastolic != null
          ? `${Math.round(latestBp.systolic)}/${Math.round(latestBp.diastolic)}`
          : null,
      temperature: latestTemperature != null ? `${latestTemperature.toFixed(1)}°` : null,
      oxygenSaturation: latestOxygen != null ? `${Math.round(latestOxygen)}%` : null,
      source: latestVitalSource ? latestVitalSource.replace(/_/g, " ") : null,
    },
    summaryText,
  };
}
