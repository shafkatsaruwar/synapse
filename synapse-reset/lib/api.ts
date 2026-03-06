/**
 * Batch D — minimal API helpers. Add routes as needed; requires EXPO_PUBLIC_DOMAIN.
 */
import { getApiUrl } from "@/lib/query-client";

export async function apiGet<T = unknown>(route: string): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  const res = await fetch(new URL(route, base).toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T = unknown>(route: string, data?: unknown): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  const res = await fetch(new URL(route, base).toString(), {
    method: "POST",
    headers: data != null ? { "Content-Type": "application/json" } : {},
    body: data != null ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
