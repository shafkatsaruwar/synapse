/**
 * Register an authorized owner iPhone Expo push token.
 * Auth: Authorization: Bearer <OWNER_ALERTS_SECRET>
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireOwnerAlertsSecret } from "../_shared/owner-auth.ts";

type Body = {
  expoPushToken?: string;
  label?: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const denied = requireOwnerAlertsSecret(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as Body;
    const token = body.expoPushToken?.trim() || "";
    if (!token.startsWith("ExponentPushToken")) {
      return Response.json(
        { error: "expoPushToken must be an ExponentPushToken[…]" },
        { status: 400 },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Supabase secrets missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : null;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("owner_push_devices")
      .upsert(
        {
          expo_push_token: token,
          label,
          updated_at: now,
          disabled_at: null,
          disable_reason: null,
        },
        { onConflict: "expo_push_token" },
      )
      .select("id, expo_push_token, label, updated_at")
      .single();

    if (error) throw error;
    return Response.json({ ok: true, device: data });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
});
