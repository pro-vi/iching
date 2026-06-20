import type { Line } from "../types.js";
import { kwFromLines } from "../identify/lookup.js";
import { invertLines } from "./invert-lines.js";

/** 對角卦 — Invert all lines then reverse (錯+綜 combined) — the furthest point */
export function diagonal(lines: Line[]): number {
  return kwFromLines(invertLines(lines).reverse());
}
