#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { authenticateStdioEnv } from "./auth";
import { mcpLog } from "./logging";
import { createSynapseMcpServer } from "./server";

async function main(): Promise<void> {
  const auth = authenticateStdioEnv();
  if (!auth.ok) {
    mcpLog(auth.error);
    process.exit(1);
  }

  const server = createSynapseMcpServer(auth);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  mcpLog("stdio server ready");
}

main().catch(() => {
  mcpLog("stdio server failed to start");
  process.exit(1);
});
