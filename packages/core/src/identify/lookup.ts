import type { Hexagram, Line } from "../types.js";
import { GUA } from "../data/gua.js";
import { linesToBinary } from "../casting/binary.js";

/**
 * Binary-to-King-Wen lookup table.
 * Binary value = lower_trigram + upper_trigram * 8
 * Trigram values: 坤=0, 震=1, 坎=2, 兌=3, 艮=4, 離=5, 巽=6, 乾=7
 *
 * Returns 1-indexed King Wen numbers (1-64) to match traditional I Ching numbering.
 * Access GUA array with: GUA[kwNumber - 1]
 */
export const BINARY_TO_KW: number[] = [
  2, 24, 7, 19, 15, 36, 46, 11, 16, 51, 40, 54, 62, 55, 32, 34, 8, 3, 29, 60,
  39, 63, 48, 5, 45, 17, 47, 58, 31, 49, 28, 43, 23, 27, 4, 41, 52, 22, 18,
  26, 35, 21, 64, 38, 56, 30, 50, 14, 20, 42, 59, 61, 53, 37, 57, 9, 12, 25,
  6, 10, 33, 13, 44, 1,
];

/** Throw a RangeError unless `value` is an integer within [lo, hi]. `label` names
 *  the offending parameter for the message (e.g. "hexagramByKW: kw"). */
function assertIntInRange(value: number, lo: number, hi: number, label: string): void {
  if (!Number.isInteger(value) || value < lo || value > hi) {
    throw new RangeError(`${label} must be an integer in [${lo}, ${hi}], got ${value}`);
  }
}

/** Look up a hexagram by its binary encoding (0-63) */
export function hexagramByBinary(binary: number): Hexagram {
  // Honor the return contract: out of range, GUA[...] is undefined, but the
  // signature promises Hexagram — a consumer would get a confusing undefined
  // access instead of a clear error. (External review of the divination core.)
  assertIntInRange(binary, 0, 63, "hexagramByBinary: binary");
  return GUA[BINARY_TO_KW[binary] - 1];
}

/**
 * The King Wen number (1-64) for a set of six lines — linesToBinary, then the
 * table lookup. The four line-derivations (nuclear 互 / polarity 錯 / mirror 綜 /
 * diagonal 對角) each transform the lines and resolve the result this way; this
 * is that shared tail, so the transform stays the visible part of each.
 */
export function kwFromLines(lines: Line[]): number {
  return BINARY_TO_KW[linesToBinary(lines)];
}

/** Look up a hexagram by its King Wen number (1-64) */
export function hexagramByKW(kw: number): Hexagram {
  assertIntInRange(kw, 1, 64, "hexagramByKW: kw");
  return GUA[kw - 1];
}

/**
 * King Wen number (1–64) of a hexagram — the inverse of hexagramByKW. `hex` must be
 * an element of the canonical GUA array (identity comparison); returns 0 otherwise.
 */
export function kwOf(hex: Hexagram): number {
  return GUA.indexOf(hex) + 1;
}
