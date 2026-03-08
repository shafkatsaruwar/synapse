import Constants from "expo-constants";
import { Platform } from "react-native";

/** API base URL from env. Never use localhost on physical device (use EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL). */
function getBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra) as Record<string, unknown> | undefined;
  const fromEnv = (key: string) =>
    (typeof extra?.[key] === "string" ? (extra[key] as string).trim() : null) || process.env[key]?.trim() || "";
  const apiUrl = fromEnv("EXPO_PUBLIC_API_URL") || fromEnv("EXPO_PUBLIC_APP_URL");
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  const domain = fromEnv("EXPO_PUBLIC_DOMAIN");
  if (domain) return domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`.replace(/\/$/, "");
  if (__DEV__ && Platform.OS === "web") return "http://localhost:5000";
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
