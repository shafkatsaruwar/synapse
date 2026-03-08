import { QueryClient, QueryFunction } from "@tanstack/react-query";
import Constants from "expo-constants";

/**
 * Base URL for the API server. Uses EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL or EXPO_PUBLIC_DOMAIN (from extra or env).
 * Returns empty string when none are set (avoids localhost on physical device).
 */
export function getApiUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra) as Record<string, unknown> | undefined;
  const from = (key: string) =>
    (typeof extra?.[key] === "string" ? (extra[key] as string).trim() : null) || process.env[key]?.trim() || "";
  const apiUrl = from("EXPO_PUBLIC_API_URL") || from("EXPO_PUBLIC_APP_URL");
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  const domain = from("EXPO_PUBLIC_DOMAIN");
  if (domain) {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    return url.replace(/\/$/, "");
  }
  return "";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown,
): Promise<Response> {
  const baseUrl = getApiUrl();
  if (!baseUrl) throw new Error("API URL not set. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_APP_URL in .env or EAS.");
  const url = new URL(route, baseUrl);
  const res = await fetch(url.toString(), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  const { on401: unauthorizedBehavior } = options;
  return async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    if (!baseUrl) return null as T;
    const url = new URL(queryKey.join("/") as string, baseUrl);
    const res = await fetch(url.toString(), { credentials: "include" });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }
    await throwIfResNotOk(res);
    return (await res.json()) as T;
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
