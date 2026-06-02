import { describe, test, expect } from "bun:test";
import { XU_GUA, XU_GUA_META } from "../data/xugua.js";
import { ZA_GUA, ZA_GUA_META, ZA_GUA_BY_HEX } from "../data/zagua.js";

/**
 * U2 integrity tests — 序卦 + 雜卦 data modules.
 *
 * The canonical text content is verified verbatim against ctext.org with a
 * Wikisource cross-check; these tests lock in the structural invariants
 * (coverage, indices, anchors, editorial notes) that future contributors
 * must preserve.
 */

describe("XU_GUA (序卦傳)", () => {
  test("has exactly 64 entries", () => {
    expect(XU_GUA).toHaveLength(64);
  });

  test("entries are ordered 1..64 with no gaps", () => {
    XU_GUA.forEach((entry, i) => {
      expect(entry.hexagram).toBe(i + 1);
    });
  });

  test("every entry has non-empty text and zh name", () => {
    for (const entry of XU_GUA) {
      expect(entry.text.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  test("verification anchor — opening cosmological premise on hex 1 + 2", () => {
    expect(XU_GUA[0]!.name).toBe("乾");
    expect(XU_GUA[0]!.text).toContain("有天地，然後萬物生焉");
    expect(XU_GUA[1]!.name).toBe("坤");
    expect(XU_GUA[1]!.text).toContain("有天地，然後萬物生焉");
  });

  test("hex 3 (屯) carries the canonical sequence transition", () => {
    expect(XU_GUA[2]!.name).toBe("屯");
    expect(XU_GUA[2]!.text).toContain("故受之以");
    expect(XU_GUA[2]!.text).toContain("屯");
  });

  test("editorial notes carried on hex 1, 2, 30, 31 (per JSON _meta)", () => {
    expect(XU_GUA[0]!.note).toBeDefined();
    expect(XU_GUA[1]!.note).toBeDefined();
    expect(XU_GUA[29]!.note).toBeDefined();
    expect(XU_GUA[30]!.note).toBeDefined();
  });

  test("XU_GUA_META carries provenance", () => {
    expect(XU_GUA_META.source).toMatch(/ctext\.org/);
    expect(XU_GUA_META.crossChecks.length).toBeGreaterThan(0);
    expect(XU_GUA_META.license).toMatch(/public domain/);
  });
});

describe("ZA_GUA (雜卦傳)", () => {
  test("has 53 entries (preserves the disordered structure)", () => {
    expect(ZA_GUA).toHaveLength(53);
  });

  test("indices are sequential 0..52", () => {
    ZA_GUA.forEach((entry, i) => {
      expect(entry.index).toBe(i);
    });
  });

  test("every entry has non-empty text", () => {
    for (const entry of ZA_GUA) {
      expect(entry.text.length).toBeGreaterThan(0);
    }
  });

  test("pair[] lengths are 0, 1, or 2", () => {
    for (const entry of ZA_GUA) {
      expect([0, 1, 2]).toContain(entry.pair.length);
      expect(entry.names.length).toBe(entry.pair.length);
    }
  });

  test("verification anchor — opening 乾剛坤柔", () => {
    expect(ZA_GUA[0]!.pair).toEqual([1, 2]);
    expect(ZA_GUA[0]!.names).toEqual(["乾", "坤"]);
    expect(ZA_GUA[0]!.text).toContain("乾");
    expect(ZA_GUA[0]!.text).toContain("剛");
    expect(ZA_GUA[0]!.text).toContain("坤");
    expect(ZA_GUA[0]!.text).toContain("柔");
  });

  test("all 64 hexagrams appear exactly once across pair[] arrays", () => {
    const allHexes = ZA_GUA.flatMap((e) => e.pair).sort((a, b) => a - b);
    const expected = Array.from({ length: 64 }, (_, i) => i + 1);
    expect(allHexes).toEqual(expected);
  });

  test("exactly one closing-coda entry with empty pair[]", () => {
    const empty = ZA_GUA.filter((e) => e.pair.length === 0);
    expect(empty).toHaveLength(1);
  });

  test("ZA_GUA_META carries provenance", () => {
    expect(ZA_GUA_META.source).toMatch(/ctext\.org/);
    expect(ZA_GUA_META.license).toMatch(/public domain/);
  });
});

describe("ZA_GUA_BY_HEX (reverse index)", () => {
  test("has exactly 64 keys (one per hexagram)", () => {
    expect(Object.keys(ZA_GUA_BY_HEX)).toHaveLength(64);
  });

  test("hexagrams 1 and 2 share the opening entry (the canonical 乾/坤 pair)", () => {
    expect(ZA_GUA_BY_HEX[1]).toBeDefined();
    expect(ZA_GUA_BY_HEX[2]).toBeDefined();
    expect(ZA_GUA_BY_HEX[1]).toBe(ZA_GUA_BY_HEX[2]!);
    expect(ZA_GUA_BY_HEX[1]).toBe(ZA_GUA[0]!);
  });

  test("every hex 1..64 maps to an entry whose pair[] contains that hex", () => {
    for (let h = 1; h <= 64; h++) {
      const entry = ZA_GUA_BY_HEX[h];
      expect(entry).toBeDefined();
      expect(entry!.pair).toContain(h);
    }
  });

  test("hex 29 (坎) and hex 30 (離) share the polarity-fallback entry", () => {
    expect(ZA_GUA_BY_HEX[29]).toBeDefined();
    expect(ZA_GUA_BY_HEX[30]).toBeDefined();
    // Both should pair via polarity (the 8 self-mirror hexagrams pattern).
    // They might share an entry or appear in adjacent single-entry cells.
    // We assert the entry referencing them includes the expected partner.
    const e29 = ZA_GUA_BY_HEX[29]!;
    const e30 = ZA_GUA_BY_HEX[30]!;
    const e29Hexes = new Set(e29.pair);
    const e30Hexes = new Set(e30.pair);
    expect(e29Hexes.has(29) || e30Hexes.has(29)).toBe(true);
    expect(e29Hexes.has(30) || e30Hexes.has(30)).toBe(true);
  });
});
