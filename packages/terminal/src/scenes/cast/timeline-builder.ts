// timeline-builder.ts — compose the full ritual timeline from DSL primitives

import { type Cast, type DisplayLanguage, type GlyphFont, type GlyphSize, GUA, toSimplified } from "@iching/core";
import type { RitualTiming } from "../../animation/presets.ts";
import type { Step } from "../../animation/timeline.ts";
import { seq, par, wait, call, tween } from "../../animation/timeline.ts";
import { easeOut, easeInOut } from "../../animation/easing.ts";
import type { CastModel } from "./model.ts";
import { canSplit } from "./layout-calc.ts";
import type { GlyphAnimStyle } from "../../glyph-anim/types.ts";
import { composeGlyph } from "../../glyph-anim/compose.ts";
import { createGlyphAnimator, GLYPH_ANIM_DURATION_MS } from "../../glyph-anim/factory.ts";

export interface CastGlyphConfig {
  glyphAnim: GlyphAnimStyle;
  glyphFont: GlyphFont;
  glyphSize: GlyphSize;
  /** zh-Hans composes the glyph from the Simplified name (e.g. 觀→观). */
  language?: DisplayLanguage;
}

export interface BuildCastTimelineOpts {
  /**
   * Skip the opening breath + 6-line coin-cast phase, pre-settling all lines
   * to their final state. The reveal phases (glow → glyph → split → morph →
   * exploration) still play normally. Used by the manual coin-toss path,
   * where the user has already cast the lines via the physics-toss scene.
   */
  skipLineDrawing?: boolean;
}

/**
 * Build the full ritual timeline for a casting sequence.
 *
 * The timeline is the concatenation of two phases:
 *
 *   line phase    + reveal phase
 *   ───────────────────────────────────────────────────────────────────
 *   line casting    final stillness → whole-figure glow → primary glyph
 *      (or)         → title → marker pulse (if becoming) → split slide →
 *   line pre-settle morph wave → becoming title → becoming glyph →
 *                   exploration mode
 *
 * Auto cast uses the line-casting phase (the 6-coin ritual). Manual cast
 * uses the line pre-settle phase (lines were already drawn via the
 * physics-toss scene). Either way, the reveal phase that follows is
 * identical — same Step factories, same TimelineRunner, same model.
 */
export function buildCastTimeline(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
  termWidth: number = 80,
  glyphConfig?: CastGlyphConfig,
  opts?: BuildCastTimelineOpts,
): Step {
  return seq(
    ...(opts?.skipLineDrawing
      ? buildLinePresettlePhase(cast, model)
      : buildLineCastingPhase(cast, model, timing)),
    ...buildRevealPhase(cast, model, timing, termWidth, glyphConfig),
  );
}

/**
 * Line-casting phase: opening breath, then the 6-line coin ritual with
 * trigram-recognition and final-line pauses.
 */
function buildLineCastingPhase(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
): Step[] {
  return [
    wait(timing.startBreathMs),
    ...cast.lines.map((line, i) =>
      seq(
        castOneLine(i, line, model, timing),
        // Trigram recognition beat after line 3 (index 2)
        ...(i === 2 ? [wait(timing.afterLine3Ms)] : []),
        // Pause after line 5 (index 4)
        ...(i === 4 ? [wait(timing.afterLine5Ms)] : []),
      ),
    ),
  ];
}

/**
 * Line pre-settle phase: instantly mark all 6 lines as settled and progress 1.
 * Used when the lines were already drawn upstream (e.g. by the manual coin
 * toss). Changing-line markers stay hidden until the marker-pulse step in
 * the reveal phase — same visual beat as auto cast.
 */
function buildLinePresettlePhase(cast: Cast, model: CastModel): Step[] {
  return [
    call(() => {
      for (let i = 0; i < cast.lines.length; i++) {
        model.lines[i].settled = true;
        model.lines[i].progress = 1;
      }
    }),
    // Brief beat before the reveal phase starts.
    wait(400),
  ];
}

/**
 * Reveal phase: stillness, whole-figure glow, primary glyph reveal, title,
 * then either the becoming sequence (marker pulse → split/morph → becoming
 * glyph → exploration) or the no-becoming hold.
 *
 * Shared by all reveal paths (auto cast, manual cast). The line phase that
 * precedes it differs; everything from here on is the same.
 */
