import { Platform } from "react-native";

function getBaseUrl(): string {
  if (Platform.OS === "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (domain) return `https://${domain}`;
    return "http://localhost:5000";
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "http://localhost:5000";
}

const BASE = getBaseUrl();

export async function analyzeDocument(imageBase64: string, mimeType: string) {
  const res = await fetch(`${BASE}/api/analyze-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  if (!res.ok) throw new Error("Failed to analyze document");
  return res.json();
}

export async function getHealthInsights(data: any) {
  const res = await fetch(`${BASE}/api/health-insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to generate insights");
  return res.json();
}

export async function compareMedications(currentMedications: any[], extractedMedications: any[]) {
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
