import { describe, expect, it } from "vitest";
import { remediationFor } from "../src/remediation.js";

describe("remediation guidance", () => {
  it("returns targeted contrast advice", () => {
    expect(remediationFor("color-contrast").join(" ")).toMatch(/design-token/i);
  });

  it("returns safe generic ARIA advice", () => {
    expect(remediationFor("aria-valid-attr").join(" ")).toMatch(/native HTML/i);
  });
});
