/**
 * App Store Server Notifications V2 webhook for Synapse Plus owner alerts.
 *
 * Configure in App Store Connect → App → App Store Server Notifications →
 * Production / Sandbox URL:
 *   https://<project-ref>.supabase.co/functions/v1/app-store-notifications
 *
 * Does not modify entitlements or purchase logic. No customer PHI in pushes.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyAssnSignedPayload } from "../_shared/apple-assn.ts";
import {
  alertCopyForEnvironment,
  decidePurchaseAlert,
} from "../_shared/purchase-alert-policy.ts";
import { sendExpoPushMessages } from "../_shared/expo-push.ts";

const BUNDLE_ID = Deno.env.get("APP_BUNDLE_ID")?.trim() || "com.mohammedsaruwar.synapse";
const APP_APPLE_ID = Number(Deno.env.get("APP_APPLE_ID")?.trim() || "6759972036");
const NOTIFY_SANDBOX = (Deno.env.get("OWNER_NOTIFY_SANDBOX") || "").toLowerCase() === "true";

type AssnRequestBody = {
  signedPayload?: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      // 500 so Apple retries until secrets are configured.
      return Response.json({ error: "Supabase secrets missing" }, { status: 500 });
    }

    const body = (await req.json()) as AssnRequestBody;
    if (!body.signedPayload || typeof body.signedPayload !== "string") {
      return Response.json({ error: "Missing signedPayload" }, { status: 400 });
    }

    const verified = await verifyAssnSignedPayload({
      signedPayload: body.signedPayload,
      bundleId: BUNDLE_ID,
      appAppleId: APP_APPLE_ID,
    });

    const notificationUUID = verified.notification.notificationUUID;
    const notificationType = String(verified.notification.notificationType || "");
    const subtype = verified.notification.subtype ? String(verified.notification.subtype) : null;
    const productId = verified.transaction?.productId ?? null;
    const transactionId = verified.transaction?.transactionId ?? null;
    const originalTransactionId = verified.transaction?.originalTransactionId ?? null;

    if (!notificationUUID) {
      return Response.json({ error: "Missing notificationUUID" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Idempotency: Apple retries — acknowledge duplicates with 200.
    const { data: existing } = await supabase
      .from("plus_purchase_notification_events")
      .select("notification_uuid, alert_sent")
      .eq("notification_uuid", notificationUUID)
      .maybeSingle();

    if (existing) {
      return Response.json({
        ok: true,
        duplicate: true,
        alertSent: existing.alert_sent === true,
      });
    }

    // Also suppress duplicate alerts for the same transaction id (rare dual delivery).
    if (transactionId) {
      const { data: priorTx } = await supabase
        .from("plus_purchase_notification_events")
        .select("notification_uuid")
        .eq("transaction_id", transactionId)
        .eq("alert_sent", true)
        .limit(1)
        .maybeSingle();
      if (priorTx) {
        await supabase.from("plus_purchase_notification_events").insert({
          notification_uuid: notificationUUID,
          environment: verified.environment,
          notification_type: notificationType,
          subtype,
          product_id: productId,
          transaction_id: transactionId,
          original_transaction_id: originalTransactionId,
          alert_sent: false,
          skip_reason: "duplicate_transaction",
        });
        return Response.json({ ok: true, skipped: "duplicate_transaction" });
      }
    }

    const decision = decidePurchaseAlert({
      notificationType,
      subtype,
      productId,
      environment: verified.environment,
      notifySandbox: NOTIFY_SANDBOX,
    });

    if (!decision.alert) {
      await supabase.from("plus_purchase_notification_events").insert({
        notification_uuid: notificationUUID,
        environment: verified.environment,
        notification_type: notificationType,
        subtype,
        product_id: productId,
        transaction_id: transactionId,
        original_transaction_id: originalTransactionId,
        alert_sent: false,
        skip_reason: decision.reason,
      });
      return Response.json({ ok: true, skipped: decision.reason });
    }

    const { data: devices, error: deviceError } = await supabase
      .from("owner_push_devices")
      .select("id, expo_push_token")
      .is("disabled_at", null);
    if (deviceError) throw deviceError;

    const tokens = (devices ?? [])
      .map((d) => d.expo_push_token)
      .filter((t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken"));

    if (tokens.length === 0) {
      await supabase.from("plus_purchase_notification_events").insert({
        notification_uuid: notificationUUID,
        environment: verified.environment,
        notification_type: notificationType,
        subtype,
        product_id: productId,
        transaction_id: transactionId,
        original_transaction_id: originalTransactionId,
        alert_sent: false,
        skip_reason: "no_owner_devices",
      });
      // 200 — notification accepted; missing device is an operator config issue, not Apple's.
      return Response.json({ ok: true, skipped: "no_owner_devices" });
    }

    const copy = alertCopyForEnvironment(verified.environment);
    const push = await sendExpoPushMessages(tokens, copy.title, copy.body, {
      kind: "owner_plus_purchase_alert",
      environment: verified.environment,
      // Never include transaction IDs or customer fields in the visible push; keep minimal routing only.
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

    const hardFailures = push.tickets.filter(
      (t) => t.status === "error" && t.details?.error !== "DeviceNotRegistered",
    );
    if (hardFailures.length > 0 && hardFailures.length === push.tickets.length) {
      // All sends failed transiently — 500 so Apple retries.
      return Response.json({ error: "Expo push failed for all devices" }, { status: 500 });
    }

    const alertSent = push.tickets.some((t) => t.status === "ok");
    await supabase.from("plus_purchase_notification_events").insert({
      notification_uuid: notificationUUID,
      environment: verified.environment,
      notification_type: notificationType,
      subtype,
      product_id: productId,
      transaction_id: transactionId,
      original_transaction_id: originalTransactionId,
      alert_sent: alertSent,
      skip_reason: alertSent ? null : "expo_push_failed",
    });

    if (alertSent) {
      await supabase
        .from("owner_push_devices")
        .update({ last_success_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in(
          "expo_push_token",
          tokens.filter((t) => !push.expiredTokens.includes(t)),
        );
    }

    return Response.json({
      ok: true,
      alertSent,
      environment: verified.environment,
      sent: push.tickets.filter((t) => t.status === "ok").length,
    });
  } catch (error) {
    // Verification / unexpected errors → 500 so Apple retries.
    // Do not include payload contents in the response.
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message.slice(0, 200) }, { status: 500 });
  }
});
