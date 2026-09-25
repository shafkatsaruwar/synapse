import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { z } from "zod";
import { getSupabase } from "./supabase";
import { auditLogger } from "./audit-logger";
import {
  validateInput,
  AnalyzeDocumentRequestSchema,
  AnalyzeDocumentResponseSchema,
  HealthInsightResponseSchema,
  ApiErrorSchema,
} from "./validation";

const PRODUCTION_API_URL = "https://synapse-health.vercel.app";
const API_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Raised when an optional server feature (e.g. the AI insights backend) is not
 * deployed or not configured (HTTP 404/503). Screens should catch this and show
 * a calm "not available" state instead of a hard error, so the app degrades
 * gracefully when the AI service isn't enabled for a given build.
 */
export class ApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export function isApiUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiUnavailableError ||
    (error instanceof Error && error.name === "ApiUnavailableError")
  );
}

/**
 * True when an optional backend feature could not be reached at all: either it
 * explicitly reported "not available" (404/503 -> ApiUnavailableError), or the
 * request never got an HTTP response (network failure, CORS block on web,
 * timeout/abort). Screens for optional features (e.g. AI insights) should use
 * this to show a calm "not available" state instead of a hard error, since the
 * user-facing outcome is the same regardless of the exact transport failure.
 */
export function isServiceUnreachable(error: unknown): boolean {
  if (isApiUnavailable(error)) return true;
  if (!(error instanceof Error)) return false;
  const name = error.name?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";
  return (
    name === "aborterror" ||
    name === "typeerror" ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("network error") ||
    message.includes("api url not configured")
  );
}

function getBaseUrl(): string {
  const legacyManifest = Constants.manifest as { extra?: Record<string, unknown> } | null | undefined;
  const extra = (Constants.expoConfig?.extra ?? legacyManifest?.extra) as Record<string, unknown> | undefined;
  const apiUrlFromExtra = extra && typeof extra.apiUrl === "string" ? (extra.apiUrl as string).trim() : "";
  const apiUrl =
    apiUrlFromExtra ||
    (typeof extra?.EXPO_PUBLIC_API_URL === "string" ? (extra.EXPO_PUBLIC_API_URL as string).trim() : "") ||
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    (typeof extra?.EXPO_PUBLIC_APP_URL === "string" ? (extra.EXPO_PUBLIC_APP_URL as string).trim() : "") ||
    process.env.EXPO_PUBLIC_APP_URL?.trim() ||
    "";
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  const domain =
    (typeof extra?.EXPO_PUBLIC_DOMAIN === "string" ? (extra.EXPO_PUBLIC_DOMAIN as string).trim() : "") ||
    process.env.EXPO_PUBLIC_DOMAIN?.trim() ||
    "";
  if (domain)
    return domain.startsWith("http")
      ? domain.replace(/\/$/, "")
      : `https://${domain}`.replace(/\/$/, "");
  if (__DEV__ && Platform.OS === "web") return "http://localhost:5000";
  return PRODUCTION_API_URL;
}

const BASE = getBaseUrl();

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = getSupabase();
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;

  const legacyManifest = Constants.manifest as { extra?: Record<string, unknown> } | null | undefined;
  const extra = (Constants.expoConfig?.extra ?? legacyManifest?.extra) as Record<string, unknown> | undefined;
  const apiKey =
    (typeof extra?.EXPO_PUBLIC_API_SHARED_SECRET === "string"
      ? extra.EXPO_PUBLIC_API_SHARED_SECRET.trim()
      : "") ||
    process.env.EXPO_PUBLIC_API_SHARED_SECRET?.trim() ||
    "";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Prefer shared API key for PHI routes; fall back to session bearer if present.
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function sanitizeErrorMessage(message: string): string {
  return message.substring(0, 100).replace(/[^\w\s\-\.:\(\)]/g, "");
}

async function apiCall<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    schema?: z.ZodSchema<T>;
  }
): Promise<T> {
  if (!BASE) {
    throw new Error("API URL not configured");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE}${endpoint}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `HTTP ${response.status}` }));

        const validatedError = ApiErrorSchema.safeParse(errorData);
        const errorMessage = validatedError.success
          ? validatedError.data.error
          : "API request failed";

        await auditLogger.log("ERROR", "user", "failure", {
          errorMessage: sanitizeErrorMessage(errorMessage),
        });

        // Feature not deployed/configured: surface a distinct, non-retryable
        // error so callers can degrade gracefully instead of hammering retries.
        if (response.status === 404 || response.status === 503) {
          throw new ApiUnavailableError(sanitizeErrorMessage(errorMessage));
        }

        const httpError = new Error(sanitizeErrorMessage(errorMessage));
        if (response.status >= 400 && response.status < 500) {
          (httpError as Error & { noRetry?: boolean }).noRetry = true;
        }
        throw httpError;
      }

      const data = await response.json();

      if (options.schema) {
        try {
          return validateInput(options.schema, data);
        } catch (validationError) {
          await auditLogger.log("ERROR", "user", "failure", {
            errorMessage: "Invalid API response format",
          });
          throw validationError;
        }
      }

      return data;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Unknown API error");

      // Do not retry when the feature is unavailable or the request was a
      // client error — retrying will not help and just delays the UI.
      if (
        isApiUnavailable(error) ||
        (error as Error & { noRetry?: boolean } | null)?.noRetry
      ) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError ?? new Error("API request failed after retries");
}

export async function analyzeDocument(
  imageBase64: string,
  mimeType: string
): Promise<unknown> {
  try {
    const validated = validateInput(AnalyzeDocumentRequestSchema, {
      imageBase64,
      mimeType,
    });

    const result = await apiCall("/api/analyze-document", {
      method: "POST",
      body: validated,
      schema: AnalyzeDocumentResponseSchema,
    });

    await auditLogger.log("CREATE", "user", "success", {
      details: "Document analyzed",
    });

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Document analysis failed");
    await auditLogger.log("ERROR", "user", "failure", {
      errorMessage: sanitizeErrorMessage(err.message),
    });
    throw err;
  }
}

export async function getHealthInsights(data: unknown): Promise<z.infer<typeof HealthInsightResponseSchema>> {
  try {
    const result = await apiCall("/api/health-insights", {
      method: "POST",
      body: data,
      schema: HealthInsightResponseSchema,
    });

    await auditLogger.log("READ", "user", "success", {
      details: "Health insights generated",
    });

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Failed to generate insights");
    await auditLogger.log("ERROR", "user", "failure", {
      errorMessage: sanitizeErrorMessage(err.message),
    });
    throw err;
  }
}

export async function compareMedications(
  currentMedications: unknown[],
  extractedMedications: unknown[]
): Promise<unknown> {
  try {
    const result = await apiCall("/api/compare-medications", {
      method: "POST",
      body: { currentMedications, extractedMedications },
    });

    await auditLogger.log("READ", "user", "success", {
      details: "Medications compared",
    });

    return result;
  } catch (error) {
    const err =
      error instanceof Error ? error : new Error("Failed to compare medications");
    await auditLogger.log("ERROR", "user", "failure", {
      errorMessage: sanitizeErrorMessage(err.message),
    });
    throw err;
  }
}

export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html?: string;
  from?: string;
}): Promise<unknown> {
  try {
    const result = await apiCall("/api/send-email", {
      method: "POST",
      body: options,
    });

    await auditLogger.log("CREATE", "user", "success", {
      details: "Email sent",
    });

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Failed to send email");
    await auditLogger.log("ERROR", "user", "failure", {
      errorMessage: sanitizeErrorMessage(err.message),
    });
    throw err;
  }
}
