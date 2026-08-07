import type { Request, Response, NextFunction } from "express";

/**
 * Shared-secret gate for PHI-handling API routes.
 * Fail closed when API_SHARED_SECRET is unset so public deploys are not open relays.
 */
export function requireApiAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.API_SHARED_SECRET?.trim();
  if (!secret) {
    res.status(503).json({
      error: "API authentication is not configured. Set API_SHARED_SECRET on the server.",
    });
    return;
  }

  const headerKey = req.header("x-api-key")?.trim();
  const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const provided = headerKey || bearer;

  if (!provided || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
