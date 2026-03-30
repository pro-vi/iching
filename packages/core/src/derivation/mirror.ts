import type { Line } from "../types.js";
import { linesToBinary } from "../casting/binary.js";
import { BINARY_TO_KW } from "../identify/lookup.js";

/** 綜卦 — Flip line order (1<->6, 2<->5, 3<->4) */
export function mirror(lines: Line[]): number {
  return BINARY_TO_KW[linesToBinary([...lines].reverse())];
}
