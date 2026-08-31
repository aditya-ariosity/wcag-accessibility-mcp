import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axe from "axe-core";
import * as z from "zod/v4";
import { auditFile, auditHtml, auditUrl, type AuditOptions } from "./audit.js";
import { resolveBrowserDiagnostic } from "./browser.js";
import { contrastRatio, requiredContrast, suggestContrastFix } from "./contrast.js";
import { auditMatrix, compareAudits, type MatrixTarget } from "./matrix.js";
import { SERVER_NAME, SERVER_VERSION } from "./metadata.js";
import { remediationFor } from "./remediation.js";
import { inspectDesignSnapshot, type DesignNode } from "./design.js";
import { inspectScreenshot, type ScreenshotTarget } from "./screenshot.js";
import type { AuditResult, AuditStandard } from "./types.js";
import { getWcagChecklist, standardLevel, standardVersion } from "./wcag.js";

const standards = [
  "wcag2a",
  "wcag2aa",
  "wcag2aaa",
  "wcag21aa",
  "wcag21aaa",
  "wcag22aa",
  "wcag22aaa",
  "best-practice",
] as const;

const commonAuditSchema = {
  standard: z.enum(standards).default("wcag22aa").describe("WCAG ruleset to test. Use best-practice to include additional axe guidance."),
  width: z.number().int().min(320).max(7680).default(1440).describe("Viewport width in CSS pixels."),
  height: z.number().int().min(240).max(4320).default(900).describe("Viewport height in CSS pixels."),
  maxIssues: z.number().int().min(1).max(200).default(50).describe("Maximum violation groups returned; summary totals still cover the full run."),
  maxNodesPerIssue: z.number().int().min(1).max(100).default(10).describe("Maximum affected elements returned per rule."),
};

const viewportSchema = z.object({
  name: z.string().min(1).max(40).describe("Stable viewport label such as desktop, tablet, or mobile."),
  width: z.number().int().min(320).max(7680).describe("Viewport width in CSS pixels."),
  height: z.number().int().min(240).max(4320).describe("Viewport height in CSS pixels."),
});

const designNodeSchema: z.ZodType<DesignNode> = z.lazy(() => z.object({
  id: z.string().max(200).optional(),
  name: z.string().max(300).optional(),
  type: z.string().max(120).optional(),
  role: z.string().max(120).optional(),
  text: z.string().max(2_000).optional(),
  visible: z.boolean().optional(),
  width: z.number().min(0).max(100_000).optional(),
  height: z.number().min(0).max(100_000).optional(),
  foreground: z.string().max(120).optional(),
  background: z.string().max(120).optional(),
  fontSizePx: z.number().positive().max(500).optional(),
  fontWeight: z.number().int().min(1).max(1000).optional(),
  ariaLabel: z.string().max(500).optional(),
  alt: z.string().max(500).optional(),
  children: z.array(designNodeSchema).max(5_000).optional(),
}));

const viewportOutputSchema = z.object({ width: z.number(), height: z.number() });
const auditOutputSchema = {
  schemaVersion: z.string().optional(),
  runId: z.string().optional(),
  evidenceSource: z.string().optional(),
  engine: z.string(),
  standard: z.string(),
  testedAt: z.string(),
  target: z.string(),
  viewport: viewportOutputSchema,
  summary: z.object({
    violationCount: z.number(),
    affectedNodeCount: z.number(),
    incompleteCount: z.number(),
    passesCount: z.number(),
    byImpact: z.record(z.string(), z.number()),
  }).passthrough(),
  coverage: z.object({
    requiredCriteriaCount: z.number(),
    criteriaWithAutomatedRules: z.number(),
    criteriaRequiringManualReview: z.number(),
    catalogSource: z.string(),
  }).passthrough(),
  issues: z.array(z.unknown()),
  incomplete: z.array(z.unknown()),
  notes: z.array(z.string()),
  state: z.string().optional(),
  locale: z.object({ language: z.string().optional(), direction: z.enum(["ltr", "rtl", "mixed", "unknown"]) }).optional(),
  evidence: z.array(z.unknown()).optional(),
  criterionEvaluations: z.array(z.unknown()).optional(),
  profile: z.object({
    requested: z.string(),
    highestFullyVerifiedLevel: z.string().nullable(),
    blockers: z.array(z.string()),
    counts: z.record(z.string(), z.number()),
    criteria: z.array(z.unknown()),
  }).optional(),
};
const contrastOutputSchema = {
  foreground: z.string(),
  background: z.string(),
  ratio: z.number(),
  requiredRatio: z.number(),
  passes: z.boolean(),
};
const suggestionOutputSchema = {
  foreground: z.string(),
  background: z.string(),
  currentRatio: z.number(),
  requiredRatio: z.number(),
  suggestedForeground: z.string().optional(),
  suggestedBackground: z.string().optional(),
  suggestedRatio: z.number().optional(),
};
const genericOutputSchema = z.object({}).passthrough();

