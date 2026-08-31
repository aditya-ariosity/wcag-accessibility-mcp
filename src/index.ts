#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_NAME } from "./metadata.js";
import { createA11yServer } from "./server.js";

async function main(): Promise<void> {
  process.env.A11Y_MCP_TRANSPORT = "stdio";
  const server = createA11yServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} is running over stdio`);
}

main().catch((error: unknown) => {
  console.error(`${SERVER_NAME} failed:`, error);
  process.exit(1);
});
