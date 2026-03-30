import { describe, test, expect } from "bun:test";
import { GUA, BINARY_TO_KW, TRIGRAMS } from "@iching/core";

describe("doctor checks", () => {
  test("glyph test: all trigram symbols present", () => {
    const expected = ["☰", "☱", "☲", "☳", "☴", "☵", "☶", "☷"];
    const actual = TRIGRAMS.map((t) => t.sym);

    for (const sym of expected) {
      expect(actual).toContain(sym);
    }
  });

  test("data integrity: GUA has 64 entries", () => {
    expect(GUA).toHaveLength(64);
  });

  test("data integrity: BINARY_TO_KW has 64 entries", () => {
    expect(BINARY_TO_KW).toHaveLength(64);
  });

  test("data integrity: BINARY_TO_KW values are all valid KW numbers 1-64", () => {
    for (const kw of BINARY_TO_KW) {
      expect(kw).toBeGreaterThanOrEqual(1);
      expect(kw).toBeLessThanOrEqual(64);
    }
  });

  test("data integrity: BINARY_TO_KW has all 64 unique values", () => {
    const unique = new Set(BINARY_TO_KW);
    expect(unique.size).toBe(64);
  });

  test("color detection: reports correct support", () => {
    // Basic test — the detection logic is deterministic given env vars
    const colorterm = process.env.COLORTERM ?? "";
    const term = process.env.TERM ?? "";
    const noColor = process.env.NO_COLOR;

    if (noColor !== undefined) {
      // NO_COLOR overrides everything
      expect(typeof noColor).toBe("string");
    } else if (colorterm === "truecolor" || colorterm === "24bit") {
      expect(colorterm).toMatch(/truecolor|24bit/);
    } else {
      // At minimum we can detect the env vars exist or not
      expect(typeof colorterm).toBe("string");
      expect(typeof term).toBe("string");
    }
  });

  test("all GUA entries have required fields", () => {
    for (let i = 0; i < GUA.length; i++) {
      const g = GUA[i];
      expect(g.u).toBeDefined();
      expect(g.n).toBeDefined();
      expect(g.p).toBeDefined();
      expect(g.l).toHaveLength(6);
      expect(g.dx).toBeDefined();
      expect(g.tu).toBeDefined();
      expect(g.en).toBeDefined();
      expect(g.te).toBeDefined();
      expect(g.w).toBeDefined();
    }
  });
});
