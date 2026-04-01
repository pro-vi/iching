// Glyph reveal animations — reusable animators for braille glyph display

export type { GlyphAnimator, GlyphAnimStyle } from "./types.ts";
export { createGlyphAnimator } from "./factory.ts";
export { NoiseAnimator } from "./noise.ts";
export { DotsAnimator } from "./dots.ts";
export { RadialAnimator } from "./radial.ts";
export { SandAnimator } from "./sand.ts";
export { composeGlyph } from "./compose.ts";
