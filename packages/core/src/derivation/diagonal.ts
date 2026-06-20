import type { Line } from "../types.js";
import { kwFromLines } from "../identify/lookup.js";

/** 對角卦 — Invert all lines then reverse (錯+綜 combined) — the furthest point */
export function diagonal(lines: Line[]): number {
  const inverted = lines.map((l) => ({ ...l, isYang: !l.isYang }));
  return kwFromLines([...inverted].reverse());
}
