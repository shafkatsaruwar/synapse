import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthSuccess } from "./auth";
import { loadOwnerSnapshot } from "./data-source";
import { mcpLog } from "./logging";
import {
  getHealthProfile,
  getHealthSummary,
  getRecoveryStatus,
  listCheckIns,
  listLabWork,
  listMedications,
  listSymptoms,
  listUpcomingAppointments,
  listVitals,
  queryHealthData,
  type QueryCollection,
} from "./query";

const collectionsSchema = z
  .array(
    z.enum([
      "checkins",
      "symptoms",
      "vitals",
      "medications",
      "medicationLogs",
      "appointments",
      "labs",
      "imaging",
      "hydration",
      "eating",
    ])
  )
  .optional();

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

async function withSnapshot<T>(auth: AuthSuccess, fn: (snapshot: Awaited<ReturnType<typeof loadOwnerSnapshot>>) => T) {
  try {
    const snapshot = await loadOwnerSnapshot(auth);
    if (snapshot.source === "empty" && !(snapshot.appointments && snapshot.appointments.length > 0)) {
      return textResult({
        notice:
          "No cloud backup found for this account yet. Sign in on the app and use Account → Assistant access → Sync now, or point SYNAPSE_BACKUP_JSON at a Privacy export.",
        source: snapshot.source,
      });
    }
    return textResult(fn(snapshot));
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return errorResult("Unauthorized");
    mcpLog("tool failed");
    return errorResult("Unable to load health data");
  }
}

export function createSynapseMcpServer(auth: AuthSuccess): McpServer {
  const server = new McpServer({
    name: "synapse-health",
    version: "1.0.0",
  });

  server.registerTool(
    "get_health_profile",
    {
      title: "Get health profile",
      description:
        "Return the owner's health profile: name, conditions, allergy/emergency notes, sick/recovery flags. Read-only.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => withSnapshot(auth, getHealthProfile)
  );

  server.registerTool(
    "get_health_summary",
    {
      title: "Get health summary",
      description:
        "High-level summary of recent check-ins, symptoms, medication adherence, upcoming appointments, and recovery status.",
      inputSchema: {
        days: z.number().int().min(1).max(90).optional().describe("Lookback window in days. Default 7."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ days }) => withSnapshot(auth, (snapshot) => getHealthSummary(snapshot, days ?? 7))
  );

  server.registerTool(
    "list_recent_symptoms",
    {
      title: "List recent symptoms",
      description: "List recent symptom logs, optionally filtered by date range.",
      inputSchema: {
        from: z.string().optional().describe("Inclusive start date YYYY-MM-DD"),
        to: z.string().optional().describe("Inclusive end date YYYY-MM-DD"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => withSnapshot(auth, (snapshot) => listSymptoms(snapshot, args))
  );

  server.registerTool(
    "list_medications",
    {
      title: "List medications",
      description: "List medications and recent adherence from dose logs.",
      inputSchema: {
        from: z.string().optional().describe("Adherence window start YYYY-MM-DD"),
        to: z.string().optional().describe("Adherence window end YYYY-MM-DD"),
        includeInactive: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => withSnapshot(auth, (snapshot) => listMedications(snapshot, args))
  );

  server.registerTool(
    "list_upcoming_appointments",
    {
      title: "List upcoming appointments",
      description: "List upcoming (non-cancelled) appointments from today forward.",
      inputSchema: {
        from: z.string().optional().describe("Inclusive start date YYYY-MM-DD. Defaults to today."),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => withSnapshot(auth, (snapshot) => listUpcomingAppointments(snapshot, args))
  );

  server.registerTool(
    "list_recent_checkins",
    {
      title: "List recent check-ins",
      description: "List daily check-ins (energy, mood, sleep, notes).",
      inputSchema: {
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => withSnapshot(auth, (snapshot) => listCheckIns(snapshot, args))
  );

  server.registerTool(
    "list_recent_vitals",
    {
      title: "List recent vitals",
      description: "List recent vitals (manual, Apple Health, or other sources).",
      inputSchema: {
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => withSnapshot(auth, (snapshot) => listVitals(snapshot, args))
  );

  server.registerTool(
    "list_recovery_status",
    {
      title: "List recovery status",
      description: "Sick/recovery mode, hydration, eating, and recent energy/mood/sleep averages.",
      inputSchema: {
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => withSnapshot(auth, (snapshot) => getRecoveryStatus(snapshot, args))
  );

  server.registerTool(
    "list_lab_work",
    {
      title: "List lab work",
      description: "List imported or logged lab work in a date range.",
      inputSchema: {
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) => withSnapshot(auth, (snapshot) => listLabWork(snapshot, args))
  );

  server.registerTool(
    "query_health_data",
    {
      title: "Query health data by date",
      description:
        "Dated query over check-ins, symptoms, vitals, medication logs, appointments, labs, imaging, hydration, or eating.",
      inputSchema: {
        from: z.string().optional().describe("Inclusive start date YYYY-MM-DD"),
        to: z.string().optional().describe("Inclusive end date YYYY-MM-DD"),
        collections: collectionsSchema.describe("Which collections to include. Default is a useful mix."),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args) =>
      withSnapshot(auth, (snapshot) =>
        queryHealthData(snapshot, {
          from: args.from,
          to: args.to,
          collections: args.collections as QueryCollection[] | undefined,
          limit: args.limit,
        })
      )
  );

  return server;
}
