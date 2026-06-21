import { describe, test, expect } from "bun:test";
import { searchHexagrams } from "../search.js";
import { GUA } from "../data/gua.js";
import { getStructure } from "../identify/structure.js";

const kwOf = (hex: { n: string }): number => GUA.indexOf(hex as (typeof GUA)[number]) + 1;

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

// ---------------------------------------------------------------------------
// Trigram grammar — single tokens mark a family; "X over Y" pairs (and their
// compact two-character forms) name one hexagram by structure (upper first).
// ---------------------------------------------------------------------------
describe("searchHexagrams — trigram grammar", () => {
  test("single English image word (fire) returns the 離 family", () => {
    const results = searchHexagrams("fire");
    // 8 upper + 8 lower − 1 doubled (30 離) = 15
    expect(results).toHaveLength(15);
    for (const hex of results) {
      const s = getStructure(kwOf(hex));
      expect(s.upper.img === "fire" || s.lower.img === "fire").toBe(true);
    }
  });

  test("single trigram symbol (☵) returns the 坎 family", () => {
    const results = searchHexagrams("☵");
    expect(results).toHaveLength(15);
    for (const hex of results) {
      const s = getStructure(kwOf(hex));
      expect(s.upper.sym === "☵" || s.lower.sym === "☵").toBe(true);
    }
  });

  test("trigram pinyin (kan) ranks the exact hexagram 29 first, family after", () => {
    const results = searchHexagrams("kan");
    expect(kwOf(results[0])).toBe(29); // 坎 Kǎn — exact pinyin match
    expect(results).toHaveLength(15); // the 坎 family (29 included once)
  });

  test("name matches outrank trigram-family matches (gen)", () => {
    const results = searchHexagrams("gen");
    expect(kwOf(results[0])).toBe(52); // 艮 Gèn — exact pinyin
    expect(kwOf(results[1])).toBe(57); // 巽 "The Gentle" — ename contains
    expect(results).toHaveLength(16); // 15 艮-family + the ename hit
  });

  test("Simplified trigram name (离) ranks hexagram 30 first, family after", () => {
    const results = searchHexagrams("离");
    expect(kwOf(results[0])).toBe(30);
    expect(results).toHaveLength(15);
  });

  test('"X over Y" with image words pins one hexagram (water over mountain → 39 蹇)', () => {
    const results = searchHexagrams("water over mountain");
    expect(results).toHaveLength(1);
    expect(kwOf(results[0])).toBe(39);
  });

  test('"X over Y" with trigram pinyin (li over dui → 38 睽)', () => {
    const results = searchHexagrams("li over dui");
    expect(results).toHaveLength(1);
    expect(kwOf(results[0])).toBe(38);
  });

  test('"X over Y" doubles (heaven over heaven → 1 乾)', () => {
    const results = searchHexagrams("heaven over heaven");
    expect(kwOf(results[0])).toBe(1);
  });

  test("compact Chinese image pair (山風 → 18 蠱, upper first)", () => {
    const results = searchHexagrams("山風");
    expect(results).toHaveLength(1);
    expect(kwOf(results[0])).toBe(18);
  });

  test("compact Chinese image pair (地天 → 11 泰)", () => {
    const results = searchHexagrams("地天");
    expect(results).toHaveLength(1);
    expect(kwOf(results[0])).toBe(11);
  });

  test("compact symbol pair (☲☱ → 38 睽)", () => {
    const results = searchHexagrams("☲☱");
    expect(results).toHaveLength(1);
    expect(kwOf(results[0])).toBe(38);
  });

  test("spaced single-character pair (雷 水 → 40 解)", () => {
    const results = searchHexagrams("雷 水");
    expect(results).toHaveLength(1);
    expect(kwOf(results[0])).toBe(40);
  });

  test('unresolvable "over" phrase falls back to normal matching', () => {
    expect(searchHexagrams("game over man")).toHaveLength(0);
  });

  test("trigram grammar does not disturb name ranking (qian → 乾 first)", () => {
    const results = searchHexagrams("qian");
    expect(results[0].p).toBe("Qián");
  });

  test("English single word that is not a trigram is unchanged (creative)", () => {
    const results = searchHexagrams("creative");
    expect(results[0].ename).toBe("The Creative");
  });
});
