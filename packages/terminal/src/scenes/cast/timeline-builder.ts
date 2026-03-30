// timeline-builder.ts — compose the full ritual timeline from DSL primitives

import type { Cast } from "@iching/core";
import type { RitualTiming } from "../../animation/presets.ts";
import type { Step } from "../../animation/timeline.ts";
import { seq, par, wait, call, tween } from "../../animation/timeline.ts";
import { easeOut, easeInOut } from "../../animation/easing.ts";
import type { CastModel } from "./model.ts";
import { canSplit } from "./layout-calc.ts";

/**
 * Build the full ritual timeline for a casting sequence.
 *
 * Timeline structure:
 * 1. Opening breath
 * 2. For each line (0-5): coin toss -> land -> collapse -> line draw -> settle
 * 3. Extra pause after line 3 (trigram recognition)
 * 4. Extra pause after line 5
 * 5. Final stillness
 * 6. Whole-figure glow
 * 7. Title reveal
 * 8. If becoming: marker pulse -> morph wave -> becoming title
 * 9. If no changing: longer hold + "unchanging" subtitle
 * 10. Show prompt
 */
export function buildCastTimeline(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
  termWidth: number = 80,
): Step {
  return seq(
    // 1. Opening breath
    wait(timing.startBreathMs),

    // 2-4. Cast each line
    ...cast.lines.map((line, i) =>
      seq(
        castOneLine(i, line, model, timing),
        // Trigram recognition beat after line 3 (index 2)
        ...(i === 2 ? [wait(timing.afterLine3Ms)] : []),
        // Pause after line 5 (index 4)
        ...(i === 4 ? [wait(timing.afterLine5Ms)] : []),
      ),
    ),

    // 5. Final stillness
    wait(timing.finalStillMs),

    // 6. Whole-figure glow
    call(() => {
      model.hexagramComplete = true;
    }),
    tween(timing.finalGlowUpMs, (p) => {
      model.glowProgress = p;
    }, easeInOut),
    wait(timing.finalGlowDownMs),
    call(() => {
      model.glowProgress = 0;
    }),

    // 7. Title reveal
    tween(timing.titleStaggerMs > 0 ? 400 : 1, (p) => {
      model.titleProgress = p;
    }, easeOut),

    // 8/9. Becoming or unchanging
    ...(cast.becoming !== null
      ? canSplit(termWidth)
        ? buildWideBecoming(cast, model, timing)
        : buildNarrowBecoming(cast, model, timing)
      : [
          wait(1200),
          call(() => {
            model.subtitleText = "unchanging";
          }),
        ]),

    // 10. Show prompt
    wait(timing.restMs),
    call(() => {
      model.showPrompt = true;
    }),
  );
}

/**
 * Build the timeline steps for casting a single line:
 * pre-toss pause -> coin spin -> coin land -> coin collapse -> line draw -> settle
 */
function castOneLine(
  lineIndex: number,
  _line: { isYang: boolean; isChanging: boolean; value: number },
  model: CastModel,
  timing: RitualTiming,
): Step {
  const spinDuration = timing.coinFrameMs * 9; // 9 frames of spin
  const landDuration = timing.landHoldMs;
  const lineFrames = _line.isYang ? 7 : 6;
  const lineDuration = timing.lineFrameMs * lineFrames;

  return seq(
    // Pre-toss pause
    wait(timing.preTossMs),

    // Set active line and prepare coins
    call(() => {
      model.activeLine = lineIndex;
      model.coinPhase = "spin";
      model.coinProgress = [0, 0, 0];
      // Set coin results based on line value
      // value 6 (old yin): 2+2+2=6 -> all tails
      // value 7 (young yang): 2+2+3=7 -> two tails, one heads
      // value 8 (young yin): 2+3+3=8 -> one tail, two heads
      // value 9 (old yang): 3+3+3=9 -> all heads
      const v = _line.value;
      model.coinResults = [
        v === 9 || v === 8,      // coin 0 heads if >= 8
        v === 9 || v === 8,      // coin 1 heads if >= 8
        v === 9 || v === 7,      // coin 2 heads if value is 9 or 7
      ];
      // Adjust for value 7: exactly one heads (coin 2)
      if (v === 7) {
        model.coinResults = [false, false, true];
      }
      // Adjust for value 8: exactly two heads (coins 0, 1)
      if (v === 8) {
        model.coinResults = [true, true, false];
      }
    }),

    // Coin spin with stagger
    ...(spinDuration > 0
      ? [
          par(
            tween(spinDuration, (p) => { model.coinProgress[0] = p; }),
            tween(spinDuration, (p) => { model.coinProgress[1] = Math.max(0, (p * spinDuration - timing.coinStaggerMs) / (spinDuration - timing.coinStaggerMs)); }),
            tween(spinDuration, (p) => { model.coinProgress[2] = Math.max(0, (p * spinDuration - timing.coinStaggerMs * 2) / (spinDuration - timing.coinStaggerMs * 2)); }),
          ),
        ]
      : []),

    // Coin land
    call(() => {
      model.coinPhase = "land";
      model.coinProgress = [1, 1, 1];
    }),
    wait(landDuration),

    // Coin collapse
    call(() => {
      model.coinPhase = "collapse";
      model.coinProgress = [0, 0, 0];
    }),
    tween(200, (p) => {
      model.coinProgress = [p, p, p];
    }),
    call(() => {
      model.coinPhase = "done";
    }),

    // Line draw
    tween(lineDuration > 0 ? lineDuration : 1, (p) => {
      model.lines[lineIndex].progress = p;
    }, easeOut),

    // Settle
    wait(timing.lineSettleMs),
    call(() => {
      model.lines[lineIndex].settled = true;
      model.lines[lineIndex].progress = 1;
    }),

    // Changing line pulse (extra hold + pulse)
    ...(_line.isChanging
      ? [
          wait(80),
          call(() => {
            model.lines[lineIndex].glowing = true;
          }),
          tween(320, (p) => {
            model.lines[lineIndex].glowProgress = p;
          }, easeInOut),
          call(() => {
            model.lines[lineIndex].glowing = false;
            model.lines[lineIndex].glowProgress = 0;
            model.lines[lineIndex].markerVisible = true;
          }),
        ]
      : []),
  );
}

