// reading-renderer.ts — the oracle texts of the reading, below the title block.
//
// Once the reveal settles, the texts a reading is classically made of appear
// (built by reading-lines.ts). The vertical anchor comes from titleLayout,
// which already budgets the space against the large glyph — the texts win
// that budget fight (see glyphDisplayMode in reveal-renderer.ts).

import type { DisplayLanguage } from "@iching/core";
import type { CellBuffer } from "../../render/buffer.ts";
import type { CastModel } from "./model.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { titleLayout } from "./reveal-renderer.ts";
import { buildReadingLines, readingPanelWidth } from "./reading-lines.ts";

// Re-exports — the panel's line construction lives in reading-lines.ts.
export { buildReadingLines, readingHint, type ReadingLine } from "./reading-lines.ts";

/**
 * Render the reading panel between the title block and the prompt bar.
 * Skips itself entirely when the terminal leaves no room — the detail
 * view remains the full reference.
 */
export function renderReadingPanel(
  buf: CellBuffer,
  model: CastModel,
  language: DisplayLanguage,
): void {
  const t = getTheme();
  const { baseRow, lines: titleLines } = titleLayout(buf, model, language);
  const endRow = buf.height - 3; // one row above the prompt bar

  // Prefer a breathing row after the title; surrender it when the texts
  // need the space.
  const gapStart = baseRow + titleLines.length + 1;
  const tightStart = baseRow + titleLines.length;
  const tightBudget = endRow - tightStart + 1;
  if (tightBudget < 1) return;

  const width = readingPanelWidth(buf.width);
  const panel = buildReadingLines(model.cast, language, width, tightBudget);
  const startRow = panel.length <= endRow - gapStart + 1 ? gapStart : tightStart;

  for (let i = 0; i < panel.length; i++) {
    const row = startRow + i;
    if (row < 0 || row >= buf.height) break;
    const line = panel[i];
    const w = stringWidth(line.text);
    const col = Math.max(0, Math.floor((buf.width - w) / 2));
    if (line.role === "hint" || line.role === "more") {
      buf.writeText(row, col, line.text, { fg: t.tertiary, dim: true });
    } else {
      buf.writeText(row, col, line.text, { fg: t.secondary });
    }
  }
}
