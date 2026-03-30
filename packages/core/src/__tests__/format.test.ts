import { describe, test, expect } from "bun:test";
import { formatReading } from "../format/reading.js";
import { formatDerived } from "../format/derived.js";
import { buildStructure } from "../identify/structure.js";
import { GUA } from "../data/gua.js";
import { SeededRandomSource } from "../random.js";
import type { Cast, DerivedType, Line } from "../types.js";
import { nuclear } from "../derivation/nuclear.js";
import { polarity } from "../derivation/polarity.js";
import { mirror } from "../derivation/mirror.js";
import { diagonal } from "../derivation/diagonal.js";

/** Helper: build a Cast for a given KW number (no changing lines) */
function makeCast(kw: number): Cast {
  const g = GUA[kw - 1];
  const lines: Line[] = g.l.map((v) => ({
    value: (v === 1 ? 7 : 8) as 7 | 8,
    isYang: v === 1,
    isChanging: false,
  }));
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

/** Helper: build a Cast with changing lines */
function makeCastWithChanging(kw: number, becomingKw: number, changingPos: number[]): Cast {
  const g = GUA[kw - 1];
  const lines: Line[] = g.l.map((v, i) => {
    const isChangingLine = changingPos.includes(i + 1);
    if (isChangingLine) {
      // changing: use 9 for yang, 6 for yin
      return {
        value: (v === 1 ? 9 : 6) as 9 | 6,
        isYang: v === 1,
        isChanging: true,
      };
    }
    return {
      value: (v === 1 ? 7 : 8) as 7 | 8,
      isYang: v === 1,
      isChanging: false,
    };
  });
  return {
    lines,
    primary: kw,
    becoming: becomingKw,
    changingPositions: changingPos,
    nuclear: nuclear(lines),
    polarity: polarity(lines),
    mirror: mirror(lines),
    diagonal: diagonal(lines),
  };
}

describe("formatReading", () => {
  test("produces string with hexagram symbol, name, pinyin", () => {
    const cast = makeCast(1); // 乾
    const structure = buildStructure(cast);
    const result = formatReading(cast, "dx", structure);

    expect(result).toContain("䷀");
    expect(result).toContain("乾");
    expect(result).toContain("Qián");
    expect(result).toContain("天行健");
  });

  test("includes becoming hexagram when present", () => {
    // 乾 with all changing → becoming 坤
    const cast = makeCastWithChanging(1, 2, [1, 2, 3, 4, 5, 6]);
    const structure = buildStructure(cast);
    const result = formatReading(cast, "dx", structure);

    expect(result).toContain("→");
    expect(result).toContain("䷁");
    expect(result).toContain("坤");
  });

  test("st style shows trigram structure", () => {
    const cast = makeCast(1); // 乾 = heaven/heaven
    const structure = buildStructure(cast);
    const result = formatReading(cast, "st", structure);

    expect(result).toContain("☰");
    expect(result).toContain("乾");
    expect(result).toContain("heaven");
  });

  test("all 5 commentary styles produce non-empty output", () => {
    const cast = makeCast(30); // 離
    const structure = buildStructure(cast);

    for (const style of ["dx", "tu", "en", "te", "w"] as const) {
      const result = formatReading(cast, style, structure);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("離");
    }
  });
});

describe("formatDerived", () => {
  test("produces labeled string for each DerivedType", () => {
    const cast = makeCast(3); // 屯 — has distinct nuclear/polarity/mirror/diagonal
    const source = new SeededRandomSource(42);

    const types: DerivedType[] = ["nuclear", "polarity", "mirror", "diagonal"];
    for (const type of types) {
      const result = formatDerived(cast, type, new SeededRandomSource(42));
      expect(result.length).toBeGreaterThan(0);
      // Should contain a hexagram unicode symbol
      expect(result).toMatch(/[\u4DC0-\u4DFF]/);
    }
  });

  test("becoming returns empty string when becoming is null", () => {
    const cast = makeCast(1); // no changing lines
    const source = new SeededRandomSource(42);
    const result = formatDerived(cast, "becoming", source);
    expect(result).toBe("");
  });

  test("becoming returns non-empty when becoming exists", () => {
    const cast = makeCastWithChanging(1, 2, [1, 2, 3, 4, 5, 6]);
    const source = new SeededRandomSource(42);
    const result = formatDerived(cast, "becoming", source);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("坤");
  });

  test("self-mirroring hexagram shows 自綜 or self-mirroring", () => {
    // 乾 (1) mirrors to itself
    const cast = makeCast(1);
    const source = new SeededRandomSource(42);
    const result = formatDerived(cast, "mirror", source);
    expect(result).toMatch(/自綜|self-mirroring/);
    expect(result).toContain("綜卦");
  });

  test("locked pair shows 错综同象", () => {
    // 泰 (11) is a locked pair
    const cast = makeCast(11);
    const source = new SeededRandomSource(42);
    const result = formatDerived(cast, "mirror", source);
    expect(result).toContain("错综同象");
  });
});
