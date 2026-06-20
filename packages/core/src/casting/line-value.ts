import type { LineValue } from "../types.js";

// The I Ching line-value semantics: 6 = old yin, 7 = young yang, 8 = young yin,
// 9 = old yang. So a yang line is 7 or 9; a changing (old) line is 6 or 9. Every
// cast method that BUILDS a line (coins, yarrow) and the validator that CHECKS
// one (storage cast-shape) reads the relation from here, so they can never
// disagree on what a value means.

/** True when the line value is yang (young yang 7 or old yang 9). */
export function isYangValue(value: LineValue): boolean {
  return value === 7 || value === 9;
}

/** True when the line value is changing/old (old yin 6 or old yang 9). */
export function isChangingValue(value: LineValue): boolean {
  return value === 6 || value === 9;
}
