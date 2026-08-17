import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditFile, auditHtml } from "../src/audit.js";

describe("browser accessibility audit", () => {
  it("finds semantic failures in rendered HTML", async () => {
    const result = await auditHtml(`<!doctype html><html><body><button><span aria-hidden="true">x</span></button><img src="x"></body></html>`);
    const ruleIds = result.issues.map((issue) => issue.id);
    expect(ruleIds).toContain("button-name");
    expect(ruleIds).toContain("image-alt");
    expect(result.summary.violationCount).toBeGreaterThan(0);
  }, 45_000);

  it("audits a local file and includes selector evidence", async () => {
    const path = resolve("fixtures/inaccessible.html");
    const result = await auditFile(path);
    expect(result.issues.some((issue) => issue.nodes.some((node) => node.target.length > 0))).toBe(true);
    expect(result.notes.join(" ")).toMatch(/do not prove WCAG conformance/i);
  }, 45_000);
});
