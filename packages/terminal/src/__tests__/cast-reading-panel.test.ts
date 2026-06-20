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
import type { Cast, DisplayLanguage } from "@iching/core";
import { GUA } from "@iching/core";
import { castOf } from "@iching/core/testing";
import { CastScene, type CastGlyphInput } from "../scenes/cast/cast-scene.ts";
import { buildReadingLines, readingPanelWidth } from "../scenes/cast/reading-lines.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";

const GLYPH_CFG: CastGlyphInput = { glyphAnim: "dots", glyphFont: "kaiti" };

/** A correct Cast for `primary` with the given changing positions. */

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
  // Settle directly to the static end-state (glyph included). The virtual clock
  // now advances by the clamped per-frame dt, so a single big update() no longer
  // fast-forwards the glyph; skipToComplete(false) IS the settled state.
  scene.skipToComplete(false);
  const ctx: SceneContext = { cols, rows, done: false, colorSupport: "truecolor", language };
  scene.update(0, 0, ctx);
  expect(scene.getModel().showPrompt).toBe(true);
  // The reading is hidden by default; reveal it with [r] — these tests verify
  // how the reading renders (survives the glyph, fits, left-aligns), so it must
  // be on screen.
  scene.handleKey({ type: "char", char: "r" }, ctx);
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

