export type AuditStandard =
  | "wcag2a"
  | "wcag2aa"
  | "wcag2aaa"
  | "wcag21aa"
  | "wcag21aaa"
  | "wcag22aa"
  | "wcag22aaa"
  | "best-practice";

export type Viewport = {
  width: number;
  height: number;
};

export type ElementContext = {
  text?: string;
  color?: string;
  backgroundColor?: string;
  fontSizePx?: number;
  fontWeight?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type ContrastSuggestion = {
  foreground: string;
  background: string;
  currentRatio: number;
  requiredRatio: number;
  suggestedForeground?: string;
  suggestedBackground?: string;
  suggestedRatio?: number;
};

export type AuditNode = {
  target: string[];
  html: string;
  failureSummary?: string;
  context?: ElementContext;
  contrastSuggestion?: ContrastSuggestion;
};

export type AuditIssue = {
  id: string;
  impact: string | null;
  title: string;
  description: string;
  helpUrl: string;
  /**
   * WCAG success criteria only, for example "1.4.3".
   */
  wcagTags: string[];
  wcagCriteria: string[];
  wcagLevels: string[];
  standardsTags: string[];
  remediation: string[];
  nodes: AuditNode[];
};

export type AuditSummary = {
  violationCount: number;
  affectedNodeCount: number;
  incompleteCount: number;
  passesCount: number;
  byImpact: Record<string, number>;
};

export type AuditResult = {
  engine: string;
  standard: AuditStandard;
  testedAt: string;
  target: string;
  viewport: Viewport;
  summary: AuditSummary;
  coverage: {
    requiredCriteriaCount: number;
    criteriaWithAutomatedRules: number;
    criteriaRequiringManualReview: number;
    catalogSource: string;
  };
  issues: AuditIssue[];
  incomplete: Array<{
    id: string;
    impact: string | null;
    title: string;
    description: string;
    helpUrl: string;
    affectedNodeCount: number;
  }>;
  notes: string[];
};
