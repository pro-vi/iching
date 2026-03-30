import type { RandomSource } from "../random.js";
import type { Line, LineValue } from "../types.js";

/**
 * Cast a single line using the provided random source.
 * Simulates 3 coin tosses: heads=3, tails=2, sum determines line.
 */
export function castLine(source: RandomSource): Line {
  const bytes = source.nextBytes(3);
  const coins = [bytes[0] & 1, bytes[1] & 1, bytes[2] & 1];
  const sum = coins.map((c) => (c ? 3 : 2)).reduce((a, b) => a + b) as LineValue;

  return {
    value: sum,
    isYang: sum === 7 || sum === 9,
    isChanging: sum === 6 || sum === 9,
  };
}
