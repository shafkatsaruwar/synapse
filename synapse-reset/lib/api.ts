import Constants from "expo-constants";
import { Platform } from "react-native";

/** Production backend URL when no env is set. Prevents production app from using localhost (device cannot reach dev machine). */
const PRODUCTION_API_URL = "https://synapse-health.vercel.app";

/**
 * API base URL: extra.apiUrl / EXPO_PUBLIC_API_URL / EXPO_PUBLIC_APP_URL / EXPO_PUBLIC_DOMAIN from bundle,
 * then production fallback, then localhost only for web dev. Never uses localhost on native production builds.
 */
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
  return PRODUCTION_API_URL;
}

const BASE = getBaseUrl();

const API_HEADERS: HeadersInit = { "Content-Type": "application/json", Accept: "application/json" };

export async function analyzeDocument(imageBase64: string, mimeType: string) {
  console.log("API Base URL:", BASE);
  if (!BASE) throw new Error("API URL not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const res = await fetch(`${BASE}/api/analyze-document`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  if (!res.ok) throw new Error("Failed to analyze document");
  return res.json();
}

export async function getHealthInsights(data: any) {
  console.log("API Base URL:", BASE);
  if (!BASE) throw new Error("API URL not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const res = await fetch(`${BASE}/api/health-insights`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to generate insights");
  return res.json();
}

export async function compareMedications(currentMedications: any[], extractedMedications: any[]) {
  console.log("API Base URL:", BASE);
  if (!BASE) throw new Error("API URL not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const res = await fetch(`${BASE}/api/compare-medications`, {
    method: "POST",
    headers: API_HEADERS,
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
  console.log("API Base URL:", BASE);
  if (!BASE) throw new Error("API URL not configured. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const res = await fetch(`${BASE}/api/send-email`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error || "Failed to send email");
  }
  return res.json();
}
