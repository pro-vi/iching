// Factory — create a GlyphAnimator by style name

import type { GlyphEntry } from "@iching/core";
import type { GlyphAnimator, GlyphAnimStyle } from "./types.ts";
import { NoiseAnimator } from "./noise.ts";
import { DotsAnimator } from "./dots.ts";
import { RadialAnimator } from "./radial.ts";
import { SandAnimator } from "./sand.ts";

/** Create a glyph animator for the given style and glyph data. */
export function createGlyphAnimator(
  style: GlyphAnimStyle,
  glyph: GlyphEntry,
): GlyphAnimator {
  switch (style) {
    case "noise":  return new NoiseAnimator(glyph);
    case "dots":   return new DotsAnimator(glyph);
    case "radial": return new RadialAnimator(glyph);
    case "sand":   return new SandAnimator(glyph);
  }
}
