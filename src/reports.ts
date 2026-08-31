import type { AuditResult } from "./types.js";
import type { CompareReport, MatrixResult } from "./matrix.js";

export function toMarkdownReport(report: AuditResult | MatrixResult | CompareReport): string {
  const value = report as MatrixResult;
  if ("gate" in report) {
    return [`# Accessibility comparison`, ``, `- New findings: ${report.delta.newCount}`, `- Resolved findings: ${report.delta.resolvedCount}`, `- Persisting findings: ${report.delta.persistingCount}`, `- Regression gate: ${report.gate.passed ? "PASS" : "FAIL"}`, ``, report.gate.statement].join("\n");
  }
  if ("findings" in report) {
    return [`# Accessibility matrix`, ``, `- Target: ${value.target}`, `- Standard: ${value.standard}`, `- Viewports: ${value.viewports.map((v) => v.name).join(", ")}`, `- Unique findings: ${value.aggregate.uniqueFindingCount}`, `- Occurrences: ${value.aggregate.occurrenceCount}`, ``, ...value.findings.map((f) => `- **${f.impact ?? "unknown"}** ${f.title} (${f.affectedViewports.join(", ")})`)].join("\n");
  }
  return [`# Accessibility audit`, ``, `- Target: ${report.target}`, `- Standard: ${report.standard}`, `- Violations: ${report.summary.violationCount}`, `- Incomplete: ${report.summary.incompleteCount}`, `- Profile status: ${report.profile?.highestFullyVerifiedLevel ?? "unverified"}`, ``, ...report.issues.map((issue) => `- **${issue.impact ?? "unknown"}** ${issue.title} (${issue.nodes.length} nodes)`)].join("\n");
}

export function toSarifReport(report: AuditResult | MatrixResult): Record<string, unknown> {
  const audits = "results" in report ? report.results : [report];
  const results = audits.flatMap((audit) => audit.issues.flatMap((issue) => issue.nodes.map((node) => ({
    ruleId: issue.id,
    level: issue.impact === "critical" || issue.impact === "serious" ? "error" : issue.impact === "moderate" ? "warning" : "note",
    message: { text: `${issue.title}: ${node.failureSummary ?? issue.description}` },
    locations: [{ physicalLocation: { artifactLocation: { uri: audit.target }, region: node.context?.boundingBox ? { startLine: 1, startColumn: 1 } : undefined } }],
    helpUri: issue.helpUrl,
  }))));
  return { version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json", runs: [{ tool: { driver: { name: "wcag-accessibility-mcp", informationUri: "https://github.com/aditya-ariosity/wcag-accessibility-mcp" } }, results }] };
}
