// patterns/chance.ts — the chance model.
//
// How observed counts compare to what the casting method would produce by
// chance. The per-method expectation tables and the observed-vs-expected
// comparison live together because every lift / residual figure in the pane
// rests on them. Pure: no IO, no dates.

import type { CastMethod, LineValue } from "../../types.js";
import type { ExpectedComparison, MethodFamily } from "./types.js";

/** Classify a recorded cast method into the family whose chance model applies. */
export function methodFamily(method: CastMethod | undefined): MethodFamily {
  if (method === "coin" || method === "coin-manual") return "coin";
  if (method === "yarrow" || method === "yarrow-manual") return "yarrow";
  return "unknown";
}

// Canonical per-line-value probabilities by method (coin = three-coin sum
// 6–9; yarrow = the classical 1:5:7:3 stalk ratio). Two facts here are
// load-bearing for the whole baseline — do NOT "simplify" them away:
//   • P(yang line) = P(7)+P(9) = 1/2 for BOTH methods (coin 3/8+1/8, yarrow
//     5/16+3/16), so the primary hexagram is uniform over 2^6 = 64 either way
//     → expected count per hexagram = known/64.
//   • P(line moves) = P(6)+P(9) = 1/4 for BOTH (coin 1/8+1/8, yarrow 1/16+3/16)
//     → per-position moving expectation = known/4, and the moving-COUNT law is a
//     single Binomial(6, 1/4) shared by both methods (see below).
// Only the DIRECTION differs — coin is symmetric (6 and 9 equally likely),
// yarrow favours old-yang 3:1 — which is why oldYin/oldYang expectations are
// summed per entry from THIS table, never from a shared constant.
export const LINE_PROBABILITIES: Record<Exclude<MethodFamily, "unknown">, Record<LineValue, number>> = {
  coin: { 6: 1 / 8, 7: 3 / 8, 8: 3 / 8, 9: 1 / 8 },
  yarrow: { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 },
};

// The count of moving lines in a cast ~ Binomial(6, 1/4) — valid for coin AND
// yarrow because both have P(line moves) = 1/4 (above). Sums to 4096/4096 = 1.
export const MOVING_COUNT_PROBABILITIES = [
  729 / 4096,
  1458 / 4096,
  1215 / 4096,
  540 / 4096,
  135 / 4096,
  18 / 4096,
  1 / 4096,
] as const;

/**
 * Observed's lift over expected: observed / expected, or null when there's no
 * usable expectation (absent or ≤ 0) — the null-returning sibling of shareOf.
 * Shared by `comparison` and the trigram frequency so both report lift the same
 * way (a hexagram and a trigram never disagree on what "no baseline" means).
 */
export function liftOf(observed: number, expected: number | null): number | null {
  return expected !== null && expected > 0 ? observed / expected : null;
}

/**
 * Observed-vs-expected for one quantity: lift (observed/expected) and a
 * Poisson-style residual. Returns nulls (not throws) when there is no usable
 * expectation, so callers can render "—" instead of dividing by zero.
 */
export function comparison(observed: number, expected: number | null): ExpectedComparison {
  const lift = liftOf(observed, expected);
  if (expected === null) return { observed, expected: 0, lift, residual: null };
  if (expected <= 0) return { observed, expected, lift, residual: null };
  return {
    observed,
    expected,
    lift,
    residual: (observed - expected) / Math.sqrt(expected),
  };
}
