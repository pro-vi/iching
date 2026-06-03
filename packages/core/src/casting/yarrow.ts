import type { RandomSource } from "../random.js";
import type { Cast, Line, LineValue } from "../types.js";
import { assembleCast } from "./cast.js";

/**
 * Faithful 49-stalk yarrow casting.
 *
 * Per round: a pile of N stalks is divided at a random point, one stalk is set
 * aside, and each heap is counted off in fours. The set-aside total is 5 or 9
 * (round 1) or 4 or 8 (rounds 2-3). After three rounds the remaining pile
 * divided by 4 gives the line value 6/7/8/9.
 *
 * Auto yarrow samples the visible split point from a canonical domain that
 * preserves the textbook yarrow probabilities without making the split
 * decorative. Round 1 samples k in [1, 44], giving setAside 5:9 as 3:1.
 * Rounds 2-3 sample k in [1, N-4], giving setAside 4:8 as 1:1. The transcript
 * remains causal: splitAt -> remainders -> setAside -> remaining -> line.
 *
 * If a split point is supplied explicitly, it is treated as an authored cut and
 * may use the full physical interval [1, N-1]. Manual yarrow uses that path, so
 * its distribution depends on how the operator chooses cuts.
 */

/** One division round of the yarrow ritual. */
export interface YarrowRound {
  /** Stalks in the pile at the start of this round (49, then 44|40, ...). */
  startCount: number;
  /** Random split point — size of the left heap, in [1, startCount-1]. */
  splitAt: number;
  /** Left heap counted by fours, remainder 1-4. */
  leftRemainder: number;
  /** Right heap (after the set-aside stalk) counted by fours, remainder 1-4. */
  rightRemainder: number;
  /** Stalks removed this round: 1 + leftRemainder + rightRemainder. */
  setAside: number;
  /** Stalks carried into the next round (startCount - setAside). */
  remaining: number;
}

/** The three rounds and resulting line for one hexagram line. */
export interface YarrowLineResult {
  rounds: [YarrowRound, YarrowRound, YarrowRound];
  line: Line;
}

/** A yarrow cast: the assembled hexagram plus the full ritual transcript. */
export interface YarrowCast {
  cast: Cast;
  transcript: YarrowLineResult[];
}

/** Uniform integer in [0, maxExclusive) — rejection-sampled to avoid modulo bias. */
function randomInt(source: RandomSource, maxExclusive: number): number {
  if (maxExclusive <= 0) {
    throw new Error(`randomInt: maxExclusive must be positive, got ${maxExclusive}`);
  }
  const limit = Math.floor(256 / maxExclusive) * maxExclusive;
  for (;;) {
    const byte = source.nextBytes(1)[0];
    if (byte < limit) return byte % maxExclusive;
  }
}

function autoSplitCount(startCount: number): number {
  if (startCount === 49) return 44;
  if (startCount % 4 === 0 && startCount >= 8) return startCount - 4;
  return startCount - 1;
}

/**
 * Count a heap by fours.
 *
 * A non-empty heap whose size is a multiple of 4 counts as having a final
 * group of 4 as the remainder (the "0 → 4" convention). An *empty* heap
 * has nothing to count, so the remainder is 0. This matters when the right
 * heap is exactly 1 stalk before takeOne (rightHeap = 0 after): without
 * this branch, the renderer would show a 0-stalk heap "growing into 4"
 * during the count beat — a visible conservation violation.
 */
function countByFours(heap: number): number {
  if (heap === 0) return 0;
  const rem = heap % 4;
  return rem === 0 ? 4 : rem;
}

/**
 * Run one division round on a pile of `startCount` stalks.
 *
 * If `opts.splitAt` is provided, use it directly (operator-authored cut);
 * otherwise sample the auto-mode split point from the canonical yarrow domain.
 */
export function castYarrowRound(
  source: RandomSource,
  startCount: number,
  opts?: { splitAt?: number },
): YarrowRound {
  let splitAt: number;
  if (opts?.splitAt !== undefined) {
    const k = opts.splitAt;
    if (!Number.isInteger(k) || k < 1 || k > startCount - 1) {
      throw new Error(`splitAt must be integer in [1, ${startCount - 1}], got ${k}`);
    }
    splitAt = k;
  } else {
    splitAt = 1 + randomInt(source, autoSplitCount(startCount));
  }
  const leftHeap = splitAt;
  const rightHeap = startCount - splitAt - 1; // one stalk taken from the right
  const leftRemainder = countByFours(leftHeap);
  const rightRemainder = countByFours(rightHeap);
  const setAside = 1 + leftRemainder + rightRemainder;
  return {
    startCount,
    splitAt,
    leftRemainder,
    rightRemainder,
    setAside,
    remaining: startCount - setAside,
  };
}

/** Narrow a computed remainder/4 to a LineValue; throws if the sim drifted. */
export function toLineValue(n: number): LineValue {
  if (n === 6 || n === 7 || n === 8 || n === 9) return n;
  throw new Error(`yarrow: line value out of range (${n})`);
}

export function lineFromValue(value: LineValue): Line {
  return {
    value,
    isYang: value === 7 || value === 9,
    isChanging: value === 6 || value === 9,
  };
}

/**
 * Cast a single line via three yarrow rounds, returning the full transcript.
 * If `opts.firstSplitAt` is provided, round 1 uses it as an authored cut point;
 * rounds 2-3 still use the auto-mode canonical yarrow domain.
 */
export function castYarrowLine(
  source: RandomSource,
  opts?: { firstSplitAt?: number },
): YarrowLineResult {
  const first = castYarrowRound(source, 49, { splitAt: opts?.firstSplitAt });
  const second = castYarrowRound(source, first.remaining);
  const third = castYarrowRound(source, second.remaining);
  return {
    rounds: [first, second, third],
    line: lineFromValue(toLineValue(third.remaining / 4)),
  };
}

/** Cast a full hexagram via the yarrow method; returns the Cast and transcript. */
export function castYarrowHexagram(source: RandomSource): YarrowCast {
  const transcript: YarrowLineResult[] = [];
  for (let i = 0; i < 6; i++) {
    transcript.push(castYarrowLine(source));
  }
  return {
    cast: assembleCast(transcript.map((r) => r.line)),
    transcript,
  };
}
