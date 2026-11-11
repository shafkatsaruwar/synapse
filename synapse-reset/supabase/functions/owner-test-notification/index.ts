/**
 * Secure test push to all active owner devices.
 * Auth: Authorization: Bearer <OWNER_ALERTS_SECRET>
 * Does not touch App Store or customer data.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  OWNER_PURCHASE_ALERT_BODY,
  OWNER_PURCHASE_ALERT_TITLE,
  SANDBOX_OWNER_PURCHASE_ALERT_BODY,
  SANDBOX_OWNER_PURCHASE_ALERT_TITLE,
} from "../_shared/purchase-alert-policy.ts";
import { sendExpoPushMessages } from "../_shared/expo-push.ts";
import { requireOwnerAlertsSecret } from "../_shared/owner-auth.ts";

type Body = {
  /** Defaults to production celebration copy. Use "Sandbox" to preview sandbox wording. */
  environment?: "Production" | "Sandbox";
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const denied = requireOwnerAlertsSecret(req);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const environment = body.environment === "Sandbox" ? "Sandbox" : "Production";
    const title =
      environment === "Sandbox" ? SANDBOX_OWNER_PURCHASE_ALERT_TITLE : OWNER_PURCHASE_ALERT_TITLE;
    const message =
      environment === "Sandbox"
        ? SANDBOX_OWNER_PURCHASE_ALERT_BODY
        : `[Test] ${OWNER_PURCHASE_ALERT_BODY}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Supabase secrets missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: devices, error } = await supabase
      .from("owner_push_devices")
      .select("expo_push_token")
      .is("disabled_at", null);
    if (error) throw error;

    const tokens = (devices ?? [])
      .map((d) => d.expo_push_token)
      .filter((t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken"));

    if (tokens.length === 0) {
      return Response.json({ ok: false, error: "No active owner devices registered" }, { status: 400 });
    }

    const push = await sendExpoPushMessages(tokens, title, message, {
      kind: "owner_plus_purchase_alert_test",
      environment,
    });

    if (push.expiredTokens.length > 0) {
      await supabase
        .from("owner_push_devices")
        .update({
          disabled_at: new Date().toISOString(),
          disable_reason: "DeviceNotRegistered",
          updated_at: new Date().toISOString(),
        })
        .in("expo_push_token", push.expiredTokens);
    }

    const sent = push.tickets.filter((t) => t.status === "ok").length;
    if (sent === 0) {
      return Response.json({ ok: false, error: "Expo push failed", tickets: push.tickets }, { status: 502 });
    }

    return Response.json({
      ok: true,
      sent,
      expiredTokensCleared: push.expiredTokens.length,
      environment,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
});
