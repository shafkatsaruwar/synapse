import Constants from "expo-constants";
import { Platform } from "react-native";

/** API base URL: primary Constants.expoConfig.extra.apiUrl; fallbacks then localhost for web dev. Logs clear error if missing on device. */
function getBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra) as Record<string, unknown> | undefined;
  const apiUrlFromExtra = extra && typeof extra.apiUrl === "string" ? (extra.apiUrl as string).trim() : "";
  const apiUrl = apiUrlFromExtra ||
    (typeof extra?.EXPO_PUBLIC_API_URL === "string" ? (extra.EXPO_PUBLIC_API_URL as string).trim() : "") ||
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    (typeof extra?.EXPO_PUBLIC_APP_URL === "string" ? (extra.EXPO_PUBLIC_APP_URL as string).trim() : "") ||
    process.env.EXPO_PUBLIC_APP_URL?.trim() ||
    "";
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  const domain = (typeof extra?.EXPO_PUBLIC_DOMAIN === "string" ? (extra.EXPO_PUBLIC_DOMAIN as string).trim() : "") || process.env.EXPO_PUBLIC_DOMAIN?.trim() || "";
  if (domain) return domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`.replace(/\/$/, "");
  if (__DEV__ && Platform.OS === "web") return "http://localhost:5000";
  if (!apiUrlFromExtra && typeof global !== "undefined") {
    console.error(
      "[Synapse] API URL not configured: Constants.expoConfig.extra.apiUrl is undefined. Set EXPO_PUBLIC_API_URL in .env or EAS, then rebuild. View this in Mac Console when the app runs on a physical device."
    );
  }
  return "";
}

const BASE = getBaseUrl();

export async function analyzeDocument(imageBase64: string, mimeType: string) {
  if (!BASE) throw new Error("API URL not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const res = await fetch(`${BASE}/api/analyze-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  if (!res.ok) throw new Error("Failed to analyze document");
  return res.json();
}

export async function getHealthInsights(data: any) {
  if (!BASE) throw new Error("API URL not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const res = await fetch(`${BASE}/api/health-insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to generate insights");
  return res.json();
}

export async function compareMedications(currentMedications: any[], extractedMedications: any[]) {
  if (!BASE) throw new Error("API URL not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const res = await fetch(`${BASE}/api/compare-medications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentMedications, extractedMedications }),
  });
  if (!res.ok) throw new Error("Failed to compare medications");
  return res.json();
}

/** Send an email via Resend (requires RESEND_API_KEY on server / Vercel). */
export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html?: string;
  from?: string;
}) {
  if (!BASE) throw new Error("API URL not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const res = await fetch(`${BASE}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error || "Failed to send email");
  }
  return res.json();
}
