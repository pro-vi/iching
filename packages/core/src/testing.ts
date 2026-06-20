// Test-only cast fixtures. NOT re-exported from index.ts — imported via the
// "@iching/core/testing" subpath so it never ships in the production bundle.
//
// Every persisted cast must be internally consistent (its primary/becoming/
// derived hexagrams must match its lines), or the store tears it on read
// (isCastShaped reconstructs and compares). assembleCast derives all of those
// FROM the lines, so anything built here round-trips through a store cleanly.
import type { Cast, Line } from "./types.js";
import { GUA } from "./data/gua.js";
import { assembleCast } from "./casting/cast.js";
import { isYangValue, isChangingValue } from "./casting/line-value.js";

/** A single line by its value: 6 old-yin, 7 young-yang, 8 young-yin, 9 old-yang. */
export function lineOf(value: 6 | 7 | 8 | 9): Line {
  return {
    value,
    isYang: isYangValue(value),
    isChanging: isChangingValue(value),
  };
}

/**
 * A consistent cast OF hexagram `primary`.
 *
 * - `castOf(kw)` — a static cast of `kw` (no moving lines).
 * - `castOf(kw, { becoming })` — flips exactly the lines where `kw` and
 *   `becoming` differ, so the derived becoming equals `becoming`.
 * - `castOf(kw, { changing })` — marks those 1-based positions moving; the
 *   becoming is then whatever those flips produce.
 *
 * Pass at most one of `becoming` / `changing`. assembleCast computes
 * primary/becoming/the four derived hexagrams from the resulting lines.
 */
export function castOf(
  primary: number,
  opts: { becoming?: number; changing?: number[] } = {},
): Cast {
  const p = GUA[primary - 1].l;
  const target = opts.becoming != null ? GUA[opts.becoming - 1].l : null;
  const lines: Line[] = p.map((bit, i) => {
    const moves = target != null ? target[i] !== bit : Boolean(opts.changing?.includes(i + 1));
    return moves ? lineOf(bit ? 9 : 6) : lineOf(bit ? 7 : 8);
  });
  return assembleCast(lines);
}
