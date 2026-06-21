// reading-renderer — the oracle texts shown in the cast exploration phase

import { describe, test, expect } from "bun:test";
import type { Cast, Line } from "@iching/core";
import { assembleCast, GUA } from "@iching/core";
import { buildReadingLines } from "../scenes/cast/reading-renderer.ts";
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

  test("the untruncated build is memoized across frames; resize busts it", () => {
    // renderReadingPanel asks for the panel twice per frame at 30 FPS over a
    // settled reading. The word-wrap + zh simplification is memoized on
    // (cast, language, width), so identical inputs return the SAME cached array
    // instead of rebuilding — recomputed only on a new cast or a resize.
    const cast = realCast(21, [2, 5]); // 噬嗑, two moving lines
    const a = buildReadingLines(cast, "en", 60, 999); // 999 > panel rows → untruncated
    const b = buildReadingLines(cast, "en", 60, 999);
    expect(b).toBe(a); // identical reference: built once, then cache hits
    expect(readingPanelRows(cast, "en", 60)).toBe(a.length); // shares the same memo
    expect(buildReadingLines(cast, "en", 40, 999)).not.toBe(a); // a resize rebuilds
  });

  test("two changing lines: a hint leads, then the 爻辭 top-down (upper first)", () => {
    const lines = buildReadingLines(makeCast(21, [4, 1], 42), "zh-Hant", 70, 8);
    expect(lines[0].role).toBe("hint"); // the method hint leads
    expect(lines[0].text).toBe("以上爻為主");
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts[0]).toBe(GUA[20].yao[3]); // line 4 first — the upper line
    expect(texts[1]).toBe(GUA[20].yao[0]); // line 1 below it
  });

  test("three changing lines: both judgments (本卦 first, then 之卦), with a hint", () => {
    const cast = realCast(21, [1, 3, 5]);
    const becoming = GUA[cast.becoming! - 1];
    const lines = buildReadingLines(cast, "en", 200, 12);
    expect(lines[0]).toEqual({ text: "both judgments — primary and becoming", role: "hint" });
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    // each judgment carries its own hexagram glyph+name (not a bare "Judgment ·")
    expect(texts[0]).toBe(`${GUA[20].u} ${GUA[20].n} · ${GUA[20].gcEnW}`); // primary first
    expect(texts[1]).toBe(`${becoming.u} ${becoming.n} · ${becoming.gcEnW}`); // becoming second
    // not the moving lines' 爻辭
    expect(texts.join("\n")).not.toContain(GUA[20].yaoEn[4]);
  });

  test("en mode shows yaoEn prefixed with the line position", () => {
    const lines = buildReadingLines(makeCast(21, [4], 42), "en", 200, 8);
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts[0]).toBe(`4 · ${GUA[20].yaoEn[3]}`);
  });

  test("the type-label line is flagged so the renderer can dim it", () => {
    // judgment (卦辭 · …) → labeled
    const jud = buildReadingLines(makeCast(21, [], null), "zh-Hant", 200, 6);
    expect(jud.find((l) => l.role === "text")!.labeled).toBe(true);
    // en 爻辭 ("4 · …") carries a position label → labeled
    const yaoEn = buildReadingLines(makeCast(21, [4], 42), "en", 200, 6);
    expect(yaoEn.find((l) => l.role === "text")!.labeled).toBe(true);
    // zh 爻辭 is the bare text (it opens with its own line name) → not labeled
    const yaoZh = buildReadingLines(makeCast(21, [4], 42), "zh-Hant", 200, 6);
    expect(yaoZh.find((l) => l.role === "text")!.labeled).toBeUndefined();
    // becoming 卦辭 (6 off 乾/坤) and 用九/用六 are labeled too
    expect(
      buildReadingLines(realCast(63, [1, 2, 3, 4, 5, 6]), "en", 500, 6).find((l) => l.role === "text")!
        .labeled,
    ).toBe(true);
    expect(
      buildReadingLines(makeCast(1, [1, 2, 3, 4, 5, 6], 2), "zh-Hant", 200, 6).find(
        (l) => l.role === "text",
      )!.labeled,
    ).toBe(true);
    // only the FIRST wrapped line of a labeled text bears the flag
    const wrapped = buildReadingLines(makeCast(21, [], null), "en", 24, 12).filter(
      (l) => l.role === "text",
    );
    expect(wrapped.length).toBeGreaterThan(1); // genuinely wrapped
    expect(wrapped[0].labeled).toBe(true);
    expect(wrapped.slice(1).every((l) => l.labeled === undefined)).toBe(true);
  });

  test("all six on hexagram 1 shows the 用九 text instead of six lines", () => {
    const lines = buildReadingLines(makeCast(1, [1, 2, 3, 4, 5, 6], 2), "zh-Hant", 70, 8);
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("用九");
    expect(texts[0]).toContain("見群龍無首");
  });

  test("four changing lines: the becoming's two UNCHANGED lines, lower first (zh-Hant)", () => {
    const cast = realCast(21, [1, 2, 3, 4]); // still lines = 5, 6
    const becoming = GUA[cast.becoming! - 1];
    const lines = buildReadingLines(cast, "zh-Hant", 500, 12);
    expect(lines[0]).toEqual({ text: "之卦靜爻，以下爻為主", role: "hint" });
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts).toHaveLength(2);
    // read from the BECOMING, the lower (主) first: line 5 then line 6 — matching
    // the "lower leads" hint (以下爻為主).
    expect(texts[0]).toBe(becoming.yao[4]);
    expect(texts[1]).toBe(becoming.yao[5]);
    // not the primary's moving-line texts
    for (const pos of cast.changingPositions) {
      expect(texts.join("\n")).not.toContain(GUA[20].yao[pos - 1]);
    }
  });

  test("five changing lines: the becoming's one UNCHANGED line (en)", () => {
    const cast = realCast(21, [1, 2, 3, 4, 5]); // still line = 6
    const becoming = GUA[cast.becoming! - 1];
    const lines = buildReadingLines(cast, "en", 1000, 12);
    expect(lines[0]).toEqual({ text: "the becoming's still line", role: "hint" });
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toBe(`6 · ${becoming.yaoEn[5]}`); // the becoming's line 6
  });

  test("all six changing off hex 1/2: the becoming 卦辭 is the reading", () => {
    const cast = realCast(63, [1, 2, 3, 4, 5, 6]);
    expect(cast.becoming).toBe(64);
    const lines = buildReadingLines(cast, "zh-Hant", 500, 12);
    const texts = lines.filter((l) => l.role === "text").map((l) => l.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain(GUA[63].gc);
  });

  test("truncates to maxRows with a trailing … row", () => {
    // A long judgment (坤) wraps past the budget; the tail stands down behind "…".
    const lines = buildReadingLines(makeCast(2, [], null), "en", 40, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toEqual({ text: "…", role: "more" });
  });

  test("returns empty when there is no room", () => {
    expect(buildReadingLines(makeCast(21, [1], 42), "en", 60, 0)).toEqual([]);
    expect(buildReadingLines(makeCast(21, [1], 42), "en", 2, 4)).toEqual([]);
  });

  test("never paints a lone … (or a hint with no text) — drops the panel", () => {
    // maxRows so tight that no oracle text survives above the "…" is not a
    // reading; the renderer skips cleanly. A 2-moving cast has a hint, so
    // maxRows=1 would leave [{…}] and maxRows=2 [hint, {…}] — both drop.
    const cast = makeCast(21, [1, 3], 42); // n=2 → has a hint line
    expect(buildReadingLines(cast, "en", 40, 1)).toEqual([]); // not [{ text:"…" }]
    expect(buildReadingLines(cast, "en", 40, 2)).toEqual([]); // not [hint, "…"]
    // Once a text row fits above the …, it's meaningful again.
    const three = buildReadingLines(cast, "en", 40, 3);
    expect(three.some((l) => l.role === "text")).toBe(true);
    expect(three.at(-1)).toEqual({ text: "…", role: "more" });
  });
});

