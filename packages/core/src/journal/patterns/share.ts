/**
 * A zero-safe fraction: count / total, but 0 when the total is 0 (never NaN from
 * a divide-by-zero). Every patterns frequency `share` field (hexagram, moving
 * line, trigram, pair, structural echo) and the diversity `normalizedEntropy`
 * divide this way; one helper so an empty journal yields a clean 0 everywhere
 * rather than one path forgetting the guard.
 */
export function shareOf(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}
