import { NativeModules, Platform } from "react-native";

type FoundationTask = "appointment_explainer" | "doctor_notes_summary" | "health_summary";

type FoundationBridge = {
  isAvailable: () => Promise<boolean>;
  generate: (task: FoundationTask, payloadJson: string) => Promise<string>;
};

const bridge = NativeModules.SynapseFoundationModelsBridge as FoundationBridge | undefined;

export type AppointmentExplanation = {
  explanation: string;
  likelyPurpose: string;
  bringOrExpect: string[];
};

export type DoctorNotesSummary = {
  keyFindings: string[];
  nextSteps: string[];
  medicationsMentioned: string[];
  followUps: string[];
};

export type HealthGeneratedSummary = {
  summary: string;
  trends: string[];
  adherence: string;
  notablePatterns: string[];
};

export type AppointmentExplanationInput = {
  title: string;
  doctorName?: string;
  location?: string;
  notes?: string;
};

export type DoctorNotesSummaryInput = {
  notes: string;
  doctorName?: string;
  appointmentDate?: string;
};

export type HealthSummaryInput = {
  rangeDays: number;
  adherence: number;
  takenDoses: number;
  totalExpectedDoses: number;
  missedDoses: number;
  symptoms: { name: string; count: number }[];
  hydrationTotalMl: number;
  hydrationEntryCount: number;
  appointmentCount: number;
  appointments: { doctorName: string; specialty?: string; date: string; location?: string }[];
  meds: { name: string; active: boolean }[];
};

export async function isFoundationModelsAvailable() {
  if (Platform.OS !== "ios" || !bridge?.isAvailable) return false;
  return bridge.isAvailable().catch(() => false);
}

export async function explainAppointment(input: AppointmentExplanationInput): Promise<AppointmentExplanation> {
  const result = await generateStructured<AppointmentExplanation>("appointment_explainer", input);
  return {
    explanation: cleanText(result.explanation),
    likelyPurpose: cleanText(result.likelyPurpose),
    bringOrExpect: cleanList(result.bringOrExpect),
  };
}

export async function summarizeDoctorNotes(input: DoctorNotesSummaryInput): Promise<DoctorNotesSummary> {
  const result = await generateStructured<DoctorNotesSummary>("doctor_notes_summary", input);
  return {
    keyFindings: cleanList(result.keyFindings),
    nextSteps: cleanList(result.nextSteps),
    medicationsMentioned: cleanList(result.medicationsMentioned),
    followUps: cleanList(result.followUps),
  };
}

export async function generateHealthSummary(input: HealthSummaryInput): Promise<HealthGeneratedSummary> {
  const result = await generateStructured<HealthGeneratedSummary>("health_summary", input);
  return {
    summary: cleanText(result.summary),
    trends: cleanList(result.trends),
    adherence: cleanText(result.adherence),
    notablePatterns: cleanList(result.notablePatterns),
  };
}

async function generateStructured<T>(task: FoundationTask, payload: unknown): Promise<T> {
  if (Platform.OS !== "ios" || !bridge?.generate) {
    throw new Error("On-device Apple Intelligence is not available in this build.");
  }

  const raw = await bridge.generate(task, JSON.stringify(payload));
  return parseJson<T>(raw);
}

function parseJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("The on-device summary could not be read. Try again.");
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 6);
}