// The reading-rule invariant (Zhu Xi 啟蒙): the leading text the rule turns on
// is always the first one the panel shows (the hint precedes it but is not a
// text). 3 → primary 卦辭 first; 4/5 → the becoming's top still line.
describe("the leading text is shown first (1–6 moving lines, 啟蒙)", () => {
  const becomingOf = (cast: Cast): (typeof GUA)[number] => GUA[cast.becoming! - 1];
  const cases: Array<{
    label: string;
    cast: Cast;
    named: (cast: Cast, english: boolean) => string;
  }> = [
    {
      label: "1 moving — that line's 爻辭",
      cast: realCast(21, [4]),
      named: (_c, en) => (en ? GUA[20].yaoEn[3] : GUA[20].yao[3]),
    },
    {
      label: "2 moving — the upper line's 爻辭",
      cast: realCast(21, [1, 4]),
      named: (_c, en) => (en ? GUA[20].yaoEn[3] : GUA[20].yao[3]),
    },
    {
      label: "3 moving — the primary 卦辭 (first of the pair)",
      cast: realCast(21, [1, 3, 5]),
      named: (_c, en) => (en ? GUA[20].gcEnW : GUA[20].gc),
    },
    {
      label: "4 moving — the becoming's lower still line (主)",
      cast: realCast(21, [1, 2, 3, 4]),
      named: (c, en) => (en ? becomingOf(c).yaoEn[4] : becomingOf(c).yao[4]),
    },
    {
      label: "5 moving — the becoming's still line",
      cast: realCast(21, [1, 2, 3, 4, 5]),
      named: (c, en) => (en ? becomingOf(c).yaoEn[5] : becomingOf(c).yao[5]),
    },
    {
      label: "6 moving on hex 1 — 用九",
      cast: realCast(1, [1, 2, 3, 4, 5, 6]),
      named: (_c, en) => (en ? GUA[0].extra!.textEn : GUA[0].extra!.text),
    },
    {
      label: "6 moving on hex 2 — 用六",
      cast: realCast(2, [1, 2, 3, 4, 5, 6]),
      named: (_c, en) => (en ? GUA[1].extra!.textEn : GUA[1].extra!.text),
    },
    {
      label: "6 moving elsewhere — the becoming 卦辭",
      cast: realCast(63, [1, 2, 3, 4, 5, 6]),
      named: (c, en) => (en ? becomingOf(c).gcEnW : becomingOf(c).gc),
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
