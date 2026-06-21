// Factory — create a GlyphAnimator by style name

import type { GlyphEntry } from "@iching/core";
import type { GlyphAnimator, GlyphAnimStyle } from "./types.ts";
import { NoiseAnimator, NOISE_TOTAL_MS } from "./noise.ts";
import { DotsAnimator, DOTS_TOTAL_MS } from "./dots.ts";
import { RadialAnimator, RADIAL_TOTAL_MS } from "./radial.ts";
import { SandAnimator, SAND_TOTAL_MS } from "./sand.ts";

/**
 * Base run time (ms) of each style at durationScale 1. Timeline builders use
 * this to size the post-reveal hold so slow styles aren't truncated and fast
 * styles don't sit in dead stillness.
 */
export const GLYPH_ANIM_DURATION_MS: Record<GlyphAnimStyle, number> = {
  noise: NOISE_TOTAL_MS,
  dots: DOTS_TOTAL_MS,
  radial: RADIAL_TOTAL_MS,
  sand: SAND_TOTAL_MS,
};

/**
 * Create a glyph animator for the given style and glyph data.
 * `durationScale` dilates time per the motion preset (<1 plays faster).
 */
export function createGlyphAnimator(
  style: GlyphAnimStyle,
  glyph: GlyphEntry,
  durationScale: number = 1,
): GlyphAnimator {
  switch (style) {
    case "noise":  return new NoiseAnimator(glyph, durationScale);
    case "dots":   return new DotsAnimator(glyph, durationScale);
    case "radial": return new RadialAnimator(glyph, durationScale);
    case "sand":   return new SandAnimator(glyph, durationScale);
  }
}
