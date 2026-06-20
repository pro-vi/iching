import type { Line } from "../types.js";
import { kwFromLines } from "../identify/lookup.js";

/** 錯卦 — Invert all lines (yang<->yin) — complementary opposite */
export function polarity(lines: Line[]): number {
  const inverted = lines.map((l) => ({ ...l, isYang: !l.isYang }));
  return kwFromLines(inverted);
}
