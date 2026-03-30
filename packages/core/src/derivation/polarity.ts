import type { Line } from "../types.js";
import { linesToBinary } from "../casting/binary.js";
import { BINARY_TO_KW } from "../identify/lookup.js";

/** 錯卦 — Invert all lines (yang<->yin) — complementary opposite */
export function polarity(lines: Line[]): number {
  const inverted = lines.map((l) => ({ ...l, isYang: !l.isYang }));
  return BINARY_TO_KW[linesToBinary(inverted)];
}
