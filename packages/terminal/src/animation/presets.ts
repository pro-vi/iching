// Motion presets — timing profiles for the casting ritual

export interface RitualTiming {
  startBreathMs: number;
  preTossMs: number;
  coinFrameMs: number;
  coinStaggerMs: number;
  coinStageMs: number;
  landHoldMs: number;
  lineFrameMs: number;
  lineSettleMs: number;
  afterLine3Ms: number;
  afterLine5Ms: number;
  finalStillMs: number;
  finalGlowUpMs: number;
  finalGlowDownMs: number;
  titleStaggerMs: number;
  perChangeMs: number;
  compareRevealMs: number;
  splitSlideMs: number;
  restMs: number;
}

export type MotionPreset = "default" | "brisk" | "deep" | "reduced";

const DEFAULT: RitualTiming = {
  startBreathMs: 800,
  preTossMs: 300,
  coinFrameMs: 80,
  coinStaggerMs: 60,
  coinStageMs: 680,
  landHoldMs: 250,
  lineFrameMs: 200,
  lineSettleMs: 150,
  afterLine3Ms: 400,
  afterLine5Ms: 300,
  finalStillMs: 600,
  finalGlowUpMs: 500,
  finalGlowDownMs: 400,
  titleStaggerMs: 60,
  perChangeMs: 300,
  compareRevealMs: 400,
  splitSlideMs: 400,
  restMs: 200,
};

const BRISK: RitualTiming = {
  startBreathMs: 400,
  preTossMs: 150,
  coinFrameMs: 55,
  coinStaggerMs: 35,
  coinStageMs: 400,
  landHoldMs: 120,
  lineFrameMs: 120,
  lineSettleMs: 80,
  afterLine3Ms: 200,
  afterLine5Ms: 150,
  finalStillMs: 300,
  finalGlowUpMs: 250,
  finalGlowDownMs: 200,
  titleStaggerMs: 35,
  perChangeMs: 150,
  compareRevealMs: 200,
  splitSlideMs: 250,
  restMs: 100,
};

const DEEP: RitualTiming = {
  startBreathMs: 1200,
  preTossMs: 500,
  coinFrameMs: 95,
  coinStaggerMs: 80,
  coinStageMs: 900,
  landHoldMs: 400,
  lineFrameMs: 300,
  lineSettleMs: 250,
  afterLine3Ms: 700,
  afterLine5Ms: 500,
  finalStillMs: 900,
  finalGlowUpMs: 700,
  finalGlowDownMs: 600,
  titleStaggerMs: 80,
  perChangeMs: 500,
  compareRevealMs: 600,
  splitSlideMs: 600,
  restMs: 350,
};

// Reduced motion: same ritual structure (pauses preserved), but no spin,
// no glow, instant morph. Same soul, less movement.
const REDUCED: RitualTiming = {
  startBreathMs: 800,
  preTossMs: 300,
  coinFrameMs: 0,
  coinStaggerMs: 0,
  coinStageMs: 0,
  landHoldMs: 250,
  lineFrameMs: 0,
  lineSettleMs: 0,
  afterLine3Ms: 400,
  afterLine5Ms: 300,
  finalStillMs: 600,
  finalGlowUpMs: 0,
  finalGlowDownMs: 0,
  titleStaggerMs: 0,
  perChangeMs: 0,
  compareRevealMs: 0,
  splitSlideMs: 0,
  restMs: 200,
};

const PRESETS: Record<MotionPreset, RitualTiming> = {
  default: DEFAULT,
  brisk: BRISK,
  deep: DEEP,
  reduced: REDUCED,
};

/** Get a frozen copy of the timing values for the given preset. */
export function getPreset(name: MotionPreset): RitualTiming {
  return { ...PRESETS[name] };
}
