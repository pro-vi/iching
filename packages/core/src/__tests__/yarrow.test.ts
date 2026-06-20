import { describe, test, expect } from "bun:test";
import { castYarrowHexagram, castYarrowLine, castYarrowRound } from "../casting/yarrow.js";
import { CryptoRandomSource, SeededRandomSource, TapeRandomSource } from "../random.js";
import type { LineValue } from "../types.js";

function autoDomainSize(startCount: number): number {
  return startCount === 49 ? 44 : startCount - 4;
}

function acceptedByteLimit(maxExclusive: number): number {
  return Math.floor(256 / maxExclusive) * maxExclusive;
}

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

describe("castYarrowLine — output distribution", () => {
  test("reproduces the authentic yarrow probabilities (6/7/8/9 = 1:5:7:3 over 16)", () => {
    // The chance-baseline system (LINE_PROBABILITIES.yarrow in patterns.ts) trusts
    // the stalk simulation to yield exactly these — old yin rarest, young yin
    // commonest, the asymmetry that distinguishes yarrow from the symmetric coin.
    // If the sim and that table ever diverge, every yarrow "by chance" figure in
    // the 觀象 pane silently lies.
    //
    // Deliberately the PRODUCTION CryptoRandomSource, not SeededRandomSource: the
    // seeded PRNG takes xorshift128+'s low byte, which is non-uniform enough that
    // yarrow's rejection sampling visibly skews it (~0.01 off per value). That is
    // fine for --seed's reproduce-one-cast purpose, but it would false-fail a
    // distribution check. N and the ±0.01 band put every assertion ~9σ from its
    // true probability, so the crypto draw effectively never flakes.
    const source = new CryptoRandomSource();
    const tally: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
    const N = 200_000;
    for (let i = 0; i < N; i++) tally[castYarrowLine(source).line.value]++;
    expect(Math.abs(tally[6] / N - 1 / 16)).toBeLessThan(0.01); // 0.0625 — 老陰 old yin (rarest)
    expect(Math.abs(tally[7] / N - 5 / 16)).toBeLessThan(0.01); // 0.3125 — 少陽 young yang
    expect(Math.abs(tally[8] / N - 7 / 16)).toBeLessThan(0.01); // 0.4375 — 少陰 young yin (commonest)
    expect(Math.abs(tally[9] / N - 3 / 16)).toBeLessThan(0.01); // 0.1875 — 老陽 old yang
  });
});

describe("castYarrowLine — firstSplitAt authoring (H4 manual mode)", () => {
  test("uses the supplied splitAt for round 1", () => {
    const source = new SeededRandomSource(2026);
    const result = castYarrowLine(source, { firstSplitAt: 24 });
    expect(result.rounds[0].splitAt).toBe(24);
  });

  test("rounds 2 and 3 still use the canonical auto split domain", () => {
    const source = new TapeRandomSource(new Uint8Array([36, 32]));
    const result = castYarrowLine(source, { firstSplitAt: 20 });

    expect(result.rounds[1].startCount).toBe(40);
    expect(result.rounds[1].splitAt).toBe(1);
    expect(result.rounds[2].startCount).toBe(36);
    expect(result.rounds[2].splitAt).toBe(1);
  });

  test("same seed + same firstSplitAt → identical result (determinism)", () => {
    const a = castYarrowLine(new SeededRandomSource(123), { firstSplitAt: 17 });
    const b = castYarrowLine(new SeededRandomSource(123), { firstSplitAt: 17 });
    expect(a).toEqual(b);
  });

  test("rejects invalid firstSplitAt values", () => {
    const source = new SeededRandomSource(1);
    expect(() => castYarrowLine(source, { firstSplitAt: 0 })).toThrow();
    expect(() => castYarrowLine(source, { firstSplitAt: 49 })).toThrow();
    expect(() => castYarrowLine(source, { firstSplitAt: 2.5 })).toThrow();
    expect(() => castYarrowLine(source, { firstSplitAt: -1 })).toThrow();
  });

  test("k % 4 === 0 → round 1 setAside is 9, line value can be 6/7/8 (never 9)", () => {
    // k=24 → leftHeap=24 (rem 4), rightHeap=49-24-1=24 (rem 4) → setAside=9
    const result = castYarrowLine(new SeededRandomSource(1), { firstSplitAt: 24 });
    expect(result.rounds[0].setAside).toBe(9);
    expect([6, 7, 8]).toContain(result.line.value);
  });

  test("k % 4 !== 0 → round 1 setAside is 5, line value can be 7/8/9 (never 6)", () => {
    // k=25 → leftHeap=25 (rem 1), rightHeap=49-25-1=23 (rem 3) → setAside=5
    const result = castYarrowLine(new SeededRandomSource(1), { firstSplitAt: 25 });
    expect(result.rounds[0].setAside).toBe(5);
    expect([7, 8, 9]).toContain(result.line.value);
  });
});

