import { describe, expect, it } from "vitest";
import { axeTagsForStandard, htmlWithBaseUrl } from "../src/audit.js";
import { profileFromRuleResults } from "../src/wcag.js";

describe("Evidence Core v2 contracts", () => {
  it("preserves standards mode while injecting a base URL", () => {
    const html = htmlWithBaseUrl("<!doctype html><html><body>content</body></html>", "https://example.com/assets/");
    expect(html.trimStart().toLowerCase().startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<head><base href=\"https://example.com/assets/\">");
  });

  it("filters axe tags against the installed axe rule set", () => {
    const tags = axeTagsForStandard("wcag22aaa");
    expect(tags).toContain("wcag22aa");
    expect(tags).not.toContain("wcag22aaa");
    expect(tags).not.toContain("wcag21aaa");
  });

  it("keeps unresolved manual criteria from becoming a verified level", () => {
    const profile = profileFromRuleResults("wcag22aa", { violations: [], incomplete: [], passes: [] });
    expect(profile.highestFullyVerifiedLevel).toBeNull();
    expect(profile.counts.untested).toBeGreaterThan(0);
    expect(profile.blockers).toContain("2.1.1");
  });
});
