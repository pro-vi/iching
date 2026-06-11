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

  test("ambiguous query returns the scored match list", () => {
    const result = resolveHexagramQuery("qian");
    expect(result.kind).toBe("matches");
    if (result.kind === "matches") {
      expect(result.matches.length).toBeGreaterThan(1);
      expect(GUA.indexOf(result.matches[0]) + 1).toBe(1); // 乾 exact first
    }
  });

  test("no match returns none", () => {
    expect(resolveHexagramQuery("zzzzzz")).toEqual({ kind: "none" });
  });
});
