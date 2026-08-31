import { describe, expect, it } from "vitest";
import { buildMatrixResult, compareAudits, findingFingerprint, validateMatrixViewports } from "../src/matrix.js";
import type { AuditIssue, AuditResult } from "../src/types.js";

function issue(id: string, impact: string | null, selector: string, html: string): AuditIssue {
  return {
    id,
    impact,
    title: `${id} help`,
    description: `${id} description`,
    helpUrl: `https://example.com/${id}`,
    wcagTags: ["1.4.3"],
    wcagCriteria: ["1.4.3"],
    wcagLevels: ["wcag2aa"],
    standardsTags: ["wcag2aa"],
    remediation: ["Fix it."],
    nodes: [{ target: [selector], html }],
  };
}

function audit(viewport: { width: number; height: number }, issues: AuditIssue[]): AuditResult {
  return {
    engine: "axe test",
    standard: "wcag22aa",
    testedAt: "2026-08-30T00:00:00.000Z",
    target: "https://example.com/page",
    viewport,
    summary: {
      violationCount: issues.length,
      affectedNodeCount: issues.reduce((total, item) => total + item.nodes.length, 0),
      incompleteCount: 0,
      passesCount: 10,
      byImpact: {},
    },
    coverage: {
      requiredCriteriaCount: 56,
      criteriaWithAutomatedRules: 20,
      criteriaRequiringManualReview: 36,
      catalogSource: "test",
    },
    issues,
    incomplete: [],
    notes: [],
  };
}

describe("Phase 2 matrix helpers", () => {
  it("creates stable fingerprints without volatile audit fields", () => {
    const first = issue("color-contrast", "serious", ".card", '<p id="first" data-test="1">Text</p>');
    const second = issue("color-contrast", "serious", ".card", '<p id="second" data-test="2">Text</p>');
    expect(findingFingerprint(first, first.nodes[0], "https://example.com/page")).toBe(
      findingFingerprint(second, second.nodes[0], "https://example.com/page"),
    );
  });

  it("groups findings by fingerprint across viewports without double-counting unique issues", () => {
    const desktopIssue = issue("color-contrast", "serious", ".shared", "<p>Low contrast</p>");
    const mobileIssue = issue("color-contrast", "serious", ".shared", "<p>Low contrast</p>");
    const mobileOnly = issue("button-name", "critical", ".menu", "<button></button>");

    const matrix = buildMatrixResult(
      "https://example.com/page",
      "wcag22aa",
      [
        { name: "desktop", width: 1440, height: 900 },
        { name: "mobile", width: 390, height: 844 },
      ],
      [
        audit({ width: 1440, height: 900 }, [desktopIssue]),
        audit({ width: 390, height: 844 }, [mobileIssue, mobileOnly]),
      ],
    );

    expect(matrix.schemaVersion).toBe("2.1");
    expect(matrix.aggregate.uniqueFindingCount).toBe(2);
    expect(matrix.aggregate.occurrenceCount).toBe(3);
    expect(matrix.findings.find((finding) => finding.ruleId === "color-contrast")?.affectedViewports).toEqual([
      "desktop",
      "mobile",
    ]);
    expect(matrix.uniqueToViewport.find((entry) => entry.viewport === "mobile")?.fingerprints).toHaveLength(1);
  });

  it("compares reports and only fails the default gate on new critical or serious findings", () => {
    const baseline = buildMatrixResult(
      "https://example.com/page",
      "wcag22aa",
      [{ name: "desktop", width: 1440, height: 900 }],
      [audit({ width: 1440, height: 900 }, [issue("label", "moderate", "input", "<input>")])],
    );
    const candidate = buildMatrixResult(
      "https://example.com/page",
      "wcag22aa",
      [{ name: "desktop", width: 1440, height: 900 }],
      [audit({ width: 1440, height: 900 }, [
        issue("label", "moderate", "input", "<input>"),
        issue("button-name", "critical", "button", "<button></button>"),
      ])],
    );

    const report = compareAudits(baseline, candidate);
    expect(report.delta).toMatchObject({ newCount: 1, resolvedCount: 0, persistingCount: 1 });
    expect(report.gate.passed).toBe(false);
    expect(report.gate.failingNewFindings[0]?.ruleId).toBe("button-name");
  });

  it("validates viewport bounds and names", () => {
    expect(() => validateMatrixViewports([{ name: "desktop", width: 1440, height: 900 }])).toThrow(/between 2 and 8/);
    expect(() => validateMatrixViewports([
      { name: "desktop", width: 1440, height: 900 },
      { name: "desktop", width: 1024, height: 768 },
    ])).toThrow(/duplicate/i);
  });
});
