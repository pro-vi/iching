import type { Line } from "../types.js";
import { linesToBinary } from "../casting/binary.js";
import { BINARY_TO_KW } from "../identify/lookup.js";

/** 互卦 — Extract lines 2-3-4-5, form overlapping trigrams */
export function nuclear(lines: Line[]): number {
  const nuclearLines: Line[] = [
    lines[1],
    lines[2],
    lines[3],
    lines[2],
    lines[3],
    lines[4],
  ];
  return BINARY_TO_KW[linesToBinary(nuclearLines)];
}
