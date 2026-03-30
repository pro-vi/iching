import type { Line } from "../types.js";

/**
 * Compute hexagram binary value from lines.
 * Line 1 (bottom) = LSB, yang=1, yin=0.
 */
export function linesToBinary(lines: Line[]): number {
  let binary = 0;
  for (let i = 0; i < 6; i++) {
    if (lines[i].isYang) {
      binary |= 1 << i;
    }
  }
  return binary;
}
