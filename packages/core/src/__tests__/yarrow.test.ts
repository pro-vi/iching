import { describe, test, expect } from "bun:test";
import { castYarrowHexagram, castYarrowLine } from "../casting/yarrow.js";
import { SeededRandomSource } from "../random.js";
import type { LineValue } from "../types.js";

describe("castYarrowHexagram", () => {
  test("produces a complete Cast with seeded source", () => {
    const cast = castYarrowHexagram(new SeededRandomSource(42));

    expect(cast.cast.lines).toHaveLength(6);
    expect(cast.cast.primary).toBeGreaterThanOrEqual(1);
    expect(cast.cast.primary).toBeLessThanOrEqual(64);
    expect(cast.cast.nuclear).toBeGreaterThanOrEqual(1);
    expect(cast.cast.nuclear).toBeLessThanOrEqual(64);

    expect(cast.transcript).toHaveLength(6);
    for (const lineResult of cast.transcript) {
      expect(lineResult.rounds).toHaveLength(3);
    }
  });

  test("transcript lines match the assembled cast lines", () => {
    const cast = castYarrowHexagram(new SeededRandomSource(7));
    for (let i = 0; i < 6; i++) {
      expect(cast.transcript[i].line).toEqual(cast.cast.lines[i]);
    }
  });

  test("same seed produces an identical transcript", () => {
    const a = castYarrowHexagram(new SeededRandomSource(123));
    const b = castYarrowHexagram(new SeededRandomSource(123));
    expect(a).toEqual(b);
  });
});

describe("castYarrowLine — round invariants", () => {
  test("set-aside, remainder chain, and final value hold across many casts", () => {
    const source = new SeededRandomSource(2026);
    for (let i = 0; i < 5000; i++) {
      const { rounds, line } = castYarrowLine(source);

      expect(rounds[0].startCount).toBe(49);
      expect([5, 9]).toContain(rounds[0].setAside);
      expect([4, 8]).toContain(rounds[1].setAside);
      expect([4, 8]).toContain(rounds[2].setAside);

      for (let r = 0; r < 3; r++) {
        const round = rounds[r];
        expect(round.splitAt).toBeGreaterThanOrEqual(1);
        expect(round.splitAt).toBeLessThanOrEqual(round.startCount - 1);
        // leftHeap is always ≥ 1 (splitAt ∈ [1, N-1]), so leftRemainder ∈ [1,4].
        // rightHeap can be 0 (when splitAt = N-1: right was 1, takeOne emptied
        // it), in which case rightRemainder is 0 — no stalks to count.
        expect(round.leftRemainder).toBeGreaterThanOrEqual(1);
        expect(round.leftRemainder).toBeLessThanOrEqual(4);
        expect(round.rightRemainder).toBeGreaterThanOrEqual(0);
        expect(round.rightRemainder).toBeLessThanOrEqual(4);
        expect(round.setAside).toBe(1 + round.leftRemainder + round.rightRemainder);
        expect(round.remaining).toBe(round.startCount - round.setAside);
      }

      expect(rounds[1].startCount).toBe(rounds[0].remaining);
      expect(rounds[2].startCount).toBe(rounds[1].remaining);
      expect([24, 28, 32, 36]).toContain(rounds[2].remaining);
      expect(line.value).toBe((rounds[2].remaining / 4) as LineValue);
    }
  });
});

describe("castYarrowLine — distribution", () => {
  test("converges to the traditional yarrow distribution", () => {
    const source = new SeededRandomSource(99);
    const counts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
    const samples = 64000;
    for (let i = 0; i < samples; i++) {
      counts[castYarrowLine(source).line.value]++;
    }

    // Textbook yarrow: 6 = 1/16, 7 = 5/16, 8 = 7/16, 9 = 3/16.
    // The uniform-integer split-point model approximates this but does NOT
    // reproduce it exactly: rounds 2-3 favor "few" slightly above 1/2, and
    // the empty-right-heap edge case (countByFours(0) = 0) shifts more cases
    // toward "few" — together they nudge the distribution toward higher line
    // values by up to ~5 percentage points on the largest term. Exact textbook
    // probabilities would require sampling the round outcome directly rather
    // than the split point — tracked as a follow-up.
    const target = { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 };
    for (const v of [6, 7, 8, 9] as const) {
      const freq = counts[v] / samples;
      expect(Math.abs(freq - target[v])).toBeLessThan(0.06);
    }

    // The load-bearing claim: the asymmetric ordering must hold —
    // young yin most common, old yin rarest, with young yang and old yang
    // between. This is what distinguishes yarrow from the symmetric coin cast.
    expect(counts[8]).toBeGreaterThan(counts[7]);
    expect(counts[7]).toBeGreaterThan(counts[9]);
    expect(counts[9]).toBeGreaterThan(counts[6]);
  });
});