// 0/1/3/4/5/6 changing lines, with correctly derived becoming hexagrams.
const CASES: Array<{ label: string; cast: Cast }> = [
  { label: "0 changing (hex 63)", cast: castOf(63, { changing: [] }) },
  { label: "1 changing (hex 21, line 4)", cast: castOf(21, { changing: [4] }) },
  { label: "3 changing (hex 21, lines 1·3·4)", cast: castOf(21, { changing: [1, 3, 4] }) },
  { label: "4 changing (hex 21 → becoming 卦辭)", cast: castOf(21, { changing: [1, 2, 3, 4] }) },
  { label: "5 changing (hex 21 → becoming 卦辭)", cast: castOf(21, { changing: [1, 2, 3, 4, 5] }) },
  { label: "6 changing (hex 1 → 用九)", cast: castOf(1, { changing: [1, 2, 3, 4, 5, 6] }) },
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
          const firstText = panel.find((l) => l.role === "text");
          expect(firstText).toBeDefined();

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
    const cast = castOf(21, { changing: [4] });
    const frame = settledRows(cast, 100, 30, "zh-Hant");
    expect(hasGlyph(frame)).toBe(true);
    expect(rowOf(frame, GUA[20].yao[3])).toBeGreaterThanOrEqual(0);
  });

  test("100x30 zh-Hant, 0 changing: glyph AND the judgment share the frame", () => {
    const cast = castOf(63, { changing: [] });
    const frame = settledRows(cast, 100, 30, "zh-Hant");
    expect(hasGlyph(frame)).toBe(true);
    expect(rowOf(frame, "卦辭 ·")).toBeGreaterThanOrEqual(0);
  });

  test("100x30 zh-Hant, 6 changing: glyph AND the 用九 text share the frame", () => {
    const cast = castOf(1, { changing: [1, 2, 3, 4, 5, 6] });
    const frame = settledRows(cast, 100, 30, "zh-Hant");
    expect(hasGlyph(frame)).toBe(true);
    expect(rowOf(frame, "用九 ·")).toBeGreaterThanOrEqual(0);
  });

  test("100x30 en, 3 changing: both judgments (longer) win — the glyph yields", () => {
    const cast = castOf(21, { changing: [1, 3, 4] }); // 3 moving → primary + becoming 卦辭
    const frame = settledRows(cast, 100, 30, "en");
    expect(hasGlyph(frame)).toBe(false);
    expect(rowOf(frame, "Biting through brings success")).toBeGreaterThanOrEqual(0); // primary 卦辭 (gcEnW)
  });

  test("100x40 en, 1 changing: room for everything — glyph, title, texts", () => {
    const cast = castOf(21, { changing: [4] });
    const frame = settledRows(cast, 100, 40, "en");
    expect(hasGlyph(frame)).toBe(true);
    expect(rowOf(frame, "Biting on dried gristly meat")).toBeGreaterThanOrEqual(0); // line 4
    expect(rowOf(frame, "Shì Kè")).toBeGreaterThanOrEqual(0); // pinyin title kept
  });

  test("the title block never orphans below the prompt bar at small heights", () => {
    // The title rows are placed at fixed anchor offsets; at cramped heights the
    // becoming title used to spill onto the prompt row and the last line below
    // it. The title now clips at the prompt bar (height - 2) like the panel.
    const cast = castOf(21, { changing: [4] }); // a becoming cast → has a becoming title
    for (const [cols, rows] of [[44, 24], [80, 12]] as Array<[number, number]>) {
      const frame = settledRows(cast, cols, rows, "en");
      expect(frame[rows - 1].trim()).toBe(""); // nothing below the prompt bar
      expect(frame[rows - 2]).toContain("["); // the prompt bar is intact
    }
  });

  test("the type-label dims and leads; the canonical text is brighter and follows", () => {
    // 0 changing → "卦辭 · <judgment>" on one row at 100x30. The label glyphs
    // ("卦辭 · ") render dim/tertiary; the oracle text after the separator is
    // the brighter secondary. Assert the row carries both, label-cells first.
    const cast = castOf(63, { changing: [] });
    const scene = new CastScene(cast, "default", 100, GLYPH_CFG, 30, undefined, {
      language: "zh-Hant",
    });
    scene.skipToComplete();
    const ctx: SceneContext = {
      cols: 100,
      rows: 30,
      done: false,
      colorSupport: "truecolor",
      language: "zh-Hant",
    };
    scene.update(0, 0, ctx);
    scene.update(120_000, 33, ctx);
    scene.handleKey({ type: "char", char: "r" }, ctx); // reveal the reading
    const frame = CellBuffer.create(100, 30);
    scene.render(frame, ctx);

    // Locate the judgment row (the one bearing 卦辭).
    let judgRow = -1;
    for (let r = 0; r < frame.height && judgRow < 0; r++) {
      let line = "";
      for (let c = 0; c < frame.width; c++) line += frame.getCell(r, c).char;
      if (line.includes("卦辭")) judgRow = r;
    }
    expect(judgRow).toBeGreaterThanOrEqual(0);

    // Walk the non-space cells: the label ones are dim, the text ones are not,
    // and every dim cell precedes every bright cell (label leads, text follows).
    const cells: Array<{ col: number; dim: boolean; fg?: string }> = [];
    for (let c = 0; c < frame.width; c++) {
      const cell = frame.getCell(judgRow, c);
      if (cell.char.trim() !== "") cells.push({ col: c, dim: cell.dim === true, fg: cell.fg });
    }
    const dimCols = cells.filter((x) => x.dim).map((x) => x.col);
    const brightCols = cells.filter((x) => !x.dim).map((x) => x.col);
    expect(dimCols.length).toBeGreaterThan(0); // a dim label is present
    expect(brightCols.length).toBeGreaterThan(0); // and brighter oracle text
    expect(Math.max(...dimCols)).toBeLessThan(Math.min(...brightCols)); // label leads
    // The two registers are genuinely different colors.
    const labelFg = cells.find((x) => x.dim)!.fg;
    const textFg = cells.find((x) => !x.dim)!.fg;
    expect(labelFg).not.toBe(textFg);
  });

  test("80x24 en, 0 changing: the WHOLE English judgment is on screen, not truncated", () => {
    // Regression for the headline bug: at the standard 24-row terminal the
    // no-glyph English title used to take four rows, leaving the judgment only
    // its first wrapped line + "…". The title now sheds its optional image and
    // trigram rows so the reading is whole. 坤's judgment is multi-line; its LAST
    // line (the load-bearing clause) must be on screen, with no "…".
    const cast = castOf(2, { changing: [] });
    const frame = settledRows(cast, 80, 24, "en");
    const footerRow = 24 - 2;
    const panel = buildReadingLines(cast, "en", readingPanelWidth(80), Number.MAX_SAFE_INTEGER);
    const lastText = panel.filter((l) => l.role === "text").at(-1)!;
    expect(panel.length).toBeGreaterThan(2); // a genuinely multi-line judgment
    const lastRow = rowOf(frame, lastText.text.trim());
    expect(lastRow).toBeGreaterThanOrEqual(0); // the final line rendered…
    expect(lastRow).toBeLessThan(footerRow); // …above the footer…
    expect(rowOf(frame, "…")).toBe(-1); // …and nothing was elided
  });

  test("80x24 en: the headline fix holds across ALL 64 — only the longest few truncate", () => {
    // Exhaustive lock for the headline regression (it once truncated 53/64 EN
    // judgments at the standard terminal). The title-yields fix recovers all but
    // the longest Legge judgments, which can't fit 24 rows even after the title
    // sheds its optional rows and degrade gracefully (… + the detail view). This
    // pins the coverage so a regression to the title block re-breaks loudly.
    let truncated = 0;
    const footerRow = 24 - 2;
    for (let kw = 1; kw <= 64; kw++) {
      const cast = castOf(kw, { changing: [] }); // 0 changing → the judgment IS the reading
      const frame = settledRows(cast, 80, 24, "en");
      const panel = buildReadingLines(cast, "en", readingPanelWidth(80), Number.MAX_SAFE_INTEGER);
      const lastText = panel.filter((l) => l.role === "text").at(-1);
      if (!lastText) continue;
      // Whole iff the real last line reached the screen above the footer; a
      // truncated panel replaces its tail with "…", so the full line won't show.
      const lastRow = rowOf(frame, lastText.text.trim());
      if (lastRow < 0 || lastRow >= footerRow) truncated++;
    }
    // ≤15 today (the irreducible long-judgment limit at 80×24). A jump above
    // this means the title stopped yielding and the headline bug is back.
    expect(truncated).toBeLessThanOrEqual(15);
  });
});