function auditOptions(input: {
  standard: AuditStandard;
  width: number;
  height: number;
  maxIssues: number;
  maxNodesPerIssue: number;
}, signal?: AbortSignal): AuditOptions {
  return {
    standard: input.standard,
    viewport: { width: input.width, height: input.height },
    maxIssues: input.maxIssues,
    maxNodesPerIssue: input.maxNodesPerIssue,
    signal,
  };
}

function auditText(result: AuditResult): string {
  const impactOrder = ["critical", "serious", "moderate", "minor", "unknown"];
  const impacts = impactOrder
    .filter((impact) => result.summary.byImpact[impact])
    .map((impact) => `${impact}: ${result.summary.byImpact[impact]}`)
    .join(", ");
  const topIssues = result.issues.slice(0, 8).map((issue) => {
    const node = issue.nodes[0];
    const selector = node?.target[0] ? ` at ${node.target[0]}` : "";
    const correction = node?.contrastSuggestion?.suggestedForeground
      ? ` Suggested foreground: ${node.contrastSuggestion.suggestedForeground}.`
      : "";
    return `- [${issue.impact ?? "unknown"}] ${issue.id}${selector}: ${issue.title}.${correction}`;
  });

  return [
    `Accessibility audit: ${result.target}`,
    `Standard: ${result.standard}; engine: ${result.engine}; viewport: ${result.viewport.width}×${result.viewport.height}`,
    `Found ${result.summary.violationCount} violation groups affecting ${result.summary.affectedNodeCount} nodes (${impacts || "no impact counts"}).`,
    `${result.summary.incompleteCount} checks need manual review; ${result.summary.passesCount} rule groups passed.`,
    `Profile coverage: ${result.coverage.requiredCriteriaCount} required success criteria; ${result.coverage.criteriaWithAutomatedRules} have partial automated rule mappings and ${result.coverage.criteriaRequiringManualReview} require manual evaluation.`,
    ...(result.profile
      ? [`Profile status: ${result.profile.highestFullyVerifiedLevel ? `highest fully verified level ${result.profile.highestFullyVerifiedLevel}` : "no full conformance level verified"}; ${result.profile.blockers.length} criteria remain unresolved or manual.`]
      : []),
    ...(topIssues.length ? ["Top findings:", ...topIssues] : ["No automated violations found."]),
    "Automated testing does not prove WCAG conformance. Review incomplete checks and test keyboard, focus, zoom, motion, and assistive-technology behavior.",
  ].join("\n");
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Accessibility tool error: ${message}` }],
    isError: true,
  };
}

function auditResponse(result: AuditResult) {
  return {
    content: [{ type: "text" as const, text: auditText(result) }],
    structuredContent: result as unknown as Record<string, unknown>,
  };
}

function axeRule(ruleId: string) {
  return axe.getRules().find((rule) => rule.ruleId === ruleId);
}

export function createA11yServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  }, {
    capabilities: { logging: {} },
    instructions: [
      "Use this server to audit rendered web interfaces and obtain evidence-based accessibility fixes.",
      "Treat audit tools as read-only. Never claim WCAG conformance from automated results alone.",
      "When correcting code, inspect the returned selector and DOM snippet, apply the smallest appropriate fix, then rerun the same audit.",
      "Call get_wcag_checklist for the selected AA or AAA profile; an axe mapping is partial coverage, not a completed success criterion.",
      "Require human review for incomplete checks and for keyboard, focus, screen-reader, zoom, content, motion, and cognitive usability behavior.",
    ].join(" "),
  });

  server.registerTool("audit_url", {
    title: "Audit a rendered URL",
    description: "Load a public or local web page in headless Chromium, run axe-core, and return prioritized WCAG findings, DOM evidence, computed styles, and contrast corrections. Read-only.",
    inputSchema: {
      url: z.url().describe("Absolute http:// or https:// URL to render and test."),
      ...commonAuditSchema,
    },
    outputSchema: auditOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async (input, extra) => {
    try {
      if (extra.signal.aborted) throw new Error("Audit cancelled before it started.");
      const result = await auditUrl(input.url, auditOptions(input, extra.signal));
      return auditResponse(result);
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool("audit_html", {
    title: "Audit an HTML document",
    description: "Render supplied HTML in an isolated headless browser and return WCAG findings plus evidence and suggested corrections. Use for generated UI before it is hosted. Read-only.",
    inputSchema: {
      html: z.string().min(1).max(2_000_000).describe("Complete HTML document or fragment to render and test."),
      baseUrl: z.url().optional().describe("Optional http(s) base URL used to resolve relative assets."),
      ...commonAuditSchema,
    },
    outputSchema: auditOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async (input, extra) => {
    try {
      if (extra.signal.aborted) throw new Error("Audit cancelled before it started.");
      const result = await auditHtml(input.html, { ...auditOptions(input, extra.signal), baseUrl: input.baseUrl });
      return auditResponse(result);
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool("audit_file", {
    title: "Audit a local HTML file",
    description: "Render a local .html or .htm file beneath the configured allowed root and return accessibility findings and corrections. Read-only.",
    inputSchema: {
      filePath: z.string().min(1).describe("Absolute path, or path relative to the server working directory, to an HTML file."),
      ...commonAuditSchema,
    },
    outputSchema: auditOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async (input, extra) => {
    try {
      if (extra.signal.aborted) throw new Error("Audit cancelled before it started.");
      const result = await auditFile(input.filePath, auditOptions(input, extra.signal));
      return auditResponse(result);
    } catch (error) {
      return toolError(error);
    }
  });

  if (process.env.A11Y_MCP_ENABLE_EXPERIMENTAL_TOOLS === "true") {
  server.registerTool("audit_matrix", {
    title: "Audit a target across viewports",
    description: "Run one URL, HTML document, or local HTML file across multiple named viewports and group findings by deterministic fingerprints. Read-only.",
    inputSchema: {
      url: z.url().optional().describe("Absolute http:// or https:// URL to render and test."),
      html: z.string().min(1).max(2_000_000).optional().describe("Complete HTML document or fragment to render and test."),
      filePath: z.string().min(1).optional().describe("Absolute path, or path relative to the server working directory, to an HTML file."),
      baseUrl: z.url().optional().describe("Optional http(s) base URL used only with html."),
      standard: commonAuditSchema.standard,
      viewports: z.array(viewportSchema).min(2).max(8).optional().describe("Named viewport list. Defaults to desktop and mobile."),
      maxIssues: commonAuditSchema.maxIssues,
      maxNodesPerIssue: commonAuditSchema.maxNodesPerIssue,
    },
    outputSchema: genericOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async (input, extra) => {
    try {
      if (extra.signal.aborted) throw new Error("Audit matrix cancelled before it started.");
      const targetCount = [input.url, input.html, input.filePath].filter((value) => value !== undefined).length;
      if (targetCount !== 1) throw new Error("audit_matrix requires exactly one of url, html, or filePath.");
      if (input.baseUrl && !input.html) throw new Error("baseUrl is only supported with html.");

      const target: MatrixTarget = input.url
        ? { kind: "url", url: input.url }
        : input.html
          ? { kind: "html", html: input.html, baseUrl: input.baseUrl }
          : { kind: "file", filePath: input.filePath as string };

      const result = await auditMatrix({
        target,
        standard: input.standard,
        viewports: input.viewports,
        maxIssues: input.maxIssues,
        maxNodesPerIssue: input.maxNodesPerIssue,
        signal: extra.signal,
      });
      return {
        content: [{
          type: "text",
          text: `Audit matrix: ${result.target}\nViewports: ${result.viewports.map((viewport) => viewport.name).join(", ")}\nUnique findings: ${result.aggregate.uniqueFindingCount}; occurrences: ${result.aggregate.occurrenceCount}. Automated testing is not a WCAG conformance claim.`,
        }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool("compare_audits", {
    title: "Compare accessibility audit reports",
    description: "Compare a baseline audit or matrix with a candidate audit or matrix and return new, resolved, and persisting findings plus a configurable regression gate. Read-only.",
    inputSchema: {
      baseline: z.record(z.string(), z.unknown()).describe("Baseline AuditResult or Phase 2 audit_matrix result."),
      candidate: z.record(z.string(), z.unknown()).describe("Candidate AuditResult or Phase 2 audit_matrix result."),
      failOnImpacts: z.array(z.enum(["critical", "serious", "moderate", "minor", "unknown"])).default(["critical", "serious"]).describe("New impacts that fail the regression gate."),
    },
    outputSchema: genericOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ baseline, candidate, failOnImpacts }) => {
    try {
      const result = compareAudits(
        baseline as unknown as AuditResult,
        candidate as unknown as AuditResult,
        { failOnImpacts },
      );
      return {
        content: [{
          type: "text",
          text: `Accessibility comparison: ${result.delta.newCount} new, ${result.delta.resolvedCount} resolved, ${result.delta.persistingCount} persisting. Gate ${result.gate.passed ? "passed" : "failed"}.`,
        }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool("browser_diagnostics", {
    title: "Inspect browser configuration",
    description: "Report which browser source would be used for audits without launching it. Read-only diagnostic for setup and CI.",
    inputSchema: {},
    outputSchema: genericOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async () => {
    try {
      const result = await resolveBrowserDiagnostic();
      return {
        content: [{
          type: "text",
          text: result.executablePath
            ? `Browser source: ${result.source}; executable: ${result.executablePath}; sandbox disabled: ${result.sandboxDisabled}.`
            : `Browser source: ${result.source}; no executable resolved. ${result.guidance ?? ""}`,
        }],
        structuredContent: result,
      };
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool("inspect_screenshot", {
    title: "Inspect a screenshot with optional OCR",
    description: "Capture a PNG screenshot from one URL, HTML document, or local HTML file, optionally run local OCR, and return visual evidence. Read-only.",
    inputSchema: {
      url: z.url().optional().describe("Absolute http:// or https:// URL to render and capture."),
      html: z.string().min(1).max(2_000_000).optional().describe("Complete HTML document or fragment to render and capture."),
      filePath: z.string().min(1).optional().describe("Absolute path, or path relative to the server working directory, to an HTML file."),
      baseUrl: z.url().optional().describe("Optional http(s) base URL used only with html."),
      width: commonAuditSchema.width,
      height: commonAuditSchema.height,
      fullPage: z.boolean().default(false).describe("Capture the full scrollable page instead of only the viewport."),
      runOcr: z.boolean().default(false).describe("Run local OCR using A11Y_MCP_OCR_COMMAND or tesseract if available."),
      includeImage: z.boolean().default(false).describe("Include base64 PNG bytes in structured output. Leave false for ordinary audit loops."),
    },
    outputSchema: genericOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  }, async (input, extra) => {
    try {
      if (extra.signal.aborted) throw new Error("Screenshot inspection cancelled before it started.");
      const targetCount = [input.url, input.html, input.filePath].filter((value) => value !== undefined).length;
      if (targetCount !== 1) throw new Error("inspect_screenshot requires exactly one of url, html, or filePath.");
      if (input.baseUrl && !input.html) throw new Error("baseUrl is only supported with html.");

      const target: ScreenshotTarget = input.url
        ? { kind: "url", url: input.url }
        : input.html
          ? { kind: "html", html: input.html, baseUrl: input.baseUrl }
          : { kind: "file", filePath: input.filePath as string };

      const result = await inspectScreenshot({
        target,
        viewport: { width: input.width, height: input.height },
        fullPage: input.fullPage,
        runOcr: input.runOcr,
        includeImage: input.includeImage,
      });
      const ocrLine = result.ocr.requested
        ? result.ocr.available
          ? `OCR text length: ${result.ocr.text?.length ?? 0}.`
          : `OCR unavailable: ${result.ocr.warning}`
        : "OCR was not requested.";
      return {
        content: [{
          type: "text",
          text: `Screenshot inspection: ${result.target}\nViewport: ${result.viewport.width}x${result.viewport.height}; PNG bytes: ${result.screenshot.byteLength}. ${ocrLine}`,
        }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool("inspect_design_snapshot", {
    title: "Inspect a Figma or Claude Design snapshot",
    description: "Inspect exported Figma, Claude Design, or generic design-node data for pre-implementation accessibility risks. Read-only.",
    inputSchema: {
      source: z.enum(["figma", "claude-design", "generic"]).default("generic").describe("Design surface that produced the snapshot."),
      root: designNodeSchema.describe("Exported design-node tree with optional name, type, role, text, dimensions, colors, labels, and children."),
      maxFindings: z.number().int().min(1).max(500).default(100).describe("Maximum findings returned."),
    },
    outputSchema: genericOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ source, root, maxFindings }) => {
    try {
      const result = inspectDesignSnapshot({ source, root, maxFindings });
      return {
        content: [{
          type: "text",
          text: `Design snapshot inspection: ${result.findingCount} findings across ${result.nodeCount} nodes. This is pre-implementation guidance; verify rendered output with audit_matrix.`,
        }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return toolError(error);
    }
  });
  }

  server.registerTool("check_contrast", {
    title: "Check a color pair",
    description: "Calculate the WCAG contrast ratio for foreground and background colors and determine whether the pair passes for the supplied text size and weight.",
    inputSchema: {
      foreground: z.string().describe("Foreground CSS sRGB color such as white, #767676, rgb(), hsl(), or color(srgb ...)."),
      background: z.string().describe("Background CSS sRGB color such as white, #ffffff, rgb(), hsl(), or color(srgb ...)."),
      level: z.enum(["AA", "AAA"]).default("AA"),
      fontSizePx: z.number().positive().default(16),
      fontWeight: z.number().int().min(1).max(1000).default(400),
    },
    outputSchema: contrastOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ foreground, background, level, fontSizePx, fontWeight }) => {
    try {
      const ratio = Number(contrastRatio(foreground, background).toFixed(2));
      const required = requiredContrast(level, fontSizePx, fontWeight);
      const result = { foreground, background, ratio, requiredRatio: required, passes: ratio >= required };
      return {
        content: [{ type: "text", text: `${foreground} on ${background} has a ${ratio}:1 ratio and ${result.passes ? "passes" : "fails"} ${level} (required ${required}:1).` }],
        structuredContent: result,
      };
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool("suggest_contrast_fix", {
    title: "Suggest a passing color",
    description: "Find the nearest black-or-white-directed foreground or background adjustment that reaches the selected WCAG contrast threshold. Returns a mathematical candidate, not an automatic edit.",
    inputSchema: {
      foreground: z.string().describe("Foreground CSS sRGB color such as white, #767676, rgb(), hsl(), or color(srgb ...)."),
      background: z.string().describe("Background CSS sRGB color such as white, #ffffff, rgb(), hsl(), or color(srgb ...)."),
      level: z.enum(["AA", "AAA"]).default("AA"),
      fontSizePx: z.number().positive().default(16),
      fontWeight: z.number().int().min(1).max(1000).default(400),
      adjust: z.enum(["foreground", "background", "either"]).default("foreground"),
    },
    outputSchema: suggestionOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async (input) => {
    try {
      const result = suggestContrastFix(input);
      const passes = result.currentRatio >= result.requiredRatio;
      const proposed = result.suggestedForeground
        ? `Suggested foreground: ${result.suggestedForeground} (${result.suggestedRatio}:1).`
        : result.suggestedBackground
          ? `Suggested background: ${result.suggestedBackground} (${result.suggestedRatio}:1).`
          : passes
            ? "The current pair already passes."
            : "No candidate was found for the requested adjustment.";
      return {
        content: [{ type: "text", text: `Current contrast is ${result.currentRatio}:1; required is ${result.requiredRatio}:1. ${proposed}` }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool("explain_issue", {
    title: "Explain an accessibility rule",
    description: "Return implementation-focused remediation steps and the axe rule reference for a rule ID found in an audit.",
    inputSchema: {
      ruleId: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).describe("axe rule ID such as color-contrast, button-name, or label."),
    },
    outputSchema: {
      ruleId: z.string(),
      title: z.string(),
      remediation: z.array(z.string()),
      reference: z.string(),
      verification: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ ruleId }) => {
    const rule = axeRule(ruleId);
    if (!rule) {
      return toolError(new Error(`Unknown axe rule ID: ${ruleId}. Use a rule ID returned by audit_url, audit_html, or audit_file.`));
    }

    const steps = remediationFor(ruleId);
    const result = {
      ruleId,
      title: rule.description,
      remediation: steps,
      reference: rule.helpUrl,
      verification: "Apply the smallest semantic fix, rerun the same audit, then complete the relevant manual interaction checks.",
    };
    return {
      content: [{ type: "text", text: `${ruleId}\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\nReference: ${result.reference}` }],
      structuredContent: result,
    };
  });

  server.registerTool("get_wcag_checklist", {
    title: "Get the complete WCAG requirement checklist",
    description: "Return every success criterion required by a WCAG 2.0, 2.1, or 2.2 A/AA/AAA profile, with W3C references, axe rule mappings, and explicit automated-partial versus manual coverage. Use this to plan the checks that a browser audit cannot complete.",
    inputSchema: {
      standard: z.enum(standards).default("wcag22aa"),
      principle: z.enum(["perceivable", "operable", "understandable", "robust"]).optional(),
      evaluation: z.enum(["automated-partial", "manual"]).optional(),
    },
    outputSchema: {
      standard: z.string(), version: z.string(), conformanceLevel: z.string(),
      filters: z.object({ principle: z.string().optional(), evaluation: z.string().optional() }),
      total: z.number(), automatedPartial: z.number(), manual: z.number(), criteria: z.array(z.unknown()),
      attribution: z.string(), source: z.string(), warning: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ standard, principle, evaluation }) => {
    const criteria = getWcagChecklist(standard, { principle, evaluation });
    const automatedPartial = criteria.filter((criterion) => criterion.evaluation === "automated-partial").length;
    const result = {
      standard,
      version: standardVersion(standard),
      conformanceLevel: standardLevel(standard),
      filters: { principle, evaluation },
      total: criteria.length,
      automatedPartial,
      manual: criteria.length - automatedPartial,
      criteria,
      attribution: "WCAG success criterion identifiers and titles are from W3C WCAG 2.2. Added coverage labels and test-method summaries are project annotations.",
      source: "https://www.w3.org/WAI/WCAG22/wcag.json",
      warning: "A criterion with an axe mapping is only partially automated. Conformance requires all applicable criteria at and below the selected level, plus the WCAG conformance requirements.",
    };
    return {
      content: [{
        type: "text",
        text: `${standard} means WCAG ${result.version} Level ${result.conformanceLevel}. This checklist contains ${result.total} required success criteria: ${result.automatedPartial} have at least one partial axe rule mapping and ${result.manual} require manual evaluation. Automated coverage is never a conformance claim.`,
      }],
      structuredContent: result,
    };
  });

  server.registerPrompt("accessibility-fix-loop", {
    title: "Audit, fix, and verify accessibility",
    description: "A reusable agent workflow for evidence-led accessibility correction.",
    argsSchema: {
      target: z.string().describe("URL or local HTML file to audit."),
    },
  }, async ({ target }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Audit ${target} at desktop and mobile widths. Use get_wcag_checklist for the selected AA or AAA profile. Prioritize critical and serious findings, inspect each returned selector and DOM snippet, apply the smallest semantic or token-level correction, and rerun the same audits. Do not claim WCAG conformance from automation alone. Report criteria without automated coverage and unresolved incomplete checks as manual test tasks.`,
      },
    }],
  }));

  return server;
}
