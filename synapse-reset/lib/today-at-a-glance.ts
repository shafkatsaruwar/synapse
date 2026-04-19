import type { Medication, MedicationLog, Symptom, Vital } from "@/lib/storage";

export type TodayAtAGlanceSummary = {
  medicationLine: string;
  symptomsLine?: string;
  insightLine: string;
  scheduledTaken: number;
  scheduledTotal: number;
  extraDoseCount: number;
  extraDoseNames: string[];
  symptomNames: string[];
  vitalLabels: string[];
};

function formatList(items: string[], limit = 2) {
  if (items.length <= limit) return items.join(", ");
  const visible = items.slice(0, limit).join(", ");
  return `${visible} +${items.length - limit} more`;
}

function normalizeSymptomName(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

function getVitalLabel(vital: Vital) {
  if (vital.bloodPressureSystolic || vital.bloodPressureDiastolic || vital.type === "blood_pressure") return "BP";
  if (vital.heartRate || vital.type === "heart_rate") return "HR";
  if (vital.bodyTemperature || vital.type === "temperature") return "Temp";
  if (vital.oxygenSaturation || vital.type === "oxygen_saturation") return "O₂";
  return vital.type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildTodayAtAGlance({
  medications,
  medicationLogs,
  symptoms,
  vitals,
}: {
  medications: Medication[];
  medicationLogs: MedicationLog[];
  symptoms: Symptom[];
  vitals: Vital[];
}): TodayAtAGlanceSummary {
  const medNameMap = new Map(medications.map((med) => [med.id, med.name]));
  const scheduledMeds = medications.filter((med) => (med.medicationType ?? "scheduled") !== "prn");
  const prnMeds = medications.filter((med) => (med.medicationType ?? "scheduled") === "prn");
  const prnMedIds = new Set(prnMeds.map((med) => med.id));

  const scheduledTotal = scheduledMeds.reduce((sum, med) => {
    const doseCount = Array.isArray(med.doses) && med.doses.length > 0 ? med.doses.length : 1;
    return sum + doseCount;
  }, 0);

  const takenLogs = medicationLogs.filter((log) => log.taken);
  const scheduledTaken = takenLogs.filter((log) => {
    const med = scheduledMeds.find((item) => item.id === log.medicationId);
    if (!med) return false;
    const doseCount = Array.isArray(med.doses) && med.doses.length > 0 ? med.doses.length : 1;
    return (log.doseIndex ?? 0) < doseCount;
  }).length;

  const extraDoseLogs = takenLogs.filter((log) => prnMedIds.has(log.medicationId) || (log.doseIndex ?? 0) === -1);
  const extraDoseNames = Array.from(
    new Set(
      extraDoseLogs
        .map((log) => medNameMap.get(log.medicationId))
        .filter((value): value is string => !!value),
    ),
  );

  const symptomNames = Array.from(
    new Set(
      symptoms
        .map((symptom) => normalizeSymptomName(symptom.name))
        .filter(Boolean),
    ),
  );

  const vitalLabels = Array.from(new Set(vitals.map(getVitalLabel).filter(Boolean)));

  const extraDoseCount = extraDoseLogs.length;
  const medicationLineParts: string[] = [];
  if (scheduledTotal > 0) {
    medicationLineParts.push(`You took ${scheduledTaken} of ${scheduledTotal} scheduled doses`);
  } else if (extraDoseCount === 0) {
    medicationLineParts.push("No scheduled doses today");
  }
  if (extraDoseCount > 0) {
    medicationLineParts.push(`You logged ${extraDoseCount} extra dose${extraDoseCount === 1 ? "" : "s"} (${formatList(extraDoseNames, 1)})`);
  }

  let symptomsLine: string | undefined;
  if (symptomNames.length > 0) {
    const symptomPart = `Symptoms: ${formatList(symptomNames)}`;
    symptomsLine = vitalLabels.length > 0 ? `${symptomPart} • ${formatList(vitalLabels, 2)} logged` : symptomPart;
  }

  let insightLine = "Everything stayed on track today";
  if (extraDoseCount > 0) {
    insightLine = extraDoseCount === 1
      ? `You used ${formatList(extraDoseNames, 1)} more than usual today`
      : "You logged extra medication use today";
  } else if (scheduledTotal > 0 && scheduledTaken < scheduledTotal && symptomNames.length > 0) {
    insightLine = "Looks like a heavier day than usual";
  } else if (symptomNames.length >= 3 || vitalLabels.length >= 3) {
    insightLine = "Looks like a heavier day than usual";
  } else if (scheduledTotal > 0 && scheduledTaken < scheduledTotal) {
    insightLine = "A few scheduled doses are still pending";
  } else if (symptomNames.length > 0) {
    insightLine = "You logged a few symptoms today";
  } else if (vitalLabels.length > 0) {
    insightLine = "You kept a closer eye on things today";
  }

  return {
    medicationLine: medicationLineParts.join(" • "),
    symptomsLine,
    insightLine,
    scheduledTaken,
    scheduledTotal,
    extraDoseCount,
    extraDoseNames,
    symptomNames,
    vitalLabels,
  };
}
