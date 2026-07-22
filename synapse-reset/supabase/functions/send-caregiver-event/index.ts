import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type EventBody = {
  eventKey?: string;
  patientUserId?: string;
  type?: string;
  payload?: {
    patientName?: string;
    message?: string;
    medicationName?: string;
    doseLabel?: string;
  };
};

function notificationCopy(type?: string, payload?: EventBody["payload"]) {
  const message = payload?.message?.trim();
  if (message) return message;
  const name = payload?.patientName?.trim() || "Someone";
  if (type === "missed_medication") {
    const med = payload?.medicationName?.trim() || "a medication";
    const time = payload?.doseLabel ? ` at ${payload.doseLabel}` : "";
    return `${name} missed ${med}${time}`;
  }
  if (type === "missed_appointment") return `${name} missed an appointment today`;
  if (type === "sick_mode_activated") return `${name} activated Sick Mode`;
  if (type === "no_activity") return `${name} hasn't logged anything today`;
  return `${name} has a Synapse update`;
}

async function sendExpoPush(tokens: string[], title: string, body: string) {
  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data: { target: "caregiver_dashboard" },
  }));
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    throw new Error(`Expo push failed: ${response.status} ${await response.text()}`);
  }
}

Deno.serve(async (req) => {
  try {
    const body = (await req.json()) as EventBody;
    if (!body.patientUserId || !body.eventKey) {
      return Response.json({ error: "Missing patientUserId or eventKey" }, { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Supabase function secrets are not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: events, error: eventError } = await supabase
      .from("caregiver_events")
      .select("caregiver_user_id, type, payload")
      .eq("patient_user_id", body.patientUserId)
      .eq("event_key", body.eventKey);
    if (eventError) throw eventError;

    const caregiverIds = Array.from(new Set((events ?? []).map((event) => event.caregiver_user_id).filter(Boolean)));
    if (caregiverIds.length === 0) return Response.json({ sent: 0 });

    const { data: caregivers, error: caregiverError } = await supabase
      .from("caregiver_users")
      .select("device_token")
      .in("user_id", caregiverIds);
    if (caregiverError) throw caregiverError;

    const tokens = (caregivers ?? [])
      .map((caregiver) => caregiver.device_token)
      .filter((token): token is string => typeof token === "string" && token.startsWith("ExponentPushToken"));
    if (tokens.length === 0) return Response.json({ sent: 0 });

    const event = events?.[0];
    await sendExpoPush(tokens, "Synapse caregiver alert", notificationCopy(event?.type ?? body.type, event?.payload ?? body.payload));
    return Response.json({ sent: tokens.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
