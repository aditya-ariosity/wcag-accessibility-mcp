import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditFile, auditHtml } from "../src/audit.js";
import { contrastRatio, suggestContrastFix } from "../src/contrast.js";
import { remediationFor } from "../src/remediation.js";
import { isPrivateAddress } from "../src/security.js";
import { getWcagChecklist } from "../src/wcag.js";

const doc = (body: string) =>
  `<!doctype html><html lang="en"><head><title>fixture</title></head><body><main>${body}</main></body></html>`;

describe("deployment regression coverage", () => {
  it("keeps contrast suggestions aligned with axe-composited opacity evidence", async () => {
    const result = await auditHtml(
      doc(`<div style="opacity:.5"><p style="color:#767676;background:#ffffff">text</p></div>`),
    );
    const node = result.issues.find((issue) => issue.id.startsWith("color-contrast"))?.nodes[0];
    expect(node).toBeDefined();
    if (node?.contrastSuggestion) {
      expect(node.contrastSuggestion.currentRatio).toBeLessThan(node.contrastSuggestion.requiredRatio);
    }
  }, 60_000);

  it("does not invent an opaque white background behind gradients", async () => {
    const result = await auditHtml(
      doc(`<div style="background:linear-gradient(#fff,#000)"><p style="color:#8a8a8a">text</p></div>`),
    );
    const nodes = result.issues.filter((issue) => issue.id.startsWith("color-contrast")).flatMap((issue) => issue.nodes);
    expect(nodes.every((node) => node.context?.backgroundColor !== "rgb(255, 255, 255)")).toBe(true);
  }, 60_000);

  it("returns computed context and suggested fixes for ordinary failing text", async () => {
    const result = await auditHtml(doc(`<p style="color:#999999;background:#ffffff">low contrast</p>`));
    const node = result.issues.find((issue) => issue.id === "color-contrast")?.nodes[0];
    expect(node?.context?.color).toBeDefined();
    expect(node?.contrastSuggestion?.suggestedForeground).toBeDefined();
  }, 60_000);

  it.each(["white", "hsl(0, 100%, 50%)", "rgb(1 2 3)", "#aabbccdd"])(
    "accepts common CSS color syntax: %s",
    (color) => {
      expect(() => contrastRatio(color, "#ffffff")).not.toThrow();
    },
  );

  it("accepts browser sRGB color() syntax for suggestions", () => {
    expect(() => suggestContrastFix({ foreground: "color(srgb 0.6 0.6 0.6)", background: "#ffffff" })).not.toThrow();
  });

  it.each([
    "2002:7f00:1::",
    "64:ff9b::808:808",
    "fec0::1",
    "192.0.0.1",
    "192.0.2.1",
    "192.88.99.1",
  ])("treats reserved address %s as blocked", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it("uses non-dead references for WCAG 2.0 criteria", () => {
    const criterion = getWcagChecklist("wcag2a").find((item) => item.id === "1.1.1");
    expect(criterion?.reference).not.toBe("https://www.w3.org/TR/WCAG20/#non-text-content");
  });

  it("reports the version where a criterion was introduced", () => {
    const criterion = getWcagChecklist("wcag22aaa").find((item) => item.id === "1.3.4");
    expect(criterion?.version).toBe("2.1");
    expect(criterion?.profileVersion).toBe("2.2");
  });

  it("keeps WCAG criteria separate from conformance level tags", async () => {
    const result = await auditHtml(doc(`<p style="color:#999;background:#fff">low</p>`));
    const issue = result.issues.find((item) => item.id === "color-contrast");
    expect(issue?.wcagTags).toEqual(["1.4.3"]);
    expect(issue?.wcagLevels).toContain("wcag2aa");
  }, 60_000);

  it.each(["frame-title", "select-name", "list", "region", "bypass", "empty-heading", "nested-interactive", "meta-viewport"])(
    "has specific remediation for %s",
    (ruleId) => {
      expect(remediationFor(ruleId)[0]).not.toContain("Open the linked rule guidance");
    },
  );
});

describe("audit_file containment", () => {
  let root: string;
  let outside: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "a11y-root-"));
    outside = await mkdtemp(join(tmpdir(), "a11y-outside-"));
    await writeFile(join(root, "hash #name.html"), doc("<h1>ok</h1>"), "utf8");
    await writeFile(join(outside, "secret.html"), doc("<h1>secret</h1>"), "utf8");
    await symlink(join(outside, "secret.html"), join(root, "link.html"));
    process.env.A11Y_MCP_ALLOWED_ROOT = root;
    delete process.env.A11Y_MCP_TRANSPORT;
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it("rejects symlinks that escape the allowed root", async () => {
    await expect(auditFile(join(root, "link.html"))).rejects.toThrow(/outside the allowed root/i);
  }, 60_000);

  it("audits filenames containing # characters", async () => {
    const result = await auditFile(join(root, "hash #name.html"));
    expect(result.target).toContain("hash%20%23name.html");
  }, 60_000);
});
