import { Resend } from "resend";

type SendEmailResult = { status: number; body: { error: string } | { success: true; id?: string } };

/**
 * Behavior of the root Vercel function `api/send-email.ts`.
 * The Next route is a thin wrapper around this so the two can be compared directly.
 */
export async function handleSendEmail(request: Request): Promise<SendEmailResult> {
  if (request.method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  if (!isAuthorized(request)) {
    if (!process.env.API_SHARED_SECRET?.trim()) {
      return {
        status: 503,
        body: { error: "API authentication is not configured. Set API_SHARED_SECRET on the server." },
      };
    }
    return { status: 401, body: { error: "Unauthorized" } };
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return { status: 500, body: { error: "RESEND_API_KEY is not set" } };
    }

    const body = (await request.json()) as {
      to: string | string[];
      subject: string;
      html?: string;
    };
    const { to, subject, html } = body;

    if (!to || !subject) {
      return { status: 400, body: { error: "to and subject are required" } };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Synapse <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || "<p>No content</p>",
    });

    if (error) {
      return { status: 400, body: { error: error.message } };
    }

    return { status: 200, body: { success: true, id: data?.id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("Send email error:", message);
    return { status: 500, body: { error: "Failed to send email" } };
  }
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.API_SHARED_SECRET?.trim();
  if (!secret) return false;
  const headerKey = request.headers.get("x-api-key")?.trim();
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const provided = headerKey || auth;
  return Boolean(provided && provided === secret);
}
