import type { RandomSource } from "../random.js";
import type { Cast, DerivedType } from "../types.js";
import { GUA } from "../data/gua.js";
import { DERIVED_LABELS, DERIVED_LABELS_CN } from "../data/trigrams.js";
import { isLockedPair } from "../derivation/locked-pairs.js";
import { getRandomQuoteStyle } from "./reading.js";

/** Format a derived hexagram reading with random style */
export function formatDerived(
  cast: Cast,
  type: DerivedType,
  source: RandomSource,
): string {
  // 自綜卦: mirror = self (8 vertically symmetric hexagrams)
  if (type === "mirror" && cast.mirror === cast.primary) {
    const g = GUA[cast.primary - 1];
    const tag = source.nextBytes(1)[0] < 128 ? "自綜" : "self-mirroring";
    return `綜卦 (${tag}) ${g.u} ${g.n} (${g.p}) — ${g[getRandomQuoteStyle(source)]}`;
  }

  // 错综同象: locked pairs where mirror === polarity
  if ((type === "mirror" || type === "polarity") && isLockedPair(cast)) {
    const g = GUA[cast.mirror - 1];
    return `错综同象 ${g.u} ${g.n} (${g.p}) — ${g[getRandomQuoteStyle(source)]}`;
  }

  // 對角卦 special cases
  if (type === "diagonal") {
    // Self-mirroring: diagonal = polarity (no distinct 4th point)
    if (cast.mirror === cast.primary) {
      const g = GUA[cast.polarity - 1];
      return `對角卦 = 錯卦 (自綜) ${g.u} ${g.n} (${g.p}) — ${g[getRandomQuoteStyle(source)]}`;
    }
    // Locked pairs: diagonal = self (自返)
    if (isLockedPair(cast)) {
      const g = GUA[cast.primary - 1];
      return `對角卦 = ${g.n} (自返) ${g.u} ${g.n} (${g.p}) — ${g[getRandomQuoteStyle(source)]}`;
    }
  }

  const kwNum = type === "becoming" ? cast.becoming : cast[type];
  if (kwNum === null) return "";
  const g = GUA[kwNum - 1];

  // 50% chance for 来知德 Chinese variant labels
  const useChinese = source.nextBytes(1)[0] < 128;
  const label = useChinese ? DERIVED_LABELS_CN[type] : DERIVED_LABELS[type];

  return `${label} ${g.u} ${g.n} (${g.p}) — ${g[getRandomQuoteStyle(source)]}`;
}
