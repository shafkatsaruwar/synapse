import { Resend } from "resend";
import type { VercelRequest, VercelResponse } from "@vercel/node";

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.API_SHARED_SECRET?.trim();
  if (!secret) return false;
  const headerKey = (req.headers["x-api-key"] as string | undefined)?.trim();
  const auth = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, "").trim();
  const provided = headerKey || auth;
  return Boolean(provided && provided === secret);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    if (!process.env.API_SHARED_SECRET?.trim()) {
      return res.status(503).json({
        error: "API authentication is not configured. Set API_SHARED_SECRET on the server.",
      });
    }
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "RESEND_API_KEY is not set" });
    }

    const { to, subject, html } = req.body as {
      to: string | string[];
      subject: string;
      html?: string;
    };

    if (!to || !subject) {
      return res.status(400).json({ error: "to and subject are required" });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Synapse <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || "<p>No content</p>",
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error("Send email error:", err?.message || "unknown");
    return res.status(500).json({ error: "Failed to send email" });
  }
}
