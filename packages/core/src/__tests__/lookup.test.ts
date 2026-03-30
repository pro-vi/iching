import { describe, test, expect } from "bun:test";
import { BINARY_TO_KW } from "../identify/lookup.js";
import { GUA } from "../data/gua.js";

describe("BINARY_TO_KW", () => {
  test("has exactly 64 entries", () => {
    expect(BINARY_TO_KW).toHaveLength(64);
  });

  test("all values are 1-64", () => {
    for (let i = 0; i < 64; i++) {
      expect(BINARY_TO_KW[i]).toBeGreaterThanOrEqual(1);
      expect(BINARY_TO_KW[i]).toBeLessThanOrEqual(64);
    }
  });

  test("all 64 KW numbers appear exactly once", () => {
    const seen = new Set(BINARY_TO_KW);
    expect(seen.size).toBe(64);
    for (let kw = 1; kw <= 64; kw++) {
      expect(seen.has(kw)).toBe(true);
    }
  });

  test("GUA[kw-1].l matches binary encoding for all 64", () => {
    for (let kw = 1; kw <= 64; kw++) {
      const g = GUA[kw - 1];
      const lower = g.l[0] + g.l[1] * 2 + g.l[2] * 4;
      const upper = g.l[3] + g.l[4] * 2 + g.l[5] * 4;
      const index = lower + upper * 8;
      expect(BINARY_TO_KW[index]).toBe(kw);
    }
  });
});

describe("GUA", () => {
  test("has exactly 64 entries", () => {
    expect(GUA).toHaveLength(64);
  });

  test("all entries have required fields", () => {
    for (let i = 0; i < 64; i++) {
      const g = GUA[i];
      expect(typeof g.u).toBe("string");
      expect(typeof g.n).toBe("string");
      expect(typeof g.p).toBe("string");
      expect(g.l).toHaveLength(6);
      expect(typeof g.dx).toBe("string");
      expect(typeof g.tu).toBe("string");
      expect(typeof g.en).toBe("string");
      expect(typeof g.te).toBe("string");
      expect(typeof g.w).toBe("string");

      // Lines are all 0 or 1
      for (const v of g.l) {
        expect(v === 0 || v === 1).toBe(true);
      }
    }
  });
});
