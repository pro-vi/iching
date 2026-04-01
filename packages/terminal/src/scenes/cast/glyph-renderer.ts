// glyph-renderer.ts — render large braille glyph in the cast scene

import type { CellBuffer } from "../../render/buffer.ts";
import type { CastModel } from "./model.ts";
import { anchorRow } from "./hexagram-renderer.ts";
import { getTheme } from "../../color/theme.ts";

/**
 * Render the large glyph (animated or static) below the hexagram.
 * Placed at anchor + 1 and centered horizontally.
 */
export function renderLargeGlyph(
  buf: CellBuffer,
  model: CastModel,
): void {
  if (!model.glyphAnimator && !model.glyphAnimDone) return;

  const anchor = anchorRow(buf.height);
  const glyphRow = anchor + 1; // just below hexagram bottom line

  // Get current glyph entry (primary or becoming based on focus)
  const entry =
    model.focusedHex === "primary"
      ? model.primaryGlyphEntry
      : model.becomingGlyphEntry;
  if (!entry) return;

  const glyphCol = Math.max(0, Math.floor((buf.width - entry.width) / 2));

  if (model.glyphAnimator && !model.glyphAnimDone) {
    model.glyphAnimator.render(buf, glyphRow, glyphCol);
  } else if (entry) {
    // Static render of settled glyph
    const t = getTheme();
    for (let r = 0; r < entry.height; r++) {
      const chars = [...(entry.rows[r] ?? "")];
      for (let c = 0; c < chars.length; c++) {
        if (chars[c] === "\u2800" || chars[c] === " ") continue;
        buf.writeText(glyphRow + r, glyphCol + c, chars[c], { fg: t.primary });
      }
    }
  }
}
