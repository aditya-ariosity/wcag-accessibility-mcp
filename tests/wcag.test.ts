import { describe, expect, it } from "vitest";
import { coverageForStandard, getWcagChecklist, profileFromRuleResults } from "../src/wcag.js";

describe("WCAG catalog", () => {
  it.each([
    ["wcag2aaa", 61],
    ["wcag21aaa", 78],
    ["wcag22aaa", 86],
  ] as const)("contains the complete %s criterion set", (standard, expected) => {
    expect(getWcagChecklist(standard)).toHaveLength(expected);
  });

  it("includes A and AA criteria in the WCAG 2.2 AA conformance profile", () => {
    const criteria = getWcagChecklist("wcag22aa");
    expect(criteria).toHaveLength(55);
    expect(new Set(criteria.map((criterion) => criterion.level))).toEqual(new Set(["A", "AA"]));
  });

  it("maps enhanced contrast to an axe rule without calling the criterion fully automated", () => {
    const enhancedContrast = getWcagChecklist("wcag22aaa").find((criterion) => criterion.id === "1.4.6");
    expect(enhancedContrast?.axeRuleIds).toContain("color-contrast-enhanced");
    expect(enhancedContrast?.evaluation).toBe("automated-partial");
  });

  it("keeps manual criteria visible in coverage", () => {
    const coverage = coverageForStandard("wcag22aaa");
    expect(coverage.requiredCriteriaCount).toBe(86);
    expect(coverage.criteriaRequiringManualReview).toBeGreaterThan(0);
  });

  it("models stricter alternatives without pretending every criterion has an AAA rung", () => {
    const contrast = getWcagChecklist("wcag22aaa").find((criterion) => criterion.id === "1.4.3");
    const semantics = getWcagChecklist("wcag22aaa").find((criterion) => criterion.id === "4.1.2");
    expect(contrast?.relatedCriteria).toContainEqual({ id: "1.4.6", relationship: "stricter-alternative" });
    expect(semantics?.relatedCriteria).toEqual([]);
  });

  it("does not mark a profile fully verified while manual criteria are unresolved", () => {
    const profile = profileFromRuleResults("wcag22aa", { violations: [], incomplete: [], passes: [] });
    expect(profile.highestFullyVerifiedLevel).toBeNull();
    expect(profile.counts.untested).toBeGreaterThan(0);
  });
});
