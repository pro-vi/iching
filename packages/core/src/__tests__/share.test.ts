// shareOf — the zero-safe fraction every patterns frequency (and the diversity
// normalizedEntropy) divides by. The zero-total case is the whole point: an empty
// journal must yield a clean 0, never NaN — and that guard was previously
// unexercised by the patterns suite.

import { describe, test, expect } from "bun:test";
import { shareOf } from "../journal/patterns/share.js";

describe("shareOf", () => {
  test("count / total for a positive total", () => {
    expect(shareOf(1, 4)).toBe(0.25);
    expect(shareOf(3, 3)).toBe(1);
    expect(shareOf(0, 5)).toBe(0); // a zero count is a real 0 share
  });

  test("a zero total yields 0, never NaN (empty journal)", () => {
    expect(shareOf(0, 0)).toBe(0);
    expect(shareOf(7, 0)).toBe(0); // count without a total is still 0, not Infinity/NaN
    expect(Number.isNaN(shareOf(0, 0))).toBe(false);
  });
});
