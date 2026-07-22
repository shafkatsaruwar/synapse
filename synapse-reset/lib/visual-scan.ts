import { NativeModules, Platform } from "react-native";
import type { LabResult } from "@/lib/storage";

type NativeVisionBridge = {
  recognizeText?: (imageUri: string) => Promise<string>;
  recognizePDFText?: (pdfUri: string) => Promise<string>;
};

export type VisualScanType = "medication" | "appointment" | "lab" | "imaging";

export type ScannedMedication = {
  name: string;
  dosage: string;
  rawText: string;
};

export type ScannedAppointment = {
  doctorName: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  rawText: string;
};

export type ScannedLabNote = {
  doctorName: string;
  date: string;
  notes: string;
  results: LabResult[];
  rawText: string;
};

export type ScannedImaging = {
  type: string;
  bodyArea: string;
  doctorName: string;
  date: string;
  notes: string;
  rawText: string;
};

const bridge = NativeModules.SynapseVisionBridge as NativeVisionBridge | undefined;

export async function recognizeTextFromImage(imageUri: string) {
  if (Platform.OS !== "ios" || !bridge?.recognizeText) {
    throw new Error("On-device scan support is only available in the iOS build.");
  }
  return bridge.recognizeText(imageUri);
}

export async function recognizeTextFromPDF(pdfUri: string) {
  if (Platform.OS !== "ios" || !bridge?.recognizePDFText) {
    throw new Error("PDF scan support is only available in the iOS build.");
  }
  return bridge.recognizePDFText(pdfUri);
}

export function parseMedicationScan(rawText: string): ScannedMedication {
  const lines = cleanLines(rawText);
  const dosageMatch = rawText.match(/\b(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mL|units?|tabs?|tablets?|caps?|capsules?)(?:\/\d+\s?mL)?)\b/i);
  const name = lines.find((line) =>
    /[a-z]/i.test(line) &&
    !/^(rx|qty|quantity|take|use|discard|refill|doctor|prescriber|pharmacy|warning|patient|date)\b/i.test(line) &&
    !/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(line)
  ) ?? "";

  return {
    name: titleCase(name.replace(/\b(tablets?|capsules?|solution|cream|ointment)\b/gi, "").trim()),
    dosage: dosageMatch?.[1]?.trim() ?? "",
    rawText,
  };
}

export function parseAppointmentScan(rawText: string): ScannedAppointment {
  const lines = cleanLines(rawText);
  const doctorLine = lines.find((line) => /\b(dr\.?|md|clinic|hospital)\b/i.test(line)) ?? "";
  const date = parseDate(rawText);
  const time = parseTime(rawText);
  const location = lines.find((line) =>
    /\b(st|street|ave|avenue|road|rd|blvd|suite|clinic|hospital|medical|center)\b/i.test(line) &&
    line !== doctorLine
  ) ?? "";

  return {
    doctorName: cleanDoctorName(doctorLine) || "Appointment",
    date,
    time,
    location,
    notes: rawText.slice(0, 600),
    rawText,
  };
}

export function parseLabScan(rawText: string): ScannedLabNote {
  const lines = cleanLines(rawText);
  const doctorLine = lines.find((line) => /\b(dr\.?|md|provider|ordered by|physician)\b/i.test(line)) ?? "";
  return {
    doctorName: cleanDoctorName(doctorLine),
    date: parseDate(rawText),
    notes: rawText.slice(0, 1200),
    results: parseLabResults(rawText),
    rawText,
  };
}

const LAB_TEST_ALIASES: Record<string, string[]> = {
  Glucose: ["glucose", "blood glucose", "fasting glucose"],
  Hemoglobin: ["hemoglobin", "hgb", "hb"],
  WBC: ["wbc", "white blood cell", "white blood cells", "white blood count"],
  Platelets: ["platelets", "platelet count", "plt"],
  Creatinine: ["creatinine", "creat"],
  ALT: ["alt", "alanine aminotransferase", "sgpt"],
  AST: ["ast", "aspartate aminotransferase", "sgot"],
};

