import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

// Files prefixed with "_" are not exposed as routes by Vercel; this is shared
// helper code for the /api serverless functions.

/**
 * Shared-secret auth for the PHI/AI routes. The client sends the secret as
 * `x-api-key` (see synapse-reset/lib/api.ts). Fails closed: if no secret is
 * configured on the server, all requests are rejected.
 */
export function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.API_SHARED_SECRET?.trim();
  if (!secret) return false;
  const headerKey = (req.headers["x-api-key"] as string | undefined)?.trim();
  const auth = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, "").trim();
  const provided = headerKey || auth;
  return Boolean(provided && provided === secret);
}

/**
 * Standard gate for POST-only, authenticated AI routes. Returns true when the
 * request has already been answered (caller should return immediately).
 */
export function rejectIfNotAllowed(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return true;
  }
  if (!isAuthorized(req)) {
    if (!process.env.API_SHARED_SECRET?.trim()) {
      res.status(503).json({ error: "API authentication is not configured. Set API_SHARED_SECRET on the server." });
      return true;
    }
    res.status(401).json({ error: "Unauthorized" });
    return true;
  }
  return false;
}

let openaiClient: OpenAI | null = null;

export function getOpenAIKey(): string | undefined {
  return process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
}

/**
 * Returns an OpenAI client, or null when no API key is configured. Callers
 * should return a clean 503 when this is null so the app can degrade gracefully
 * instead of surfacing a hard error.
 */
export function getOpenAI(): OpenAI | null {
  const apiKey = getOpenAIKey();
  if (!apiKey) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

export const AI_MODEL = "gpt-5-mini";
