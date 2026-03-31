// morph-renderer.ts — render becoming transformation (line flip animation)

import type { CellBuffer } from "../../render/buffer.ts";
import type { StyledCell } from "../../render/cell.ts";
import type { CastModel } from "./model.ts";
import { GLYPHS, LINE_WIDTH } from "../../glyphs.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { anchorRow, LINE_ROW_OFFSETS } from "./hexagram-renderer.ts";

/**
 * Get the morph frame for a line transformation.
 *
 * @param isYangToYin - true if old yang (9) morphing to yin, false if old yin (6) morphing to yang
 * @param progress - 0 (original form) to 1 (transformed form)
 * @returns The frame string for this morph progress
 */
export function morphFrame(isYangToYin: boolean, progress: number): string {
  const frames = isYangToYin
    ? GLYPHS.changingYangToYin
    : GLYPHS.changingYinToYang;

  const clamped = Math.min(1, Math.max(0, progress));
  const maxFrame = frames.length - 1;
  const frameIndex = Math.min(maxFrame, Math.floor(clamped * frames.length));
  return frames[Math.min(frameIndex, maxFrame)];
}

/**
 * Render all morphing lines.
 * Called during the becoming transformation phase.
 */
export function renderMorph(
  buf: CellBuffer,
  model: CastModel,
  xOffset: number = 0,
): void {
  const t = getTheme();
  const anchor = anchorRow(buf.height);
  const changingPositions = model.cast.changingPositions;

  for (let ci = 0; ci < changingPositions.length; ci++) {
    const lineIndex = changingPositions[ci] - 1; // changingPositions is 1-indexed
    const lineState = model.lines[lineIndex];

    // Only render during active morph
    if (lineState.morphProgress <= 0 || lineState.morphComplete) continue;

    const line = model.cast.lines[lineIndex];
    const row = anchor + LINE_ROW_OFFSETS[lineIndex];

    if (row < 0 || row >= buf.height) continue;

    const isYangToYin = line.value === 9; // old yang morphs to yin
    const frameStr = morphFrame(isYangToYin, lineState.morphProgress);

    // Color ramp during morph: changingYang/changingYin -> glow -> primary
    const p = lineState.morphProgress;
    let fg: string;
    if (p < 0.33) {
      fg = isYangToYin ? t.changingYang : t.changingYin;
    } else if (p < 0.66) {
      fg = t.glow;
    } else {
      fg = t.primary;
    }

    const style: Partial<StyledCell> = { fg };
    const lineW = stringWidth(frameStr);
    const col = Math.max(0, Math.floor((buf.width - lineW) / 2) + xOffset);
    buf.writeText(row, col, frameStr, style);
  }
}
