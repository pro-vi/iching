// layout-calc.ts — pure layout math for side-by-side hexagram comparison
// and the settled-reveal vertical budget (glyph vs title vs reading texts).

export const MIN_SPLIT_WIDTH = 50;
export const SPLIT_OFFSET = 10;
export const ARROW_GAP = 5;

/**
 * How the settled reveal shares the rows below the hexagram between the
 * large glyph, the title block, and the reading panel. The oracle texts
 * are the heart of the reading — they win the budget fight; the glyph is
 * ornament and adapts or yields:
 *
 *  - "normal":  glyph at anchor+1, breathing row, title block, panel.
 *  - "compact": glyph hugs the hexagram at anchor, title yields its rows,
 *               the panel sits directly below the glyph.
 *  - "none":    even compact cannot host the texts — the glyph yields.
 */
export type GlyphRevealMode = "normal" | "compact" | "none";

/**
 * Decide the reveal mode for a glyph of `glyphHeight` rows, a title block
 * of `titleLines` rows, and a reading panel of `panelRows` rows, on a
 * terminal of `bufHeight` rows with the hexagram anchored at `anchor`.
 * The panel must end at or above bufHeight-3 (one row above the prompt bar).
 */
export function glyphRevealMode(
  bufHeight: number,
  anchor: number,
  glyphHeight: number,
  titleLines: number,
  panelRows: number,
): GlyphRevealMode {
  if (glyphHeight <= 0) return "none";
  // normal: glyph rows anchor+1..anchor+G, blank row, title, then the panel
  // (tight placement — the breathing row is the renderer's bonus when free).
  if (glyphHeight + titleLines + panelRows <= bufHeight - anchor - 4) return "normal";
  // compact: glyph rows anchor..anchor+G-1, panel directly below.
  if (glyphHeight + panelRows <= bufHeight - anchor - 2) return "compact";
  return "none";
}

/**
 * Title-block line count when the large glyph is shown (the glyph replaces
 * the CJK name). Mirrors titleLayout's hasGlyph branches: split shows the
 * pinyin only; centered English adds ename/translation/structure; centered
 * Chinese adds the structure line.
 */
export function glyphTitleLineCount(isSplit: boolean, english: boolean): number {
  if (isSplit) return 1;
  return english ? 4 : 2;
}

/** Can the terminal accommodate the side-by-side layout? */
export function canSplit(bufWidth: number): boolean {
  return bufWidth >= MIN_SPLIT_WIDTH;
}

/**
 * Returns the x-offset from natural center for left/right/center positions.
 *
 * @param side - Which hexagram position
 * @param splitProgress - 0 (centered) to 1 (fully split)
 * @returns Column offset from center (negative = left, positive = right)
 */
export function hexColOffset(
  side: "left" | "right" | "center",
  splitProgress: number,
): number {
  if (side === "center") return 0;
  const offset = Math.round(SPLIT_OFFSET * splitProgress);
  return side === "left" ? -offset : offset;
}
