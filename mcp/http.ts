import type { Express, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authenticateRequestAsync, extractBearerToken, isAuthConfigured } from "./auth";
import { mcpLog } from "./logging";
import { createSynapseMcpServer } from "./server";

async function handleMcp(req: Request, res: Response): Promise<void> {
  if (!isAuthConfigured()) {
    res.status(503).json({
      error: "MCP authentication is not configured. Set SYNAPSE_MCP_TOKEN or Supabase URL/anon key.",
    });
    return;
  }

  const token = extractBearerToken(req.headers as Record<string, unknown>);
  const auth = await authenticateRequestAsync(token);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const server = createSynapseMcpServer(auth);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    mcpLog("mcp request failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "MCP request failed" });
    }
  }
}

export function registerMcpRoutes(app: Express): void {
  app.get("/mcp/health", (_req, res) => {
    res.json({
      ok: true,
      name: "synapse-health",
      authConfigured: isAuthConfigured(),
    });
  });

  app.post("/mcp", (req, res) => {
    void handleMcp(req, res);
  });
  app.get("/mcp", (req, res) => {
    void handleMcp(req, res);
  });
  app.delete("/mcp", (req, res) => {
    void handleMcp(req, res);
  });
}
