import { Resend } from "resend";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "RESEND_API_KEY is not set" });
    }

    const { to, subject, html, from } = req.body as {
      to: string | string[];
      subject: string;
      html?: string;
      from?: string;
    };

    if (!to || !subject) {
      return res.status(400).json({ error: "to and subject are required" });
    }

    const { data, error } = await resend.emails.send({
      from: from || "Synapse <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || "<p>No content</p>",
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error("Send email error:", err?.message || err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
