import type { RandomSource } from "../random.js";
import type { Cast, QuoteStyle, Style, Structure } from "../types.js";
import { GUA } from "../data/gua.js";
import { QUOTE_STYLES } from "../data/trigrams.js";
import { formatTrigrams } from "../identify/structure.js";

/**
 * Which canonical text a reading turns on — by Zhu Xi's 《易學啟蒙·考變占》 rule,
 * the orthodox Song codification (one tradition among several; the app attributes
 * it, never absolutizes it). The rule reads the *minority* and migrates focus
 * from the primary hexagram toward the becoming as more lines move:
 *   0 moving → the primary hexagram's 卦辭
 *   1 moving → that line's 爻辭
 *   2 moving → both lines' 爻辭, the upper as primary (以上爻為主)
 *   3 moving → both 卦辭: the primary (本卦, 貞) and the becoming (之卦, 悔)
 *   4 moving → the becoming's two UNCHANGED lines' 爻辭, the lower as primary
 *   5 moving → the becoming's one UNCHANGED line's 爻辭
 *   6 moving → the becoming's 卦辭; on 乾/坤 the 用九/用六 text
 * The 4–5 case is the subtle one: when most lines move, the few that DON'T move
 * become the reading — read in the becoming hexagram. (We show both 卦辭 at 3
 * primary-first; we do not implement the finer 貞/悔 priority among the twenty
 * three-line transforms.)
 */
export type ReadingFocus =
  | { kind: "judgment" }
  | { kind: "line"; position: number }
  | { kind: "lines"; positions: number[]; governing: number }
  | { kind: "dualJudgment" }
  | { kind: "stillLines"; positions: number[]; governing: number }
  | { kind: "becoming" }
  | { kind: "extra"; name: "用九" | "用六" };

/** Classify which text a reading turns on, from the cast's changing positions. */
export function readingFocus(
  cast: Pick<Cast, "primary" | "changingPositions">,
): ReadingFocus {
  const positions = [...cast.changingPositions].sort((a, b) => a - b);
  const n = positions.length;

  if (n === 0) return { kind: "judgment" };
  if (n === 1) return { kind: "line", position: positions[0] };
  if (n === 2) return { kind: "lines", positions, governing: positions[1] };
  if (n === 3) return { kind: "dualJudgment" };
  if (n === 4 || n === 5) {
    // The lines that did NOT move — read in the becoming, the lower as primary.
    const still = [1, 2, 3, 4, 5, 6].filter((p) => !positions.includes(p));
    return { kind: "stillLines", positions: still, governing: still[0] };
  }
  // n === 6 — all move
  if (cast.primary === 1) return { kind: "extra", name: "用九" };
  if (cast.primary === 2) return { kind: "extra", name: "用六" };
  return { kind: "becoming" };
}

/**
 * One text the canonical reading turns on — a hexagram's 卦辭 (judgment), one of
 * its 爻辭 (line), or its 用九/用六 (extra). `kw` is the King Wen number to look up.
 */
export type ReadingPart =
  | { kind: "judgment"; kw: number }
  | { kind: "line"; kw: number; position: number }
  | { kind: "extra"; kw: number };

/**
 * The ordered texts a reading turns on, by the 啟蒙 rule (see readingFocus) — the
 * single source the TUI reading panel and the CLI plain/JSON output both render,
 * so they cannot drift. The governing (leading) text is first: the upper line at
 * 2 moving, the lower still line at 4–5, the primary judgment at 3.
 */
export function readingTexts(cast: Cast): ReadingPart[] {
  const focus = readingFocus(cast);
  const { primary, becoming } = cast;
  // The governing line first, then the rest top-down (line 6 down to line 1).
  const lines = (kw: number, positions: number[], governing: number): ReadingPart[] => [
    { kind: "line", kw, position: governing },
    ...[...positions]
      .sort((a, b) => b - a)
      .filter((p) => p !== governing)
      .map((p): ReadingPart => ({ kind: "line", kw, position: p })),
  ];

  switch (focus.kind) {
    case "judgment":
      return [{ kind: "judgment", kw: primary }];
    case "line":
      return [{ kind: "line", kw: primary, position: focus.position }];
    case "lines":
      return lines(primary, focus.positions, focus.governing);
    case "dualJudgment":
      return becoming !== null
        ? [{ kind: "judgment", kw: primary }, { kind: "judgment", kw: becoming }]
        : [{ kind: "judgment", kw: primary }];
    case "stillLines":
      return becoming !== null ? lines(becoming, focus.positions, focus.governing) : [];
    case "extra":
      return [{ kind: "extra", kw: primary }];
    case "becoming":
      return becoming !== null ? [{ kind: "judgment", kw: becoming }] : [];
  }
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
