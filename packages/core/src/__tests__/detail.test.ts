import { describe, test, expect } from "bun:test";
import { buildHexagramDetail } from "../detail.js";

describe("buildHexagramDetail", () => {
  test("returns correct detail for hexagram 1 (乾)", () => {
    const d = buildHexagramDetail(1);
    expect(d.kw).toBe(1);
    expect(d.gua.n).toBe("乾");
    expect(d.gua.ename).toBe("The Creative");
  });

  test("includes trigram structure", () => {
    const d = buildHexagramDetail(1);
    expect(d.structure.upper).toBeDefined();
    expect(d.structure.lower).toBeDefined();
    expect(d.structure.upper.sym).toBe("☰");
    expect(d.structure.lower.sym).toBe("☰");
  });

  test("includes nuclear derivation", () => {
    const d = buildHexagramDetail(1);
    expect(d.nuclear.kw).toBeGreaterThanOrEqual(1);
    expect(d.nuclear.kw).toBeLessThanOrEqual(64);
    expect(d.nuclear.gua).toBeDefined();
  });

  test("includes polarity derivation", () => {
    const d = buildHexagramDetail(1);
    // Polarity of 乾 (all yang) is 坤 (all yin) = KW 2
    expect(d.polarity.kw).toBe(2);
    expect(d.polarity.gua.n).toBe("坤");
  });

  test("includes mirror derivation", () => {
    const d = buildHexagramDetail(1);
    expect(d.mirror.kw).toBeGreaterThanOrEqual(1);
  });

  test("includes diagonal derivation", () => {
    const d = buildHexagramDetail(1);
    expect(d.diagonal.kw).toBeGreaterThanOrEqual(1);
  });

  test("detects locked pairs", () => {
    // 泰 (11) and 否 (12) are a locked pair
    const d11 = buildHexagramDetail(11);
    expect(d11.isLocked).toBe(true);
    expect(d11.lockedPartner).toBeDefined();

    const d12 = buildHexagramDetail(12);
    expect(d12.isLocked).toBe(true);
  });

  test("non-locked pair has no partner", () => {
    // Hexagram 1 (乾) is not locked
    const d = buildHexagramDetail(1);
    expect(d.isLocked).toBe(false);
    expect(d.lockedPartner).toBeUndefined();
  });

  test("works for all 64 hexagrams", () => {
    for (let kw = 1; kw <= 64; kw++) {
      const d = buildHexagramDetail(kw);
      expect(d.kw).toBe(kw);
      expect(d.gua).toBeDefined();
      expect(d.nuclear.kw).toBeGreaterThanOrEqual(1);
      expect(d.polarity.kw).toBeGreaterThanOrEqual(1);
      expect(d.mirror.kw).toBeGreaterThanOrEqual(1);
      expect(d.diagonal.kw).toBeGreaterThanOrEqual(1);
    }
  });
});
