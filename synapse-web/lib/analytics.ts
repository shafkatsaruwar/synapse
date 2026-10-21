/**
 * Marketing-site events. Separate from the scroll animation.
 * Nothing is sent unless a visitor has granted consent AND an endpoint is configured.
 * The Synapse app does not ship a third-party analytics SDK; this stays inert by default.
 * Never include health information in props.
 */

export type AnalyticsEvent =
  | "app_store_click"
  | "feature_visit"
  | "hero_engagement"
  | "scroll_completion"
  | "support_visit";

const CONSENT_KEY = "synapse-web-analytics-consent";
const sent = new Set<string>();

export function analyticsConsent() {
  if (typeof window === "undefined") return "unknown" as const;
  const value = window.localStorage.getItem(CONSENT_KEY);
  if (value === "granted" || value === "denied") return value;
  return "unknown" as const;
}

export function setAnalyticsConsent(value: "granted" | "denied") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, value);
}

export function track(event: AnalyticsEvent, props?: Record<string, string>) {
  if (typeof window === "undefined") return;
  if (analyticsConsent() !== "granted") return;
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
  if (!endpoint) return;
  const onceKey = `${event}:${props?.id ?? props?.phase ?? ""}`;
  if (event === "scroll_completion" || event === "hero_engagement" || event === "feature_visit" || event === "support_visit") {
    if (sent.has(onceKey)) return;
    sent.add(onceKey);
  }
  const body = JSON.stringify({
    event,
    props: props ?? {},
    path: window.location.pathname,
    ts: Date.now(),
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(endpoint, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}
