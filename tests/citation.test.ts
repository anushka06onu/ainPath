import { describe, expect, it } from "vitest";
import { normForMatch } from "@/lib/extract";

describe("normForMatch", () => {
  it("collapses whitespace and case", () => {
    expect(normForMatch("  Hello   World  ")).toBe(normForMatch("hello world"));
  });

  it("normalises Bengali digits to ASCII", () => {
    expect(normForMatch("৩০ দিন")).toContain("30");
  });

  it("rejects mismatched authority quotes", () => {
    const passage = "state their terms clearly to the buyer, including delivery terms and timeframes";
    const bad = "this quote does not appear in the passage at all";
    expect(normForMatch(passage).includes(normForMatch(bad))).toBe(false);
    expect(normForMatch(passage).includes(normForMatch("delivery terms and timeframes"))).toBe(true);
  });
});
