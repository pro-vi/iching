// reading-renderer — the oracle texts shown in the cast exploration phase

import { describe, test, expect } from "bun:test";
import type { Cast } from "@iching/core";
import { GUA } from "@iching/core";
import { buildReadingLines, readingHint } from "../scenes/cast/reading-renderer.ts";

function makeCast(primary: number, changing: number[], becoming: number | null): Cast {
  const gua = GUA[primary - 1];
  return {
    lines: gua.l.map((v, i) => ({
      value: changing.includes(i + 1) ? (v === 1 ? 9 : 6) : v === 1 ? 7 : 8,
      isYang: v === 1,
      isChanging: changing.includes(i + 1),
    })) as Cast["lines"],
    primary,
    becoming,
    changingPositions: changing,
    nuclear: 1,
    polarity: 2,
    mirror: 1,
    diagonal: 2,
  };
}

describe("readingHint", () => {
  test("empty when no lines move", () => {
    expect(readingHint(makeCast(21, [], null), "en")).toBe("");
  });

  test("one moving line", () => {
    expect(readingHint(makeCast(21, [4], 42), "en")).toBe("one line moves — it speaks");
    expect(readingHint(makeCast(21, [4], 42), "zh-Hant")).toBe("一爻動，以動爻為占");
    expect(readingHint(makeCast(21, [4], 42), "zh-Hans")).toBe("一爻动，以动爻为占");
  });

  test("two moving lines — upper governs", () => {
    expect(readingHint(makeCast(21, [1, 4], 42), "en")).toBe(
      "two lines move — the upper governs",
    );
  });

  test("all six on hexagram 1 → 用九", () => {
    expect(readingHint(makeCast(1, [1, 2, 3, 4, 5, 6], 2), "zh-Hant")).toBe(
      "六爻皆動，以用九為占",
    );
  });

  test("all six on hexagram 2 → 用六", () => {
    expect(readingHint(makeCast(2, [1, 2, 3, 4, 5, 6], 1), "en")).toBe(
      "all six lines move — 用六 speaks",
    );
  });
});

describe("buildReadingLines", () => {
  test("no moving lines → the judgment, labeled", () => {
    const lines = buildReadingLines(makeCast(21, [], null), "zh-Hant", 60, 6);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].role).toBe("text");
    expect(lines[0].text).toContain("卦辭");
    expect(lines[0].text).toContain(GUA[20].gc);
  });

  test("zh-Hans judgment converts via toSimplified", () => {
    const lines = buildReadingLines(makeCast(21, [], null), "zh-Hans", 60, 6);
    expect(lines[0].text).toContain("卦辞");
    // 21 噬嗑 gc: 亨。利用獄。 → 狱 in Simplified
    expect(lines[0].text).toContain("狱");
  });

  test("changing lines render bottom-line-first with a hint", () => {
    const lines = buildReadingLines(makeCast(21, [4, 1], 42), "zh-Hant", 70, 8);
    expect(lines[0].role).toBe("hint");
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts[0]).toBe(GUA[20].yao[0]); // line 1 first (bottom)
    expect(texts[1]).toBe(GUA[20].yao[3]); // line 4 second
  });

  test("en mode shows yaoEn prefixed with the line position", () => {
    const lines = buildReadingLines(makeCast(21, [4], 42), "en", 200, 8);
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts[0]).toBe(`4 · ${GUA[20].yaoEn[3]}`);
  });

  test("all six on hexagram 1 shows the 用九 text instead of six lines", () => {
    const lines = buildReadingLines(makeCast(1, [1, 2, 3, 4, 5, 6], 2), "zh-Hant", 70, 8);
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("用九");
    expect(texts[0]).toContain("見群龍無首");
  });

  test("truncates to maxRows with a trailing … row", () => {
    const lines = buildReadingLines(makeCast(21, [1, 4], 42), "en", 40, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toEqual({ text: "…", role: "more" });
  });

  test("returns empty when there is no room", () => {
    expect(buildReadingLines(makeCast(21, [1], 42), "en", 60, 0)).toEqual([]);
    expect(buildReadingLines(makeCast(21, [1], 42), "en", 2, 4)).toEqual([]);
  });
});