/**
 * Build morph wave steps: each changing line morphs bottom-to-top
 * with a stagger delay between each.
 */
function buildMorphWave(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
): Step[] {
  const sorted = [...cast.changingPositions].sort((a, b) => a - b); // bottom to top
  const steps: Step[] = [];

  for (let ci = 0; ci < sorted.length; ci++) {
    const lineIndex = sorted[ci] - 1; // changingPositions is 1-indexed
    steps.push(
      seq(
        tween(timing.perChangeMs > 0 ? timing.perChangeMs : 1, (p) => {
          model.lines[lineIndex].morphProgress = p;
        }, easeInOut),
        call(() => {
          model.lines[lineIndex].morphComplete = true;
          model.lines[lineIndex].morphProgress = 1;
        }),
      ),
    );
  }

  // Stagger: each line starts 100ms after the previous
  if (steps.length <= 1) return steps;

  // Use sequence with small waits between
  const staggered: Step[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (i > 0) staggered.push(wait(100));
    staggered.push(steps[i]);
  }
  return [seq(...staggered)];
}

/**
 * Wide terminal becoming sequence: slide apart + right hexagram morph.
 * Primary stays on the left; right copy morphs changing lines.
 */
function buildWideBecoming(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
): Step[] {
  return [
    wait(680),
    // Marker pulse on all changing lines
    call(() => {
      for (const pos of cast.changingPositions) {
        model.lines[pos - 1].glowing = true;
        model.lines[pos - 1].markerVisible = true;
      }
    }),
    tween(320, (p) => {
      for (const pos of cast.changingPositions) {
        model.lines[pos - 1].glowProgress = p;
      }
    }, easeInOut),
    call(() => {
      for (const pos of cast.changingPositions) {
        model.lines[pos - 1].glowing = false;
        model.lines[pos - 1].glowProgress = 0;
      }
    }),
    // Wait before split
    wait(200),
    // Split slide: primary slides left, right copy appears
    call(() => {
      model.layout = "splitting";
    }),
    tween(timing.splitSlideMs > 0 ? timing.splitSlideMs : 1, (p) => {
      model.splitProgress = p;
    }, easeInOut),
    call(() => {
      model.layout = "side-by-side";
      model.splitProgress = 1;
    }),
    // Small pause after split completes
    wait(200),
    // Right hexagram morph wave
    ...buildRightMorphWave(cast, model, timing),
    // Becoming title (under right hexagram)
    tween(timing.compareRevealMs > 0 ? timing.compareRevealMs : 1, (p) => {
      model.becomingTitleProgress = p;
    }, easeOut),
  ];
}

/**
 * Narrow terminal becoming sequence: in-place morph (original behavior).
 */
function buildNarrowBecoming(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
): Step[] {
  return [
    wait(680),
    // Marker pulse
    call(() => {
      for (const pos of cast.changingPositions) {
        model.lines[pos - 1].glowing = true;
        model.lines[pos - 1].markerVisible = true;
      }
    }),
    tween(320, (p) => {
      for (const pos of cast.changingPositions) {
        model.lines[pos - 1].glowProgress = p;
      }
    }, easeInOut),
    call(() => {
      for (const pos of cast.changingPositions) {
        model.lines[pos - 1].glowing = false;
        model.lines[pos - 1].glowProgress = 0;
      }
    }),
    // In-place morph wave
    ...buildMorphWave(cast, model, timing),
    // Becoming title
    tween(timing.compareRevealMs > 0 ? timing.compareRevealMs : 1, (p) => {
      model.becomingTitleProgress = p;
    }, easeOut),
  ];
}

/**
 * Build right-hexagram morph wave: tweens model.rightHexMorphProgress[ci]
 * where ci is the index into changingPositions (0, 1, 2...).
 */
function buildRightMorphWave(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
): Step[] {
  // Sort by position (bottom to top) but track original index into changingPositions
  const indexed = cast.changingPositions
    .map((pos, ci) => ({ pos, ci }))
    .sort((a, b) => a.pos - b.pos); // bottom to top

  const steps: Step[] = [];

  for (const { ci } of indexed) {
    steps.push(
      seq(
        tween(timing.perChangeMs > 0 ? timing.perChangeMs : 1, (p) => {
          model.rightHexMorphProgress[ci] = p;
        }, easeInOut),
        call(() => {
          model.rightHexMorphProgress[ci] = 1;
        }),
      ),
    );
  }

  // After all morph tweens, mark complete
  const morphComplete = call(() => {
    model.rightHexMorphComplete = true;
  });

  if (steps.length <= 1) {
    return [...steps, morphComplete];
  }

  // Stagger with 100ms between each
  const staggered: Step[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (i > 0) staggered.push(wait(100));
    staggered.push(steps[i]);
  }
  return [seq(...staggered), morphComplete];
}
