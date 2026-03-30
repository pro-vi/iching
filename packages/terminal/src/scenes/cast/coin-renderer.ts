// coin-renderer.ts — render 3 coins based on coin phase and progress

import type { CellBuffer } from "../../render/buffer.ts";
import type { StyledCell } from "../../render/cell.ts";
import type { CastModel } from "./model.ts";
import { GLYPHS, LINE_WIDTH } from "../../glyphs.ts";
import { TEMPLE_NIGHT } from "../../color/themes/temple-night.ts";

/** Render the 3 coins at the given row, centered in the buffer. */
export function renderCoins(
  buf: CellBuffer,
  model: CastModel,
  row: number,
): void {
  const { coinPhase, coinProgress, coinResults } = model;
  if (coinPhase === "done" || coinPhase === "idle") return;

  // Center coins on the same axis as the hexagram lines
  // Lines are LINE_WIDTH (15) chars, centered at (buf.width - LINE_WIDTH) / 2 + floor(LINE_WIDTH / 2)
  const lineLeft = Math.floor((buf.width - LINE_WIDTH) / 2);
  const centerCol = lineLeft + Math.floor(LINE_WIDTH / 2);

  // Coins spaced 4 apart: [-4, 0, +4]
  const offsets = [-4, 0, 4];

  for (let i = 0; i < 3; i++) {
    const col = centerCol + offsets[i];
    const p = coinProgress[i];

    let char: string;
    let style: Partial<StyledCell>;

    switch (coinPhase) {
      case "spin": {
        // Spin through quarter-circle glyphs, each coin out of phase
        const frameIndex = Math.floor(p * (GLYPHS.coinSpin.length * 2)) % GLYPHS.coinSpin.length;
        char = GLYPHS.coinSpin[frameIndex];
        // Color ramp: mist at start, stone at middle, gold at end
        const fg = p < 0.5 ? TEMPLE_NIGHT.mist : TEMPLE_NIGHT.stone;
        style = { fg };
        break;
      }
      case "land": {
        // Show the landed result
        const isHeads = coinResults[i];
        char = isHeads ? GLYPHS.coinHeads : GLYPHS.coinTails;
        style = { fg: TEMPLE_NIGHT.gold };
        break;
      }
      case "collapse": {
        // Collapse animation: coins shrink toward center
        if (p < 0.5) {
          // Still showing coins
          const isHeads = coinResults[i];
          char = isHeads ? GLYPHS.coinHeads : GLYPHS.coinTails;
          style = { fg: TEMPLE_NIGHT.stone, dim: true };
        } else {
          // Collapsed — only center coin visible as dot
          if (i === 1) {
            char = "\u00B7"; // middle dot
            style = { fg: TEMPLE_NIGHT.ash };
          } else {
            continue;
          }
        }
        break;
      }
      default:
        continue;
    }

    buf.writeText(row, col, char, style);
  }
}

/**
 * Get the glyph for a coin at a given spin progress.
 * Exported for testing.
 */
export function coinSpinGlyph(progress: number, coinIndex: number): string {
  const frameIndex =
    Math.floor(progress * (GLYPHS.coinSpin.length * 2)) % GLYPHS.coinSpin.length;
  return GLYPHS.coinSpin[frameIndex];
}

/**
 * Get the landed glyph for a coin result.
 * Exported for testing.
 */
export function coinLandGlyph(isHeads: boolean): string {
  return isHeads ? GLYPHS.coinHeads : GLYPHS.coinTails;
}
