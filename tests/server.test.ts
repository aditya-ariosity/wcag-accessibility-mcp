import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createA11yServer } from "../src/server.js";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  delete process.env.A11Y_MCP_ENABLE_EXPERIMENTAL_TOOLS;
  while (closeCallbacks.length) await closeCallbacks.pop()?.();
});

function enableExperimentalTools(): void {
  process.env.A11Y_MCP_ENABLE_EXPERIMENTAL_TOOLS = "true";
}

describe("MCP contract", () => {
  it("advertises read-only accessibility tools", async () => {
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
    ].sort());
    expect(response.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(response.tools.every((tool) => tool.outputSchema)).toBe(true);
  });

  it("inspects design snapshots through MCP without launching a browser", async () => {
    enableExperimentalTools();
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
      name: "inspect_design_snapshot",
      arguments: {
        source: "claude-design",
        root: {
          name: "Card",
          children: [{ id: "copy", type: "TEXT", text: "Low", foreground: "#999", background: "#fff" }],
        },
      },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      source: "claude-design",
      findingCount: 1,
    });
  });

  it("uses package metadata for browser-free diagnostics", async () => {
    enableExperimentalTools();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createA11yServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeCallbacks.push(async () => {
      await client.close();
      await server.close();
    });

    const response = await client.callTool({ name: "browser_diagnostics", arguments: {} });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      sandboxDisabled: false,
    });
  });

  it("compares audits through MCP without launching a browser", async () => {
    enableExperimentalTools();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createA11yServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeCallbacks.push(async () => {
      await client.close();
      await server.close();
    });

    const baseline = {
      engine: "axe test",
      standard: "wcag22aa",
      testedAt: "2026-08-30T00:00:00.000Z",
      target: "https://example.com",
      viewport: { width: 1440, height: 900 },
      summary: { violationCount: 0, affectedNodeCount: 0, incompleteCount: 0, passesCount: 1, byImpact: {} },
      coverage: { requiredCriteriaCount: 1, criteriaWithAutomatedRules: 1, criteriaRequiringManualReview: 0, catalogSource: "test" },
      issues: [],
      incomplete: [],
      notes: [],
    };
    const response = await client.callTool({
      name: "compare_audits",
      arguments: { baseline, candidate: baseline },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      delta: { newCount: 0, resolvedCount: 0, persistingCount: 0 },
      gate: { passed: true },
    });
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
