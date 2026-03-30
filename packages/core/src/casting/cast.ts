import type { RandomSource } from "../random.js";
import type { Cast, Line } from "../types.js";
import { BINARY_TO_KW } from "../identify/lookup.js";
import { nuclear } from "../derivation/nuclear.js";
import { polarity } from "../derivation/polarity.js";
import { mirror } from "../derivation/mirror.js";
import { diagonal } from "../derivation/diagonal.js";
import { castLine } from "./coins.js";
import { linesToBinary } from "./binary.js";

/** Cast a full hexagram (6 lines) and compute all derived hexagrams. */
export function castHexagram(source: RandomSource): Cast {
  const lines: Line[] = [];
  for (let i = 0; i < 6; i++) {
    lines.push(castLine(source));
  }

  const primaryBinary = linesToBinary(lines);
  const primary = BINARY_TO_KW[primaryBinary];

  const changingPositions: number[] = [];
  let becoming: number | null = null;

  const hasChanging = lines.some((l) => l.isChanging);
  if (hasChanging) {
    const becomingLines = lines.map((l) => ({
      ...l,
      isYang: l.isChanging ? !l.isYang : l.isYang,
    }));
    const becomingBinary = linesToBinary(becomingLines);
    becoming = BINARY_TO_KW[becomingBinary];

    lines.forEach((l, i) => {
      if (l.isChanging) changingPositions.push(i + 1);
    });
  }

  return {
    lines,
    primary,
    becoming,
    changingPositions,
    nuclear: nuclear(lines),
    polarity: polarity(lines),
    mirror: mirror(lines),
    diagonal: diagonal(lines),
  };
}
