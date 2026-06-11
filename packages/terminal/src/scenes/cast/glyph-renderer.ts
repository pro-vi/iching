// glyph-renderer.ts — render large braille glyph in the cast scene

import type { DisplayLanguage } from "@iching/core";
import type { CellBuffer } from "../../render/buffer.ts";
import type { CastModel } from "./model.ts";
import { anchorRow } from "./hexagram-renderer.ts";
import { glyphDisplayMode } from "./reveal-renderer.ts";
import { getTheme } from "../../color/theme.ts";

/**
 * Render the large glyph (animated or static) below the hexagram.
 * Centered horizontally; the row follows the shared reveal budget
 * (glyphDisplayMode): anchor+1 normally, hugging the hexagram at
 * `anchor` in compact mode, and yielding entirely to the reading
 * texts when there is no room ("none").
 */
export function renderLargeGlyph(
  buf: CellBuffer,
  model: CastModel,
  language: DisplayLanguage = "en",
): void {
  if (!model.glyphAnimator && !model.glyphAnimDone) return;

  const mode = glyphDisplayMode(buf, model, language);
  if (mode === "none") return;

  const anchor = anchorRow(buf.height);
  const glyphRow = mode === "compact" ? anchor : anchor + 1;

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
