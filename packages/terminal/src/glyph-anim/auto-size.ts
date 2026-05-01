// auto-size.ts — pick the largest glyph size that fits the available space

import type { GlyphSize } from "@iching/core";

// Per-character cell dimensions for each glyph size (matches large-glyphs.ts).
const SIZE_DIMS: Record<GlyphSize, { rows: number; cols: number }> = {
  32: { rows: 8, cols: 16 },
  48: { rows: 12, cols: 24 },
  64: { rows: 16, cols: 32 },
};

const CHAR_GAP = 1; // matches CHAR_GAP in compose.ts

/**
 * Pick the largest GlyphSize whose composed width × height fits within the
 * available cells. Falls back to 32 if even that doesn't fit.
 */
export function autoGlyphSize(
  availRows: number,
  availCols: number,
  charCount: number,
): GlyphSize {
  for (const size of [64, 48, 32] as const) {
    const dims = SIZE_DIMS[size];
    const totalCols =
      dims.cols * charCount + CHAR_GAP * Math.max(0, charCount - 1);
    if (dims.rows <= availRows && totalCols <= availCols) return size;
  }
  return 32;
}
