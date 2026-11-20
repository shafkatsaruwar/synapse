/** Constant-time-ish compare for owner alert secrets. */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * Accepts `Authorization: Bearer <OWNER_ALERTS_SECRET>` or `X-Owner-Alerts-Secret`.
 * Never log the secret.
 */
export function requireOwnerAlertsSecret(req: Request): Response | null {
  const expected = Deno.env.get("OWNER_ALERTS_SECRET")?.trim();
  if (!expected) {
    return Response.json(
      { error: "OWNER_ALERTS_SECRET is not configured on this function" },
      { status: 500 },
    );
  }

  const header = req.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const alt = (req.headers.get("x-owner-alerts-secret") || "").trim();
  const provided = bearer || alt;

  if (!provided || !timingSafeEqualString(provided, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
