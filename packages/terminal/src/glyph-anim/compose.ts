// compose.ts — compose multi-character glyph entries side by side

import type { GlyphEntry, GlyphFont, GlyphSize } from "@iching/core";
import { LARGE_GLYPHS } from "@iching/core";

const CHAR_GAP = 1; // braille columns between characters

/**
 * Look up and compose a multi-character name into a single GlyphEntry.
 * Each character is placed side by side with a small gap.
 *
 * Returns null if any character is missing from the glyph data.
 */
export function composeGlyph(
  name: string,
  font: GlyphFont,
  size: GlyphSize,
): GlyphEntry | null {
  const chars = [...name];

  if (chars.length === 0) return null;

  // Look up each character
  const entries: GlyphEntry[] = [];
  for (const ch of chars) {
    const entry = LARGE_GLYPHS[ch]?.[font]?.[size];
    if (!entry) return null;
    entries.push(entry);
  }

  // Single character — return as-is
  if (entries.length === 1) return entries[0];

  // Compose side by side
  // Total width = sum of widths + gaps between
  const totalWidth = entries.reduce((sum, e) => sum + e.width, 0) + CHAR_GAP * (entries.length - 1);

  // Height = max height (pad shorter ones with empty rows)
  const maxHeight = Math.max(...entries.map(e => e.height));

  const EMPTY_BRAILLE = "\u2800";
  const composedRows: string[] = [];

  for (let r = 0; r < maxHeight; r++) {
    let row = "";
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (r < entry.height) {
        row += entry.rows[r];
      } else {
        // Pad with empty braille
        row += EMPTY_BRAILLE.repeat(entry.width);
      }
      // Gap between characters (not after the last one)
      if (i < entries.length - 1) {
        row += EMPTY_BRAILLE.repeat(CHAR_GAP);
      }
    }
    composedRows.push(row);
  }

  return {
    rows: composedRows,
    width: totalWidth,
    height: maxHeight,
  };
}