describe("cast-scene polish (review #3, #9)", () => {
  function renderAt(cast: Cast, cols: number, rows: number, showReading: boolean): string {
    const scene = new CastScene(cast, "default", cols, GLYPH_CFG, rows);
    scene.skipToComplete(false); // settled end-state (clamped-dt clock; see settledRows)
    const ctx: SceneContext = { cols, rows, done: false, colorSupport: "truecolor", language: "en" };
    scene.update(0, 0, ctx);
    if (showReading) scene.handleKey({ type: "char", char: "r" }, ctx); // reveal the reading
    const frame = CellBuffer.create(cols, rows);
    scene.render(frame, ctx);
    let text = "";
    for (let r = 0; r < frame.height; r++) {
      for (let c = 0; c < frame.width; c++) text += frame.getCell(r, c).char;
      text += "\n";
    }
    return text;
  }

  test("#3: [s] settles the glyph instead of re-seeding its reveal", () => {
    // skipToComplete(false) from the [s] handler: the central glyph snaps to its
    // static end-state. The old default (true) re-seeded a fresh animator
    // (glyphAnimDone=false), noisily re-playing the whole reveal.
    const scene = new CastScene(castOf(1, { changing: [] }), "default", 80, GLYPH_CFG, 40);
    const ctx: SceneContext = { cols: 80, rows: 40, done: false, colorSupport: "truecolor", language: "en" };
    scene.update(0, 0, ctx);
    scene.update(120, 33, ctx); // mid-reveal: the glyph is animating, not done
    expect(scene.getModel().showPrompt).toBe(false);
    scene.handleKey({ type: "char", char: "s" }, ctx);
    expect(scene.getModel().glyphAnimDone).toBe(true); // settled…
    expect(scene.getModel().glyphAnimator).toBeNull(); // …not re-seeded to replay
  });

  test("#9: centered+becoming suppresses the standalone becoming title when the reading shows", () => {
    // Tall-narrow (< MIN_SPLIT_WIDTH → centered, no side-by-side; no glyph either)
    // renders the "→ <becoming>" title a few rows below the primary — exactly
    // where the reading panel stacks down. Suppressed while the reading shows (it
    // carries the becoming) so the two don't garble each other. The becoming
    // hexagram NAME is the marker (it appears only in that title here — the 1-
    // moving-line reading is the line text, and the footer "[←→]" is not it).
    const cast = castOf(11, { changing: [2] }); // 泰 line 2 → a real becoming
    const becomingName = GUA[cast.becoming! - 1].n;

    const shown = renderAt(cast, 40, 30, /* showReading */ true);
    expect(/[⠀-⣿]/.test(shown)).toBe(false); // no glyph at this width
    expect(shown).not.toContain(becomingName); // the becoming title is suppressed
    expect(shown).toContain("·"); // …while the reading itself still renders

    // [r]-hidden, the becoming title comes back (nothing to overlap).
    const hidden = renderAt(cast, 40, 30, /* showReading */ false);
    expect(hidden).toContain(becomingName);
  });
});
