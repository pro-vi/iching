import type { Cast, Structure, TrigramInfo } from "../types.js";
import { GUA } from "../data/gua.js";
import { TRIGRAMS } from "../data/trigrams.js";

/** Get trigram index from 3 binary lines */
export function trigramIndex(lines: number[]): number {
  return lines.reduce((acc, v, i) => acc + (v === 1 ? 1 << i : 0), 0);
}

/** Split a hexagram's six binary lines into its lower (lines 1-3) and upper
 *  (lines 4-6) trigram indices — the bottom three lines form the lower trigram. */
export function trigramIndices(lines: number[]): { lower: number; upper: number } {
  return {
    lower: trigramIndex(lines.slice(0, 3)),
    upper: trigramIndex(lines.slice(3, 6)),
  };
}

/** Get upper/lower trigram structure for a King Wen hexagram number */
export function getStructure(kw: number): {
  upper: TrigramInfo;
  lower: TrigramInfo;
} {
  const g = GUA[kw - 1];
  const { lower, upper } = trigramIndices(g.l);
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
