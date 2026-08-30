import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createA11yServer } from "../src/server.js";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closeCallbacks.length) await closeCallbacks.pop()?.();
});

describe("MCP contract", () => {
  it("advertises seven read-only accessibility tools", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createA11yServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeCallbacks.push(async () => {
      await client.close();
      await server.close();
    });

    const response = await client.listTools();
    expect(response.tools.map((tool) => tool.name).sort()).toEqual([
      "audit_file",
      "audit_html",
      "audit_url",
      "check_contrast",
      "explain_issue",
      "get_wcag_checklist",
      "suggest_contrast_fix",
    ]);
    expect(response.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("returns structured contrast results through MCP", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createA11yServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeCallbacks.push(async () => {
      await client.close();
      await server.close();
    });

    const response = await client.callTool({
      name: "check_contrast",
      arguments: { foreground: "#777777", background: "#ffffff", level: "AA" },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({ passes: false, requiredRatio: 4.5 });
  });

  it("returns a complete WCAG 2.2 AAA checklist through MCP", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createA11yServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeCallbacks.push(async () => {
      await client.close();
      await server.close();
    });

    const response = await client.callTool({
      name: "get_wcag_checklist",
      arguments: { standard: "wcag22aaa" },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      version: "2.2",
      conformanceLevel: "AAA",
      total: 86,
    });
  });
});
