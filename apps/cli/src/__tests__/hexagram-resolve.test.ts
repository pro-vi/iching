// resolveHexagramQuery — the shared hexagram-argument resolution used by
// `iching hexagram <query>` and `iching dict <query>`: King Wen numbers pass
// through, names/pinyin/trigram grammar resolve via core searchHexagrams.

import { describe, test, expect } from "bun:test";
import { GUA } from "@iching/core";
import { resolveHexagramQuery } from "../commands/hexagram.js";

describe("resolveHexagramQuery", () => {
  test("integer in range resolves directly", () => {
    expect(resolveHexagramQuery("11")).toEqual({ kind: "kw", kw: 11 });
    expect(resolveHexagramQuery(" 64 ")).toEqual({ kind: "kw", kw: 64 });
  });

  test("integer out of range is invalid (keeps the classic range error)", () => {
    expect(resolveHexagramQuery("0")).toEqual({ kind: "invalid" });
    expect(resolveHexagramQuery("65")).toEqual({ kind: "invalid" });
    expect(resolveHexagramQuery("99")).toEqual({ kind: "invalid" });
  });

  test("Chinese name resolves uniquely (泰 → 11)", () => {
    expect(resolveHexagramQuery("泰")).toEqual({ kind: "kw", kw: 11 });
  });

  test("Simplified name resolves uniquely (剥 → 23)", () => {
    expect(resolveHexagramQuery("剥")).toEqual({ kind: "kw", kw: 23 });
  });

  test("pinyin resolves uniquely when only one hexagram answers (tai → 11)", () => {
    expect(resolveHexagramQuery("tai")).toEqual({ kind: "kw", kw: 11 });
  });

  test("English name resolves uniquely (the receptive → 2)", () => {
    expect(resolveHexagramQuery("the receptive")).toEqual({ kind: "kw", kw: 2 });
  });

  test("trigram pair grammar resolves uniquely (山風 → 18)", () => {
    expect(resolveHexagramQuery("山風")).toEqual({ kind: "kw", kw: 18 });
    expect(resolveHexagramQuery("water over mountain")).toEqual({ kind: "kw", kw: 39 });
  });

  test("a hexagram whose name IS a trigram token resolves to its KW, not a shortlist", () => {
    // The single-trigram family scoring gives score 3 to every hexagram sharing a
    // queried trigram, but an exact (score-0) hit must still win — otherwise the 8
    // doubled-trigram hexagrams' OWN name returned a family shortlist (15 hits for
    // 乾) instead of opening the hexagram (the most canonical lookups in the app).
    const byName: Array<[string, number]> = [
      ["乾", 1], ["坤", 2], ["坎", 29], ["離", 30], ["震", 51], ["艮", 52], ["巽", 57], ["兌", 58],
    ];
    for (const [name, kw] of byName) expect(resolveHexagramQuery(name)).toEqual({ kind: "kw", kw });
    // A doubled symbol/char is a trigram PAIR (also score-0) → its one hexagram.
    expect(resolveHexagramQuery("☰☰")).toEqual({ kind: "kw", kw: 1 });
    expect(resolveHexagramQuery("☷☷")).toEqual({ kind: "kw", kw: 2 });
  });

  test("tone-stripped pinyin that collides stays a shortlist (qian → 乾 + 謙)", () => {
    // Diacritic-insensitive matching merges qián (乾/1) and qiān (謙/15): two exact
    // score-0 hits, so it's genuinely ambiguous (pre-existing on main, not a
    // family-scoring regression). The resolver must NOT pick one arbitrarily.
    const result = resolveHexagramQuery("qian");
    expect(result.kind).toBe("matches");
    if (result.kind === "matches") {
      const kws = result.matches.map((g) => GUA.indexOf(g) + 1);
      expect(kws).toContain(1);
      expect(kws).toContain(15);
    }
  });

  test("a single-trigram family query stays a shortlist (genuinely ambiguous)", () => {
    // "fire" is the 離 trigram, in many hexagrams with no exact name hit — so it
    // legitimately returns the family, unlike an exact name/pinyin above.
    const result = resolveHexagramQuery("fire");
    expect(result.kind).toBe("matches");
    if (result.kind === "matches") {
      expect(result.matches.length).toBeGreaterThan(1);
      expect(result.matches.map((g) => GUA.indexOf(g) + 1)).toContain(30); // 離 itself among them
    }
  });

  test("no match returns none", () => {
    expect(resolveHexagramQuery("zzzzzz")).toEqual({ kind: "none" });
  });
});
