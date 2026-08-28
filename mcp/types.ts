/** Loose snapshot of the app ExportPayload so the MCP server stays Node-only. */

export type JsonRecord = Record<string, unknown>;

export type HealthSource = "supabase_backup" | "local_json" | "empty";

export interface HealthSnapshot {
  source: HealthSource;
  ownerUserId?: string;
  updatedAt?: string | null;
  exportDate?: string;
  appVersion?: string;
  profile?: JsonRecord;
  healthProfile?: JsonRecord;
  allergy?: JsonRecord;
  conditions?: JsonRecord[];
  healthLogs?: JsonRecord[];
  symptoms?: JsonRecord[];
  medications?: JsonRecord[];
  medicationLogs?: JsonRecord[];
  doctors?: JsonRecord[];
  pharmacies?: JsonRecord[];
  appointments?: JsonRecord[];
  doctorNotes?: JsonRecord[];
  labWork?: JsonRecord[];
  imaging?: JsonRecord[];
  fastingLogs?: JsonRecord[];
  vitals?: JsonRecord[];
  sickMode?: JsonRecord;
  monthlyCheckIns?: JsonRecord[];
  eatingLogs?: JsonRecord[];
  hydrationLogs?: JsonRecord[];
  mentalHealthMode?: JsonRecord;
  goals?: JsonRecord[];
  cycleEntries?: JsonRecord[];
  insights?: JsonRecord[];
}

export interface DateRange {
  from?: string;
  to?: string;
}

export const EMPTY_SNAPSHOT: HealthSnapshot = {
  source: "empty",
  healthLogs: [],
  symptoms: [],
  medications: [],
  medicationLogs: [],
  doctors: [],
  pharmacies: [],
  appointments: [],
  doctorNotes: [],
  labWork: [],
  imaging: [],
  fastingLogs: [],
  vitals: [],
  monthlyCheckIns: [],
  eatingLogs: [],
  hydrationLogs: [],
  goals: [],
  cycleEntries: [],
  insights: [],
  conditions: [],
};
