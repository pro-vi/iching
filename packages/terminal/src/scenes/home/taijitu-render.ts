// Taijitu — rotating yin-yang renderer using braille dot patterns.
// Monochrome: no fg/bg set, cells inherit the terminal's default text color.
// Blank regions are achieved by simply not writing a cell.

import type { CellBuffer } from "../../render/buffer.ts";

export type TaijituStyle = "dots" | "dense";

type Region = 0 | 1 | 2;
const YANG: Region = 0;
const YIN: Region = 1;
const BG: Region = 2;

// Unicode braille dot bit positions for a 2×4 grid (col → row → bit):
//   col 0: rows 0..3 → bits 0, 1, 2, 6
//   col 1: rows 0..3 → bits 3, 4, 5, 7
const DOT_BITS: readonly (readonly number[])[] = [
  [0, 1, 2, 6],
  [3, 4, 5, 7],
];

// Sparse stipple pattern used when rendering the minority region in the
// "dense/sparse" styles. Top-left and bottom-right braille dots only.
const SPARSE_MASK = 0b10000001;

/**
 * Render a rotating taijitu centered at (centerCol, centerRow) in cell coords.
 * `radius` is in pixel units where 1 pixel = 1 cell wide ≈ ½ cell tall,
 * so the rendered footprint is 2R cells wide × R cells tall.
 */
export function renderTaijitu(
  buf: CellBuffer,
  centerCol: number,
  centerRow: number,
  radius: number,
  theta: number,
  style: TaijituStyle,
): void {
  if (radius < 4) return;

  const R = radius;
  const R2 = R * R;
  const halfR = R / 2;
  const halfR2 = halfR * halfR;
  const dotR = Math.max(R / 8, 0.9);
  const dotR2 = dotR * dotR;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const startCol = Math.floor(centerCol - R) - 1;
  const endCol = Math.ceil(centerCol + R) + 1;
  const startRow = Math.floor(centerRow - R / 2) - 1;
  const endRow = Math.ceil(centerRow + R / 2) + 1;

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cpx = col + 0.5 - centerCol;
      const cpy = 2 * (row - centerRow);

      let yangBits = 0;
      let yinBits = 0;

      for (let colIdx = 0; colIdx < 2; colIdx++) {
        const dx = colIdx === 0 ? -0.25 : 0.25;
        for (let rowIdx = 0; rowIdx < 4; rowIdx++) {
          const dy = rowIdx * 0.5 - 0.75;
          const reg = regionAt(cpx + dx, cpy + dy, R2, halfR, halfR2, dotR2, cosT, sinT);
          if (reg === YANG) {
            yangBits |= 1 << DOT_BITS[colIdx][rowIdx];
          } else if (reg === YIN) {
            yinBits |= 1 << DOT_BITS[colIdx][rowIdx];
          }
        }
      }

      const bits = style === "dense"
        ? yangBits | (yinBits & SPARSE_MASK)
        : yangBits;

      if (bits === 0) continue;

      buf.setCell(row, col, { char: String.fromCharCode(0x2800 + bits) });
    }
  }
}

function regionAt(
  px: number,
  py: number,
  R2: number,
  halfR: number,
  halfR2: number,
  dotR2: number,
  cosT: number,
  sinT: number,
): Region {
  if (px * px + py * py > R2) return BG;

  // Inverse-rotate the query point so the figure spins.
  const rx = px * cosT + py * sinT;
  const ry = -px * sinT + py * cosT;

  // Top head in screen coords (py negative is up), centered at py = -R/2
  const dyTop = ry + halfR;
  const distTop2 = rx * rx + dyTop * dyTop;
  // Bottom head centered at py = +R/2
  const dyBot = ry - halfR;
  const distBot2 = rx * rx + dyBot * dyBot;

  // Eye dots: opposite color of containing head, take precedence
  if (distTop2 < dotR2) return YANG;
  if (distBot2 < dotR2) return YIN;

  // Heads
  if (distTop2 < halfR2) return YIN;
  if (distBot2 < halfR2) return YANG;

  // S-curve divider: right of vertical axis is yang, left is yin
  return rx > 0 ? YANG : YIN;
}
