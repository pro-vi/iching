import type { Hexagram } from "../types.js";
import { GUA } from "../data/gua.js";

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

/** Look up a hexagram by its binary encoding (0-63) */
export function hexagramByBinary(binary: number): Hexagram {
  // Honor the return contract: out of range, GUA[...] is undefined, but the
  // signature promises Hexagram — a consumer would get a confusing undefined
  // access instead of a clear error. (External review of the divination core.)
  if (!Number.isInteger(binary) || binary < 0 || binary > 63) {
    throw new RangeError(`hexagramByBinary: binary must be an integer in [0, 63], got ${binary}`);
  }
  return GUA[BINARY_TO_KW[binary] - 1];
}

/** Look up a hexagram by its King Wen number (1-64) */
export function hexagramByKW(kw: number): Hexagram {
  if (!Number.isInteger(kw) || kw < 1 || kw > 64) {
    throw new RangeError(`hexagramByKW: kw must be an integer in [1, 64], got ${kw}`);
  }
  return GUA[kw - 1];
}