export function parseLabResults(rawText: string): LabResult[] {
  const seen = new Set<string>();
  const results: LabResult[] = [];
  const lines = cleanLines(rawText);
  const resultPattern = /([A-Za-z][A-Za-z\s./()-]{1,45}):?\s+([-+]?\d+(?:\.\d+)?)\s*([A-Za-z/%^\d]+(?:\/[A-Za-z^\d]+)?)/g;

  for (const line of lines) {
    if (/\b(date|dob|patient|provider|physician|address|phone|fax|page|collected|reported|ordered)\b/i.test(line)) {
      continue;
    }

    resultPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = resultPattern.exec(line)) != null) {
      const rawName = match[1].replace(/[.:|-]+$/g, "").replace(/\s+/g, " ").trim();
      const value = Number(match[2]);
      const unit = match[3].trim();
      if (!rawName || !Number.isFinite(value) || !unit || rawName.length > 48) continue;

      const name = mapLabTestName(rawName);
      const key = `${name.toLowerCase()}|${value}|${unit.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const referenceRange = findReferenceRange(line, match.index + match[0].length);
      results.push({
        name,
        value,
        unit,
        ...(referenceRange ? { referenceRange } : {}),
      });
    }
  }

  return results.slice(0, 40);
}

function mapLabTestName(rawName: string) {
  const normalized = rawName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const [canonical, aliases] of Object.entries(LAB_TEST_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) return canonical;
  }
  return titleCase(rawName.replace(/\b(result|value|test)\b/gi, "").trim());
}

function findReferenceRange(line: string, startIndex: number) {
  const rest = line.slice(startIndex);
  const range = rest.match(/(?:ref(?:erence)?\s*range|normal)?\s*:?\s*([-+]?\d+(?:\.\d+)?\s*[-–]\s*[-+]?\d+(?:\.\d+)?\s*[A-Za-z/%^\d]*)/i);
  return range?.[1]?.replace(/\s+/g, " ").trim();
}

export function parseImagingScan(rawText: string): ScannedImaging {
  const lines = cleanLines(rawText);
  const doctorLine = lines.find((line) => /\b(dr\.?|md|provider|ordered by|physician)\b/i.test(line)) ?? "";
  const typeLine = lines.find((line) => /\b(x-?ray|mri|ct|ultrasound|sonogram|imaging|radiology)\b/i.test(line)) ?? "";
  const bodyLine = lines.find((line) => /\b(chest|head|brain|neck|spine|back|abdomen|pelvis|knee|hip|ankle|foot|shoulder|arm|wrist|hand)\b/i.test(line)) ?? "";
  return {
    type: normalizeImagingType(typeLine) || "Imaging",
    bodyArea: titleCase(bodyLine.replace(/\b(x-?ray|mri|ct|ultrasound|sonogram|imaging|radiology)\b/gi, "").trim()),
    doctorName: cleanDoctorName(doctorLine),
    date: parseDate(rawText),
    notes: rawText.slice(0, 1200),
    rawText,
  };
}

function cleanLines(rawText: string) {
  return rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseDate(rawText: string) {
  const numeric = rawText.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (numeric) {
    const year = normalizeYear(numeric[3]);
    return `${year}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  }

  const month = rawText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
  if (month) {
    const date = new Date(`${month[1]} ${month[2]}, ${month[3] ?? new Date().getFullYear()}`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function parseTime(rawText: string) {
  const match = rawText.match(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i);
  if (!match) return "09:00";
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeYear(year: string) {
  if (year.length === 4) return year;
  const value = parseInt(year, 10);
  return `${value > 70 ? 1900 + value : 2000 + value}`;
}

function cleanDoctorName(value: string) {
  return titleCase(
    value
      .replace(/^(ordered by|provider|physician)\s*:?\s*/i, "")
      .replace(/\b(md|m\.d\.)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function normalizeImagingType(value: string) {
  if (/\bmri\b/i.test(value)) return "MRI";
  if (/\bct\b/i.test(value)) return "CT";
  if (/\bx-?ray\b/i.test(value)) return "X-ray";
  if (/\bultrasound|sonogram\b/i.test(value)) return "Ultrasound";
  return titleCase(value.trim());
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bDr\b/g, "Dr.");
}
