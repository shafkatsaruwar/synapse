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

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
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

        throw new Error(sanitizeErrorMessage(errorMessage));
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
