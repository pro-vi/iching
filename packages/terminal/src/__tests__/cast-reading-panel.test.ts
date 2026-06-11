// cast-reading-panel — the oracle texts must survive the glyph (regression).
//
// The interactive app always passes glyphConfig, and the auto-sized glyph
// used to swallow every row below the hexagram: renderReadingPanel silently
// returned at every realistic terminal size, so the heart of the reading —
// the 爻辭 / 卦辭 — never appeared after the reveal settled. These are
// composed-scene tests: a real CastScene with a real glyph config, rendered
// to a CellBuffer, asserting the texts are on screen and the footer is not
// overlapped. The reading texts win the vertical budget; the glyph keeps
// its place only when there is room (and yields below that floor).

import { describe, test, expect } from "bun:test";
import type { Cast, DisplayLanguage, Line } from "@iching/core";
import { assembleCast, GUA } from "@iching/core";
import { CastScene, type CastGlyphInput } from "../scenes/cast/cast-scene.ts";
import { buildReadingLines, readingHint, readingPanelWidth } from "../scenes/cast/reading-lines.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";

const GLYPH_CFG: CastGlyphInput = { glyphAnim: "dots", glyphFont: "kaiti" };

/** A correct Cast for `primary` with the given changing positions. */
function makeCast(primary: number, changing: number[]): Cast {
  const gua = GUA[primary - 1];
  const lines: Line[] = gua.l.map((v, i) => ({
    value: (changing.includes(i + 1) ? (v === 1 ? 9 : 6) : v === 1 ? 7 : 8) as Line["value"],
    isYang: v === 1,
    isChanging: changing.includes(i + 1),
  }));
  return assembleCast(lines);
}

/**
 * Run the full real-app path: construct with glyphConfig, skip to the
 * settled state, advance well past the glyph animation, render a frame.
 */
function settledRows(
  cast: Cast,
  cols: number,
  rows: number,
  language: DisplayLanguage,
): string[] {
  const scene = new CastScene(cast, "default", cols, GLYPH_CFG, rows, undefined, { language });
  scene.skipToComplete();
  const ctx: SceneContext = { cols, rows, done: false, colorSupport: "truecolor", language };
  scene.update(0, 0, ctx); // anchor the glyph animator's clock
  scene.update(120_000, 33, ctx); // then advance far past any glyph animation
  expect(scene.getModel().showPrompt).toBe(true);
  const frame = CellBuffer.create(cols, rows);
  scene.render(frame, ctx);
  const out: string[] = [];
  for (let r = 0; r < frame.height; r++) {
    let row = "";
    for (let c = 0; c < frame.width; c++) row += frame.getCell(r, c).char;
    out.push(row.trimEnd());
  }
  return out;
}

/** Row index of the first row containing `text`, or -1. */
function rowOf(rows: string[], text: string): number {
  return rows.findIndex((r) => r.includes(text));
}

/** Does any row carry visible braille (the large glyph)? */
function hasGlyph(rows: string[]): boolean {
  return rows.some((r) => /[⠁-⣿]/.test(r));
}

// 0/1/3/6 changing lines, with correctly derived becoming hexagrams.
const CASES: Array<{ label: string; cast: Cast }> = [
  { label: "0 changing (hex 63)", cast: makeCast(63, []) },
  { label: "1 changing (hex 21, line 4)", cast: makeCast(21, [4]) },
  { label: "3 changing (hex 21, lines 1·3·4)", cast: makeCast(21, [1, 3, 4]) },
  { label: "6 changing (hex 1 → 用九)", cast: makeCast(1, [1, 2, 3, 4, 5, 6]) },
];

const SIZES: Array<[number, number]> = [
  [80, 24],
  [100, 30],
];

const LANGUAGES: DisplayLanguage[] = ["en", "zh-Hant"];

describe("reading panel renders with a glyph config at realistic sizes", () => {
  for (const [cols, rows] of SIZES) {
    for (const language of LANGUAGES) {
      for (const { label, cast } of CASES) {
        test(`${cols}x${rows} ${language} — ${label}`, () => {
          const frame = settledRows(cast, cols, rows, language);
          const footerRow = rows - 2;

          // The panel's own lines, exactly as the renderer wraps them.
          const panel = buildReadingLines(
            cast,
            language,
            readingPanelWidth(cols),
            Number.MAX_SAFE_INTEGER,
          );
          const hint = readingHint(cast, language);
          const firstText = panel.find((l) => l.role === "text");
          expect(firstText).toBeDefined();

          // Hint line (when the cast has one) is on screen, above the footer.
          if (hint !== "") {
            const hintRow = rowOf(frame, hint);
            expect(hintRow).toBeGreaterThanOrEqual(0);
            expect(hintRow).toBeLessThan(footerRow);
          }

          // At least one 爻辭/judgment line is on screen, above the footer.
          const textRow = rowOf(frame, firstText!.text.trim());
          expect(textRow).toBeGreaterThanOrEqual(0);
          expect(textRow).toBeLessThan(footerRow);

          // The footer is intact (panel did not overlap or displace it).
          expect(frame[footerRow]).toContain("[esc]");
        });
      }
    }
  }
});

describe("the glyph yields to the texts — and returns when there is room", () => {
  test("80x24: the glyph yields at every case (texts win the budget fight)", () => {
    for (const language of LANGUAGES) {
      for (const { cast } of CASES) {
        expect(hasGlyph(settledRows(cast, 80, 24, language))).toBe(false);
      }
    }
  });

  test("100x30 zh-Hant, 1 changing: glyph (settled form) AND the texts share the frame", () => {
    const cast = makeCast(21, [4]);
    const frame = settledRows(cast, 100, 30, "zh-Hant");
    expect(hasGlyph(frame)).toBe(true);
    expect(rowOf(frame, readingHint(cast, "zh-Hant"))).toBeGreaterThanOrEqual(0);
    expect(rowOf(frame, GUA[20].yao[3])).toBeGreaterThanOrEqual(0);
  });

  test("100x30 zh-Hant, 0 changing: glyph AND the judgment share the frame", () => {
    const cast = makeCast(63, []);
    const frame = settledRows(cast, 100, 30, "zh-Hant");
    expect(hasGlyph(frame)).toBe(true);
    expect(rowOf(frame, "卦辭 ·")).toBeGreaterThanOrEqual(0);
  });

  test("100x30 zh-Hant, 6 changing: glyph AND the 用九 text share the frame", () => {
    const cast = makeCast(1, [1, 2, 3, 4, 5, 6]);
    const frame = settledRows(cast, 100, 30, "zh-Hant");
    expect(hasGlyph(frame)).toBe(true);
    expect(rowOf(frame, "用九 ·")).toBeGreaterThanOrEqual(0);
  });

  test("100x30 en, 3 changing: the longer English texts win — the glyph yields", () => {
    const cast = makeCast(21, [1, 3, 4]);
    const frame = settledRows(cast, 100, 30, "en");
    expect(hasGlyph(frame)).toBe(false);
    expect(rowOf(frame, readingHint(cast, "en"))).toBeGreaterThanOrEqual(0);
  });

  test("100x40 en, 1 changing: room for everything — glyph, title, texts", () => {
    const cast = makeCast(21, [4]);
    const frame = settledRows(cast, 100, 40, "en");
    expect(hasGlyph(frame)).toBe(true);
    expect(rowOf(frame, readingHint(cast, "en"))).toBeGreaterThanOrEqual(0);
    expect(rowOf(frame, "Shì Kè")).toBeGreaterThanOrEqual(0); // pinyin title kept
  });
});
