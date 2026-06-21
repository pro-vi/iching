// HexagramDetail — build a full detail struct for a hexagram

import type { Hexagram, TrigramInfo, Line } from "./types.js";
import { GUA } from "./data/gua.js";
import { getStructure } from "./identify/structure.js";
import { nuclear } from "./derivation/nuclear.js";
import { polarity } from "./derivation/polarity.js";
import { mirror } from "./derivation/mirror.js";
import { diagonal } from "./derivation/diagonal.js";

/** A King Wen number paired with its resolved hexagram. */
export interface KwGua {
  kw: number;
  gua: Hexagram;
}

export interface HexagramDetail {
  kw: number;
  gua: Hexagram;
  structure: { upper: TrigramInfo; lower: TrigramInfo };
  nuclear: KwGua;
  polarity: KwGua;
  mirror: KwGua;
  diagonal: KwGua;
  isLocked: boolean;
  lockedPartner?: KwGua;
}

/** Convert a hexagram's raw line array [0|1, ...] to Line[] for derivation functions */
function toLines(l: number[]): Line[] {
  return l.map((v) => ({
    value: v === 1 ? (7 as const) : (8 as const),
    isYang: v === 1,
    isChanging: false,
  }));
}

/** Pair a King Wen number with its hexagram (kw is 1-64, always a valid index). */
function withGua(kw: number): KwGua {
  return { kw, gua: GUA[kw - 1] };
}

/** Build a complete HexagramDetail for a given King Wen number (1-64) */
export function buildHexagramDetail(kw: number): HexagramDetail {
  const gua = GUA[kw - 1];
  const lines = toLines(gua.l);

  const nuclearKw = nuclear(lines);
  const polarityKw = polarity(lines);
  const mirrorKw = mirror(lines);
  const diagonalKw = diagonal(lines);
  const isLocked = mirrorKw === polarityKw;

  const detail: HexagramDetail = {
    kw,
    gua,
    structure: getStructure(kw),
    nuclear: withGua(nuclearKw),
    polarity: withGua(polarityKw),
    mirror: withGua(mirrorKw),
    diagonal: withGua(diagonalKw),
    isLocked,
  };

  if (isLocked) {
    detail.lockedPartner = withGua(mirrorKw);
  }

  return detail;
}
