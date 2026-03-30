import type { Cast, Structure, TrigramInfo } from "../types.js";
import { GUA } from "../data/gua.js";
import { TRIGRAMS } from "../data/trigrams.js";

/** Get trigram index from 3 binary lines */
export function trigramIndex(lines: number[]): number {
  return lines.reduce((acc, v, i) => acc + (v === 1 ? 1 << i : 0), 0);
}

/** Get upper/lower trigram structure for a King Wen hexagram number */
export function getStructure(kw: number): {
  upper: TrigramInfo;
  lower: TrigramInfo;
} {
  const g = GUA[kw - 1];
  const lower = trigramIndex(g.l.slice(0, 3));
  const upper = trigramIndex(g.l.slice(3, 6));
  return { upper: TRIGRAMS[upper], lower: TRIGRAMS[lower] };
}

/** Build full structure with optional becoming */
export function buildStructure(cast: Cast): Structure {
  const primary = getStructure(cast.primary);
  return {
    ...primary,
    becoming: cast.becoming !== null ? getStructure(cast.becoming) : null,
  };
}

/** Format trigram pair as "☰ 乾 heaven / ☲ 離 fire" (upper / lower) */
export function formatTrigrams(s: {
  upper: TrigramInfo;
  lower: TrigramInfo;
}): string {
  return `${s.upper.sym} ${s.upper.n} ${s.upper.img} / ${s.lower.sym} ${s.lower.n} ${s.lower.img}`;
}
