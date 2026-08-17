#!/usr/bin/env node
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { createA11yServer } from "./server.js";

process.env.A11Y_MCP_TRANSPORT = "http";

const host = process.env.HOST ?? process.env.A11Y_MCP_HOST ?? "127.0.0.1";
const allowedHosts = process.env.A11Y_MCP_ALLOWED_HOSTS
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const bodyLimit = process.env.A11Y_MCP_BODY_LIMIT ?? "4mb";
const app = express();
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

function hostnameFromHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  if (header.startsWith("[")) {
    const end = header.indexOf("]");
    return end === -1 ? header.toLowerCase() : header.slice(0, end + 1).toLowerCase();
  }
  return header.split(":")[0].toLowerCase();
}

function defaultAllowedHosts(bindHost: string): string[] | undefined {
  if (["127.0.0.1", "localhost", "::1"].includes(bindHost)) {
    return ["127.0.0.1", "localhost", "[::1]"];
  }
  return undefined;
}

const hostValidation: RequestHandler = (request, response, next) => {
  const allowed = allowedHosts ?? defaultAllowedHosts(host);
  if (!allowed) {
    next();
    return;
  }

  const requestedHost = hostnameFromHeader(request.headers.host);
  if (requestedHost && allowed.map((value) => value.toLowerCase()).includes(requestedHost)) {
    next();
    return;
  }

  response.status(403).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Host is not allowed for this MCP transport." },
    id: null,
  });
};

const jsonErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const tooLarge = (error as { type?: string })?.type === "entity.too.large";
  response.status(tooLarge ? 413 : 400).json({
    jsonrpc: "2.0",
    error: {
      code: -32600,
      message: tooLarge ? "Request body too large." : "Malformed request.",
    },
    id: null,
  });
};

app.use(express.json({ limit: bodyLimit }));
app.use(jsonErrorHandler);
app.use(hostValidation);

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "a11y-feedback-mcp", version: "0.1.0" });
});

app.post("/mcp", async (request, response) => {
  const server = createA11yServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  } finally {
    response.on("close", () => {
      void transport.close();
      void server.close();
    });
  }
});

app.get("/mcp", (_request, response) => {
  response.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Use POST /mcp for stateless Streamable HTTP." },
    id: null,
  });
});

app.delete("/mcp", (_request, response) => {
  response.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Stateless transport has no session to delete." },
    id: null,
  });
});

const server = app.listen(port, host, () => {
  console.log(`a11y-feedback-mcp listening on http://${host}:${port}/mcp`);
});

server.on("error", (error) => {
  console.error("Failed to start HTTP transport:", error);
  process.exit(1);
});
