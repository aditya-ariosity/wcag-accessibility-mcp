import { describe, expect, it } from "vitest";
import { inspectDesignSnapshot } from "../src/design.js";

describe("design snapshot inspection", () => {
  it("flags pre-implementation accessibility risks in exported design nodes", () => {
    const result = inspectDesignSnapshot({
      source: "figma",
      root: {
        name: "Checkout",
        type: "FRAME",
        children: [
          {
            id: "button-1",
            name: "Icon CTA",
            type: "BUTTON",
            width: 20,
            height: 20,
          },
          {
            id: "hero-copy",
            name: "Muted headline",
            type: "TEXT",
            text: "Welcome",
            foreground: "#999999",
            background: "#ffffff",
            fontSizePx: 16,
            fontWeight: 400,
          },
          {
            id: "image-1",
            name: "Product photo",
            type: "IMAGE",
          },
        ],
      },
    });

    expect(result.schemaVersion).toBe("2.2");
    expect(result.source).toBe("figma");
    expect(result.nodeCount).toBe(4);
    expect(result.findings.map((finding) => finding.id).sort()).toEqual([
      "design-color-contrast",
      "design-image-text-alternative",
      "design-target-size",
    ]);
    expect(result.bySeverity.serious).toBe(1);
  });

  it("keeps design findings bounded", () => {
    const result = inspectDesignSnapshot({
      root: {
        name: "Many controls",
        children: Array.from({ length: 10 }, (_, index) => ({
          id: `button-${index}`,
          type: "BUTTON",
        })),
      },
      maxFindings: 3,
    });

    expect(result.findingCount).toBe(3);
  });
});
