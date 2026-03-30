// Layout helpers for rasterizing content into a CellBuffer

import { CellBuffer } from "./buffer.ts";
import type { StyledCell } from "./cell.ts";
import { stringWidth, centerPad } from "../layout/measure.ts";

/**
 * Center a set of text lines vertically and horizontally within a buffer.
 * Returns a new CellBuffer with the content centered.
 */
export function centerBlock(
  lines: string[],
  width: number,
  height: number,
  style?: Partial<StyledCell>,
): CellBuffer {
  const buf = CellBuffer.create(width, height);
  const startRow = Math.max(0, Math.floor((height - lines.length) / 2));

  for (let i = 0; i < lines.length; i++) {
    const row = startRow + i;
    if (row >= height) break;
    const centered = centerPad(lines[i], width);
    buf.writeText(row, 0, centered, style);
  }

  return buf;
}

/**
 * Write lines into a buffer starting at a given row, horizontally centered.
 */
export function writeBlockCentered(
  buf: CellBuffer,
  startRow: number,
  lines: string[],
  style?: Partial<StyledCell>,
): void {
  for (let i = 0; i < lines.length; i++) {
    const row = startRow + i;
    if (row >= buf.height) break;
    const lineWidth = stringWidth(lines[i]);
    const col = Math.max(0, Math.floor((buf.width - lineWidth) / 2));
    buf.writeText(row, col, lines[i], style);
  }
}
