import type { RandomSource } from "../random.js";
import type { Cast, QuoteStyle, Style, Structure } from "../types.js";
import { GUA } from "../data/gua.js";
import { QUOTE_STYLES } from "../data/trigrams.js";
import { formatTrigrams } from "../identify/structure.js";

/**
 * Which canonical text governs a reading, per the common (Zhu Xi) rules:
 *   0 moving lines  → the primary hexagram's 卦辭 is the reading
 *   1 moving line   → that line's 爻辭 speaks
 *   2-3 moving      → the noted lines' 爻辭, the uppermost governing
 *   4-5 moving      → the becoming hexagram's 卦辭 speaks
 *   6 moving        → 用九 (hex 1) / 用六 (hex 2); otherwise the becoming 卦辭
 */
export type ReadingFocus =
  | { kind: "judgment" }
  | { kind: "line"; position: number }
  | { kind: "lines"; positions: number[]; governing: number }
  | { kind: "becoming" }
  | { kind: "extra"; name: "用九" | "用六" };

/** Classify which text governs, from the cast's changing positions. */
export function readingFocus(
  cast: Pick<Cast, "primary" | "changingPositions">,
): ReadingFocus {
  const positions = [...cast.changingPositions].sort((a, b) => a - b);
  const n = positions.length;

  if (n === 0) return { kind: "judgment" };
  if (n === 1) return { kind: "line", position: positions[0] };
  if (n <= 3) {
    return { kind: "lines", positions, governing: positions[n - 1] };
  }
  if (n === 6) {
    if (cast.primary === 1) return { kind: "extra", name: "用九" };
    if (cast.primary === 2) return { kind: "extra", name: "用六" };
  }
  return { kind: "becoming" };
}

/** Unbiased random quote style for derived hexagrams (excludes "st"). */
export function getRandomQuoteStyle(source: RandomSource): QuoteStyle {
  let byte: number;
  do {
    byte = source.nextBytes(1)[0];
  } while (byte >= 250);
  return QUOTE_STYLES[byte % 5] as QuoteStyle;
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
