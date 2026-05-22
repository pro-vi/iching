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
  /** Breath after each beat — the inter-step pulse that gives the ritual cadence. */
  beatGapMs: number;
  /** Pause between rounds. */
  roundGapMs: number;
  /** Remainder rises and condenses into the hexagram line. */
  fuseMs: number;
  /** Pause after a line completes. */
  lineSettleMs: number;
  /** Trigram-recognition pause after line 3. */
  afterTrigramMs: number;
  /** Extra dwell on a narrated beat so its caption can be read. */
  captionHoldMs: number;
  /** Hold the finished figure before handing off to the reveal phase. */
  revealBridgeMs: number;
}

const DEFAULT: YarrowTiming = {
  gatherMs: 380,
  divideMs: 720,
  takeOneMs: 320,
  countMs: 640,
  tallyHoldMs: 420,
  carryMs: 380,
  beatGapMs: 130,
  roundGapMs: 340,
  fuseMs: 560,
  lineSettleMs: 300,
  afterTrigramMs: 600,
  captionHoldMs: 1000,
  revealBridgeMs: 800,
};

const DEEP: YarrowTiming = {
  gatherMs: 560,
  divideMs: 1050,
  takeOneMs: 480,
  countMs: 1200,
  tallyHoldMs: 640,
  carryMs: 560,
  beatGapMs: 220,
  roundGapMs: 540,
  fuseMs: 860,
  lineSettleMs: 460,
  afterTrigramMs: 900,
  captionHoldMs: 1500,
  revealBridgeMs: 1200,
};

const BRISK: YarrowTiming = {
  gatherMs: 110,
  divideMs: 320,
  takeOneMs: 150,
  countMs: 200,
  tallyHoldMs: 180,
  carryMs: 170,
  beatGapMs: 60,
  roundGapMs: 130,
  fuseMs: 280,
  lineSettleMs: 120,
  afterTrigramMs: 220,
  captionHoldMs: 650,
  revealBridgeMs: 360,
};

// Reduced motion, not reduced meaning: motion durations collapse to zero
// (instant state changes), but structural holds — and the caption dwell —
// remain so each round is still perceptible and the teaching still readable.
const REDUCED: YarrowTiming = {
  gatherMs: 70,
  divideMs: 0,
  takeOneMs: 0,
  countMs: 0,
  tallyHoldMs: 140,
  carryMs: 0,
  beatGapMs: 50,
  roundGapMs: 110,
  fuseMs: 0,
  lineSettleMs: 90,
  afterTrigramMs: 170,
  captionHoldMs: 800,
  revealBridgeMs: 280,
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
