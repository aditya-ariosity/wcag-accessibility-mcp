import { contrastRatio, requiredContrast } from "./contrast.js";

export type DesignSource = "figma" | "claude-design" | "generic";

export type DesignNode = {
  id?: string;
  name?: string;
  type?: string;
  role?: string;
  text?: string;
  visible?: boolean;
  width?: number;
  height?: number;
  foreground?: string;
  background?: string;
  fontSizePx?: number;
  fontWeight?: number;
  ariaLabel?: string;
  alt?: string;
  children?: DesignNode[];
};

export type DesignInspectionFinding = {
  id: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  title: string;
  nodePath: string;
  nodeId?: string;
  evidence: Record<string, unknown>;
  recommendation: string;
};

export type DesignInspectionResult = {
  schemaVersion: "2.2";
  source: DesignSource;
  nodeCount: number;
  findingCount: number;
  bySeverity: Record<string, number>;
  findings: DesignInspectionFinding[];
  notes: string[];
};

function nodeLabel(node: DesignNode, index: number): string {
  return node.name || node.id || node.type || `node-${index}`;
}

function isInteractive(node: DesignNode): boolean {
  const type = `${node.type ?? ""} ${node.role ?? ""} ${node.name ?? ""}`.toLowerCase();
  return /\b(button|link|input|checkbox|radio|tab|switch|menuitem|select|cta)\b/.test(type);
}

function isImageLike(node: DesignNode): boolean {
  const type = `${node.type ?? ""} ${node.role ?? ""} ${node.name ?? ""}`.toLowerCase();
  return /\b(image|img|photo|picture|icon|illustration|media)\b/.test(type);
}

function accessibleName(node: DesignNode): string | undefined {
  return [node.ariaLabel, node.alt, node.text, node.name].find((value) => value?.trim());
}

function pushFinding(findings: DesignInspectionFinding[], finding: DesignInspectionFinding, maxFindings: number): void {
  if (findings.length < maxFindings) findings.push(finding);
}

function inspectNode(
  node: DesignNode,
  path: string,
  findings: DesignInspectionFinding[],
  maxFindings: number,
): number {
  if (node.visible === false) return 0;
  let count = 1;

  if (isInteractive(node) && !accessibleName(node)) {
    pushFinding(findings, {
      id: "design-interactive-name",
      severity: "serious",
      title: "Interactive element may not have an accessible name",
      nodePath: path,
      nodeId: node.id,
      evidence: { type: node.type, role: node.role, name: node.name },
      recommendation: "Provide a visible label or explicit accessible name before implementation.",
    }, maxFindings);
  }

  if (isInteractive(node) && typeof node.width === "number" && typeof node.height === "number" && (node.width < 24 || node.height < 24)) {
    pushFinding(findings, {
      id: "design-target-size",
      severity: "moderate",
      title: "Interactive target appears smaller than WCAG target-size guidance",
      nodePath: path,
      nodeId: node.id,
      evidence: { width: node.width, height: node.height },
      recommendation: "Increase the hit area or ensure an equivalent larger target is provided in implementation.",
    }, maxFindings);
  }

  if (!isInteractive(node) && isImageLike(node) && !node.alt && !node.ariaLabel && !node.text) {
    pushFinding(findings, {
      id: "design-image-text-alternative",
      severity: "moderate",
      title: "Image-like node has no text alternative in the design data",
      nodePath: path,
      nodeId: node.id,
      evidence: { type: node.type, name: node.name },
      recommendation: "Mark decorative images as decorative in handoff, or provide alt text for meaningful images.",
    }, maxFindings);
  }

  if (node.foreground && node.background) {
    try {
      const ratio = Number(contrastRatio(node.foreground, node.background).toFixed(2));
      const required = requiredContrast("AA", node.fontSizePx ?? 16, node.fontWeight ?? 400);
      if (ratio < required) {
        pushFinding(findings, {
          id: "design-color-contrast",
          severity: "serious",
          title: "Design color pair fails WCAG AA contrast math",
          nodePath: path,
          nodeId: node.id,
          evidence: {
            foreground: node.foreground,
            background: node.background,
            ratio,
            requiredRatio: required,
            fontSizePx: node.fontSizePx,
            fontWeight: node.fontWeight,
          },
          recommendation: "Adjust foreground/background tokens and verify the rendered implementation with audit_url, audit_html, or audit_matrix.",
        }, maxFindings);
      }
    } catch {
      pushFinding(findings, {
        id: "design-color-unparseable",
        severity: "minor",
        title: "Design color pair could not be parsed",
        nodePath: path,
        nodeId: node.id,
        evidence: { foreground: node.foreground, background: node.background },
        recommendation: "Normalize design colors to CSS-compatible sRGB values before contrast verification.",
      }, maxFindings);
    }
  }

  node.children?.forEach((child, index) => {
    count += inspectNode(child, `${path} / ${nodeLabel(child, index)}`, findings, maxFindings);
  });
  return count;
}

export function inspectDesignSnapshot(input: {
  source?: DesignSource;
  root: DesignNode;
  maxFindings?: number;
}): DesignInspectionResult {
  const maxFindings = input.maxFindings ?? 100;
  const findings: DesignInspectionFinding[] = [];
  const nodeCount = inspectNode(input.root, nodeLabel(input.root, 0), findings, maxFindings);
  const bySeverity = findings.reduce<Record<string, number>>((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    return counts;
  }, {});

  return {
    schemaVersion: "2.2",
    source: input.source ?? "generic",
    nodeCount,
    findingCount: findings.length,
    bySeverity,
    findings,
    notes: [
      "Design-surface inspection is pre-implementation guidance. It does not prove rendered accessibility because final HTML semantics, focus order, keyboard behavior, and browser-composited colors are only available after implementation.",
      "Use audit_matrix on the rendered output before treating the design or generated UI as ready.",
    ],
  };
}
