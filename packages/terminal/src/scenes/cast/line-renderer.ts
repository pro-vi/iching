// line-renderer.ts — render a single hexagram line at a given progress

import type { CellBuffer } from "../../render/buffer.ts";
import type { StyledCell } from "../../render/cell.ts";
import { GLYPHS, LINE_WIDTH } from "../../glyphs.ts";
import { TEMPLE_NIGHT } from "../../color/themes/temple-night.ts";
import { stringWidth } from "../../layout/measure.ts";

/**
 * Render a single hexagram line centered in the buffer at the given row.
 *
 * @param buf - Target buffer
 * @param row - Row to render at
 * @param isYang - true for solid line, false for broken (yin)
 * @param progress - 0 (invisible) to 1 (fully drawn)
 * @param color - Override foreground color (for glow effects)
 */
export function renderLine(
  buf: CellBuffer,
  row: number,
  isYang: boolean,
  progress: number,
  color?: string,
): void {
  if (progress <= 0) return;

  const frames = isYang ? GLYPHS.yangFrames : GLYPHS.yinFrames;
  const maxFrame = frames.length - 1;

  // Map progress 0-1 to frame index 0-maxFrame
  const clamped = Math.min(1, Math.max(0, progress));
  const frameIndex = Math.min(maxFrame, Math.floor(clamped * frames.length));
  const frameStr = frames[Math.min(frameIndex, maxFrame)];

  // Color ramp: ash -> stone -> bone based on progress
  let fg: string;
  if (color) {
    fg = color;
  } else if (clamped < 0.33) {
    fg = TEMPLE_NIGHT.ash;
  } else if (clamped < 0.66) {
    fg = TEMPLE_NIGHT.stone;
  } else {
    fg = TEMPLE_NIGHT.bone;
  }

  const style: Partial<StyledCell> = { fg };
  const lineW = stringWidth(frameStr);
  const col = Math.max(0, Math.floor((buf.width - lineW) / 2));
  buf.writeText(row, col, frameStr, style);
}

/**
 * Get the frame string for a line at a given progress.
 * Exported for testing.
 */
export function lineFrame(isYang: boolean, progress: number): string {
  const frames = isYang ? GLYPHS.yangFrames : GLYPHS.yinFrames;
  const maxFrame = frames.length - 1;
  const clamped = Math.min(1, Math.max(0, progress));
  const frameIndex = Math.min(maxFrame, Math.floor(clamped * frames.length));
  return frames[frameIndex];
}
