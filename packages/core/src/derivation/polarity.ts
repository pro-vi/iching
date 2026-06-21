import type { Line } from "../types.js";
import { kwFromLines } from "../identify/lookup.js";
import { invertLines } from "./invert-lines.js";

/** 錯卦 — Invert all lines (yang<->yin) — complementary opposite */
export function polarity(lines: Line[]): number {
  return kwFromLines(invertLines(lines));
}
