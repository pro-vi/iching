// HexagramDetail — build a full detail struct for a hexagram

import type { Hexagram, TrigramInfo, Line, CastConnections } from "./types.js";
import { GUA } from "./data/gua.js";
import { getStructure } from "./identify/structure.js";
import { nuclear } from "./derivation/nuclear.js";
import { polarity } from "./derivation/polarity.js";
import { mirror } from "./derivation/mirror.js";
import { diagonal } from "./derivation/diagonal.js";
import { connections as buildConnections } from "./derivation/connections.js";

export interface HexagramDetail {
  kw: number;
  gua: Hexagram;
  structure: { upper: TrigramInfo; lower: TrigramInfo };
  nuclear: { kw: number; gua: Hexagram };
  polarity: { kw: number; gua: Hexagram };
  mirror: { kw: number; gua: Hexagram };
  diagonal: { kw: number; gua: Hexagram };
  isLocked: boolean;
  lockedPartner?: { kw: number; gua: Hexagram };
  /** Text-bearing relations overlay — 序卦 / 雜卦 / 說卦 citations. */
  connections: CastConnections;
}

/** Convert a hexagram's raw line array [0|1, ...] to Line[] for derivation functions */
function toLines(l: number[]): Line[] {
  return l.map((v) => ({
    value: v === 1 ? (7 as const) : (8 as const),
    isYang: v === 1,
    isChanging: false,
  }));
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
    nuclear: { kw: nuclearKw, gua: GUA[nuclearKw - 1] },
    polarity: { kw: polarityKw, gua: GUA[polarityKw - 1] },
    mirror: { kw: mirrorKw, gua: GUA[mirrorKw - 1] },
    diagonal: { kw: diagonalKw, gua: GUA[diagonalKw - 1] },
    isLocked,
    connections: buildConnections({ primary: kw }),
  };

  if (isLocked) {
    detail.lockedPartner = { kw: mirrorKw, gua: GUA[mirrorKw - 1] };
  }

  return detail;
}
