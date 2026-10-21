const SENSITIVE_QUERY_KEYS = [
  "code",
  "token_hash",
  "type",
  "access_token",
  "refresh_token",
  "error",
  "error_code",
  "error_description",
] as const;

export type AuthCallback = {
  present: boolean;
  recovery: boolean;
};

/** Detect a Supabase confirmation or recovery landing without returning token values. */
export function readAuthCallback(href: string): AuthCallback {
  const url = new URL(href, "https://synapse-health.vercel.app");
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;
  const recovery = hash.get("type") === "recovery" || query.get("type") === "recovery" || url.pathname === "/reset-password";
  const present =
    hash.has("access_token") ||
    hash.has("refresh_token") ||
    hash.has("error") ||
    hash.has("error_code") ||
    query.has("code") ||
    query.has("token_hash") ||
    query.has("error") ||
    query.has("error_code") ||
    query.has("type") ||
    hash.has("type");
  return { present, recovery: present && recovery };
}

/** Address-bar form of the same URL with auth tokens removed. */
export function stripAuthParams(href: string): string {
  const url = new URL(href, "https://synapse-health.vercel.app");
  url.hash = "";
  for (const key of SENSITIVE_QUERY_KEYS) url.searchParams.delete(key);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}
