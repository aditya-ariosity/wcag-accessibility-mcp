import { createHash } from "node:crypto";
import { auditFile, auditHtml, auditUrl, type AuditOptions } from "./audit.js";
import type { AuditIssue, AuditNode, AuditResult, AuditStandard, Viewport } from "./types.js";
import { getWcagChecklist } from "./wcag.js";

export const PHASE2_SCHEMA_VERSION = "2.1";
export const FINGERPRINT_VERSION = "1";

export type NamedViewport = Viewport & { name: string };

export type MatrixTarget =
  | { kind: "url"; url: string }
  | { kind: "html"; html: string; baseUrl?: string }
  | { kind: "file"; filePath: string };

export type AuditMatrixOptions = {
  target: MatrixTarget;
  standard?: AuditStandard;
  viewports?: NamedViewport[];
  maxIssues?: number;
  maxNodesPerIssue?: number;
  signal?: AbortSignal;
};

export type FindingOccurrence = {
  viewport: string;
  target: string[];
  html: string;
};

export type FindingGroup = {
  fingerprint: string;
  fingerprintVersion: string;
  ruleId: string;
  impact: string | null;
  title: string;
  description: string;
  helpUrl: string;
  wcagCriteria: string[];
  wcagLevels: string[];
  standardsTags: string[];
  remediation: string[];
  affectedViewports: string[];
  occurrenceCount: number;
  occurrences: FindingOccurrence[];
  rootCauseCandidates?: Array<{ kind: "shared-selector" | "repeated-pattern"; confidence: number; evidence: string }>;
};

export type MatrixResult = {
  schemaVersion: string;
  fingerprintVersion: string;
  target: string;
  standard: AuditStandard;
  viewports: NamedViewport[];
  results: AuditResult[];
  aggregate: {
    viewportCount: number;
    uniqueFindingCount: number;
    occurrenceCount: number;
    byImpact: Record<string, number>;
    incompleteCount: number;
    passesCount: number;
  };
  findings: FindingGroup[];
  uniqueToViewport: Array<{ viewport: string; fingerprints: string[] }>;
  coverage: ReturnType<typeof getWcagChecklist>;
  notes: string[];
};

export type CompareGateOptions = {
  failOnImpacts?: string[];
};

export type CompareReport = {
  schemaVersion: string;
  fingerprintVersion: string;
  baseline: {
    target: string;
    uniqueFindingCount: number;
    occurrenceCount: number;
  };
  candidate: {
    target: string;
    uniqueFindingCount: number;
    occurrenceCount: number;
  };
  delta: {
    uniqueFindingCount: number;
    occurrenceCount: number;
    newCount: number;
    resolvedCount: number;
    persistingCount: number;
  };
  new: FindingGroup[];
  resolved: FindingGroup[];
  persisting: Array<{
    fingerprint: string;
    baselineImpact: string | null;
    candidateImpact: string | null;
    impactChanged: boolean;
    baselineViewports: string[];
    candidateViewports: string[];
    viewportChanged: boolean;
  }>;
  gate: {
    passed: boolean;
    failOnImpacts: string[];
    failingNewFindings: FindingGroup[];
    statement: string;
  };
};

const DEFAULT_VIEWPORTS: NamedViewport[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeHtml(html: string): string {
  return normalizeText(html)
    .replace(/\s(?:id|data-[\w-]+)="[^"]*"/g, "")
    .replace(/\s(?:id|data-[\w-]+)='[^']*'/g, "")
    .slice(0, 500);
}

function normalizeTargetIdentity(target: string): string {
  try {
    const url = new URL(target);
    return `${url.protocol}//${url.host}${url.pathname}${url.search}`;
  } catch {
    return normalizeText(target);
  }
}

function hashFingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 24);
}

export function findingFingerprint(issue: AuditIssue, node: AuditNode | undefined, target: string): string {
  const normalizedTarget = node?.target.join(" ") ?? normalizeTargetIdentity(target);
  return hashFingerprint([
    FINGERPRINT_VERSION,
    issue.id,
    normalizeTargetIdentity(target),
    normalizeText(normalizedTarget),
    normalizeHtml(node?.html ?? issue.title),
  ]);
}

function normalizeViewport(viewport: NamedViewport): NamedViewport {
  return {
    name: normalizeText(viewport.name).replace(/[^a-z0-9_-]/g, "-").slice(0, 40),
    width: viewport.width,
    height: viewport.height,
  };
}

