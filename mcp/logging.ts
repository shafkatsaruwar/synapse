/**
 * MCP logging goes to stderr only. Never write PHI, tokens, or request bodies.
 */
export function mcpLog(message: string): void {
  process.stderr.write(`[synapse-mcp] ${message}\n`);
}
