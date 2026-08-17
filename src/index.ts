#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createA11yServer } from "./server.js";

async function main(): Promise<void> {
  process.env.A11Y_MCP_TRANSPORT = "stdio";
  const server = createA11yServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("a11y-feedback-mcp is running over stdio");
}

main().catch((error: unknown) => {
  console.error("a11y-feedback-mcp failed:", error);
  process.exit(1);
});
