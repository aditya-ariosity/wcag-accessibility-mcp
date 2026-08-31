import { describe, expect, it } from "vitest";
import { classifyDirection } from "../src/direction.js";

describe("direction evidence", () => {
  it("classifies explicit RTL and mixed declarations", () => {
    expect(classifyDirection(["rtl", null])).toBe("rtl");
    expect(classifyDirection(["ltr", "rtl"])).toBe("mixed");
    expect(classifyDirection([undefined, "auto"])).toBe("unknown");
  });
});