export function validateMatrixViewports(viewports: NamedViewport[] | undefined): NamedViewport[] {
  const normalized = (viewports?.length ? viewports : DEFAULT_VIEWPORTS).map(normalizeViewport);
  if (normalized.length < 2 || normalized.length > 8) {
    throw new Error("audit_matrix requires between 2 and 8 named viewports.");
  }
  const names = new Set<string>();
  for (const viewport of normalized) {
    if (!viewport.name) throw new Error("Each viewport must have a non-empty name.");
    if (names.has(viewport.name)) throw new Error(`Duplicate viewport name: ${viewport.name}`);
    names.add(viewport.name);
  }
  return normalized;
}

function groupFindings(results: AuditResult[], viewportNames: string[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();

  results.forEach((result, resultIndex) => {
    const viewport = viewportNames[resultIndex] ?? `${result.viewport.width}x${result.viewport.height}`;
    for (const issue of result.issues) {
      const nodes = issue.nodes.length ? issue.nodes : [undefined];
      for (const node of nodes) {
        const fingerprint = findingFingerprint(issue, node, result.target);
        const existing = groups.get(fingerprint);
        const occurrence = {
          viewport,
          target: node?.target ?? [],
          html: node?.html ?? "",
        };
        if (existing) {
          existing.occurrenceCount += 1;
          existing.occurrences.push(occurrence);
          if (!existing.affectedViewports.includes(viewport)) existing.affectedViewports.push(viewport);
          continue;
        }

        groups.set(fingerprint, {
          fingerprint,
          fingerprintVersion: FINGERPRINT_VERSION,
          ruleId: issue.id,
          impact: issue.impact,
          title: issue.title,
          description: issue.description,
          helpUrl: issue.helpUrl,
          wcagCriteria: issue.wcagCriteria,
          wcagLevels: issue.wcagLevels,
          standardsTags: issue.standardsTags,
          remediation: issue.remediation,
          affectedViewports: [viewport],
          occurrenceCount: 1,
          occurrences: [occurrence],
        });
      }
    }
  });

  return [...groups.values()].map((group) => ({
    ...group,
    rootCauseCandidates: group.occurrenceCount > 1
      ? [{ kind: "repeated-pattern" as const, confidence: Math.min(0.95, 0.5 + group.occurrenceCount * 0.1), evidence: `Same rule and normalized DOM signature observed ${group.occurrenceCount} times across ${group.affectedViewports.length} viewport(s).` }]
      : undefined,
  })).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export function buildMatrixResult(target: string, standard: AuditStandard, viewports: NamedViewport[], results: AuditResult[]): MatrixResult {
  const findings = groupFindings(results, viewports.map((viewport) => viewport.name));
  const byImpact = findings.reduce<Record<string, number>>((counts, finding) => {
    const impact = finding.impact ?? "unknown";
    counts[impact] = (counts[impact] ?? 0) + 1;
    return counts;
  }, {});

  return {
    schemaVersion: PHASE2_SCHEMA_VERSION,
    fingerprintVersion: FINGERPRINT_VERSION,
    target,
    standard,
    viewports,
    results,
    aggregate: {
      viewportCount: viewports.length,
      uniqueFindingCount: findings.length,
      occurrenceCount: findings.reduce((total, finding) => total + finding.occurrenceCount, 0),
      byImpact,
      incompleteCount: results.reduce((total, result) => total + result.summary.incompleteCount, 0),
      passesCount: results.reduce((total, result) => total + result.summary.passesCount, 0),
    },
    findings,
    uniqueToViewport: viewports.map((viewport) => ({
      viewport: viewport.name,
      fingerprints: findings
        .filter((finding) => finding.affectedViewports.length === 1 && finding.affectedViewports[0] === viewport.name)
        .map((finding) => finding.fingerprint),
    })),
    coverage: getWcagChecklist(standard),
    notes: [
      "Unique findings are grouped by deterministic fingerprints; occurrence counts show repeated evidence across viewports.",
      "Automated testing does not prove WCAG conformance. Manual keyboard, focus, screen-reader, zoom, motion, and content checks remain required.",
    ],
  };
}

export async function auditMatrix(options: AuditMatrixOptions): Promise<MatrixResult> {
  const standard = options.standard ?? "wcag22aa";
  const viewports = validateMatrixViewports(options.viewports);
  const common: Omit<AuditOptions, "viewport"> = {
    standard,
    maxIssues: options.maxIssues,
    maxNodesPerIssue: options.maxNodesPerIssue,
    signal: options.signal,
  };

  const results: AuditResult[] = [];
  for (const viewport of viewports) {
    const auditOptions = { ...common, viewport };
    if (options.target.kind === "url") {
      results.push(await auditUrl(options.target.url, auditOptions));
    } else if (options.target.kind === "html") {
      results.push(await auditHtml(options.target.html, { ...auditOptions, baseUrl: options.target.baseUrl }));
    } else {
      results.push(await auditFile(options.target.filePath, auditOptions));
    }
  }

  const target = results[0]?.target ?? (options.target.kind === "file" ? options.target.filePath : options.target.kind === "url" ? options.target.url : options.target.baseUrl ?? "inline HTML");
  return buildMatrixResult(target, standard, viewports, results);
}

function asMatrix(value: MatrixResult | AuditResult): MatrixResult {
  if ((value as MatrixResult).schemaVersion === PHASE2_SCHEMA_VERSION && Array.isArray((value as MatrixResult).findings)) {
    return value as MatrixResult;
  }
  const audit = value as AuditResult;
  if (!audit.summary || !Array.isArray(audit.issues) || !audit.viewport) {
    throw new Error("compare_audits expects AuditResult or Phase 2 matrix objects.");
  }
  const viewport = { name: `${audit.viewport.width}x${audit.viewport.height}`, ...audit.viewport };
  return buildMatrixResult(audit.target, audit.standard, [viewport], [audit]);
}

export function compareAudits(baselineInput: MatrixResult | AuditResult, candidateInput: MatrixResult | AuditResult, gateOptions: CompareGateOptions = {}): CompareReport {
  const baseline = asMatrix(baselineInput);
  const candidate = asMatrix(candidateInput);
  if (baseline.fingerprintVersion !== candidate.fingerprintVersion) {
    throw new Error(`Incompatible fingerprint versions: ${baseline.fingerprintVersion} and ${candidate.fingerprintVersion}.`);
  }

  const baselineMap = new Map(baseline.findings.map((finding) => [finding.fingerprint, finding]));
  const candidateMap = new Map(candidate.findings.map((finding) => [finding.fingerprint, finding]));
  const newFindings = candidate.findings.filter((finding) => !baselineMap.has(finding.fingerprint));
  const resolved = baseline.findings.filter((finding) => !candidateMap.has(finding.fingerprint));
  const persisting = candidate.findings
    .filter((finding) => baselineMap.has(finding.fingerprint))
    .map((finding) => {
      const base = baselineMap.get(finding.fingerprint);
      return {
        fingerprint: finding.fingerprint,
        baselineImpact: base?.impact ?? null,
        candidateImpact: finding.impact,
        impactChanged: (base?.impact ?? null) !== finding.impact,
        baselineViewports: base?.affectedViewports ?? [],
        candidateViewports: finding.affectedViewports,
        viewportChanged: (base?.affectedViewports ?? []).join("|") !== finding.affectedViewports.join("|"),
      };
    });
  const failOnImpacts = gateOptions.failOnImpacts ?? ["critical", "serious"];
  const failingNewFindings = newFindings.filter((finding) => failOnImpacts.includes(finding.impact ?? "unknown"));

  return {
    schemaVersion: PHASE2_SCHEMA_VERSION,
    fingerprintVersion: baseline.fingerprintVersion,
    baseline: {
      target: baseline.target,
      uniqueFindingCount: baseline.aggregate.uniqueFindingCount,
      occurrenceCount: baseline.aggregate.occurrenceCount,
    },
    candidate: {
      target: candidate.target,
      uniqueFindingCount: candidate.aggregate.uniqueFindingCount,
      occurrenceCount: candidate.aggregate.occurrenceCount,
    },
    delta: {
      uniqueFindingCount: candidate.aggregate.uniqueFindingCount - baseline.aggregate.uniqueFindingCount,
      occurrenceCount: candidate.aggregate.occurrenceCount - baseline.aggregate.occurrenceCount,
      newCount: newFindings.length,
      resolvedCount: resolved.length,
      persistingCount: persisting.length,
    },
    new: newFindings,
    resolved,
    persisting,
    gate: {
      passed: failingNewFindings.length === 0,
      failOnImpacts,
      failingNewFindings,
      statement: "The regression gate is not a WCAG conformance claim; it only evaluates configured changes in automated findings.",
    },
  };
}
