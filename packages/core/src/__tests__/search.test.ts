import { describe, test, expect } from "bun:test";
import { searchHexagrams } from "../search.js";

describe("searchHexagrams", () => {
  test("empty query returns all 64", () => {
    const results = searchHexagrams("");
    expect(results).toHaveLength(64);
  });

  test("search by Chinese name (乾)", () => {
    const results = searchHexagrams("乾");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].n).toBe("乾");
  });

  test("search by pinyin (qian) finds 乾", () => {
    const results = searchHexagrams("qian");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].n).toBe("乾");
  });

  test("search by pinyin is diacritic-insensitive", () => {
    const results = searchHexagrams("Qián");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].n).toBe("乾");
  });

  test("search by English name (creative)", () => {
    const results = searchHexagrams("creative");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ename).toBe("The Creative");
  });

  test("search by KW number (1)", () => {
    const results = searchHexagrams("1");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].n).toBe("乾");
  });

  test("search is case-insensitive", () => {
    const results = searchHexagrams("THE CREATIVE");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ename).toBe("The Creative");
  });

  test("exact match ranks higher than prefix", () => {
    // "qian" exact matches 乾 Qián, prefix matches 謙 Qiān
    const results = searchHexagrams("qian");
    expect(results[0].p).toBe("Qián");
  });

  test("search by partial English name", () => {
    const results = searchHexagrams("difficul");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ename).toBe("Difficulty at the Beginning");
  });

  test("search with no matches returns empty", () => {
    const results = searchHexagrams("zzzzzzz");
    expect(results).toHaveLength(0);
  });

  test("search by multi-digit KW number", () => {
    const results = searchHexagrams("42");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ename).toBe("Increase");
  });

  test("all 64 hexagrams have ename", () => {
    const all = searchHexagrams("");
    for (const gua of all) {
      expect(gua.ename).toBeDefined();
      expect(gua.ename.length).toBeGreaterThan(0);
    }
  });

  // Regression (Codex P2): the zh-Hans dictionary displays simplified names, so a
  // user types the simplified form they see (兑) — which must still match the
  // Traditional gua.n (兌). Search now also matches toSimplified(gua.n).
  test("search by Simplified name (兑) finds 兌 / KW58", () => {
    const results = searchHexagrams("兑");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].n).toBe("兌");
  });

  test("search by Simplified name (观) finds 觀 / KW20", () => {
    const results = searchHexagrams("观");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].n).toBe("觀");
  });

  test("Traditional name search still matches (兌)", () => {
    const results = searchHexagrams("兌");
    expect(results[0].n).toBe("兌");
  });
});