function buildRevealPhase(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
  termWidth: number,
  glyphConfig?: CastGlyphConfig,
): Step[] {
  return [
    // Final stillness
    wait(timing.finalStillMs),

    // Whole-figure glow
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

    // Primary glyph reveal (if config provided)
    ...(glyphConfig
      ? [
          wait(200),
          ...buildGlyphReveal(GUA[cast.primary - 1].n, "primary", model, glyphConfig, timing),
        ]
      : []),

    // Title reveal
    tween(timing.titleStaggerMs > 0 ? 400 : 1, (p) => {
      model.titleProgress = p;
    }, easeOut),

    // Becoming or unchanging
    ...(cast.becoming !== null
      ? canSplit(termWidth)
        ? buildWideBecoming(cast, model, timing, glyphConfig)
        : buildNarrowBecoming(cast, model, timing, glyphConfig)
      : buildUnchangingHold(model, timing)),
  ];
}

/**
 * No-becoming tail: hold, clear subtitle, rest, show prompt.
 * Becoming paths set showPrompt themselves via buildEnterExploration.
 */
function buildUnchangingHold(model: CastModel, timing: RitualTiming): Step[] {
  return [
    wait(1200),
    call(() => {
      model.subtitleText = "";
    }),
    wait(timing.restMs),
    call(() => {
      model.showPrompt = true;
    }),
  ];
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
  glyphConfig?: CastGlyphConfig,
): Step[] {
  return [
    wait(680),
    ...buildMarkerPulse(cast, model),
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
    // Becoming glyph reveal
    ...(glyphConfig && cast.becoming !== null
      ? [
          ...buildGlyphReveal(GUA[cast.becoming! - 1].n, "becoming", model, glyphConfig, timing),
          ...buildEnterExploration(model),
        ]
      : cast.becoming !== null
        ? [
            call(() => { model.focusedHex = "becoming"; }),
            ...buildEnterExploration(model),
          ]
        : []),
  ];
}

/**
 * Narrow terminal becoming sequence: in-place morph (original behavior).
 */
function buildNarrowBecoming(
  cast: Cast,
  model: CastModel,
  timing: RitualTiming,
  glyphConfig?: CastGlyphConfig,
): Step[] {
  return [
    wait(680),
    ...buildMarkerPulse(cast, model),
    ...buildMorphWave(cast, model, timing),
    tween(timing.compareRevealMs > 0 ? timing.compareRevealMs : 1, (p) => {
      model.becomingTitleProgress = p;
    }, easeOut),
    ...(glyphConfig && cast.becoming !== null
      ? [
          ...buildGlyphReveal(GUA[cast.becoming! - 1].n, "becoming", model, glyphConfig, timing),
          ...buildEnterExploration(model),
        ]
      : cast.becoming !== null
        ? [
            call(() => { model.focusedHex = "becoming"; }),
            ...buildEnterExploration(model),
          ]
        : []),
  ];
}

// ── Extracted helpers: state groups that are always set together ──

/** Marker pulse: glow all changing lines, then settle with markers visible. */
function buildMarkerPulse(cast: Cast, model: CastModel): Step[] {
  return [
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
  ];
}

/**
 * Start a glyph reveal: compose + create animator, motion-preset aware.
 * The hold matches the chosen style's actual run time (dilated by
 * glyphAnimScale) so slow styles aren't truncated and fast styles don't
 * sit in dead stillness. A scale of 0 (reduced motion) skips the animation
 * entirely — the settled glyph appears at once, then only the breath plays.
 */
function buildGlyphReveal(
  hexName: string,
  target: "primary" | "becoming",
  model: CastModel,
  glyphConfig: CastGlyphConfig,
  timing: RitualTiming,
): Step[] {
  const animMs = Math.round(GLYPH_ANIM_DURATION_MS[glyphConfig.glyphAnim] * timing.glyphAnimScale);
  return [
    call(() => {
      // zh-Hans renders the Simplified glyph so it matches the Simplified text.
      const name = glyphConfig.language === "zh-Hans" ? toSimplified(hexName) : hexName;
      const glyph = composeGlyph(name, glyphConfig.glyphFont, glyphConfig.glyphSize);
      if (glyph) {
        if (target === "primary") {
          model.primaryGlyphEntry = glyph;
        } else {
          model.becomingGlyphEntry = glyph;
          model.focusedHex = "becoming";
        }
        if (animMs > 0) {
          model.glyphAnimator = createGlyphAnimator(glyphConfig.glyphAnim, glyph, timing.glyphAnimScale);
          model.glyphAnimDone = false;
        } else {
          // Reduced motion: no animation — show the settled glyph immediately.
          model.glyphAnimator = null;
          model.glyphAnimDone = true;
        }
      }
    }),
    ...(animMs > 0 ? [wait(animMs)] : []),
    wait(timing.glyphBreathMs), // breath
  ];
}

/** Enter exploration mode: user can now ← → switch. */
function buildEnterExploration(model: CastModel): Step[] {
  return [
    call(() => {
      model.explorationMode = true;
      model.showPrompt = true;
    }),
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
