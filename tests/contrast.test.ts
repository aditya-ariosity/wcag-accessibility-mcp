import { describe, expect, it } from "vitest";
import { contrastRatio, requiredContrast, suggestContrastFix } from "../src/contrast.js";

describe("contrast utilities", () => {
  it("calculates the canonical black-on-white ratio", () => {
    expect(contrastRatio("#000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("uses WCAG large-text thresholds", () => {
    expect(requiredContrast("AA", 16, 400)).toBe(4.5);
    expect(requiredContrast("AA", 24, 400)).toBe(3);
    expect(requiredContrast("AAA", 18.66, 700)).toBe(4.5);
  });

  it("composites a translucent foreground over an opaque background", () => {
    expect(contrastRatio("rgba(0, 0, 0, 0.5)", "#fff")).toBeCloseTo(3.95, 1);
  });

  it("rejects a translucent background without its underlying color", () => {
    expect(() => contrastRatio("#000", "rgba(255,255,255,0.5)")).toThrow(/background must be opaque/i);
  });

  it("suggests a passing AA foreground for a failing color pair", () => {
    const result = suggestContrastFix({
      foreground: "#999999",
      background: "#ffffff",
      level: "AA",
      fontSizePx: 16,
      fontWeight: 400,
    });
    expect(result.currentRatio).toBeLessThan(4.5);
    expect(result.suggestedForeground).toBeDefined();
    expect(result.suggestedRatio).toBeGreaterThanOrEqual(4.5);
  });

  it("does not propose a change when the pair already passes", () => {
    const result = suggestContrastFix({ foreground: "#111", background: "#fff" });
    expect(result.currentRatio).toBeGreaterThanOrEqual(result.requiredRatio);
    expect(result.suggestedForeground).toBeUndefined();
    expect(result.suggestedBackground).toBeUndefined();
  });
});
