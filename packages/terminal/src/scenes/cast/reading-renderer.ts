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
export { buildReadingLines, type ReadingLine } from "./reading-lines.ts";

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

  // Left-align the reading to a common left edge (the centered panel block's
  // left), so the moving-line 爻辭 read as a top-down list rather than a stack
  // of separately-centered lines.
  const leftCol = Math.max(0, Math.floor((buf.width - width) / 2));

  for (let i = 0; i < panel.length; i++) {
    const row = startRow + i;
    if (row < 0 || row >= buf.height) break;
    const line = panel[i];
    if (line.role === "more") {
      buf.writeText(row, leftCol, line.text, { fg: t.tertiary, dim: true });
    } else if (line.labeled) {
      // Dim the type-label ("卦辭 · ", "Judgment · ", "4 · ") up to and including
      // the separator, so the canonical text leads — the 觀象 label hierarchy.
      // The first "·" is always the separator (it precedes any oracle text).
      const dot = line.text.indexOf("·");
      const split = dot >= 0 ? Math.min(line.text.length, dot + 2) : 0;
      const label = line.text.slice(0, split);
      const rest = line.text.slice(split);
      if (label) buf.writeText(row, leftCol, label, { fg: t.tertiary, dim: true });
      buf.writeText(row, leftCol + stringWidth(label), rest, { fg: t.secondary });
    } else {
      buf.writeText(row, leftCol, line.text, { fg: t.secondary });
    }
  }
}
