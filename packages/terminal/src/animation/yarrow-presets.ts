// Yarrow ritual timing — the second pacing axis.
//
// The vision separates two concerns the coin path conflated into one knob:
//   - MotionPreset  — how fast things move (reused from presets.ts).
//   - RitualDetail  — how much of the count is animated.
// One public setting (motion) maps to both; the axes stay separate internally.

import type { MotionPreset } from "./presets.ts";

/**
 * How much of the count-by-fours is animated.
 * - `expanded`   — each group of four peels away individually.
 * - `summarized` — groups sweep as batches; remainders and tally still shown.
 * - `stepped`    — static before/after states; the count concept is never hidden.
 */
export type RitualDetail = "expanded" | "summarized" | "stepped";

/** Per-beat durations for one yarrow round plus the line-level beats. */
export interface YarrowTiming {
  /** Pile rests, undivided. */
  gatherMs: number;
  /** Gap opens at the split point. */
  divideMs: number;
  /** One stalk lifts out of the right heap. */
  takeOneMs: number;
  /** Count beat — both heaps animate within this span. */
  countMs: number;
  /** Hold the removed tally. */
  tallyHoldMs: number;
  /** Survivors re-cohere for the next round. */
  carryMs: number;
  /** Pause between rounds. */
  roundGapMs: number;
  /** Remainder rises and condenses into the hexagram line. */
  fuseMs: number;
  /** Pause after a line completes. */
  lineSettleMs: number;
  /** Trigram-recognition pause after line 3. */
  afterTrigramMs: number;
  /** Hold the finished figure before handing off to the reveal phase. */
  revealBridgeMs: number;
}

const DEFAULT: YarrowTiming = {
  gatherMs: 200,
  divideMs: 450,
  takeOneMs: 260,
  countMs: 560,
  tallyHoldMs: 300,
  carryMs: 320,
  roundGapMs: 200,
  fuseMs: 500,
  lineSettleMs: 220,
  afterTrigramMs: 500,
  revealBridgeMs: 700,
};

const DEEP: YarrowTiming = {
  gatherMs: 320,
  divideMs: 680,
  takeOneMs: 420,
  countMs: 1100,
  tallyHoldMs: 480,
  carryMs: 500,
  roundGapMs: 340,
  fuseMs: 760,
  lineSettleMs: 360,
  afterTrigramMs: 760,
  revealBridgeMs: 1000,
};

const BRISK: YarrowTiming = {
  gatherMs: 80,
  divideMs: 200,
  takeOneMs: 120,
  countMs: 160,
  tallyHoldMs: 140,
  carryMs: 140,
  roundGapMs: 90,
  fuseMs: 240,
  lineSettleMs: 100,
  afterTrigramMs: 180,
  revealBridgeMs: 320,
};

// Reduced motion, not reduced meaning: motion durations collapse to zero
// (instant state changes), but small structural holds remain so the eye can
// still register each round changing state.
const REDUCED: YarrowTiming = {
  gatherMs: 60,
  divideMs: 0,
  takeOneMs: 0,
  countMs: 0,
  tallyHoldMs: 120,
  carryMs: 0,
  roundGapMs: 80,
  fuseMs: 0,
  lineSettleMs: 80,
  afterTrigramMs: 150,
  revealBridgeMs: 250,
};

const TIMINGS: Record<MotionPreset, YarrowTiming> = {
  default: DEFAULT,
  deep: DEEP,
  brisk: BRISK,
  reduced: REDUCED,
};

const DETAIL: Record<MotionPreset, RitualDetail> = {
  deep: "expanded",
  default: "summarized",
  brisk: "stepped",
  reduced: "stepped",
};

/**
 * Resolve a motion preset to the yarrow ritual's two pacing axes.
 * Returns a frozen-copy timing plus the derived `RitualDetail`.
 */
export function getYarrowTiming(motion: MotionPreset): {
  timing: YarrowTiming;
  detail: RitualDetail;
} {
  return { timing: { ...TIMINGS[motion] }, detail: DETAIL[motion] };
}
