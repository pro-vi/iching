import type { Line } from "../types.js";
import { kwFromLines } from "../identify/lookup.js";

/** 綜卦 — Flip line order (1<->6, 2<->5, 3<->4) */
export function mirror(lines: Line[]): number {
  return kwFromLines([...lines].reverse());
}
