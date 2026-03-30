import { describe, test, expect } from "bun:test";
import { nuclear } from "../derivation/nuclear.js";
import { polarity } from "../derivation/polarity.js";
import { mirror } from "../derivation/mirror.js";
import { diagonal } from "../derivation/diagonal.js";
import { isLockedPair } from "../derivation/locked-pairs.js";
import { BINARY_TO_KW } from "../identify/lookup.js";
import { GUA } from "../data/gua.js";
import { linesToBinary } from "../casting/binary.js";
import type { Line, Cast } from "../types.js";

/** Helper: build Line[] from a GUA entry's l array */
function linesFromGUA(kw: number): Line[] {
  const g = GUA[kw - 1];
  return g.l.map((v) => ({
    value: (v === 1 ? 7 : 8) as 7 | 8,
    isYang: v === 1,
    isChanging: false,
  }));
}

/** Helper: make a minimal Cast for locked-pair testing */
function makeCast(kw: number): Cast {
  const lines = linesFromGUA(kw);
  return {
    lines,
    primary: kw,
    becoming: null,
    changingPositions: [],
    nuclear: nuclear(lines),
    polarity: polarity(lines),
    mirror: mirror(lines),
    diagonal: diagonal(lines),
  };
}

describe("nuclear (互卦)", () => {
  test("乾 (KW 1) nuclear = 乾 (1)", () => {
    // All yang: nuclear lines [1,2,3,2,3,4] all yang → all yang → 乾
    const lines = linesFromGUA(1);
    expect(nuclear(lines)).toBe(1);
  });

  test("坤 (KW 2) nuclear = 坤 (2)", () => {
    // All yin: nuclear all yin → 坤
    const lines = linesFromGUA(2);
    expect(nuclear(lines)).toBe(2);
  });

  test("屯 (KW 3) nuclear", () => {
    // 屯: l=[1,0,0,0,1,0], lines[1..4] = [0,0,0,1]
    // nuclear: [lines[1],lines[2],lines[3],lines[2],lines[3],lines[4]]
    //        = [0,0,0,0,0,1] → binary=32 → BINARY_TO_KW[32]=23 (剝)
    const lines = linesFromGUA(3);
    expect(nuclear(lines)).toBe(23);
  });
});

describe("polarity (錯卦)", () => {
  test("乾 (KW 1) polarity = 坤 (2)", () => {
    const lines = linesFromGUA(1);
    expect(polarity(lines)).toBe(2);
  });

  test("坤 (KW 2) polarity = 乾 (1)", () => {
    const lines = linesFromGUA(2);
    expect(polarity(lines)).toBe(1);
  });

  test("泰 (KW 11) polarity = 否 (12)", () => {
    const lines = linesFromGUA(11);
    expect(polarity(lines)).toBe(12);
  });
});

describe("mirror (綜卦)", () => {
  test("乾 (KW 1) mirror = 乾 (1) — self-mirror", () => {
    const lines = linesFromGUA(1);
    expect(mirror(lines)).toBe(1);
  });

  test("坤 (KW 2) mirror = 坤 (2) — self-mirror", () => {
    const lines = linesFromGUA(2);
    expect(mirror(lines)).toBe(2);
  });

  test("泰 (KW 11) mirror = 否 (12)", () => {
    const lines = linesFromGUA(11);
    expect(mirror(lines)).toBe(12);
  });
});

describe("diagonal (對角卦)", () => {
  test("乾 (KW 1) diagonal = 坤 (2)", () => {
    const lines = linesFromGUA(1);
    expect(diagonal(lines)).toBe(2);
  });

  test("坤 (KW 2) diagonal = 乾 (1)", () => {
    const lines = linesFromGUA(2);
    expect(diagonal(lines)).toBe(1);
  });

  test("diagonal = polarity of mirror (錯+綜)", () => {
    // For any hexagram, diagonal(lines) should equal polarity(reverse(lines))
    for (let kw = 1; kw <= 64; kw++) {
      const lines = linesFromGUA(kw);
      const diag = diagonal(lines);
      // polarity of mirror: reverse then invert
      const reversed = [...lines].reverse();
      const pol = polarity(reversed);
      expect(diag).toBe(pol);
    }
  });
});

describe("isLockedPair (错综同象)", () => {
  test("泰/否 (11/12) are locked pair", () => {
    const cast11 = makeCast(11);
    const cast12 = makeCast(12);
    expect(isLockedPair(cast11)).toBe(true);
    expect(isLockedPair(cast12)).toBe(true);
  });

  test("隨/蠱 (17/18) are locked pair", () => {
    const cast17 = makeCast(17);
    const cast18 = makeCast(18);
    expect(isLockedPair(cast17)).toBe(true);
    expect(isLockedPair(cast18)).toBe(true);
  });

  test("漸/歸妹 (53/54) are locked pair", () => {
    const cast53 = makeCast(53);
    const cast54 = makeCast(54);
    expect(isLockedPair(cast53)).toBe(true);
    expect(isLockedPair(cast54)).toBe(true);
  });

  test("既濟/未濟 (63/64) are locked pair", () => {
    const cast63 = makeCast(63);
    const cast64 = makeCast(64);
    expect(isLockedPair(cast63)).toBe(true);
    expect(isLockedPair(cast64)).toBe(true);
  });

  test("乾 (1) is NOT a locked pair", () => {
    const cast1 = makeCast(1);
    // 乾 mirror = 1 (self), polarity = 2 (坤) → not equal
    expect(isLockedPair(cast1)).toBe(false);
  });

  test("exactly 4 locked pairs exist among all 64", () => {
    let count = 0;
    const pairs = new Set<string>();
    for (let kw = 1; kw <= 64; kw++) {
      const cast = makeCast(kw);
      if (isLockedPair(cast)) {
        const m = cast.mirror;
        const key = [Math.min(kw, m), Math.max(kw, m)].join(",");
        pairs.add(key);
        count++;
      }
    }
    // 4 pairs = 8 hexagrams that are in locked pairs
    expect(pairs.size).toBe(4);
  });
});
