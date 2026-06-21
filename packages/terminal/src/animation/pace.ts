/** The pace-speed ladder cycled by the [f] key during the cast and yarrow
 *  reveals — shared so the two rituals can never disagree on the available
 *  speeds (1× → 2× → 4×). */
export const PACE_SPEEDS = [1, 2, 4];

/**
 * Cycle to the next pace speed: 1 → 2 → 4 → 1. An off-ladder speed resets to the
 * first (indexOf → -1 → index 0), exactly as the prior inline cast/yarrow code.
 */
export function nextPaceSpeed(current: number): number {
  return PACE_SPEEDS[(PACE_SPEEDS.indexOf(current) + 1) % PACE_SPEEDS.length];
}
