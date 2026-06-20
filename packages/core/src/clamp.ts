/**
 * Constrain `value` to the inclusive range [lo, hi] — `Math.max(lo, Math.min(hi,
 * value))` spelled once. Callers across the core patterns and every terminal
 * renderer were writing the nested min/max by hand (with the inner `min`'s args
 * in either order, since it's commutative); this names the intent and fixes the
 * argument order. Assumes lo ≤ hi.
 */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
