export const EVIDENCE_SCHEMA_VERSION = "2.0" as const;

export type EvidenceSource = "dom" | "computed-style" | "pixel-sample" | "ocr" | "design-node" | "interaction" | "human";
export type EvidenceQuality = "authoritative" | "derived" | "estimated";
export type EvaluationOutcome = "passed" | "failed" | "inapplicable" | "cantTell" | "untested";

export type EvidenceSubject = {
  kind: "document" | "element" | "frame" | "design-node" | "region";
  id: string;
  locator?: string[];
};

export type EvidenceReference = {
  id: string;
  source: EvidenceSource;
  quality: EvidenceQuality;
  subject: EvidenceSubject;
  capturedAt: string;
  details?: Record<string, unknown>;
};

export type CriterionEvaluation = {
  criterionId: string;
  level: "A" | "AA" | "AAA";
  outcome: EvaluationOutcome;
  automated: boolean;
  evidenceIds: string[];
  limitations: string[];
};

export type AuditRunEnvelope = {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  runId: string;
  source: EvidenceSource;
  target: string;
  standard: string;
  viewport: { width: number; height: number };
  state: "default";
  startedAt: string;
};

export function createAuditRun(input: Omit<AuditRunEnvelope, "schemaVersion"> & { runId: string }): AuditRunEnvelope {
  return { schemaVersion: EVIDENCE_SCHEMA_VERSION, ...input };
}

export function evidenceId(runId: string, ruleId: string, locator: string[]): string {
  return `${runId}:${ruleId}:${locator.join("/")}`;
}
