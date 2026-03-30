import type { RandomSource } from "../random.js";
import type { Cast, Style, Structure } from "../types.js";
import { GUA } from "../data/gua.js";
import { QUOTE_STYLES } from "../data/trigrams.js";
import { formatTrigrams } from "../identify/structure.js";

/** Unbiased random quote style for derived hexagrams (excludes "st") */
export function getRandomQuoteStyle(source: RandomSource): Style {
  let byte: number;
  do {
    byte = source.nextBytes(1)[0];
  } while (byte >= 250);
  return QUOTE_STYLES[byte % 5];
}

/** Format full reading with optional transformation */
export function formatReading(
  cast: Cast,
  style: Style,
  structure: Structure,
): string {
  const g = GUA[cast.primary - 1];

  let middle: string;
  if (style === "st") {
    middle = formatTrigrams(structure);
    if (cast.becoming !== null && structure.becoming) {
      middle += ` → ${formatTrigrams(structure.becoming)}`;
    }
  } else {
    middle = g[style];
  }

  let out = `${g.u} ${g.n} (${g.p}) — ${middle}`;

  if (cast.becoming !== null) {
    const t = GUA[cast.becoming - 1];
    out += ` → ${t.u} ${t.n} [${cast.changingPositions.join(",")}]`;
  }

  return out;
}
