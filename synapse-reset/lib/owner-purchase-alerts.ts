/**
 * Client helpers for founder/owner purchase-alert device registration.
 * Does not change Plus purchase or entitlement logic.
 * The registration secret must never be hardcoded — the owner types it when registering.
 */
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

function getEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const easConfigId = Constants.easConfig?.projectId;
  const extraId =
    extra?.eas && typeof extra.eas === "object"
      ? (extra.eas as Record<string, unknown>).projectId
      : undefined;
  return (typeof easConfigId === "string" && easConfigId) ||
    (typeof extraId === "string" && extraId) ||
    undefined;
}

export async function getOwnerExpoPushToken(): Promise<string> {
  if (Platform.OS !== "ios") {
    throw new Error("Owner purchase alerts are configured for iPhone only.");
  }
  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    throw new Error("Notification permission is required to register this iPhone.");
  }
  const projectId = getEasProjectId();
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  if (!token.data?.startsWith("ExponentPushToken")) {
    throw new Error("Could not obtain an Expo push token on this device.");
  }
  return token.data;
}

export async function registerOwnerDeviceForPurchaseAlerts(input: {
  secret: string;
  label?: string;
  supabaseFunctionsBaseUrl: string;
}): Promise<{ ok: true }> {
  const secret = input.secret.trim();
  if (!secret) throw new Error("Enter your owner alerts secret.");
  const expoPushToken = await getOwnerExpoPushToken();
  const base = input.supabaseFunctionsBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/register-owner-device`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      expoPushToken,
      label: input.label?.trim() || "Owner iPhone",
    }),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(json.error || `Registration failed (${response.status})`);
  }
  return { ok: true };
}

export async function sendOwnerTestPurchaseAlert(input: {
  secret: string;
  supabaseFunctionsBaseUrl: string;
  environment?: "Production" | "Sandbox";
}): Promise<{ ok: true; sent?: number }> {
  const secret = input.secret.trim();
  if (!secret) throw new Error("Enter your owner alerts secret.");
  const base = input.supabaseFunctionsBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/owner-test-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ environment: input.environment || "Production" }),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string; sent?: number };
  if (!response.ok) {
    throw new Error(json.error || `Test notification failed (${response.status})`);
  }
  return { ok: true, sent: json.sent };
}