describe("castYarrowLine — distribution", () => {
  test("auto rounds use canonical split domains through the visible splitAt", () => {
    for (const startCount of [49, 44, 40, 36, 32]) {
      const domain = autoDomainSize(startCount);

      expect(castYarrowRound(new TapeRandomSource(new Uint8Array([0])), startCount).splitAt).toBe(1);
      expect(
        castYarrowRound(new TapeRandomSource(new Uint8Array([domain - 1])), startCount).splitAt,
      ).toBe(domain);
      expect(castYarrowRound(new TapeRandomSource(new Uint8Array([domain])), startCount).splitAt).toBe(1);
    }
  });

  test("a byte past the acceptance limit is rejected, not folded with % (no modulo bias)", () => {
    // domain = autoDomainSize(49) = 44; acceptedByteLimit(44) = floor(256/44)*44 = 220.
    // A byte >= 220 must be REJECTED and the next byte drawn — never taken `% 44`,
    // which would reintroduce modulo bias. 230 is rejected; 5 is accepted → splitAt 6.
    // No other test exercises this branch; if the guard were deleted, 230 % 44 + 1 = 11
    // would surface here instead.
    const round = castYarrowRound(new TapeRandomSource(new Uint8Array([230, 5])), 49);
    expect(round.splitAt).toBe(6);
  });

  test("auto round domains produce exact textbook set-aside ratios", () => {
    const cases: Array<{ startCount: number; expected: Record<number, number> }> = [
      { startCount: 49, expected: { 5: 165, 9: 55 } },
      { startCount: 44, expected: { 4: 120, 8: 120 } },
      { startCount: 40, expected: { 4: 126, 8: 126 } },
      { startCount: 36, expected: { 4: 128, 8: 128 } },
      { startCount: 32, expected: { 4: 126, 8: 126 } },
    ];

    for (const { startCount, expected } of cases) {
      const counts: Record<number, number> = {};
      const limit = acceptedByteLimit(autoDomainSize(startCount));
      for (let byte = 0; byte < limit; byte++) {
        const round = castYarrowRound(new TapeRandomSource(new Uint8Array([byte])), startCount);
        counts[round.setAside] = (counts[round.setAside] ?? 0) + 1;
      }
      expect(counts).toEqual(expected);
    }
  });

  test("auto split domains induce the exact traditional yarrow distribution", () => {
    let states = [{ startCount: 49, weight: 1 }];

    for (let i = 0; i < 3; i++) {
      const next: typeof states = [];
      for (const state of states) {
        const domain = autoDomainSize(state.startCount);
        for (let splitAt = 1; splitAt <= domain; splitAt++) {
          const round = castYarrowRound(
            new TapeRandomSource(new Uint8Array([])),
            state.startCount,
            { splitAt },
          );
          next.push({ startCount: round.remaining, weight: state.weight / domain });
        }
      }
      states = next;
    }

    const distribution: Record<LineValue, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
    for (const state of states) {
      const value = state.startCount / 4;
      distribution[value as LineValue] += state.weight;
    }

    const target = { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 };
    for (const v of [6, 7, 8, 9] as const) {
      expect(distribution[v]).toBeCloseTo(target[v], 12);
    }
  });

  test("authored manual cuts may still use the full physical split interval", () => {
    const round = castYarrowRound(new TapeRandomSource(new Uint8Array([])), 49, { splitAt: 48 });

    expect(round.splitAt).toBe(48);
    expect(round.rightRemainder).toBe(0);
    expect(round.setAside).toBe(5);
    expect(round.remaining).toBe(44);
  });
});
