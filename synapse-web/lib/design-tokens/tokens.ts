/** Synapse marketing tokens. Accent values come from the app theme (`tint` / `accent`). */

export const colors = {
  burgundy: "#A30D24",
  burgundyDeep: "#6E0918",
  burgundySoft: "rgba(163, 13, 36, 0.10)",
  ink: "#161311",
  inkSoft: "#5E5852",
  muted: "#8A837C",
  paper: "#F6F3EE",
  paperDeep: "#EFEAE3",
  white: "#FBF9F6",
  line: "rgba(28, 21, 18, 0.12)",
  green: "#2D7D46",
  clay: "#C4A08A",
  sage: "#9AAB9A",
  stone: "#A3A8B0",
  rose: "#D4B2AE",
  emergency: "#C49AA3",
} as const;

export const motion = {
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  duration: "0.6s",
} as const;

export const APP_STORE_URL = "https://apps.apple.com/us/app/synapse-health-companion/id6759972036";

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return configured || "https://synapse-health.vercel.app";
}
