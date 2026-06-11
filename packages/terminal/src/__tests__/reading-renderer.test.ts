// reading-renderer — the oracle texts shown in the cast exploration phase

import { describe, test, expect } from "bun:test";
import type { Cast, Line } from "@iching/core";
import { assembleCast, GUA } from "@iching/core";
import { buildReadingLines, readingHint } from "../scenes/cast/reading-renderer.ts";
import { readingPanelRows } from "../scenes/cast/reading-lines.ts";

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

/** A correct Cast for `primary` with the becoming hexagram actually derived. */
function realCast(primary: number, changing: number[]): Cast {
  const gua = GUA[primary - 1];
  const lines: Line[] = gua.l.map((v, i) => ({
    value: (changing.includes(i + 1) ? (v === 1 ? 9 : 6) : v === 1 ? 7 : 8) as Line["value"],
    isYang: v === 1,
    isChanging: changing.includes(i + 1),
  }));
  return assembleCast(lines);
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

  test("two changing lines render the governing (upper) line first, with a hint", () => {
    const lines = buildReadingLines(makeCast(21, [4, 1], 42), "zh-Hant", 70, 8);
    expect(lines[0].role).toBe("hint");
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts[0]).toBe(GUA[20].yao[3]); // line 4 first — the upper governs
    expect(texts[1]).toBe(GUA[20].yao[0]); // line 1 follows as context
  });

  test("three changing lines: governing first, the rest bottom-first as context", () => {
    const lines = buildReadingLines(realCast(21, [1, 3, 5]), "en", 200, 12);
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts[0]).toBe(`5 · ${GUA[20].yaoEn[4]}`); // line 5 governs
    expect(texts[1]).toBe(`1 · ${GUA[20].yaoEn[0]}`);
    expect(texts[2]).toBe(`3 · ${GUA[20].yaoEn[2]}`);
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

  test("four changing lines: the becoming 卦辭 is the reading, not the moving lines (zh-Hant)", () => {
    const cast = realCast(21, [1, 2, 3, 4]);
    expect(cast.becoming).not.toBeNull();
    const becoming = GUA[cast.becoming! - 1];
    const lines = buildReadingLines(cast, "zh-Hant", 500, 12);
    expect(lines[0].role).toBe("hint");
    expect(lines[0].text).toBe("四爻動，以之卦為占");
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("之卦卦辭");
    expect(texts[0]).toContain(becoming.gc);
    // The primary's moving-line texts are not the reading here.
    for (const pos of cast.changingPositions) {
      expect(texts[0]).not.toContain(GUA[20].yao[pos - 1]);
    }
  });

  test("five changing lines: the becoming 卦辭 is the reading (en)", () => {
    const cast = realCast(21, [1, 2, 3, 4, 5]);
    const becoming = GUA[cast.becoming! - 1];
    const lines = buildReadingLines(cast, "en", 1000, 12);
    expect(lines[0].text).toBe("five lines move — the becoming speaks");
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("Becoming · Judgment");
    expect(texts[0]).toContain(becoming.gcEn);
  });

  test("all six changing off hex 1/2: the becoming 卦辭 is the reading", () => {
    const cast = realCast(63, [1, 2, 3, 4, 5, 6]);
    expect(cast.becoming).toBe(64);
    const lines = buildReadingLines(cast, "zh-Hant", 500, 12);
    expect(lines[0].text).toBe("六爻皆動，以之卦為占");
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain(GUA[63].gc);
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

// The classical-rule invariant: whatever text the hint names governs the
// reading, and that text is always the first one the panel shows.
describe("the text the hint names is always shown first (1–6 moving lines)", () => {
  const becomingOf = (cast: Cast): (typeof GUA)[number] => GUA[cast.becoming! - 1];
  const cases: Array<{
    label: string;
    cast: Cast;
    named: (cast: Cast, english: boolean) => string;
  }> = [
    {
      label: "1 moving — that line speaks",
      cast: realCast(21, [4]),
      named: (_c, en) => (en ? GUA[20].yaoEn[3] : GUA[20].yao[3]),
    },
    {
      label: "2 moving — the upper governs",
      cast: realCast(21, [1, 4]),
      named: (_c, en) => (en ? GUA[20].yaoEn[3] : GUA[20].yao[3]),
    },
    {
      label: "3 moving — the upper governs",
      cast: realCast(21, [1, 3, 5]),
      named: (_c, en) => (en ? GUA[20].yaoEn[4] : GUA[20].yao[4]),
    },
    {
      label: "4 moving — the becoming speaks",
      cast: realCast(21, [1, 2, 3, 4]),
      named: (c, en) => (en ? becomingOf(c).gcEn : becomingOf(c).gc),
    },
    {
      label: "5 moving — the becoming speaks",
      cast: realCast(21, [1, 2, 3, 4, 5]),
      named: (c, en) => (en ? becomingOf(c).gcEn : becomingOf(c).gc),
    },
    {
      label: "6 moving on hex 1 — 用九 speaks",
      cast: realCast(1, [1, 2, 3, 4, 5, 6]),
      named: (_c, en) => (en ? GUA[0].extra!.textEn : GUA[0].extra!.text),
    },
    {
      label: "6 moving on hex 2 — 用六 speaks",
      cast: realCast(2, [1, 2, 3, 4, 5, 6]),
      named: (_c, en) => (en ? GUA[1].extra!.textEn : GUA[1].extra!.text),
    },
    {
      label: "6 moving elsewhere — the becoming speaks",
      cast: realCast(63, [1, 2, 3, 4, 5, 6]),
      named: (c, en) => (en ? becomingOf(c).gcEn : becomingOf(c).gc),
    },
  ];

  for (const language of ["en", "zh-Hant"] as const) {
    for (const { label, cast, named } of cases) {
      test(`${language} — ${label}`, () => {
        // Width wide enough that nothing wraps — the first text row carries
        // the whole governing text.
        const lines = buildReadingLines(cast, language, 4000, 50);
        const first = lines.find((l) => l.role === "text");
        expect(first).toBeDefined();
        expect(first!.text).toContain(named(cast, language === "en"));
      });
    }
  }

  // The settled-reveal layout reserves readingPanelRows before the glyph
  // sizes itself — the figure must match what buildReadingLines renders.
  for (const language of ["en", "zh-Hant"] as const) {
    test(`${language} — readingPanelRows matches the untruncated panel`, () => {
      for (const { cast } of cases) {
        expect(readingPanelRows(cast, language, 72)).toBe(
          buildReadingLines(cast, language, 72, Number.MAX_SAFE_INTEGER).length,
        );
      }
    });
  }
});
