import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ReminderBody = {
  patientUserId?: string;
  caregiverUserId?: string;
  message?: string;
};

Deno.serve(async (req) => {
  try {
    const body = (await req.json()) as ReminderBody;
    if (!body.patientUserId || !body.caregiverUserId) {
      return Response.json({ error: "Missing patientUserId or caregiverUserId" }, { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Supabase function secrets are not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: patient, error } = await supabase
      .from("caregiver_users")
      .select("device_token, linked_users")
      .eq("user_id", body.patientUserId)
      .maybeSingle();
    if (error) throw error;

    const linkedUsers = Array.isArray(patient?.linked_users) ? patient.linked_users : [];
    if (!linkedUsers.includes(body.caregiverUserId)) {
      return Response.json({ error: "Caregiver is not linked to this patient" }, { status: 403 });
    }

    const token = patient?.device_token;
    if (typeof token !== "string" || !token.startsWith("ExponentPushToken")) {
      return Response.json({ sent: 0 });
    }

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          to: token,
          sound: "default",
          title: "Caregiver check-in",
          body: body.message?.trim() || "Just checking in. How are you feeling?",
          data: { target: "dashboard" },
        },
      ]),
    });
    if (!response.ok) {
      throw new Error(`Expo push failed: ${response.status} ${await response.text()}`);
    }

    return Response.json({ sent: 1 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
